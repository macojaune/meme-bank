import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Playlist from './playlist.js'
import Video from './video.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class PlaylistVideo extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playlistId: string

  @column()
  declare videoId: string
  
  @beforeCreate()
  static assignUuid(playlistVideo: PlaylistVideo) {
    playlistVideo.id = uuidv4()
  }

  @column()
  declare position: number

  @column()
  declare isFeatured: boolean

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Playlist)
  declare playlist: BelongsTo<typeof Playlist>

  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>
}