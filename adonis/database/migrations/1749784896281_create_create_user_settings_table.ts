import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .uuid('user_id')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
        .unique()
      table.boolean('email_notifications').defaultTo(true)
      table.boolean('push_notifications').defaultTo(true)
      table.boolean('in_app_notifications').defaultTo(true)
      table.boolean('auto_play_videos').defaultTo(true)
      table.boolean('dark_mode').defaultTo(false)
      table.string('language').defaultTo('en')
      table.string('timezone').defaultTo('UTC')
      table
        .boolean('content_privacy')
        .defaultTo(false)
        .comment('Whether user content is private by default')
      table.boolean('show_activity_status').defaultTo(true)
      table.boolean('allow_comments').defaultTo(true)
      table.boolean('allow_messages').defaultTo(true)
      table.jsonb('notification_preferences').nullable().comment('Detailed notification settings')
      table.jsonb('privacy_settings').nullable().comment('Detailed privacy settings')
      table.jsonb('content_filters').nullable().comment('Content filtering preferences')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add index for faster lookups
    this.schema.raw('CREATE INDEX idx_user_settings_user_id ON user_settings(user_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
