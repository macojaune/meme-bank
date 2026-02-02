import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'downloads'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('video_id').notNullable().references('id').inTable('videos').onDelete('CASCADE')
      table.timestamp('downloaded_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Index pour optimiser les requêtes et éviter les doublons
      table.index('user_id')
      table.index('video_id')
      table.unique(['user_id', 'video_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
