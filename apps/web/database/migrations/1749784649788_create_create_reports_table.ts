import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('reporter_id').references('id').inTable('users').onDelete('SET NULL').nullable()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table.string('report_type').notNullable().comment('copyright, inappropriate, spam, etc.')
      table.text('description').nullable()
      table.jsonb('evidence').nullable().comment('URLs, timestamps, etc.')
      table.string('status').defaultTo('pending').comment('pending, reviewed, resolved, dismissed')
      table.text('admin_notes').nullable()
      table
        .uuid('admin_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
        .comment('Admin who processed the report')
      table.timestamp('resolved_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw('CREATE INDEX idx_reports_video_id ON reports(video_id)')
    this.schema.raw('CREATE INDEX idx_reports_reporter_id ON reports(reporter_id)')
    this.schema.raw('CREATE INDEX idx_reports_status ON reports(status)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
