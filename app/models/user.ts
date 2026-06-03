import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasMany } from '@adonisjs/lucid/orm'
import Transaction from './transaction.ts'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Customer from './customer.ts'

/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin.
 */
export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  @hasMany(() => Customer)
  declare customers: HasMany<typeof Customer>
}
