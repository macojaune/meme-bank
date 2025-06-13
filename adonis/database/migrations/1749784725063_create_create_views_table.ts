import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'views'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL').nullable()
      table.string('ip_address').nullable()
      table.string('user_agent').nullable()
      table.string('device_type').nullable().comment('mobile, desktop, tablet, etc.')
      table.decimal('watch_duration', 10, 2).nullable().comment('Duration watched in seconds')
      table.decimal('watch_percentage', 5, 2).nullable().comment('Percentage of video watched')
      table.jsonb('view_details').nullable().comment('Additional view details')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_views_video_id ON views(video_id)')
    this.schema.raw('CREATE INDEX idx_views_user_id ON views(user_id)')
    this.schema.raw('CREATE INDEX idx_views_created_at ON views(created_at)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
