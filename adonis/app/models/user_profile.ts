import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class UserProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string
  
  @beforeCreate()
  static assignUuid(userProfile: UserProfile) {
    userProfile.id = uuidv4()
  }

  @column()
  declare username: string

  @column()
  declare displayName: string | null

  @column()
  declare bio: string | null

  @column()
  declare avatarPath: string | null

  @column()
  declare coverImagePath: string | null

  @column()
  declare website: string | null

  @column()
  declare socialLinks: any | null

  @column()
  declare location: string | null

  @column.date()
  declare birthDate: DateTime | null

  @column()
  declare gender: string | null

  @column()
  declare isVerified: boolean

  @column()
  declare preferences: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}