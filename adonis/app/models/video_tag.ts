import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import Tag from './tag.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class VideoTag extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare videoId: string

  @column()
  declare tagId: string
  
  @beforeCreate()
  static assignUuid(videoTag: VideoTag) {
    videoTag.id = uuidv4()
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>

  @belongsTo(() => Tag)
  declare tag: BelongsTo<typeof Tag>
}