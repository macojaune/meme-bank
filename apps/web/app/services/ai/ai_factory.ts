import type {
  AITranscriptionService,
  AIEmbeddingService,
  AIServiceFactory,
} from './ai_interfaces.js'
import { WhisperCppTranscriptionService } from './providers/whisper_cpp_transcription.js'
import { OllamaTranscriptionService } from './providers/ollama_transcription.js'
import { OllamaEmbeddingService } from './providers/ollama_embeddings.js'
import aiConfig from './ai_config.js'

/**
 * Factory for creating AI service instances
 * Supports multiple providers (Ollama, OpenAI, etc.)
 */
export class DefaultAIServiceFactory implements AIServiceFactory {
  private transcriptionService: AITranscriptionService | null = null
  private embeddingService: AIEmbeddingService | null = null

  getTranscriptionService(): AITranscriptionService {
    if (!this.transcriptionService) {
      switch (aiConfig.provider) {
        case 'whispercpp':
          this.transcriptionService = new WhisperCppTranscriptionService()
          break
        case 'ollama':
          this.transcriptionService = new OllamaTranscriptionService()
          break
        case 'openai':
          // TODO: Implement OpenAI transcription service
          throw new Error('OpenAI transcription service not yet implemented')
        default:
          this.transcriptionService = new WhisperCppTranscriptionService()
      }
    }
    return this.transcriptionService
  }

  getEmbeddingService(): AIEmbeddingService {
    if (!this.embeddingService) {
      switch (aiConfig.provider) {
        case 'ollama':
          this.embeddingService = new OllamaEmbeddingService()
          break
        case 'openai':
          // TODO: Implement OpenAI embedding service
          throw new Error('OpenAI embedding service not yet implemented')
        default:
          this.embeddingService = new OllamaEmbeddingService()
      }
    }
    return this.embeddingService
  }
}

// Singleton instance
let factoryInstance: DefaultAIServiceFactory | null = null

/**
 * Get the AI service factory instance
 * @returns AIServiceFactory instance
 */
export function getAIServiceFactory(): AIServiceFactory {
  if (!factoryInstance) {
    factoryInstance = new DefaultAIServiceFactory()
  }
  return factoryInstance
}

/**
 * Reset the factory instance (useful for testing)
 */
export function resetAIServiceFactory(): void {
  factoryInstance = null
}
