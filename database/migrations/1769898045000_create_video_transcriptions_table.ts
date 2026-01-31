import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_transcriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table.integer('revision_number').notNullable().defaultTo(1)
      table
        .string('status')
        .notNullable()
        .defaultTo('auto_generated')
        .comment('auto_generated, community_corrected, admin_validated')
      table.text('transcription_text').notNullable()
      table.string('language').notNullable().defaultTo('fr')
      table.float('confidence').nullable()
      table
        .uuid('corrected_by_user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
      table.boolean('is_current').notNullable().defaultTo(true)
      table.jsonb('segments_json').nullable().comment('Array of segments with timestamps')
      table.integer('points_awarded').notNullable().defaultTo(0)
      table.text('correction_reason').nullable()
      table.timestamp('generated_at').notNullable()
      table.timestamp('corrected_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add indexes for faster lookups
    this.schema.raw(
      'CREATE INDEX idx_video_transcriptions_video_id ON video_transcriptions(video_id)'
    )
    this.schema.raw(
      'CREATE INDEX idx_video_transcriptions_is_current ON video_transcriptions(is_current)'
    )
    this.schema.raw('CREATE INDEX idx_video_transcriptions_status ON video_transcriptions(status)')
    this.schema.raw(
      'CREATE INDEX idx_video_transcriptions_language ON video_transcriptions(language)'
    )

    // Create unique index to ensure only one current transcription per video
    this.schema.raw(`
      CREATE UNIQUE INDEX idx_video_transcriptions_current_unique 
      ON video_transcriptions(video_id) 
      WHERE is_current = true
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
