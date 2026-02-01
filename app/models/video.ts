import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  hasOne,
  hasMany,
  manyToMany,
  beforeCreate,
  belongsTo,
} from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import VideoMetadata from './video_metadata.js'
import Tag from './tag.js'
import Category from './category.js'
import Like from './like.js'
import View from './view.js'
import Comment from './comment.js'
import Report from './report.js'
import Playlist from './playlist.js'
import VideoTranscription from './video_transcription.js'
import Person from './person.js'
import type { HasOne, ManyToMany, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Video extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @beforeCreate()
  static assignUuid(video: Video) {
    video.id = uuidv4()
  }

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare filePath: string

  @column()
  declare thumbnailPath: string | null

  @column()
  declare durationSeconds: number | null

  @column()
  declare viewCount: number

  @column()
  declare likeCount: number

  @column()
  declare isPublished: boolean

  @column()
  declare isFeatured: boolean

  @column()
  declare region: string | null

  @column.dateTime()
  declare uploadDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @hasOne(() => VideoMetadata)
  declare metadata: HasOne<typeof VideoMetadata>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Tag, {
    pivotTable: 'video_tags',
    pivotTimestamps: true,
  })
  declare tags: ManyToMany<typeof Tag>

  @manyToMany(() => Category, {
    pivotTable: 'video_categories',
    pivotTimestamps: true,
  })
  declare categories: ManyToMany<typeof Category>

  @manyToMany(() => Playlist, {
    pivotTable: 'playlist_videos',
    pivotTimestamps: true,
  })
  declare playlists: ManyToMany<typeof Playlist>

  @hasMany(() => Like)
  declare likes: HasMany<typeof Like>

  @hasMany(() => View)
  declare views: HasMany<typeof View>

  @hasMany(() => Comment)
  declare comments: HasMany<typeof Comment>

  @hasMany(() => Report, {
    foreignKey: 'resourceId',
    onQuery: (query) => query.where('resourceType', 'video'),
  })
  declare reports: HasMany<typeof Report>

  @hasMany(() => VideoTranscription)
  declare transcriptions: HasMany<typeof VideoTranscription>

  @manyToMany(() => Person, {
    pivotTable: 'video_persons',
    pivotColumns: ['notes'],
  })
  declare persons: ManyToMany<typeof Person>
}
