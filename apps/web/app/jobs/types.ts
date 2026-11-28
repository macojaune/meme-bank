// Types pour les jobs de la file d'attente

export interface TranscriptionJobData {
  videoId: string
  filePath: string
  language?: string
}

export interface EmbeddingJobData {
  videoId: string
  transcription: string
}

export interface VideoProcessingJobData {
  videoId: string
  filePath: string
}

export interface DeadLetterJobData {
  videoId: string
  filePath: string
  error: string
  jobType: 'transcription' | 'embedding' | 'videoProcessing'
  failedAt: string
}

export type JobData =
  | TranscriptionJobData
  | EmbeddingJobData
  | VideoProcessingJobData
  | DeadLetterJobData

export interface JobResult {
  success: boolean
  data?: any
  error?: string
}
