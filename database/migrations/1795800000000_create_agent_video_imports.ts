import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('video_upload_tokens', (table) => {
      table.increments('id')
      table.uuid('tokenable_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.timestamp('last_used_at')
      table.timestamp('expires_at')
    })
    this.schema.createTable('agent_video_imports', (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('key', 128).notNullable()
      table.string('fingerprint', 64).notNullable()
      table.uuid('video_id').references('videos.id').onDelete('SET NULL')
      table.boolean('created').notNullable().defaultTo(false)
      table.boolean('dispatched').notNullable().defaultTo(false)
      table.unique(['user_id', 'key'])
      table.index(['video_id'])
    })
    this.schema.alterTable('videos', (table) => {
      table.boolean('skip_auto_transcription').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('videos', (table) => table.dropColumn('skip_auto_transcription'))
    this.schema.dropTable('agent_video_imports')
    this.schema.dropTable('video_upload_tokens')
  }
}
