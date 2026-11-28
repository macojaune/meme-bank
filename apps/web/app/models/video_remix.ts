import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

export type RemixStatus = 'queued' | 'processing' | 'ready' | 'failed'

export default class VideoRemix extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare requesterId: string

  @column()
  declare sourceVideoId: string | null

  @column()
  declare videoId: string | null

  @column()
  declare idempotencyKey: string

  @column()
  declare fingerprint: string

  @column()
  declare title: string

  @column()
  declare startMs: number

  @column()
  declare endMs: number

  @column()
  declare status: RemixStatus

  @column()
  declare processingToken: string | null

  @column()
  declare error: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
