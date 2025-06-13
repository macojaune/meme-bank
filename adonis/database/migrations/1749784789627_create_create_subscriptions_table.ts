import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .uuid('subscriber_id')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('creator_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table
        .string('subscription_type')
        .notNullable()
        .defaultTo('free')
        .comment('free, premium, etc.')
      table.decimal('amount', 10, 2).nullable()
      table.string('currency', 3).nullable().defaultTo('USD')
      table.string('status').notNullable().defaultTo('active').comment('active, cancelled, paused')
      table.date('start_date').notNullable()
      table.date('end_date').nullable()
      table.date('next_billing_date').nullable()
      table.string('payment_method').nullable()
      table.string('payment_provider').nullable()
      table.string('subscription_id').nullable().comment('ID from payment provider')
      table.jsonb('subscription_details').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('cancelled_at').nullable()

      // Add unique constraint to prevent duplicate subscriptions
      table.unique(['subscriber_id', 'creator_id', 'subscription_type'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_subscriptions_subscriber_id ON subscriptions(subscriber_id)')
    this.schema.raw('CREATE INDEX idx_subscriptions_creator_id ON subscriptions(creator_id)')
    this.schema.raw('CREATE INDEX idx_subscriptions_status ON subscriptions(status)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
