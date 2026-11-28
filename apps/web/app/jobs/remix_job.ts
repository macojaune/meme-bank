import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { Job } from 'bullmq'
import limits from 'memebank-upload/upload-limits.json' with { type: 'json' }
import Video from '#models/video'
import VideoRemix from '#models/video_remix'
import { completeRemix, getRemixSource, SOURCE_UNAVAILABLE } from '#services/video_remix'
import { videoAssetStream, videoDisk } from '#services/video_storage'
import type { JobData, JobResult } from './types.js'

const execute = promisify(execFile)
const MAX_BYTES = limits.videoMiB * 1024 * 1024
const TRANSFER_TIMEOUT_MS = 60_000
const FORMAT_INPUT_ARGS = [
  '-protocol_whitelist',
  'file',
  '-format_whitelist',
  'mov,matroska,ogg,avi',
]
const PROCESSING_ERROR = 'Impossible de créer cet extrait. Réessaie avec un nouvel extrait.'

class InvalidRemix extends Error {}

function runTool(tool: 'ffmpeg' | 'ffprobe', args: string[], timeout: number) {
  return execute(tool, args, {
    timeout,
    killSignal: 'SIGKILL',
    maxBuffer: 512 * 1024,
    env: { PATH: process.env.PATH, LANG: 'C' },
  })
}

async function downloadSource(video: Video, destination: string) {
  let inputBytes = 0
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      inputBytes += chunk.length
      if (inputBytes > MAX_BYTES) {
        callback(new InvalidRemix(`La vidéo d’origine dépasse ${limits.videoMiB} Mio.`))
        return
      }
      callback(null, chunk)
    },
  })
  const source = await videoAssetStream(video.filePath, video.skipAutoTranscription)
  await pipeline(source, cap, createWriteStream(destination, { flags: 'wx' }), {
    signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
  })
}

async function probe(path: string) {
  try {
    const { stdout } = await runTool(
      'ffprobe',
      [
        '-v',
        'error',
        ...FORMAT_INPUT_ARGS,
        '-select_streams',
        'V:0',
        '-show_entries',
        'format=duration:stream=width,height',
        '-of',
        'json',
        path,
      ],
      15_000
    )
    const result = JSON.parse(stdout) as {
      format?: { duration?: string }
      streams?: Array<{ width?: number; height?: number }>
    }
    const duration = Number(result.format?.duration)
    const stream = result.streams?.[0]
    if (!Number.isFinite(duration) || duration <= 0 || !stream?.width || !stream.height) return null
    return { duration, width: stream.width, height: stream.height }
  } catch {
    return null
  }
}

async function extract(remix: VideoRemix, inputPath: string, outputPath: string) {
  const input = await probe(inputPath)
  if (!input)
    throw new InvalidRemix('La vidéo d’origine est illisible ou son format est incompatible.')
  if (input.width > 4096 || input.height > 4096) {
    throw new InvalidRemix('La définition de la vidéo d’origine dépasse 4096 pixels.')
  }
  if (remix.endMs > Math.round(input.duration * 1000)) {
    throw new InvalidRemix('La fin de l’extrait dépasse la durée de la vidéo d’origine.')
  }

  const duration = (remix.endMs - remix.startMs) / 1000
  await runTool(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      ...FORMAT_INPUT_ARGS,
      '-threads',
      '2',
      '-ss',
      (remix.startMs / 1000).toFixed(3),
      '-i',
      inputPath,
      '-t',
      duration.toFixed(3),
      '-map',
      '0:V:0',
      '-map',
      '0:a:0?',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-vf',
      'scale=w=min(1080\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-fpsmax',
      '30',
      '-c:v',
      'libx264',
      '-threads:v',
      '2',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-fs',
      String(MAX_BYTES + 1),
      outputPath,
    ],
    120_000
  )
  const { size } = await stat(outputPath)
  if (size > MAX_BYTES) throw new InvalidRemix(`L’extrait dépasse ${limits.videoMiB} Mio.`)
  const output = await probe(outputPath)
  if (!output || Math.abs(output.duration - duration) > Math.min(0.15, duration / 2)) {
    throw new InvalidRemix('Le montage n’a pas produit un extrait complet.')
  }
  return { size, durationSeconds: Math.max(1, Math.round(output.duration)) }
}

