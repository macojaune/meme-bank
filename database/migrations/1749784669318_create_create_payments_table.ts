import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.string('payment_type').notNullable().comment('subscription, one-time, refund')
      table.string('payment_method').notNullable().comment('credit_card, paypal, crypto, etc.')
      table.decimal('amount', 10, 2).notNullable()
      table.string('currency').notNullable().defaultTo('USD')
      table.string('status').notNullable().comment('pending, completed, failed, refunded')
      table.string('transaction_id').nullable().comment('External payment processor transaction ID')
      table.jsonb('payment_details').nullable().comment('Additional payment details')
      table.string('description').nullable()
      table.timestamp('payment_date').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_payments_user_id ON payments(user_id)')
    this.schema.raw('CREATE INDEX idx_payments_status ON payments(status)')
    this.schema.raw('CREATE INDEX idx_payments_payment_date ON payments(payment_date)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
