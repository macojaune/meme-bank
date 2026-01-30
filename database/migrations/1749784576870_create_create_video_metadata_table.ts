import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_metadata'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table.text('transcription').nullable()
      table.jsonb('metadata').nullable()
      table
        .jsonb('embedding')
        .nullable()
        .comment('Vector embedding for semantic search stored as JSON')
      table.jsonb('analysis_results').nullable().comment('Results from AI analysis')
      table.string('language').nullable()
      table.boolean('has_captions').defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add index for faster lookups by video_id
    this.schema.raw('CREATE INDEX idx_video_metadata_video_id ON video_metadata(video_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
