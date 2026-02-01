import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_persons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE')
      table.uuid('person_id').references('id').inTable('persons').onDelete('CASCADE')
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint to avoid duplicates
      table.unique(['video_id', 'person_id'])

      // Indexes for performance
      table.index('video_id')
      table.index('person_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
