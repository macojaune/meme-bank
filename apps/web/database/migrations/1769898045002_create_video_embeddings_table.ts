import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_embeddings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE').notNullable()
      table
        .uuid('transcription_id')
        .references('id')
        .inTable('video_transcriptions')
        .onDelete('CASCADE')
        .notNullable()
      table.specificType('embedding', 'vector(768)').notNullable()
      table.string('model_used').notNullable().comment('e.g., nomic-embed-text')
      table.integer('dimensions').notNullable().defaultTo(768)
      table.timestamp('generated_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Create HNSW index for fast vector similarity search
    // This uses the vector extension's HNSW index for efficient approximate nearest neighbor search
    this.schema.raw(`
      CREATE INDEX idx_video_embeddings_vector 
      ON video_embeddings 
      USING hnsw (embedding vector_cosine_ops)
    `)

    // Index for video lookups
    this.schema.raw('CREATE INDEX idx_video_embeddings_video_id ON video_embeddings(video_id)')
    this.schema.raw(
      'CREATE UNIQUE INDEX idx_video_embeddings_transcription_id ON video_embeddings(transcription_id)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
