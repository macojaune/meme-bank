import type { Job } from 'bullmq'
import type { EmbeddingJobData, JobResult } from './types.js'
import { getAIServiceFactory } from '../services/ai/ai_factory.js'
import queueConfig from '#config/queue'

/**
 * Job processor for embedding jobs
 * Generates embeddings from transcription text for vector search
 */
export async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<JobResult> {
  const { videoId, transcription } = job.data

  console.log(`[Embedding] Processing job ${job.id} for video ${videoId}`)

  try {
    // Get the embedding service
    const aiFactory = getAIServiceFactory()
    const embeddingService = aiFactory.getEmbeddingService()

    // Check service health
    const health = await embeddingService.healthCheck()
    if (!health.healthy) {
      throw new Error(`Embedding service unhealthy: ${health.message}`)
    }

    // Generate embedding
    console.log(`[Embedding] Generating embedding for video ${videoId}`)
    const embedding = await embeddingService.generateEmbedding(transcription)

    console.log(`[Embedding] Completed for video ${videoId}, dimensions: ${embedding.length}`)

    // TODO: Store embedding in database (pgvector)

    return {
      success: true,
      data: {
        videoId,
        dimensions: embedding.length,
        embedding, // This would be stored in the database
      },
    }
  } catch (error) {
    console.error(`[Embedding] Job ${job.id} failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown embedding error',
    }
  }
}

/**
 * Create and start the embedding worker
 */
export async function createEmbeddingWorker() {
  const { default: QueueService } = await import('../services/queue_service.js')
  const queueService = new QueueService()

  return queueService.createWorker(queueConfig.queues.embedding.name, processEmbeddingJob)
}
