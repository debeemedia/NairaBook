import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Debt from './debt.ts'
import { CustomerSchema } from '#database/schema'

export default class Customer extends CustomerSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Debt)
  declare debts: HasMany<typeof Debt>
}
