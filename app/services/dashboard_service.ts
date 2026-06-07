import env from '#start/env'
import BaseService from './base_service.ts'
import redis from '@adonisjs/redis/services/main'
import string from '@adonisjs/core/helpers/string'
import router from '@adonisjs/core/services/router'

export default class DashboardService extends BaseService {
  static get #cacheKeyPrefix() {
    return `short`
  }

  public static async generateDashboardLink({ userId }: { userId: string | number }) {
    const shortCode = string.random(6)

    await redis.setex(`${this.#cacheKeyPrefix}:${shortCode}`, 86400 /** 24h */, userId.toString())

    this.logger.info(
      { shortCode },
      '[DashboardService.generateDashboardLink] Short code set for user.'
    )

    const dashboardLink = router.urlBuilder.urlFor(
      'dashboard.show',
      { shortCode },
      { prefixUrl: env.get('APP_URL') }
    )

    this.logger.info(
      { shortCode, dashboardLink },
      '[DashboardService.generateDashboardLink] Link generated.'
    )

    return dashboardLink
  }

  public static async getUserFromDashboardLink({ shortCode }: { shortCode: string }) {
    if (!shortCode) {
      this.logger.warn(
        '[DashboardService.getUserFromDashboardLink] No short code in dashboard link.'
      )

      return { code: 400, message: 'Invalid link format.' }
    }

    const userIdStr = await redis.get(`${this.#cacheKeyPrefix}:${shortCode}`)

    if (!userIdStr) {
      this.logger.warn(
        { shortCode },
        '[DashboardService.getUserFromDashboardLink] Short code in dashboard link has expired or been tampered with!'
      )

      return {
        code: 403,
        message:
          'This dashboard link has expired or is invalid. Send a new voice note to get an updated link, boss!',
      }
    }

    this.logger.info(
      { shortCode },
      '[DashboardService.getUserFromDashboardLink] Dashboard link successfully decoded.'
    )

    return Number.parseInt(userIdStr, 10)
  }
}
