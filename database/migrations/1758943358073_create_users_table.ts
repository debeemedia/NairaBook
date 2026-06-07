import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().notNullable().index()
      table.string('profile_name').notNullable()
      table.string('phone_number').notNullable().unique()

      table.timestamp('created_at', { useTz: true }).notNullable().index()
      table.timestamp('updated_at', { useTz: true }).notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
