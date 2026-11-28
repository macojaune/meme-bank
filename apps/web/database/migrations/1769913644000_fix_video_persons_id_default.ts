import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_persons'

  async up() {
    // Add default value for id column using PostgreSQL's gen_random_uuid()
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      ALTER COLUMN id DROP DEFAULT
    `)
  }
}
