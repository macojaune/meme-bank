import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table
        .uuid('parent_id')
        .references('id')
        .inTable('comments')
        .onDelete('CASCADE')
        .nullable()
        .comment('For nested comments/replies')
      table.text('content').notNullable()
      table.boolean('is_pinned').defaultTo(false)
      table.boolean('is_hidden').defaultTo(false)
      table.integer('like_count').unsigned().defaultTo(0)
      table.integer('reply_count').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_comments_video_id ON comments(video_id)')
    this.schema.raw('CREATE INDEX idx_comments_user_id ON comments(user_id)')
    this.schema.raw('CREATE INDEX idx_comments_parent_id ON comments(parent_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
