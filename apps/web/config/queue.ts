import { QueueOptions } from 'bullmq'

export default {
  // Connexion Redis par défaut
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
  },

  // Configuration des queues
  queues: {
    // Transcription des vidéos
    transcription: {
      name: 'transcription',
      opts: {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      } as QueueOptions,
    },

    // Génération des embeddings
    embedding: {
      name: 'embedding',
      opts: {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      } as QueueOptions,
    },

    // Traitement des vidéos (thumbnail, etc.)
    videoProcessing: {
      name: 'video-processing',
      opts: {
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      } as QueueOptions,
    },

    // Dead letter queue pour les jobs échoués
    deadLetter: {
      name: 'dead-letter',
      opts: {
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: false, // Garder les jobs échoués pour review
        },
      } as QueueOptions,
    },
  },

  // Configuration des workers
  workers: {
    // Nombre de workers concurrents par queue
    concurrency: {
      transcription: 2,
      embedding: 3,
      videoProcessing: 1,
    },
  },
}
