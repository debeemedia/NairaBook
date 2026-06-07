import BaseService from '../base_service.ts'
import MediaService from '../media_service.ts'
import { BusinessMetricsStructure } from '../../../contracts/app.ts'
import LedgerService from '#services/ledger_service'

export default abstract class BaseAIService extends BaseService {
  public async processMessage({
    mediaUrl,
    text,
    userId,
    targetMerchantWhatsappNumber,
    appSenderWhatsappNumber,
  }: {
    mediaUrl?: string
    text?: string
    userId: number
    targetMerchantWhatsappNumber: string
    appSenderWhatsappNumber: string
  }) {
    if (!mediaUrl && !text) {
      throw new Error('Provide text or audio for processing.')
    }

    if (mediaUrl) {
      const downloadedBuffer = await MediaService.download(mediaUrl)

      text = await this.transcribeAudio(downloadedBuffer)
    }

    if (!text || text.trim() === '') {
      this.logger.warn({ userId }, '[BaseAIService] Received empty transcript.')
      return
    }

    const translatedText = await this.translateText(text)

    const metrics = await this.extractBusinessMetrics(translatedText)

    if (metrics.intent === 'unknown') {
      this.logger.warn(
        { userId, metrics },
        '[BaseAIService.processMessage] Could not resolve intent from transcript.'
      )

      return await MediaService.sendWhatsAppMessage({
        from: appSenderWhatsappNumber,
        to: targetMerchantWhatsappNumber,
        messageBody: `😮 Boss, I didn't get that clearly.\nPlease try again! Say something like:\n"I sold two bags of rice for 20k" or "Tunde bought 3 eggs on credit."`,
        withDashboardLink: true,
        userId,
      })
    }

    /**
     * NB: Ensure that amount is provided for every business action,
     * even for product restocking since an expense record is created for it.
     */
    if (!metrics.amount && metrics.amount !== '0.00') {
      this.logger.warn({ userId, metrics }, '[BaseAIService.processMessage] Amount not provided.')

      return await MediaService.sendWhatsAppMessage({
        from: appSenderWhatsappNumber,
        to: targetMerchantWhatsappNumber,
        messageBody: `😮 Boss! You did not provide the amount.\n Please try again and tell me how much is involved.`,
        withDashboardLink: true,
        userId,
      })
    }

    let messageBody = ''

    try {
      let result: string | void | null = null

      if (
        metrics.intent === 'transaction' &&
        (metrics.type === 'sale' || metrics.type === 'expense')
      ) {
        // Handle Transactions: sales & expenses
        result = await LedgerService.handleTransaction({ metrics, userId })
        //
      } else if (metrics.type === 'debt') {
        // Handle Debts: customer credit
        result = await LedgerService.handleDebt({ metrics, userId })
        //
      } else if (metrics.type === 'repayment') {
        // Handle Debt Repayment: partial or full
        result = await LedgerService.handleDebtRepayment({ metrics, userId })
        //
      } else if (metrics.intent === 'inventory' || metrics.type === 'restock') {
        // Handle Inventory: restocking products
        result = await LedgerService.handleProductInventory({ metrics, userId })
      }

      if (typeof result === 'string') {
        messageBody = result
        //
      } else {
        //  Map the metrics types to relatable phrases and emojis
        const typeMappings: Record<
          BusinessMetricsStructure['type'],
          { title: string; emoji: string }
        > = {
          sale: { title: 'Sales Record', emoji: '💰' },
          expense: { title: 'Expense', emoji: '💸' },
          debt: { title: 'Customer Credit', emoji: '📝' },
          repayment: { title: 'Credit Payment', emoji: '💰📝' },
          restock: { title: 'Stock', emoji: '📦' },
          unknown: { title: 'Record', emoji: '📊' },
        }

        const mapping = typeMappings[metrics.type]

        const messageLines = [
          `${mapping.emoji} *${mapping.title} updated successfully, Boss!*`,

          `--------------------------------`,

          metrics.itemName ? `▪️ *Item:* ${metrics.itemName}` : null,

          metrics.amount
            ? `▪️ *Amount:* ₦${parseFloat(metrics.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
            : null,

          metrics.quantity ? `▪️ *Quantity:* ${metrics.quantity}` : null,

          metrics.customerName ? `▪️ *Customer:* ${metrics.customerName}` : null,
        ]

        // Filter out null lines and join them with newlines
        messageBody = messageLines.filter(Boolean).join('\n')
        //
      }
    } catch (error) {
      this.logger.error(
        { err: error, metrics },
        '[BaseAIService.processMessage -> LedgerService] Database persistence failed for extracted metrics.'
      )

      throw error
    }

    return await MediaService.sendWhatsAppMessage({
      from: appSenderWhatsappNumber,
      to: targetMerchantWhatsappNumber,
      messageBody,
      withDashboardLink: true,
      userId,
    })
  }

  protected abstract transcribeAudio(audioBuffer: ArrayBuffer): Promise<string>

  protected abstract translateText(text: string): Promise<string>

  protected abstract extractBusinessMetrics(text: string): Promise<BusinessMetricsStructure>

  protected translationPrompt = `
    You are a highly accurate, direct translation engine for NairaBook.
    Your single job is to translate the user's input text into clean, natural English.
    The input text may be in Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mix of English and local dialects.
    
    RULES:
    1. Translate everything literally and contextually into English, whether it is a business transaction, a greeting, a question, or a casual statement.
    2. Maintain all original proper nouns, names (e.g., Tunde, Musa), item names, numbers, and quantities exactly as they are.
    3. DO NOT add any conversational filler, notes, or explanations.

    Return ONLY the plain text English translation. No markdown wrappers, no filler.
  `

  protected extractionPrompt = `
      You are a specialized financial parsing engine for NairaBook, a ledger app for Nigerian micro-merchants.
      Your job is to parse raw text transcripts (which may include Nigerian Pidgin, local business slang, or currency terms) and output a STRICT, valid JSON object.
      
      Rules for parsing:
      1. Map local terms accurately based on WHO is performing the action: 
         - MERCANT SELLING: "I sell", "somebody buy from me", "[Customer Name] bought", "[Customer Name] collect", "[Customer Name] pay me" -> intent is "transaction", type is "sale"
         - CUSTOMER CREDIT: "dey owe", "collect on credit", "customer never pay", "[Customer Name] never pay" -> intent is "transaction", type is "debt"
         - DEBT REPAYMENT: "customer pay part of their debt", "clear money", "[Customer Name] bring money for what he took" -> intent is "transaction", type is "repayment"
         - MERCHANT OPERATING EXPENSE: "I buy fuel", "pay rent", "transportation" -> intent is "transaction", type is "expense"
         - MERCHANT RESTOCKING: "restock", "add new stock", "I buy market", "I buy [goods/items to sell]" -> intent is "inventory", type is "restock"
         
      CRITICAL BUSINESS RULES: 
      1. SUBJECT AWARENESS: Distinguish between the merchant ("I") and a customer (e.g., "Tunde", "Musa", "Mama Amaka").
         - If a specific person's name is mentioned buying something (e.g., "Tunde bought one cup of rice"), this is a "sale" transaction, NOT a restock. Extract the name into 'customerName'.
         - Only treat "bought" or "paid for" as a restock inventory entry if the merchant implies THEY ("I") bought it to replenish the shop (e.g., "I bought 3 bags of rice to sell", "I buy market").
      2. AMOUNT FALLBACK: Assume that the currency is always NAIRA. If an amount is mangled or has typos like "500nra" or "500sad nara", recognize it as the currency amount and extract it cleanly as "500.00".

      2. Currency/Amount parsing:
         - Extract amounts cleanly. "5k" is "5000.00", "20 thousand" is "20000.00".
         - Always return numbers as a string with exactly two decimal places to protect precision.
      3. If fields are missing, return null.
      4. Formulate the itemName intelligently:
        - Extract the base item name as a singular noun without plurals or quantities (e.g., 'bags of rice' becomes 'rice', 'crates of egg' becomes 'egg').
        - If a unit of measurement is mentioned (like bag, crate, carton, cup), append it in parentheses to the base item name.
         - Examples: 
           "two bags of rice" -> itemName: "rice (bag)", quantity: 2
           "three cups of rice" -> itemName: "rice (cup)", quantity: 3
           "one crate of egg" -> itemName: "egg (crate)", quantity: 1
           "5 pieces of egg or 5 eggs" -> itemName: "egg (piece)", quantity: 5

      STRICT JSON FORMAT OUTPUT ONLY. No conversational filler, no markdown wrappers like \`\`\`json.
      {
        "intent": "transaction" | "inventory" | "unknown",
        "type": "sale" | "debt" | "repayment" | "expense" | "restock" | "unknown",
        "customerName": "String or null",
        "itemName": "String or null",
        "quantity": integer or null,
        "amount": "string decimal or null"
      }
    `
}
