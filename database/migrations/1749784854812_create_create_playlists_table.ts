import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'playlists'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table.text('description').nullable()
      table.string('thumbnail_path').nullable()
      table
        .string('visibility')
        .notNullable()
        .defaultTo('public')
        .comment('public, private, unlisted')
      table.boolean('is_featured').defaultTo(false)
      table.integer('video_count').unsigned().defaultTo(0)
      table.integer('view_count').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_playlists_user_id ON playlists(user_id)')
    this.schema.raw('CREATE INDEX idx_playlists_visibility ON playlists(visibility)')
    this.schema.raw('CREATE INDEX idx_playlists_is_featured ON playlists(is_featured)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
