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

      table
        .decimal('current_stock', 12, 2)
        .defaultTo(0.0)
        .notNullable() /** IMPORTANT: Leave as unsigned. User might forget to record a product stock update and later record an action which reduces the product stock, putting the stock in the negative*/

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
