import { belongsTo } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Customer from './customer.ts'
import { DebtSchema } from '#database/schema'
import Product from './product.ts'

export default class Debt extends DebtSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}

// Database defaults to unpaid during creation.
export const DebtStatusesEnum = {
  Unpaid: 'unpaid',
  PartiallyPaid: 'partially_paid',
  Paid: 'paid',
} as const
