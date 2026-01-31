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
      const { connection: _, ...optsWithoutConnection } = config.opts || {}
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
   */
  createWorker(queueName: string, processor: (job: Job<JobData>) => Promise<JobResult>): Worker {
    const concurrency =
      queueConfig.workers.concurrency[queueName as keyof typeof queueConfig.workers.concurrency] ||
      1

    const worker = new Worker<JobData, JobResult>(queueName, processor, {
      connection: queueConfig.connection,
      concurrency,
    })

    this.workers.set(queueName, worker)

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
