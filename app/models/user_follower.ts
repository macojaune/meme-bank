import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class UserFollower extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare followerId: string

  @column()
  declare followingId: string
  
  @beforeCreate()
  static assignUuid(userFollower: UserFollower) {
    userFollower.id = uuidv4()
  }

  @column()
  declare isApproved: boolean

  @column()
  declare isNotified: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'followerId',
  })
  declare follower: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'followingId',
  })
  declare following: BelongsTo<typeof User>
}