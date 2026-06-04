import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_inventory_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().notNullable().index()

      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .index()
        .references('id')
        .inTable('products')
        .onUpdate('CASCADE')
        .onDelete('CASCADE')

      table.decimal('quantity_changed', 12, 2).defaultTo(1.0).notNullable()

      table.enum('quantity_change_type', ['addition', 'subtraction']).notNullable()

      table.decimal('amount', 12, 2).nullable()

      table.text('notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
