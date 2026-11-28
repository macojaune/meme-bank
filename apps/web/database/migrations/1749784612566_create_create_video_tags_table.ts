import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_tags'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table.uuid('tag_id').references('id').inTable('tags').onDelete('CASCADE').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Add a unique constraint to prevent duplicate video-tag pairs
      table.unique(['video_id', 'tag_id'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_video_tags_video_id ON video_tags(video_id)')
    this.schema.raw('CREATE INDEX idx_video_tags_tag_id ON video_tags(tag_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
