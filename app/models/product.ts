import { BaseModel, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ProductInventoryLog from './product_inventory_log.ts'
import { ProductSchema } from '#database/schema'

export default class Product extends ProductSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => ProductInventoryLog)
  declare productInventoryLogs: HasMany<typeof ProductInventoryLog>
}
