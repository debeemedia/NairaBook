import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().notNullable().index()

      table.enum('type', ['sale', 'expense']).notNullable().index()
      table.string('item_name').notNullable() // e.g. "egg (crate)"
      table.integer('quantity').defaultTo(1)

      table.decimal('amount', 12, 2).notNullable()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .index()
        .references('id')
        .inTable('users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
