import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Video from './video.js'
import type { ManyToMany, BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Playlist extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string
  
  @beforeCreate()
  static assignUuid(playlist: Playlist) {
    playlist.id = uuidv4()
  }

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare thumbnailPath: string | null

  @column()
  declare visibility: string

  @column()
  declare isFeatured: boolean

  @column()
  declare videoCount: number

  @column()
  declare viewCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Video, {
    pivotTable: 'playlist_videos',
    pivotColumns: ['position', 'is_featured', 'note'],
    pivotTimestamps: true,
  })
  declare videos: ManyToMany<typeof Video>
}