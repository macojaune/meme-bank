import { Queue, Worker, Job } from 'bullmq'
import queueConfig from '#config/queue'
import type { JobData, JobResult } from '../jobs/types.js'

export default class QueueService {
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()

  constructor() {
    this.initializeQueues()
  }

  private initializeQueues() {
    // Initialiser chaque queue définie dans la config
    for (const [key, config] of Object.entries(queueConfig.queues)) {
      const { connection: ignoredConnection, ...optsWithoutConnection } = config.opts || {}
      void ignoredConnection
      const queue = new Queue(config.name, {
        connection: queueConfig.connection,
        ...optsWithoutConnection,
      })
      this.queues.set(key, queue)
    }
  }

  /**
   * Ajouter un job à une queue
   */
  async addJob(queueName: string, data: JobData, opts?: any): Promise<Job> {
    const queue = this.queues.get(queueName)
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`)
    }

    return queue.add(queueName, data, opts)
  }

  /**
   * Obtenir une queue par son nom
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name)
  }

  /**
   * Créer un worker pour traiter les jobs
   * queueKey: 'transcription', 'embedding', 'videoProcessing', or 'deadLetter'
   */
  createWorker(queueKey: string, processor: (job: Job<JobData>) => Promise<JobResult>): Worker {
    const queue = this.queues.get(queueKey)
    if (!queue) {
      throw new Error(`Queue '${queueKey}' not found`)
    }

    const concurrency =
      queueConfig.workers.concurrency[queueKey as keyof typeof queueConfig.workers.concurrency] || 1

    // Get the actual queue name from the queue instance
    const actualQueueName = queue.name

    const worker = new Worker<JobData, JobResult>(actualQueueName, processor, {
      connection: queueConfig.connection,
      concurrency,
    })

    this.workers.set(queueKey, worker)

    // Gestion des erreurs
    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err)
    })

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`)
    })

    return worker
  }

  /**
   * Fermer proprement les queues et workers
   */
  async close(): Promise<void> {
    // Fermer les workers
    for (const [name, worker] of this.workers) {
      await worker.close()
      console.log(`Worker '${name}' closed`)
    }

    // Fermer les queues
    for (const [name, queue] of this.queues) {
      await queue.close()
      console.log(`Queue '${name}' closed`)
    }
  }
}
