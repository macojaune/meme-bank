import { VIDEO_TERRITORIES } from '../../shared/video_territories.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import limits from 'memebank-upload/upload-limits.json' with { type: 'json' }
import { DateTime } from 'luxon'
import Video from '#models/video'
import Person from '#models/person'
import type User from '#models/user'
import VideoTranscription, { TranscriptionStatus } from '#models/video_transcription'
import VideoUploaded from '#events/video_uploaded'
import QueueService from '#services/queue_service'
import { privateBucketName, videoDisk } from '#services/video_storage'

type UploadDetails = {
  title: string
  description?: string
  region?: string
  personsData?: Array<{ id: string; name: string; socialMediaHandle?: string; platform?: string }>
  agent?: { publish: boolean; transcript: string | null }
}

type ImportReceipt = {
  id: string
  video_id: string | null
  fingerprint: string
  created: boolean
  dispatched: boolean
}

export function validatedVideo(request: HttpContext['request']) {
  return request.file('video', {
    size: limits.videoMiB * 1024 * 1024,
    extnames: ['mp4', 'webm', 'ogg', 'avi'],
  })
}

/**
 * Ensure bucket exists
 */
async function ensureBucket(privateUpload: boolean) {
  const { S3Client, CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3')
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY
  const endpoint = process.env.R2_ENDPOINT || process.env.MINIO_ENDPOINT || 'http://localhost:9000'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Object storage credentials are not configured')
  }

  // R2 buckets are provisioned outside the application. Object-scoped keys
  // should never need account-level permission to create buckets.
  if (process.env.R2_ENDPOINT) return

  const client = new S3Client({
    endpoint,
    region: process.env.R2_REGION || process.env.MINIO_REGION || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  })

  const Bucket = privateUpload ? privateBucketName() : process.env.MINIO_BUCKET || 'memes'
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket }))
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404
      ) {
        throw error
      }
      try {
        await client.send(new CreateBucketCommand({ Bucket }))
      } catch {
        // Another upload may have created the bucket after HEAD.
        await client.send(new HeadBucketCommand({ Bucket }))
      }
    }
  } finally {
    client.destroy()
  }
}

async function writeVideo(
  client: TransactionClientContract,
  user: User,
  filePath: string,
  file: MultipartFile,
  { title, description, region, personsData, agent }: UploadDetails
) {
  await ensureBucket(!!agent)
  const stream = createReadStream(file.tmpPath!)
  try {
    await videoDisk(!!agent).putStream(filePath, stream, { contentLength: file.size })
  } finally {
    stream.destroy()
  }
  const video = await Video.create(
    {
      userId: user.id,
      title,
      description,
      filePath,
      thumbnailPath: null,
      durationSeconds: 0,
      uploadDate: DateTime.now(),
      isPublished: agent?.publish ?? false,
      skipAutoTranscription: !!agent,
      isFeatured: false,
      viewCount: 0,
      likeCount: 0,
      region: VIDEO_TERRITORIES.some(({ id }) => id === region) ? region : null,
    },
    { client }
  )

  // Attach persons to video if provided
  if (personsData && Array.isArray(personsData) && personsData.length > 0) {
    const personIds: string[] = []

    for (const personData of personsData) {
      let person: Person | null = null

      if (personData.id && personData.id.startsWith('temp-')) {
        // Create new person for temporary IDs
        person = await Person.create(
          {
            name: personData.name,
            socialMediaHandle: personData.socialMediaHandle || null,
            platform: personData.platform || null,
            bio: null,
          },
          { client }
        )
      } else if (personData.id) {
        // Find existing person by ID
        person = await Person.find(personData.id, { client })
      }

      if (person) {
        personIds.push(person.id)
      }
    }

    // Attach all persons to the video
    if (personIds.length > 0) {
      await video.related('persons').attach(personIds)
    }
  }

  if (agent?.transcript) {
    await VideoTranscription.create(
      {
        videoId: video.id,
        revisionNumber: 1,
        status: TranscriptionStatus.IMPORTED,
        transcriptionText: agent.transcript,
        language: 'fr',
        correctedByUserId: user.id,
        isCurrent: true,
        pointsAwarded: 0,
        generatedAt: DateTime.now(),
      },
      { client }
    )
  }
  return video
}

export async function persistWebUpload(file: MultipartFile, user: User, details: UploadDetails) {
  const filePath = `videos/${randomUUID()}.${file.extname || 'mp4'}`
  return db.transaction((client) => writeVideo(client, user, filePath, file, details))
}

export class ImportConflict extends Error {}

export async function importVideo(
  file: MultipartFile,
  user: User,
  key: string,
  details: UploadDetails & { agent: NonNullable<UploadDetails['agent']> }
) {
  const ext = file.extname || 'mp4'
  const hash = createHash('sha256').update(JSON.stringify([ext, details.title, details.agent]))
  for await (const chunk of createReadStream(file.tmpPath!)) hash.update(chunk)
  const fingerprint = hash.digest('hex')

  // Commit the reservation first so a retry after a storage write uses the same key.
  await db.rawQuery(
    'insert into agent_video_imports (id, user_id, key, fingerprint) values (?, ?, ?, ?) on conflict (user_id, key) do nothing',
    [randomUUID(), user.id, key, fingerprint]
  )

  const query = (client: TransactionClientContract) =>
    client.from('agent_video_imports').where({ user_id: user.id, key })

  const result = await db.transaction(async (client) => {
    const receipt: ImportReceipt = await query(client).forUpdate().firstOrFail()
    if (receipt.fingerprint !== fingerprint) {
      throw new ImportConflict('Cette clé correspond déjà à un autre import.')
    }
    if (receipt.created) {
      if (!receipt.video_id) throw new ImportConflict('La vidéo de cet import a été supprimée.')
      return { video: await Video.findOrFail(receipt.video_id, { client }), replayed: true }
    }
    const video = await writeVideo(client, user, `videos/${receipt.id}.${ext}`, file, details)
    await query(client).update({ video_id: video.id, created: true })
    return { video, replayed: false }
  })

  // CLI uploads are complete once stored. The upload event still credits the
  // owner and can be retried independently of the web processing queues.
  await db.transaction(async (client) => {
    const receipt: ImportReceipt = await query(client).forUpdate().firstOrFail()
    if (!receipt.video_id) throw new ImportConflict('La vidéo de cet import a été supprimée.')
    if (receipt.dispatched) return
    await emitter.emit(VideoUploaded, new VideoUploaded(result.video, user))
    await query(client).update({ dispatched: true })
  })
  return result
}

export async function dispatchWebVideoUpload(video: Video, user: User) {
  const queue = new QueueService({ enableOfflineQueue: false, maxRetriesPerRequest: 1 })
  try {
    await queue.addJob('transcription', {
      videoId: video.id,
      filePath: video.filePath,
      language: 'fr',
    })
  } catch {
    logger.warn({ videoId: video.id }, 'Video processing queue unavailable')
  } finally {
    await queue.close()
  }

  await emitter.emit(VideoUploaded, new VideoUploaded(video, user))
}
