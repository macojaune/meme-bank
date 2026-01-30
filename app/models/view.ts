import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Video from './video.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class View extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare videoId: string

  @column()
  declare userId: string | null
  
  @beforeCreate()
  static assignUuid(view: View) {
    view.id = uuidv4()
  }

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare deviceType: string | null

  @column()
  declare watchDuration: number | null

  @column()
  declare watchPercentage: number | null

  @column()
  declare viewDetails: any | null

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