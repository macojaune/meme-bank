import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_profiles'

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
      table.string('username').notNullable().unique()
      table.string('display_name').nullable()
      table.text('bio').nullable()
      table.string('avatar_path').nullable()
      table.string('cover_image_path').nullable()
      table.string('website').nullable()
      table.jsonb('social_links').nullable().comment('JSON object with social media links')
      table.string('location').nullable()
      table.date('birth_date').nullable()
      table.string('gender').nullable()
      table.boolean('is_verified').defaultTo(false)
      table.jsonb('preferences').nullable().comment('User preferences and settings')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add index for faster lookups
    this.schema.raw('CREATE INDEX idx_user_profiles_username ON user_profiles(username)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
