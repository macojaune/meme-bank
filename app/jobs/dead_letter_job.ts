import type { Job } from 'bullmq'
import type { DeadLetterJobData, JobResult } from './types.js'
import logger from '@adonisjs/core/services/logger'

/**
 * Job processor for dead letter queue
 * Logs failed jobs for admin review
 */
export async function processDeadLetterJob(job: Job<DeadLetterJobData>): Promise<JobResult> {
  const { videoId, filePath, error, jobType, failedAt } = job.data

  console.error(`[DeadLetter] Failed job logged:`, {
    videoId,
    jobType,
    error,
    failedAt,
    jobId: job.id,
  })

  // Log to structured logger for monitoring/alerts
  logger.error(
    {
      type: 'dead_letter',
      videoId,
      filePath,
      jobType,
      error,
      failedAt,
      jobId: job.id,
    },
    'Job moved to dead letter queue after max retries'
  )

  // TODO: Could add notification logic here (email, Slack, etc.)
  // Example: await sendAdminNotification({ videoId, error, jobType })

  return {
    success: true,
    data: {
      videoId,
      jobType,
      loggedAt: new Date().toISOString(),
    },
  }
}

/**
 * Create and start the dead letter worker
 */
export async function createDeadLetterWorker() {
  const { default: QueueService } = await import('../services/queue_service.js')
  const queueService = new QueueService()

  return queueService.createWorker(
    'deadLetter',
    processDeadLetterJob as (job: any) => Promise<JobResult>
  )
}
