import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'video_persons'

  async up() {
    // Make timestamps nullable with defaults for pivot table
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      ALTER COLUMN created_at DROP NOT NULL,
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      ALTER COLUMN created_at SET NOT NULL,
      ALTER COLUMN created_at DROP DEFAULT,
      ALTER COLUMN updated_at DROP DEFAULT
    `)
  }
}
