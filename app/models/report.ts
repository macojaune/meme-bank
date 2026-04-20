import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Video from './video.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Report extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare reporterId: string | null

  @column()
  declare videoId: string

  @beforeCreate()
  static assignUuid(report: Report) {
    report.id = uuidv4()
  }

  @column()
  declare reportType: string

  @column()
  declare description: string | null

  @column()
  declare evidence: any | null

  @column()
  declare status: string

  @column()
  declare adminNotes: string | null

  @column()
  declare adminId: string | null

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'reporterId',
  })
  declare reporter: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'adminId',
  })
  declare admin: BelongsTo<typeof User>

  @belongsTo(() => Video)
  declare video: BelongsTo<typeof Video>
}
