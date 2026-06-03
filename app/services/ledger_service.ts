import Customer from '#models/customer'
import Debt, { DebtStatusesEnum } from '#models/debt'
import Transaction, { TransactionTypesEnum } from '#models/transaction'
import db from '@adonisjs/lucid/services/db'
import { BusinessMetricsStructure } from '../../contracts/app.ts'
import BaseService from './base_service.ts'
import Product from '#models/product'
import ProductInventoryLog, {
  ProductInventoryLogQuantityChangeTypesEnum,
} from '#models/product_inventory_log'

export default class LedgerService extends BaseService {
  public static async handleTransaction({
    metrics,
    userId,
  }: {
    metrics: BusinessMetricsStructure
    userId: number
  }) {
    const normalizedItemName = metrics.itemName ? metrics.itemName.toLowerCase().trim() : null

    await db.transaction(async (trx) => {
      const transaction = await Transaction.create(
        {
          amount: parseFloat(metrics.amount),
          itemName: metrics.itemName || 'Unknown Item',
          quantity: metrics.quantity || 1,
          type: metrics.type,
          userId,
        },
        { client: trx }
      )

      let product: Product | null = null
      let productInventoryLog: ProductInventoryLog | null = null

      const isProductInventoryUpdated =
        transaction.type === TransactionTypesEnum.Sale && normalizedItemName

      if (isProductInventoryUpdated) {
        product = await Product.findBy({ name: normalizedItemName }, { client: trx })

        if (product) {
          const removedQuantity = Number(transaction.quantity) ?? 1

          await product
            .useTransaction(trx)
            .merge({ currentStock: (product.currentStock -= removedQuantity) })
            .save()

          productInventoryLog = await ProductInventoryLog.create(
            {
              productId: product.id,
              quantityChanged: removedQuantity,
              amount: transaction.amount,
              quantityChangeType: ProductInventoryLogQuantityChangeTypesEnum.Subtraction,
              notes: 'Product stock reduced via sale transaction.',
            },
            { client: trx }
          )
        }
      }

      this.logger.info(
        {
          userId,
          transactionId: transaction.id,
          transactionType: transaction.type,
          productId: product?.id ?? undefined,
          productInventoryLogId: productInventoryLog?.id ?? undefined,
          productInventoryLogNotes: productInventoryLog?.notes ?? undefined,
        },
        `[LedgerService.handleTransaction] Transaction ${isProductInventoryUpdated ? 'and Product Inventory ' : ''}recorded successfully.`
      )
    })
  }

  public static async handleDebt({
    metrics,
    userId,
  }: {
    metrics: BusinessMetricsStructure
    userId: number
  }) {
    if (!metrics.customerName?.trim()) {
      return this.logger.warn(
        { userId, metrics },
        '[LedgerService.handleDebt] Received debt without a customerName. Aborting.'
      )
    }
    if (!metrics.amount?.trim()) {
      return this.logger.warn(
        { userId, metrics },
        '[LedgerService.handleDebt] Received debt without an amount. Aborting.'
      )
    }
    /**
     * @todo: Send a whatsapp response for the above??
     */

    const normalizedItemName = metrics.itemName ? metrics.itemName.toLowerCase().trim() : null

    const normalizedCustomerName = metrics.customerName!.toUpperCase().trim()

    const removedQuantity = Number(metrics.quantity) || 1

    await db.transaction(async (trx) => {
      const customer = await Customer.firstOrCreate(
        { name: normalizedCustomerName },
        { name: normalizedCustomerName, userId },
        { client: trx }
      )

      let product: Product | null = null
      let productInventoryLog: ProductInventoryLog | null = null

      if (normalizedItemName) {
        product = await Product.findBy({ name: normalizedItemName }, { client: trx })

        if (product) {
          await product
            .useTransaction(trx)
            .merge({ currentStock: (product.currentStock -= removedQuantity) })
            .save()

          productInventoryLog = await ProductInventoryLog.create(
            {
              productId: product.id,
              quantityChanged: removedQuantity,
              amount: parseFloat(metrics.amount),
              quantityChangeType: ProductInventoryLogQuantityChangeTypesEnum.Subtraction,
              notes: 'Product stock reduced via customer credit.',
            },
            { client: trx }
          )
        }
      }

      const debt = await Debt.create(
        {
          userId,
          amount: parseFloat(metrics.amount),
          customerId: customer.id,
          itemName: metrics.itemName || 'Unknown Item',
          quantity: removedQuantity,
          productId: product?.id ?? null,
          // Db defaults for status (unpaid) and total_paid (0.00)
          // dueDate /** @todo */
        },
        { client: trx }
      )

      this.logger.info(
        {
          userId,
          customerId: customer.id,
          customerName: customer.name,
          debtId: debt.id,
          debtAmount: debt.amount,
          productId: product?.id ?? undefined,
          productInventoryLogId: productInventoryLog?.id ?? undefined,
          productInventoryLogNotes: productInventoryLog?.notes ?? undefined,
        },
        `[LedgerService.handleDebt] Debt ${normalizedItemName ? 'and Product Inventory ' : ''}recorded successfully.`
      )
    })
  }

