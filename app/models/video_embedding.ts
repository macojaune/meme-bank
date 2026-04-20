import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import VideoTranscription from './video_transcription.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * Model for storing vector embeddings of video transcriptions
 * Uses pgvector extension for efficient similarity search
 */
export default class VideoEmbedding extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @beforeCreate()
  static assignUuid(embedding: VideoEmbedding) {
    embedding.id = uuidv4()
  }

  @column()
  declare videoId: string

  @column()
  declare transcriptionId: string

  @column()
  declare embedding: string // Stored as string representation of vector: '[x,y,z,...]'

  @column()
  declare modelUsed: string

  @column()
  declare dimensions: number

  @column.dateTime()
  declare generatedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>

  @belongsTo(() => VideoTranscription)
  declare transcription: BelongsTo<typeof VideoTranscription>

  /**
   * Parse embedding string into array of numbers
   */
  get embeddingArray(): number[] {
    if (!this.embedding) return []
    // Remove brackets and split by comma
    const clean = this.embedding.replace('[', '').replace(']', '')
    return clean.split(',').map((s) => Number.parseFloat(s.trim()))
  }

  /**
   * Set embedding from array of numbers
   */
  set embeddingArray(values: number[]) {
    this.embedding = '[' + values.join(',') + ']'
  }
}
