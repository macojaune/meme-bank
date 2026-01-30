import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class UserSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string
  
  @beforeCreate()
  static assignUuid(userSetting: UserSetting) {
    userSetting.id = uuidv4()
  }

  @column()
  declare emailNotifications: boolean

  @column()
  declare pushNotifications: boolean

  @column()
  declare inAppNotifications: boolean

  @column()
  declare autoPlayVideos: boolean

  @column()
  declare darkMode: boolean

  @column()
  declare language: string

  @column()
  declare timezone: string

  @column()
  declare contentPrivacy: boolean

  @column()
  declare showActivityStatus: boolean

  @column()
  declare allowComments: boolean

  @column()
  declare allowMessages: boolean

  @column()
  declare notificationPreferences: any | null

  @column()
  declare privacySettings: any | null

  @column()
  declare contentFilters: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}