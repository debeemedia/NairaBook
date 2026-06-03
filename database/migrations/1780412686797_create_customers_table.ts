import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

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

      table.string('name').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()

      table.unique(['user_id', 'name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
