import type { Job } from 'bullmq'
import type { TranscriptionJobData, JobResult } from './types.js'
import { getAIServiceFactory } from '../services/ai/ai_factory.js'
import VideoTranscription, { TranscriptionStatus } from '../models/video_transcription.js'
import QueueService from '../services/queue_service.js'
import queueConfig from '#config/queue'
import { DateTime } from 'luxon'
import Video from '../models/video.js'

const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 15000, 45000] // 5s, 15s, 45s (backoff exponentiel)

/**
 * Sleep function for delays between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Job processor for transcription jobs with retry logic
 * Downloads video from S3, transcribes it, and stores the result
 */
export async function processTranscriptionJob(job: Job<TranscriptionJobData>): Promise<JobResult> {
  const { videoId, filePath, language } = job.data
  const attempts = job.attemptsMade || 0

  console.log(
    `[Transcription] Processing job ${job.id} for video ${videoId} (attempt ${attempts + 1}/${MAX_RETRIES})`
  )

  try {
    // Get the transcription service
    const aiFactory = getAIServiceFactory()
    const transcriptionService = aiFactory.getTranscriptionService()

    // Check service health
    const health = await transcriptionService.healthCheck()
    if (!health.healthy) {
      throw new Error(`Transcription service unhealthy: ${health.message}`)
    }

    // Perform transcription
    console.log(`[Transcription] Starting transcription for ${filePath}`)
    const result = await transcriptionService.transcribe(filePath, {
      language: language || 'fr',
      includeTimestamps: true,
    })

    if (result.error) {
      throw new Error(result.error)
    }

    console.log(
      `[Transcription] Completed for video ${videoId}, text length: ${result.text.length}`
    )

    // Store transcription in database
    const transcription = await VideoTranscription.create({
      videoId: videoId,
      revisionNumber: 1,
      status: TranscriptionStatus.AUTO_GENERATED,
      transcriptionText: result.text,
      language: result.language,
      confidence: result.confidence || null,
      isCurrent: true,
      segmentsJson: result.segments ? JSON.stringify(result.segments) : null,
      pointsAwarded: 0,
      generatedAt: DateTime.now(),
    })

    console.log(`[Transcription] Stored in database with id: ${transcription.id}`)

    // Auto-publish video if transcription has content
    if (result.text && result.text.trim().length > 0) {
      try {
        const video = await Video.find(videoId)
        if (video && !video.isPublished) {
          video.isPublished = true
          await video.save()
          console.log(`[Transcription] Video ${videoId} auto-published (transcription ready)`)
        }
      } catch (publishError) {
        console.error(`[Transcription] Failed to auto-publish video ${videoId}:`, publishError)
      }
    }

    // Queue embedding job with the transcription text
    try {
      const queueService = new QueueService()
      await queueService.addJob('embedding', {
        videoId: videoId,
        transcription: result.text,
      })
      console.log(`[Transcription] Embedding job queued for video ${videoId}`)
    } catch (queueError) {
      console.error('[Transcription] Failed to queue embedding job:', queueError)
    }

    // Queue thumbnail generation job
    try {
      const queueService = new QueueService()
      await queueService.addJob('videoProcessing', {
        videoId: videoId,
        filePath: filePath,
      })
      console.log(`[Transcription] Thumbnail job queued for video ${videoId}`)
    } catch (queueError) {
      console.error('[Transcription] Failed to queue thumbnail job:', queueError)
    }

    return {
      success: true,
      data: {
        videoId,
        text: result.text,
        language: result.language,
        segments: result.segments,
        duration: result.duration,
      },
    }
  } catch (error) {
    console.error(`[Transcription] Job ${job.id} failed (attempt ${attempts + 1}):`, error)

    // Check if we should retry
    if (attempts < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS[attempts] || 45000
      console.log(`[Transcription] Retrying in ${delay}ms...`)
      await sleep(delay)

      // Throw error to trigger BullMQ retry mechanism
      throw error
    }

    // Max retries reached - mark as failed
    console.error(`[Transcription] Max retries (${MAX_RETRIES}) reached for video ${videoId}`)

    // Store failed transcription record
    try {
      await VideoTranscription.create({
        videoId: videoId,
        revisionNumber: 1,
        status: TranscriptionStatus.FAILED,
        transcriptionText: '',
        language: language || 'fr',
        confidence: null,
        isCurrent: true,
        segmentsJson: null,
        pointsAwarded: 0,
        generatedAt: DateTime.now(),
      })

      // Send to dead letter queue for admin review
      const queueService = new QueueService()
      await queueService.addJob('deadLetter', {
        videoId: videoId,
        filePath: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        jobType: 'transcription',
        failedAt: DateTime.now().toISO(),
      })
    } catch (dbError) {
      console.error('[Transcription] Failed to store failed transcription:', dbError)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transcription error',
    }
  }
}

/**
 * Create and start the transcription worker
 */
export async function createTranscriptionWorker() {
  const { default: QueueService } = await import('../services/queue_service.js')
  const queueService = new QueueService()

  return queueService.createWorker(
    'transcription',
    processTranscriptionJob as (job: any) => Promise<JobResult>
  )
}
