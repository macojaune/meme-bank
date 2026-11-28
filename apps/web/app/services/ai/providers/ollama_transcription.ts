import type {
  AITranscriptionService,
  TranscriptionResult,
  TranscriptionOptions,
} from '../ai_interfaces.js'
import aiConfig from '../ai_config.js'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'

/**
 * Ollama implementation of the transcription service
 * Uses Ollama's Whisper model for audio/video transcription
 */
export class OllamaTranscriptionService implements AITranscriptionService {
  private baseUrl: string
  private model: string
  private supportedExtensions = [
    '.mp4',
    '.mp3',
    '.wav',
    '.m4a',
    '.webm',
    '.ogg',
    '.mov',
    '.avi',
    '.mkv',
  ]

  constructor() {
    this.baseUrl = aiConfig.ollama.baseUrl
    this.model = aiConfig.ollama.transcriptionModel
  }

  async transcribe(filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    try {
      // Validate file first
      const validation = this.validateFile(filePath)
      if (!validation.valid) {
        return {
          text: '',
          language: options?.language || 'auto',
          error: validation.error,
        }
      }

      // Check file exists and get stats
      const stats = await stat(filePath)
      if (stats.size === 0) {
        return {
          text: '',
          language: options?.language || 'auto',
          error: 'File is empty',
        }
      }

      // For now, we'll simulate the transcription
      // In production, this would call Ollama's Whisper API
      // Note: Ollama doesn't have built-in Whisper support yet,
      // so this is a placeholder for when it does or for using a local Whisper instance

      console.log(`Transcribing file: ${filePath} with Ollama model: ${this.model}`)

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // For now, return a placeholder result
      // TODO: Implement actual Ollama Whisper API call
      return {
        text: `[Transcription placeholder for: ${filePath}]`,
        language: options?.language || 'fr',
        segments: options?.includeTimestamps
          ? [
              { start: 0, end: 5, text: 'Segment 1 placeholder' },
              { start: 5, end: 10, text: 'Segment 2 placeholder' },
            ]
          : undefined,
        duration: 10,
      }
    } catch (error) {
      console.error('Transcription error:', error)
      return {
        text: '',
        language: options?.language || 'auto',
        error: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        return {
          healthy: false,
          message: `Ollama server returned ${response.status}`,
        }
      }

      const data = (await response.json()) as { models?: Array<{ name?: string }> }
      const models = data.models || []
      const hasModel = models.some((m) => m.name?.includes(this.model))

      if (!hasModel) {
        return {
          healthy: false,
          message: `Model '${this.model}' not found. Available models: ${models.map((m: any) => m.name).join(', ')}`,
        }
      }

      return { healthy: true }
    } catch (error) {
      return {
        healthy: false,
        message: `Cannot connect to Ollama server at ${this.baseUrl}`,
      }
    }
  }

  getSupportedLanguages(): string[] {
    return aiConfig.supportedLanguages
  }

  validateFile(filePath: string): { valid: boolean; error?: string } {
    const ext = extname(filePath).toLowerCase()

    if (!this.supportedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported file format: ${ext}. Supported: ${this.supportedExtensions.join(', ')}`,
      }
    }

    return { valid: true }
  }
}
