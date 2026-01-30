import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_followers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('follower_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.uuid('following_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table
        .boolean('is_approved')
        .defaultTo(true)
        .comment('For private accounts that need to approve followers')
      table
        .boolean('is_notified')
        .defaultTo(false)
        .comment('Whether the user has been notified of this follow')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Add unique constraint to prevent duplicate follows
      table.unique(['follower_id', 'following_id'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_user_followers_follower_id ON user_followers(follower_id)')
    this.schema.raw('CREATE INDEX idx_user_followers_following_id ON user_followers(following_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
