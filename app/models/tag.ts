import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import Video from './video.js'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class Tag extends BaseModel {
  @column({ isPrimary: true })
  declare id: string
  
  @beforeCreate()
  static assignUuid(tag: Tag) {
    tag.id = uuidv4()
  }

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column()
  declare usageCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @manyToMany(() => Video, {
    pivotTable: 'video_tags',
    pivotTimestamps: true,
  })
  declare videos: ManyToMany<typeof Video>
}