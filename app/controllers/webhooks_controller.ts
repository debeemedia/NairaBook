import type { HttpContext } from '@adonisjs/core/http'
import BaseAIService from '../../services/ai_service/base_ai_service.ts'
import { inject } from '@adonisjs/core'
import MediaService from '../../services/media_service.ts'

export default class WebhooksController {
  @inject()
  public async handleWhatsApp(
    { request, response, logger }: HttpContext,
    aiService: BaseAIService
  ) {
    const payload = request.all()

    logger.info({ payload }, '[WebhooksController.handleWhatsApp] Incoming Payload...')

    const mediaUrl = payload.MediaUrl0

    // Check that the media is supported
    const isSupportedAudio = ['audio/ogg', 'audio/x-ogg', 'application/ogg'].some((type) =>
      (payload.MediaContentType0 || '').startsWith(type)
    )

    if (!mediaUrl || payload.MessageType !== 'audio' || !isSupportedAudio) {
      logger.info(
        {
          messageType: payload.MessageType,
          contentType: payload.MediaContentType0,
        },
        '[WebhooksController.handleWhatsApp] Unsupported media or non-voice note detected.'
      )

      return response.status(200).header('Content-Type', 'text/xml').send(`
      <Response>
        <Message>Send a voice note, my boss!</Message>
      </Response>
    `)
    }

    // Check the media size
    const fileSizeInBytes = await MediaService.checkSize(mediaUrl)

    if (fileSizeInBytes === null) {
      logger.warn(
        '[WebhooksController.handleWhatsApp] Could not determine file size. Proceeding with caution.'
      )
    } else {
      if (fileSizeInBytes === 0) {
        return response.status(200).header('Content-Type', 'text/xml').send(`
              <Response>
                <Message>Boss, your voice note seems to be empty. Try recording again!</Message>
              </Response>
            `)
      }

      const maxFileSizeInMB = 7

      if (fileSizeInBytes > maxFileSizeInMB * 1024 * 1024) {
        logger.warn(
          { fileSizeInBytes },
          `[WebhooksController.handleWhatsApp] Rejected file: Exceeds ${maxFileSizeInMB}MB limit.`
        )
        return response.status(200).header('Content-Type', 'text/xml').send(`
              <Response>
                <Message>Boss, this voice note is too long! Please keep your recording short and under ${maxFileSizeInMB}MB.</Message>
              </Response>
            `)
      }
    }

    /**
     * @todo: Use a queue for this later.
     */
    // Don't await this call so that the 200 response is sent to Twilio immediately.
    aiService.processVoiceNote(mediaUrl).catch(() => {
      // Appropriate logs are in the service.
    })

    return response.ok({})
  }
}
