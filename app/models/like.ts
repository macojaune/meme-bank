import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Video from './video.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Like extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare videoId: string

  @beforeCreate()
  static assignUuid(like: Like) {
    like.id = uuidv4()
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>
}
