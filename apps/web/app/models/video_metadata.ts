import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class VideoMetadata extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare videoId: string

  @beforeCreate()
  static assignUuid(videoMetadata: VideoMetadata) {
    videoMetadata.id = uuidv4()
  }

  @column()
  declare transcription: string | null

  @column()
  declare metadata: any | null

  @column()
  declare embedding: any | null

  @column()
  declare analysisResults: any | null

  @column()
  declare language: string | null

  @column()
  declare hasCaptions: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>
}
