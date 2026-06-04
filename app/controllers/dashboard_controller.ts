import DashboardService from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  async create({ view, response, request }: HttpContext) {
    const secureToken = request.input('token')

    const decryptedPayload = await DashboardService.decodeDashboardLink({ secureToken })

    if (typeof decryptedPayload === 'string') {
      return response.forbidden(decryptedPayload)
    }

    const userId = decryptedPayload.userId

    /**
     * @todo: Queries here
     */

    return view.render('pages/dashboard', {})
  }
}
