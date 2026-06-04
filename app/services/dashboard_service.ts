import env from '#start/env'
import encryption from '@adonisjs/core/services/encryption'
import BaseService from './base_service.ts'

export default class DashboardService extends BaseService {
  public static async generateDashboardLink({ userId }: { userId: string | number }) {
    const payload = { userId, timestamp: Date.now() }

    const secureToken = encryption.encrypt(payload, '24h')

    const appUrl = env.get('APP_URL')

    // Shorten the URL
    return await this.#shortenUrl(`${appUrl}/dashboard?token=${encodeURIComponent(secureToken)}`)
  }

  static async #shortenUrl(longUrl: string) {
    try {
      const response = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
        {
          signal: AbortSignal.timeout(5000), // Don't let a hanging upstream server block the app
        }
      )

      if (response.ok) {
        const shortUrl = await response.text() // e.g.https://tinyurl.com/267v7cf5

        this.logger.info(
          { shortUrl, longUrl },
          '[DashboardService.#shortenUrl] URL successfully shortened.'
        )

        return shortUrl
      }

      this.logger.warn(
        { status: response.status, statusText: response.statusText },
        '[DashboardService.#shortenUrl] Failed to shorten URL. Returning long URL.'
      )

      return longUrl
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`[DashboardService.#shortenUrl] Request timed out. Returning long URL.`)
      } else {
        this.logger.error(
          { err: error },
          '[DashboardService.#shortenUrl] Failed to shorten URL. Returning long URL.'
        )
      }

      return longUrl
    }
  }

  public static async decodeDashboardLink({ secureToken }: { secureToken: string }) {
    if (!secureToken) {
      this.logger.warn('[DashboardService.decodeDashboardLink] No secure token in dashboard link!')

      return 'Missing secure access token. Please open the link from your WhatsApp message.'
    }

    const decryptedPayload = encryption.decrypt<{ userId: string | number; timestamp: number }>(
      secureToken
    )

    if (!decryptedPayload) {
      this.logger.warn(
        '[DashboardService.decodeDashboardLink] Token in dashboard link has expired or been tampered with!'
      )

      return 'This dashboard link has expired or is invalid. Send a new voice note to get an updated link, boss!'
    }

    this.logger.info(
      { decryptedPayload },
      '[DashboardService.decodeDashboardLink] Dashboard link successfully decoded.'
    )

    return decryptedPayload
  }
}
