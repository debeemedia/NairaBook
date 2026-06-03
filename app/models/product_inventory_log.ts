import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Product from './product.ts'
import { ProductInventoryLogSchema } from '#database/schema'

export default class ProductInventoryLog extends ProductInventoryLogSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}

export const ProductInventoryLogQuantityChangeTypesEnum = {
  Addition: 'addition',
  Subtraction: 'subtraction',
} as const
