import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.uuid('actor_id').references('id').inTable('users').onDelete('SET NULL').nullable()
      table.string('type').notNullable().comment('like, comment, subscription, etc.')
      table.string('title').notNullable()
      table.text('message').nullable()
      table.jsonb('data').nullable().comment('Additional data related to the notification')
      table.string('resource_type').nullable().comment('Model type the notification relates to')
      table.uuid('resource_id').nullable().comment('ID of the related resource')
      table.boolean('is_read').defaultTo(false)
      table.boolean('is_seen').defaultTo(false)
      table.string('delivery_status').defaultTo('pending').comment('pending, sent, failed')
      table.timestamp('read_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_notifications_user_id ON notifications(user_id)')
    this.schema.raw('CREATE INDEX idx_notifications_is_read ON notifications(is_read)')
    this.schema.raw('CREATE INDEX idx_notifications_type ON notifications(type)')
    this.schema.raw('CREATE INDEX idx_notifications_created_at ON notifications(created_at)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
