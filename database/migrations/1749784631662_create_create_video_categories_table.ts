import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table
        .uuid('category_id')
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('display_order').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Add a unique constraint to prevent duplicate video-category pairs
      table.unique(['video_id', 'category_id'])
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_video_categories_video_id ON video_categories(video_id)')
    this.schema.raw(
      'CREATE INDEX idx_video_categories_category_id ON video_categories(category_id)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
