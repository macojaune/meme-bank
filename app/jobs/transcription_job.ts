import type { Job } from 'bullmq'
import type { TranscriptionJobData, JobResult } from './types.js'
import { getAIServiceFactory } from '../services/ai/ai_factory.js'
import VideoTranscription, { TranscriptionStatus } from '../models/video_transcription.js'
import QueueService from '../services/queue_service.js'
import queueConfig from '#config/queue'
import { DateTime } from 'luxon'

/**
 * Job processor for transcription jobs
 * Downloads video from S3, transcribes it, and stores the result
 */
export async function processTranscriptionJob(job: Job<TranscriptionJobData>): Promise<JobResult> {
  const { videoId, filePath, language } = job.data

  console.log(`[Transcription] Processing job ${job.id} for video ${videoId}`)

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

    // Queue embedding job with the transcription text
    try {
      const queueService = new QueueService()
      await queueService.addJob(queueConfig.queues.embedding.name, {
        videoId: videoId,
        transcription: result.text,
      })
      console.log(`[Transcription] Embedding job queued for video ${videoId}`)
    } catch (queueError) {
      console.error('[Transcription] Failed to queue embedding job:', queueError)
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
    console.error(`[Transcription] Job ${job.id} failed:`, error)
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

  return queueService.createWorker(queueConfig.queues.transcription.name, processTranscriptionJob)
}
