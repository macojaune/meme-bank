import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'points_history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('points').notNullable()
      table
        .enum('reason', [
          'upload',
          'download',
          'correction',
          'milestone_100',
          'milestone_500',
          'milestone_1000',
          'milestone_10000',
          'first_upload',
        ])
        .notNullable()
      table.uuid('reference_id').nullable()
      table.enum('reference_type', ['video', 'transcription']).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Index pour optimiser les requêtes
      table.index('user_id')
      table.index('reason')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
