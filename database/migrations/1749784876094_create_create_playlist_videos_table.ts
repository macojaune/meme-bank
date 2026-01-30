import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'playlist_videos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .uuid('playlist_id')
        .references('id')
        .inTable('playlists')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table
        .integer('position')
        .unsigned()
        .notNullable()
        .defaultTo(0)
        .comment('Order position in the playlist')
      table.boolean('is_featured').defaultTo(false).comment('Featured in the playlist thumbnail')
      table.text('note').nullable().comment('User note for this video in the playlist')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Add unique constraint to prevent duplicate videos in a playlist
      table.unique(['playlist_id', 'video_id'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_playlist_videos_playlist_id ON playlist_videos(playlist_id)')
    this.schema.raw('CREATE INDEX idx_playlist_videos_video_id ON playlist_videos(video_id)')
    this.schema.raw('CREATE INDEX idx_playlist_videos_position ON playlist_videos(position)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
