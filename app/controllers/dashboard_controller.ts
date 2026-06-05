import DashboardService from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import Debt, { DebtStatusesEnum } from '#models/debt'
import Product from '#models/product'
import Transaction, { TransactionTypesEnum } from '#models/transaction'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * @todo: Convert all queries to raw SQL queries.
 */
export default class DashboardController {
  async create({ view, response, request, logger }: HttpContext) {
    const result = await DashboardService.getUserFromDashboardLink({
      shortCode: request.param('shortCode'),
    })

    if (typeof result !== 'number') {
      return response.status(result.code).send(result.message)
    }

    const userId = result

    /**
     * @todo: Untill all queries are converted to raw SQL,
     * select only relevant columns.
     */
    const user = await User.query()
      .select(['id', 'profileName', 'phoneNumber'])
      .where({ id: userId })
      .first()

    if (!user) {
      logger.error({ userId }, '[DashboardController.create] User not found!')

      return response.notFound(
        'We could not find your record. Send a voice note to get a real link.'
      )
    }

    const todayStart = DateTime.local().startOf('day').toSQL()

    const [salesResult, expensesResult, debtResult] = await Promise.all([
      // Sum of Today's Sales
      Transaction.query()
        .where({ userId, type: TransactionTypesEnum.Sale })
        .where('createdAt', '>=', todayStart)
        .sum('amount as total')
        .first(),

      // Sum of Today's Expenses
      Transaction.query()
        .where({ userId })
        .where({ userId, type: TransactionTypesEnum.Expense })
        .where('createdAt', '>=', todayStart)
        .sum('amount as total')
        .first(),

      // Outstanding Debt (Balance remaining = amount - total_paid)
      Debt.query()
        .where({ userId })
        .whereIn('status', [DebtStatusesEnum.Unpaid, DebtStatusesEnum.PartiallyPaid])
        .select(db.raw('SUM(amount - total_paid) as total'))
        .first(),
    ])

    const totalSalesToday = Number(salesResult?.$extras.total) || 0
    const totalExpensesToday = Number(expensesResult?.$extras.total) || 0
    const totalOutstandingDebt = Number(debtResult?.$extras.total) || 0
    const netProfitToday = totalSalesToday - totalExpensesToday

    // Fetch Stock Alerts (Negative inventory balances from voice notes)
    const stockAlerts = await Product.query()
      .where({ userId })
      .where('currentStock', '<=', 0)
      .orderBy('currentStock', 'asc')
      .limit(5)

    // Fetch the 5 most recent activities
    const recentTransactions = await Transaction.query()
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .limit(5)

    return view.render('pages/dashboard', {
      user,
      metrics: {
        totalSalesToday,
        totalExpensesToday,
        totalOutstandingDebt,
        netProfitToday,
      },
      stockAlerts,
      recentTransactions,
    })
  }
}
