import DashboardService from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import Debt, { DebtStatusesEnum } from '#models/debt'
import Product from '#models/product'
import Transaction, { transactionTypes, TransactionTypesEnum } from '#models/transaction'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import vine, { errors } from '@vinejs/vine'

/**
 * @todo: Convert all queries to raw SQL queries.
 *
 * Until all queries are converted to raw SQL
 * select only relevant columns.
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

    let payload

    try {
      payload = await vine
        .create({
          range: vine.enum(['24h', '1mo', '1wk', 'all']).optional(),
          type: vine.enum([...transactionTypes, 'all']).optional(),
          page: vine.number().optional(),
          export: vine.enum(['transaction_ledger']).optional(),
        })
        .validate(request.qs())
    } catch (error) {
      // If validation fails, intercept the redirect and print the raw errors to the screen
      /**
       * @todo: Later on, flash the errors to the template and handle there.
       */
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.status(422).send({
          message: 'Stop the manipulation, boss!',
          errors: error.messages,
        })
      }

      throw error
    }

    const currentRange = payload.range || '1wk'
    const currentType = payload.type || 'all'
    const page = payload.page || 1
    let rangeStart: DateTime<boolean> = DateTime.local().minus({ weeks: 1 }) // Default: 1wk

    if (currentRange === '24h') {
      rangeStart = DateTime.local().minus({ hours: 24 })
    } else if (currentRange === '1mo') {
      rangeStart = DateTime.local().minus({ months: 1 })
    } else if (currentRange === 'all') {
      rangeStart = DateTime.fromMillis(0) // Start of time
    }

    // For the CSV report, get all transactions (sales and expenses) for the current range filter (regardless of current page)
    const reportTransactionsQuery = Transaction.query()
      .select(['id', 'type', 'itemName', 'amount', 'createdAt'])
      .where({ userId })
      .where('createdAt', '>=', rangeStart.toSQL()!)
      .orderBy('createdAt', 'desc')

    if (currentType !== 'all') {
      reportTransactionsQuery.where({ type: currentType })
    }

    if (payload.export) {
      const allReportRecords = await reportTransactionsQuery.clone()

      let csvContent = 'Timestamp,Type,Description,Amount (NGN)\n'

      for (const trx of allReportRecords) {
        const timestamp = trx.createdAt.toFormat('yyyy-MM-dd HH:mm:ss')

        const rowAmount = trx.type === TransactionTypesEnum.Sale ? trx.amount : -trx.amount

        csvContent += `"${timestamp}","${trx.type.toUpperCase()}","${trx.itemName || ''}",${rowAmount}\n`
      }

      // Send the report for download
      response.header('Content-Type', 'text/csv')
      response.header(
        'Content-Disposition',
        `attachment; filename="nairabook_transaction_ledger_${currentRange}_${currentType}.csv"`
      )

      return response.send(csvContent)
    }

    const todayStart = DateTime.local().startOf('day').toSQL()

    // Run all queries in parallel
    const [
      salesResult,
      expensesResult,
      debtResult,
      stockAlerts,
      recentTransactions,
      activeDebtors,
      allProducts,
      reportTransactions, // Paginated
    ] = await Promise.all([
      // Sum of Today's Sales
      Transaction.query()
        .where({ userId, type: TransactionTypesEnum.Sale })
        .where('createdAt', '>=', todayStart)
        .sum('amount as total')
        .first(),

      // Sum of Today's Expenses
      Transaction.query()
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

      // Product Stock Alerts (Negative/Zero inventory balances)
      Product.query()
        .where({ userId })
        .where('currentStock', '<=', 0)
        .orderBy('currentStock', 'asc')
        .limit(5),

      // Fetch the 5 most recent activities
      Transaction.query()
        .select(['id', 'type', 'itemName', 'amount', 'createdAt'])
        .where({ userId })
        .orderBy('createdAt', 'desc')
        .limit(5),

      //  Fetch active debts from customers
      Debt.query()
        .select(['id', 'customerId', 'status', 'amount', 'totalPaid', 'itemName', 'quantity'])
        .where({ userId })
        .whereIn('status', [DebtStatusesEnum.Unpaid, DebtStatusesEnum.PartiallyPaid])
        .preload('customer')
        .orderBy(db.raw('(amount - total_paid)'), 'desc'),

      // Fetch all product stock
      Product.query()
        .select(['id', 'name', 'currentStock', 'updatedAt'])
        .where({ userId })
        .orderBy('updatedAt', 'desc'),

      // Fetch paginated range-matching transactions
      /**
       * NB: Note that the model paginator properties like isEmpty, currentPage, lastPage, hasMorePages, total are used in the template.
       */
      reportTransactionsQuery.clone().paginate(page, 8), // 8 per page
    ])

    const totalSalesToday = Number(salesResult?.$extras.total) || 0
    const totalExpensesToday = Number(expensesResult?.$extras.total) || 0
    const totalOutstandingDebt = Number(debtResult?.$extras.total) || 0
    const netProfitToday = totalSalesToday - totalExpensesToday

    // Map the debts to the customers
    const mappedDebtors = activeDebtors.map((debtor) => {
      const itemDetails = debtor.itemName
        ? `${debtor.itemName} (${debtor.quantity || 1}x)`
        : 'Business Transaction'

      return {
        customerName: debtor.customer?.name || 'Unknown Customer',
        itemDetails,
        status: debtor.status,
        remainingBalance: Number(debtor.amount) - Number(debtor.totalPaid),
      }
    })

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
      activeDebtors: mappedDebtors,
      allProducts,
      reportTransactions,
      // Tracks states so template can "remember" active filter and pagination buttons:
      currentRange,
      currentType,
    })
  }
}
