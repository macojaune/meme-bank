import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'

/**
 * Person model for tagging people in videos
 * Can be celebrities, known figures, or random people
 */
export default class Person extends BaseModel {
  static table = 'persons'
  @column({ isPrimary: true })
  declare id: string

  @beforeCreate()
  static assignUuid(person: Person) {
    person.id = uuidv4()
  }

  @column()
  declare name: string

  @column()
  declare socialMediaHandle: string | null

  @column()
  declare platform: string | null

  @column()
  declare bio: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
