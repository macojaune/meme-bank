import { createHash, randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Video from '#models/video'
import VideoRemix from '#models/video_remix'
import QueueService from '#services/queue_service'
import { canViewVideo } from '#services/video_access'

export const MIN_REMIX_DURATION_MS = 100
export const MAX_REMIX_DURATION_MS = 60_000
export const SOURCE_UNAVAILABLE = 'La vidéo d’origine est indisponible.'

type RemixSelection = { title: string; startMs: number; endMs: number }

export function viewRemix(remix: VideoRemix) {
  if (remix.status === 'ready' && !remix.videoId) {
    return { id: remix.id, status: 'failed', videoId: null, error: 'Cet extrait a été supprimé.' }
  }
  return { id: remix.id, status: remix.status, videoId: remix.videoId, error: remix.error }
}

export async function reserveRemix(
  requesterId: string,
  sourceVideoId: string,
  key: string,
  { title, startMs, endMs }: RemixSelection
) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([sourceVideoId, title, startMs, endMs]))
    .digest('hex')

  return db.transaction(async (client) => {
    const criteria = { requesterId, idempotencyKey: key }
    const existing = await VideoRemix.query({ client }).where(criteria).first()
    if (!existing) {
      const source = await Video.query({ client }).where('id', sourceVideoId).forShare().first()
      if (!source || !canViewVideo(source, requesterId)) return { kind: 'not_found' } as const

      await client.rawQuery(
        'insert into video_remixes (id, requester_id, source_video_id, idempotency_key, fingerprint, title, start_ms, end_ms, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, now(), now()) on conflict (requester_id, idempotency_key) do nothing',
        [randomUUID(), requesterId, source.id, key, fingerprint, title, startMs, endMs]
      )
    }

    const remix = existing ?? (await VideoRemix.query({ client }).where(criteria).firstOrFail())
    return remix.fingerprint === fingerprint
      ? ({ kind: 'reserved', remix } as const)
      : ({ kind: 'conflict' } as const)
  })
}

export async function enqueueRemix(remixId: string) {
  const queue = new QueueService({
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
  })
  try {
    await queue.addJob('remix', { remixId }, { jobId: `video-remix-${remixId}` })
    return true
  } catch {
    logger.warn({ remixId }, 'Remix queue unavailable')
    return false
  } finally {
    await queue.close()
  }
}

export function getRemixSource(remix: VideoRemix, client?: TransactionClientContract) {
  if (!remix.sourceVideoId) return Promise.resolve(null)
  const query = Video.query({ client }).where('id', remix.sourceVideoId)
  if (client) query.forShare()
  return query.first().then((source) => {
    return source && canViewVideo(source, remix.requesterId) ? source : null
  })
}

export async function completeRemix(
  remixId: string,
  token: string,
  filePath: string,
  durationSeconds: number
) {
  return db.transaction(async (client) => {
    const pending = await VideoRemix.find(remixId, { client })
    if (!pending || pending.processingToken !== token) return false

    // Lock the source first, in the same order as a delete that clears the foreign key.
    const source = await getRemixSource(pending, client)
    const current = await VideoRemix.query({ client }).where('id', remixId).forUpdate().first()
    if (!current || current.status !== 'processing' || current.processingToken !== token)
      return false

    if (!source || current.sourceVideoId !== source.id) {
      await current
        .merge({ status: 'failed', error: SOURCE_UNAVAILABLE, processingToken: null })
        .save()
      return false
    }

    const video = await Video.create(
      {
        userId: current.requesterId,
        title: current.title,
        filePath,
        thumbnailPath: null,
        durationSeconds,
        uploadDate: DateTime.now(),
        isPublished: false,
        skipAutoTranscription: true,
        remixedFromVideoId: source.id,
        isFeatured: false,
        viewCount: 0,
        likeCount: 0,
      },
      { client }
    )

    await current.merge({ status: 'ready', videoId: video.id, processingToken: null }).save()
    return true
  })
}
