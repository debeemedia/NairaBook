import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'debts'

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

      table
        .integer('customer_id')
        .unsigned()
        .references('id')
        .inTable('customers')
        .onUpdate('CASCADE')
        .onDelete('RESTRICT')

      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onUpdate('CASCADE')
        .onDelete('SET NULL')
        .nullable()

      table.decimal('amount', 12, 2).notNullable()
      table.decimal('total_paid', 12, 2).notNullable().defaultTo(0.0)

      table.string('item_name').nullable()

      table.integer('quantity').defaultTo(1)

      table
        .enum('status', ['unpaid', 'partially_paid', 'paid'])
        .notNullable()
        .defaultTo('unpaid')
        .index()

      table.timestamp('due_date', { useTz: true }).nullable().index()

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()

      /**@todo  what if the user is the one owing????? maybe updated stock on credit*/
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
