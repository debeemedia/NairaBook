import type { HttpContext } from '@adonisjs/core/http'
import AiService from '../../services/ai_service.ts'

export default class WebhooksController {
  public async handleWhatsApp({ request, response, logger }: HttpContext) {
    const payload = request.all()

    logger.info({ payload }, '[WebhooksController.handleWhatsApp] Incoming Payload...')

    const mediaUrl = payload.MediaUrl0

    if (!mediaUrl || payload.MessageType !== 'audio') {
      logger.info('[WebhooksController.handleWhatsApp] No audio detected.')

      return response.status(200).header('Content-Type', 'text/xml').send(`
      <Response>
        <Message>Send a voice note, my boss!</Message>
      </Response>
    `)
    }

    /**
     * @todo: Use a queue for this later.
     */
    // Don't await this call so that the 200 response is sent to Twilio immediately.
    AiService.processVoiceNote(mediaUrl).catch(() => {
      // Appropriate logs are in the service.
    })

    return response.ok({})
  }
}
