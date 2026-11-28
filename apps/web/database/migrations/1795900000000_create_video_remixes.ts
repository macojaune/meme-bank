import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('videos', (table) => {
      table.uuid('remixed_from_video_id').references('videos.id').onDelete('SET NULL')
      table.index(['remixed_from_video_id'])
    })

    this.schema.createTable('video_remixes', (table) => {
      table.uuid('id').primary()
      table.uuid('requester_id').notNullable().references('users.id').onDelete('CASCADE')
      table.uuid('source_video_id').references('videos.id').onDelete('SET NULL')
      table.uuid('video_id').unique().references('videos.id').onDelete('SET NULL')
      table.uuid('idempotency_key').notNullable()
      table.string('fingerprint', 64).notNullable()
      table.string('title').notNullable()
      table.integer('start_ms').notNullable()
      table.integer('end_ms').notNullable()
      table.string('status', 16).notNullable().defaultTo('queued')
      table.uuid('processing_token')
      table.string('error')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['requester_id', 'idempotency_key'])
      table.index(['source_video_id'])
    })
  }

  async down() {
    this.schema.dropTable('video_remixes')
    this.schema.alterTable('videos', (table) => {
      table.dropIndex(['remixed_from_video_id'])
      table.dropColumn('remixed_from_video_id')
    })
  }
}
