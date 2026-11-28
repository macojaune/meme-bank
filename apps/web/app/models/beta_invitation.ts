import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class BetaInvitation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare tokenHash: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare redeemedAt: DateTime | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
