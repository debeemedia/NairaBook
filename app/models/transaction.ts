import { belongsTo } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { TransactionSchema } from '#database/schema'

export default class Transaction extends TransactionSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}

export const TransactionTypesEnum = {
  Sale: 'sale',
  Expense: 'expense',
} as const
