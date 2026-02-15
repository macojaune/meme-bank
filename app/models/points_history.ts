import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class PointsHistory extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare points: number

  @column()
  declare reason:
    | 'upload'
    | 'download'
    | 'correction'
    | 'milestone_100'
    | 'milestone_500'
    | 'milestone_1000'
    | 'milestone_10000'
    | 'first_upload'

  @column()
  declare referenceId: string | null

  @column()
  declare referenceType: 'video' | 'transcription' | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
