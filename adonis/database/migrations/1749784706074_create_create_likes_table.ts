import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'likes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Add a unique constraint to prevent duplicate likes
      table.unique(['user_id', 'video_id'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_likes_user_id ON likes(user_id)')
    this.schema.raw('CREATE INDEX idx_likes_video_id ON likes(video_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
