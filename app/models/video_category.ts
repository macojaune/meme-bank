import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import Category from './category.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class VideoCategory extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare videoId: string

  @column()
  declare categoryId: string
  
  @beforeCreate()
  static assignUuid(videoCategory: VideoCategory) {
    videoCategory.id = uuidv4()
  }

  @column()
  declare displayOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>
}