import env from '#start/env'

/**
 * Configuration for AI services
 */
export const aiConfig = {
  // Provider to use (ollama, openai, etc.)
  provider: env.get('AI_PROVIDER', 'ollama') as 'ollama' | 'openai',

  // Ollama configuration
  ollama: {
    baseUrl: env.get('OLLAMA_URL', 'http://localhost:11434'),
    transcriptionModel: env.get('OLLAMA_TRANSCRIPTION_MODEL', 'whisper'),
    embeddingModel: env.get('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
  },

  // OpenAI configuration (for future use)
  openai: {
    apiKey: env.get('OPENAI_API_KEY', ''),
    transcriptionModel: env.get('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1'),
    embeddingModel: env.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-ada-002'),
  },

  // Embedding dimensions
  embeddingDimensions: 768,

  // Supported languages for transcription
  supportedLanguages: [
    'fr', // French
    'ht', // Haitian Creole (if supported)
    'en', // English
    'es', // Spanish
  ],

  // Retry configuration
  maxRetries: 3,
  retryDelay: 2000,
}

export default aiConfig
