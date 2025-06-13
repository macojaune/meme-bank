import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'videos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.string('title').notNullable()
      table.text('description').nullable()
      table.string('file_path').notNullable()
      table.string('thumbnail_path').nullable()
      table.integer('duration_seconds').unsigned().nullable()
      table.integer('view_count').unsigned().defaultTo(0)
      table.integer('like_count').unsigned().defaultTo(0)
      table.boolean('is_published').defaultTo(false)
      table.boolean('is_featured').defaultTo(false)
      table.timestamp('upload_date').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
