import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * Status of a transcription revision
 */
export enum TranscriptionStatus {
  AUTO_GENERATED = 'auto_generated',
  COMMUNITY_CORRECTED = 'community_corrected',
  ADMIN_VALIDATED = 'admin_validated',
}

/**
 * Model for storing video transcriptions
 * Supports multiple revisions with community corrections
 */
export default class VideoTranscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @beforeCreate()
  static assignUuid(transcription: VideoTranscription) {
    transcription.id = uuidv4()
  }

  @column()
  declare videoId: string

  @column()
  declare revisionNumber: number

  @column()
  declare status: TranscriptionStatus

  @column()
  declare transcriptionText: string

  @column()
  declare language: string

  @column()
  declare confidence: number | null

  @column()
  declare correctedByUserId: string | null

  @column()
  declare isCurrent: boolean

  @column()
  declare segmentsJson: string | null

  @column()
  declare pointsAwarded: number

  @column()
  declare correctionReason: string | null

  @column.dateTime()
  declare generatedAt: DateTime

  @column.dateTime()
  declare correctedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>

  @belongsTo(() => User, { foreignKey: 'correctedByUserId' })
  declare correctedBy: BelongsTo<typeof User>

  /**
   * Get segments as parsed array
   */
  get segments(): Array<{ start: number; end: number; text: string; confidence?: number }> | null {
    if (!this.segmentsJson) return null
    try {
      return JSON.parse(this.segmentsJson)
    } catch {
      return null
    }
  }

  /**
   * Set segments as JSON string
   */
  set segments(
    value: Array<{ start: number; end: number; text: string; confidence?: number }> | null
  ) {
    this.segmentsJson = value ? JSON.stringify(value) : null
  }
}
