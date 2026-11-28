import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare actorId: string | null

  @beforeCreate()
  static assignUuid(notification: Notification) {
    notification.id = uuidv4()
  }

  @column()
  declare type: string

  @column()
  declare title: string

  @column()
  declare message: string | null

  @column()
  declare data: any | null

  @column()
  declare resourceType: string | null

  @column()
  declare resourceId: string | null

  @column()
  declare isRead: boolean

  @column()
  declare isSeen: boolean

  @column()
  declare deliveryStatus: string

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'actorId',
  })
  declare actor: BelongsTo<typeof User>
}
