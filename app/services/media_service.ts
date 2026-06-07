import DashboardService from '#services/dashboard_service'
import env from '#start/env'
import BaseService from './base_service.ts'

export default class MediaService extends BaseService {
  static get #accountSid() {
    return env.get('TWILIO_ACCOUNT_SID')
  }

  static get #authorizationHeader() {
    return `Basic ${Buffer.from(`${this.#accountSid}:${env.get('TWILIO_AUTH_TOKEN')}`).toString('base64')}`
  }

  public static async download(mediaUrl: string) {
    let response: Response
    try {
      response = await fetch(mediaUrl, {
        headers: {
          Authorization: MediaService.#authorizationHeader,
        },
      })
    } catch (error) {
      this.logger.error({ err: error }, `[MediaService.download] Fetch failed.`)

      throw error
    }

    if (!response.ok) {
      this.logger.error(
        { status: response.status, statusText: response.statusText },
        '[MediaService.download] Media download failed.'
      )

      throw new Error(`Media download failed: ${response.status}`)
    }

    this.logger.info('[MediaService.download] Media download successful.')

    return await response.arrayBuffer()
  }

  /**
   * Performs a fast HTTP HEAD check to retrieve the content length in bytes.
   * Returns the byte size or null if it cannot be determined.
   */
  public static async checkSize(mediaUrl: string) {
    try {
      const headResponse = await fetch(mediaUrl, {
        method: 'HEAD',
        headers: {
          Authorization: this.#authorizationHeader,
        },
      })

      if (!headResponse.ok) {
        this.logger.warn(
          { status: headResponse.status },
          '[MediaService.checkSize] HEAD request returned non-success status.'
        )

        return null
      }

      const contentLength = headResponse.headers.get('content-length')

      if (contentLength) {
        this.logger.info(
          { contentLength },

          '[MediaService.checkSize] HEAD request successfully returned content length.'
        )
        return Number.parseInt(contentLength, 10)
      }

      this.logger.warn('[MediaService.checkSize] HEAD request did not return content length.')

      return null
    } catch (error) {
      this.logger.error({ err: error }, '[MediaService.checkSize] Failed to read media headers.')

      return null
    }
  }

  public static async sendWhatsAppMessage({
    from,
    to,
    messageBody,
    withDashboardLink,
    userId,
  }: {
    from: string
    to: string
    messageBody: string
    withDashboardLink?: boolean
    userId?: string | number
  }) {
    if (withDashboardLink) {
      if (!userId) {
        throw new Error(
          'MediaService.[sendWhatsAppMessage] `userId` is required to generate dashboard link.'
        )
      }
      messageBody += `\n\n🔗 *VIEW DASHBOARD:*\n${await DashboardService.generateDashboardLink({ userId })}`
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.#accountSid}/Messages.json`

    const formData = new URLSearchParams()
    formData.append('To', to)
    formData.append('From', from)
    formData.append('Body', messageBody)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.#authorizationHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Twilio API Error: ${response.status} - ${await response.text()}`)
      }

      return true
    } catch (error) {
      this.logger.error(
        { err: error },
        `[Media Service.sendWhatsAppMessage] Failed to dispatch message.`
      )

      return false
    }
  }
}
