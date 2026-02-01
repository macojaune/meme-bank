import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'persons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('name').notNullable()
      table.string('social_media_handle').nullable()
      table.string('platform').nullable()
      table.text('bio').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index for quick search
      table.index('name')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
