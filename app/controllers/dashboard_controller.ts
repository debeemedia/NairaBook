import DashboardService from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  async create({ view, response, request }: HttpContext) {
    const result = await DashboardService.getUserFromDashboardLink({
      shortCode: request.param('shortCode'),
    })

    if (typeof result !== 'number') {
      return response.status(result.code).send(result.message)
    }

    const userId = result

    /**
     * @todo: Queries here
     */

    return view.render('pages/dashboard', {})
  }
}
