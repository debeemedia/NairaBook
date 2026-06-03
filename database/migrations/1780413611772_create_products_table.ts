import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().notNullable().index()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .index()
        .references('id')
        .inTable('users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE')

      table.string('name').notNullable().unique().index() // e.g. "egg (crate)" or "flour (cup) or "flour (bag)"

      table.integer('current_stock').defaultTo(0).notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
