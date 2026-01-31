import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Enable pgvector extension for vector embeddings
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS vector')
  }

  async down() {
    this.schema.raw('DROP EXTENSION IF EXISTS vector')
  }
}