async function claim(remixId: string, token: string) {
  return db.transaction(async (client) => {
    const remix = await VideoRemix.query({ client }).where('id', remixId).forUpdate().first()
    if (!remix || remix.status === 'failed' || remix.status === 'ready') return null

    const previousToken = remix.processingToken
    await remix.merge({ status: 'processing', error: null, processingToken: token }).save()
    return { remix, previousToken }
  })
}

function attemptKey(remixId: string, token: string) {
  return `videos/remixes/${remixId}-${token}.mp4`
}

async function removeUnattached(key: string) {
  try {
    // A transaction can succeed even if its acknowledgement is lost.
    if (!(await Video.query().where('file_path', key).first())) await videoDisk(true).delete(key)
  } catch (err) {
    logger.warn({ err, key }, 'Could not clean up remix attempt')
  }
}

async function uploadOutput(key: string, path: string, size: number) {
  const input = createReadStream(path)
  const timer = setTimeout(
    () => input.destroy(new Error('Remix storage timed out')),
    TRANSFER_TIMEOUT_MS
  )
  try {
    await videoDisk(true).putStream(key, input, { contentLength: size, contentType: 'video/mp4' })
  } finally {
    clearTimeout(timer)
    input.destroy()
  }
}

export async function processRemixJob(job: Job<JobData>): Promise<JobResult> {
  if (!('remixId' in job.data)) throw new Error('Missing remix job ID')
  const { remixId } = job.data
  const token = randomUUID()
  const claimed = await claim(remixId, token)
  if (!claimed) return { success: true }
  const { remix, previousToken } = claimed
  const key = attemptKey(remixId, token)
  let directory: string | undefined
  let uploaded = false
  let finalized = false

  try {
    if (previousToken) await removeUnattached(attemptKey(remixId, previousToken))
    const source = await getRemixSource(remix)
    if (!source) throw new InvalidRemix(SOURCE_UNAVAILABLE)
    directory = await mkdtemp(join(tmpdir(), 'memebank-remix-'))
    const inputPath = join(directory, 'source')
    const outputPath = join(directory, 'excerpt.mp4')

    await downloadSource(source, inputPath)
    const { size, durationSeconds } = await extract(remix, inputPath, outputPath)
    uploaded = true
    await uploadOutput(key, outputPath, size)
    finalized = await completeRemix(remixId, token, key, durationSeconds)
    return { success: finalized }
  } catch (err) {
    const invalid = err instanceof InvalidRemix
    const retry = !invalid && job.attemptsMade + 1 < (job.opts.attempts ?? 1)
    const error = invalid ? err.message : PROCESSING_ERROR
    await VideoRemix.query()
      .where({ id: remixId, status: 'processing', processingToken: token })
      .update({ status: retry ? 'queued' : 'failed', error: retry ? null : error })
    if (!invalid) throw err
    return { success: false, error }
  } finally {
    if (uploaded && !finalized) await removeUnattached(key)
    if (directory) {
      await rm(directory, { recursive: true, force: true }).catch((err) => {
        logger.warn({ err, remixId }, 'Could not clean up temporary remix files')
      })
    }
  }
}

/** BullMQ can fail a repeatedly stalled job without invoking the processor again. */
export async function recordExhaustedRemix(job?: Job<JobData>) {
  if (!job || !('remixId' in job.data) || (await job.getState()) !== 'failed') return
  const { remixId } = job.data
  const token = await db.transaction(async (client) => {
    const remix = await VideoRemix.query({ client }).where('id', remixId).forUpdate().first()
    if (!remix || remix.status === 'ready' || remix.status === 'failed') return null

    const abandonedToken = remix.processingToken
    await remix.merge({ status: 'failed', error: PROCESSING_ERROR, processingToken: null }).save()
    return abandonedToken
  })
  if (token) await removeUnattached(attemptKey(remixId, token))
}
