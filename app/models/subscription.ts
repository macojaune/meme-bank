import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare subscriberId: string

  @column()
  declare creatorId: string
  
  @beforeCreate()
  static assignUuid(subscription: Subscription) {
    subscription.id = uuidv4()
  }

  @column()
  declare subscriptionType: string

  @column()
  declare amount: number | null

  @column()
  declare currency: string | null

  @column()
  declare status: string

  @column.date()
  declare startDate: DateTime

  @column.date()
  declare endDate: DateTime | null

  @column.date()
  declare nextBillingDate: DateTime | null

  @column()
  declare paymentMethod: string | null

  @column()
  declare paymentProvider: string | null

  @column()
  declare subscriptionId: string | null

  @column()
  declare subscriptionDetails: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'subscriberId',
  })
  declare subscriber: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'creatorId',
  })
  declare creator: BelongsTo<typeof User>
}