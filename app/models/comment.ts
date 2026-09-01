import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Video from './video.js'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Comment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare videoId: string

  @column()
  declare parentId: string | null

  @beforeCreate()
  static assignUuid(comment: Comment) {
    comment.id = uuidv4()
  }

  @column()
  declare content: string

  @column()
  declare isPinned: boolean

  @column()
  declare isHidden: boolean

  @column()
  declare likeCount: number

  @column()
  declare replyCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>

  @belongsTo(() => Comment, {
    foreignKey: 'parentId',
  })
  declare parent: BelongsTo<typeof Comment>

  @hasMany(() => Comment, {
    foreignKey: 'parentId',
  })
  declare replies: HasMany<typeof Comment>
}
