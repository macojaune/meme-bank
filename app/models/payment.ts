import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @beforeCreate()
  static assignUuid(payment: Payment) {
    payment.id = uuidv4()
  }

  @column()
  declare paymentType: string

  @column()
  declare paymentMethod: string

  @column()
  declare amount: number

  @column()
  declare currency: string

  @column()
  declare status: string

  @column()
  declare transactionId: string | null

  @column()
  declare paymentDetails: any | null

  @column()
  declare description: string | null

  @column.dateTime()
  declare paymentDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
