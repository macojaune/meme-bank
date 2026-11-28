import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import QueueService from '#services/queue_service'
import { createTranscriptionWorker } from '#jobs/transcription_job'
import { createEmbeddingWorker } from '#jobs/embedding_job'
import { processThumbnailJob } from '#jobs/thumbnail_job'
import { createDeadLetterWorker } from '#jobs/dead_letter_job'

export default class QueueWork extends BaseCommand {
  static commandName = 'queue:work'
  static description = 'Start queue workers to process jobs'

  @args.string({
    description: 'Queue name (transcription, embedding, deadLetter, or all)',
    required: false,
  })
  declare queue: string

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  async run() {
    const queueName = this.queue || 'all'

    this.logger.info(`Starting queue workers for: ${queueName}`)

    const workers: any[] = []

    try {
      if (queueName === 'all' || queueName === 'transcription') {
        this.logger.info('Starting transcription worker...')
        const transcriptionWorker = await createTranscriptionWorker()
        workers.push(transcriptionWorker)
      }

      if (queueName === 'all' || queueName === 'embedding') {
        this.logger.info('Starting embedding worker...')
        const embeddingWorker = await createEmbeddingWorker()
        workers.push(embeddingWorker)
      }

      if (queueName === 'all' || queueName === 'videoProcessing') {
        this.logger.info('Starting video processing (thumbnail) worker...')
        const queueService = new QueueService()
        const thumbnailWorker = queueService.createWorker(
          'videoProcessing',
          processThumbnailJob as (job: any) => Promise<any>
        )
        workers.push(thumbnailWorker)
      }

      if (queueName === 'all' || queueName === 'deadLetter') {
        this.logger.info('Starting dead letter worker...')
        const deadLetterWorker = await createDeadLetterWorker()
        workers.push(deadLetterWorker)
      }

      if (workers.length === 0) {
        this.logger.error(`Unknown queue: ${queueName}`)
        this.logger.info(
          'Available queues: transcription, embedding, videoProcessing, deadLetter, all'
        )
        return
      }

      this.logger.success(`${workers.length} worker(s) started. Waiting for jobs...`)

      // Handle graceful shutdown
      const shutdown = async () => {
        this.logger.info('Shutting down workers...')
        for (const worker of workers) {
          await worker.close()
        }
        const queueService = new QueueService()
        await queueService.close()
        process.exit(0)
      }

      process.on('SIGTERM', shutdown)
      process.on('SIGINT', shutdown)

      // Keep the process alive
      await new Promise(() => {})
    } catch (error) {
      this.logger.error('Failed to start workers:')
      console.error(error)
      process.exit(1)
    }
  }
}
