import type { HttpContext } from '@adonisjs/core/http'
import BaseAIService from '../services/ai_service/base_ai_service.ts'
import { inject } from '@adonisjs/core'
import MediaService from '../services/media_service.ts'
import User from '#models/user'
import { TwilioIncomingPayload } from '../../contracts/app.ts'

export default class WebhooksController {
  @inject()
  public async handleWhatsApp(
    { request, response, logger }: HttpContext,
    aiService: BaseAIService
  ) {
    const payload = request.all() as TwilioIncomingPayload

    logger.info({ payload }, '[WebhooksController.handleWhatsApp] Incoming Payload...')

    const mediaUrl = payload.MediaUrl0

    // Check that the media is supported
    const isSupportedAudio = ['audio/ogg', 'audio/x-ogg', 'application/ogg'].some((type) =>
      (payload.MediaContentType0 || '').startsWith(type)
    )

    const isText = payload.MessageType === 'text' || (!mediaUrl && payload.Body)
    const hasValidAudio = mediaUrl && isSupportedAudio

    if (!isText && !hasValidAudio) {
      logger.info(
        {
          messageType: payload.MessageType,
          contentType: payload.MediaContentType0,
        },
        '[WebhooksController.handleWhatsApp] Unsupported media detected.'
      )

      return response.status(200).header('Content-Type', 'text/xml').send(`
      <Response>
        <Message>Send a voice note or text, my boss!</Message>
      </Response>
    `)
    }

    if (isText && !payload.Body?.trim()) {
      return
    }

    if (!isText) {
      // Check the media size
      const fileSizeInBytes = await MediaService.checkSize(mediaUrl!)

      if (fileSizeInBytes === null) {
        logger.warn(
          '[WebhooksController.handleWhatsApp] Could not determine file size. Proceeding with caution.'
        )
      } else {
        if (fileSizeInBytes === 0) {
          return response.status(200).header('Content-Type', 'text/xml').send(`
              <Response>
                <Message>😶 Boss, nothing dey this your voice note o! Try recording again.</Message>
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
                <Message>😭 Boss, this voice note is too long o! Please keep it short and under ${maxFileSizeInMB}MB.</Message>
              </Response>
            `)
        }
      }
    }

    const senderPhone = payload.WaId // e.g., "+23481........"

    const user = await User.firstOrCreate(
      { phoneNumber: senderPhone },
      {
        phoneNumber: senderPhone,
        profileName: payload.ProfileName?.trim()
          ? // Strip off emojis etc.
            payload.ProfileName.replace(/\p{Extended_Pictographic}/gu, '').trim()
          : 'Boss',
      }
    )

    const targetMerchantWhatsappNumber = payload.From // e.g., "whatsapp:+23481........"
    const appSenderWhatsappNumber = payload.To // e.g., "whatsapp:+14155238886"

    /**
     * @todo: Use a queue for this later.
     */
    // Don't await this call so that the 200 response is sent to Twilio immediately.
    aiService
      .processMessage({
        mediaUrl: !isText ? mediaUrl : undefined,
        text: isText ? payload.Body?.trim() : undefined,
        userId: user.id,
        targetMerchantWhatsappNumber,
        appSenderWhatsappNumber,
      })
      .catch(() => {
        // Appropriate logs are in the service.
      })

    return response.ok({})
  }
}
