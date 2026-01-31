import type { AIEmbeddingService } from '../ai_interfaces.js'
import aiConfig from '../ai_config.js'

/**
 * Ollama implementation of the embedding service
 * Uses Ollama's embedding models (e.g., nomic-embed-text) for generating text embeddings
 */
export class OllamaEmbeddingService implements AIEmbeddingService {
  private baseUrl: string
  private model: string
  private dimensions: number

  constructor() {
    this.baseUrl = aiConfig.ollama.baseUrl
    this.model = aiConfig.ollama.embeddingModel
    this.dimensions = aiConfig.embeddingDimensions
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      interface OllamaEmbeddingResponse {
        embedding?: number[]
      }
      const data = (await response.json()) as OllamaEmbeddingResponse

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid response from Ollama: no embedding found')
      }

      return data.embedding
    } catch (error) {
      console.error('Embedding generation error:', error)
      throw error
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Process in batches to avoid overwhelming the Ollama server
    const batchSize = 10
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map((text) => this.generateEmbedding(text)))
      results.push(...batchResults)

      // Small delay between batches
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
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

      interface OllamaTagsResponse {
        models?: Array<{ name?: string }>
      }
      const data = (await response.json()) as OllamaTagsResponse
      const models = data.models || []
      const hasModel = models.some((m) => m.name?.includes(this.model))

      if (!hasModel) {
        return {
          healthy: false,
          message: `Model '${this.model}' not found. Available models: ${models.map((m) => m.name).join(', ')}`,
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

  getDimensions(): number {
    return this.dimensions
  }
}
