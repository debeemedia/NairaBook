import env from '#start/env'
import BaseService from './base_service.ts'
import redis from '@adonisjs/redis/services/main'
import string from '@adonisjs/core/helpers/string'

export default class DashboardService extends BaseService {
  static get #cacheKeyPrefix() {
    return `short`
  }

  public static async generateDashboardLink({ userId }: { userId: string | number }) {
    const shortCode = string.random(6)

    await redis.setex(`${this.#cacheKeyPrefix}:${shortCode}`, 86400 /** 24h */, userId.toString())

    this.logger.info(
      { userId, shortCode },
      '[DashboardService.generateDashboardLink] Short code set for user.'
    )

    const appUrl = env.get('APP_URL')

    return `${appUrl}/d/${shortCode}`
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

    const userId = Number.parseInt(userIdStr, 10)

    this.logger.info(
      { shortCode, userId },
      '[DashboardService.getUserFromDashboardLink] Dashboard link successfully decoded.'
    )

    return userId
  }
}
