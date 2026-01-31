/**
 * Result of a transcription operation
 */
export interface TranscriptionResult {
  /** The transcribed text */
  text: string
  /** Language detected/used */
  language: string
  /** Confidence score (0-1) */
  confidence?: number
  /** Segments with timestamps */
  segments?: TranscriptionSegment[]
  /** Total duration of audio/video */
  duration?: number
  /** Error message if failed */
  error?: string
}

/**
 * A single segment of transcription with timing
 */
export interface TranscriptionSegment {
  /** Start time in seconds */
  start: number
  /** End time in seconds */
  end: number
  /** Transcribed text for this segment */
  text: string
  /** Confidence for this segment */
  confidence?: number
}

/**
 * Options for transcription
 */
export interface TranscriptionOptions {
  /** Language hint (e.g., 'fr', 'en') */
  language?: string
  /** Whether to include timestamps */
  includeTimestamps?: boolean
  /** Whether to translate to English */
  translate?: boolean
  /** Custom prompt for the model */
  prompt?: string
}

/**
 * Interface for transcription services
 * Implementations can use Whisper, Ollama, or any other transcription provider
 */
export interface AITranscriptionService {
  /**
   * Transcribe audio/video file
   * @param filePath Path to the media file
   * @param options Transcription options
   * @returns Promise with transcription result
   */
  transcribe(filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult>

  /**
   * Check if the service is available/healthy
   * @returns Promise with health status
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>

  /**
   * Get supported languages
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): string[]

  /**
   * Validate if file can be transcribed
   * @param filePath Path to the file
   * @returns Validation result
   */
  validateFile(filePath: string): { valid: boolean; error?: string }
}

/**
 * Interface for embedding services
 * Implementations can use Ollama, OpenAI, or any other embedding provider
 */
export interface AIEmbeddingService {
  /**
   * Generate embedding vector from text
   * @param text Text to embed
   * @returns Promise with embedding array
   */
  generateEmbedding(text: string): Promise<number[]>

  /**
   * Generate embeddings for multiple texts
   * @param texts Array of texts to embed
   * @returns Promise with array of embeddings
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>

  /**
   * Check if the service is available/healthy
   * @returns Promise with health status
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>

  /**
   * Get the dimension of embeddings
   * @returns Number of dimensions
   */
  getDimensions(): number
}

/**
 * AI Service Factory interface
 */
export interface AIServiceFactory {
  getTranscriptionService(): AITranscriptionService
  getEmbeddingService(): AIEmbeddingService
}