  public static async handleDebtRepayment({
    metrics,
    userId,
  }: {
    metrics: BusinessMetricsStructure
    userId: number
  }) {
    if (!metrics.customerName?.trim()) {
      return this.logger.warn(
        { userId, metrics },
        '[LedgerService.handleDebtRepayment] Received debt repayment without a customerName. Aborting.'
      )
    }
    if (!metrics.amount?.trim()) {
      return this.logger.warn(
        { userId, metrics },
        '[LedgerService.handleDebtRepayment] Received debt repayment without an amount. Aborting.'
      )
    }

    const normalizedCustomerName = metrics.customerName!.toUpperCase().trim()

    const customer = await Customer.query().where({ userId, name: normalizedCustomerName }).first()

    if (!customer) {
      return this.logger.warn(
        { userId, metrics },
        `[LedgerService.handleDebtRepayment] Received debt repayment for non-existent customer.`
      )
    }

    // Fetch all active (unpaid/partial) debts for the customer, oldest first (FIFO)
    const activeDebts = await Debt.query()
      .where({ userId, customerId: customer.id })
      .whereIn('status', [DebtStatusesEnum.Unpaid, DebtStatusesEnum.PartiallyPaid])
      .orderBy('createdAt', 'asc')

    await db.transaction(async (trx) => {
      let repaymentAmount = parseFloat(metrics.amount)

      const debtsUpdated: Array<{
        debtId: number
        statusBefore: string
        statusAfter: string
        amountPaidInThisSession: number
      }> = []

      for (const debt of activeDebts) {
        if (repaymentAmount <= 0) {
          break
        }

        const totalDebtAmount = Number(debt.amount)
        const currentPaidFromDebtAmount = Number(debt.totalPaid)

        const remainingDebtBalance = totalDebtAmount - currentPaidFromDebtAmount

        const statusBefore = debt.status

        if (repaymentAmount >= remainingDebtBalance) {
          // Clear debt completely
          repaymentAmount -= remainingDebtBalance
          debt.totalPaid = totalDebtAmount
          debt.status = DebtStatusesEnum.Paid

          debtsUpdated.push({
            debtId: debt.id,
            statusBefore,
            statusAfter: DebtStatusesEnum.Paid,
            amountPaidInThisSession: remainingDebtBalance,
          })
        } else {
          // Partial payment
          debt.totalPaid = currentPaidFromDebtAmount + repaymentAmount

          debtsUpdated.push({
            debtId: debt.id,
            statusBefore,
            statusAfter: DebtStatusesEnum.PartiallyPaid,
            amountPaidInThisSession: repaymentAmount,
          })

          repaymentAmount = 0

          debt.status = DebtStatusesEnum.PartiallyPaid
        }

        await debt.useTransaction(trx).save()
      }

      // await Transaction.create(
      //   {
      //     userId,
      //     type: TransactionTypesEnum.Sale,
      //     itemName: metrics.itemName || 'Unknown Item',
      //     quantity: metrics.quantity || 1,
      //     amount: parseFloat(metrics.amount),
      //   },
      //   { client: trx }
      // )

      const transaction = await Transaction.create(
        {
          userId,
          type: TransactionTypesEnum.Sale,
          itemName: `Debt Repayment: ${customer.name}`,
          amount: parseFloat(metrics.amount),
        },
        { client: trx }
      )

      this.logger.info(
        {
          userId,
          transactionId: transaction.id,
          customerName: metrics.customerName,
          totalRepaymentBrought: parseFloat(metrics.amount),
          changeLeftOver: repaymentAmount, // Should be 0 unless they overpaid their entire total debt balance...
          debtsAffectedCount: debtsUpdated.length,
          debtsDetails: debtsUpdated,
        },
        '[LedgerService.handleDebtRepayment] Debt records updated and Transaction recorded successfully.'
      )
    })
  }

  public static async handleProductInventory({
    metrics,
    userId,
  }: {
    metrics: BusinessMetricsStructure
    userId: number
  }) {
    if (!metrics.itemName?.trim()) {
      return this.logger.warn(
        { userId, metrics },
        '[LedgerService.handleInventory] Received restock intent without an itemName. Aborting.'
      )
    }

    const normalizedItemName = metrics.itemName.toLowerCase().trim()

    await db.transaction(async (trx) => {
      const product = await Product.firstOrCreate(
        { name: normalizedItemName! },
        { name: normalizedItemName!, currentStock: 0, userId },
        { client: trx }
      )

      const addedQuantity =
        // The LLM may return this as a string
        (typeof metrics.quantity === 'string'
          ? Number.parseInt(metrics.quantity, 10)
          : metrics.quantity) || 1

      await product
        .useTransaction(trx)
        .merge({ currentStock: (product.currentStock += addedQuantity) })
        .save()

      const productInventoryLog = await ProductInventoryLog.create(
        {
          productId: product.id,
          quantityChanged: addedQuantity,
          amount: parseFloat(metrics.amount),
          quantityChangeType: ProductInventoryLogQuantityChangeTypesEnum.Addition,
          notes: 'Product restocked via voice note.',
        },
        { client: trx }
      )

      const transaction = await Transaction.create(
        {
          userId,
          type: TransactionTypesEnum.Expense,
          itemName: metrics.itemName || 'Unknown Item',
          quantity: metrics.quantity || 1,
          amount: parseFloat(metrics.amount),
        },
        { client: trx }
      )

      this.logger.info(
        {
          userId,
          productId: product.id,
          productName: product.name,
          addedQuantity,
          productInventoryLogId: productInventoryLog.id,
          productInventoryLogNotes: productInventoryLog.notes,
          transactionId: transaction.id,
        },
        '[LedgerService.handleProductInventory] Product Inventory and Trnasaction recorded successfully.'
      )
    })
  }
}
