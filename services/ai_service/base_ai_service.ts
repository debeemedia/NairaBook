import BaseService from '../base_service.ts'
import env from '#start/env'

export default abstract class BaseAIService extends BaseService {
  public async processVoiceNote(mediaUrl: string) {
    const downloadedBuffer = await this.#downloadMedia(mediaUrl)

    const text = await this.transcribeAudio(downloadedBuffer)

    console.log('here is the text: ', text)
    /**
     * @todo: prompt to extract the business data and create db records accordingly
     */
  }

  protected abstract transcribeAudio(audioBuffer: ArrayBuffer): Promise<string>

  async #downloadMedia(mediaUrl: string) {
    let response: Response
    try {
      response = await fetch(mediaUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.get('TWILIO_ACCOUNT_SID')}:${env.get('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
        },
      })
    } catch (error) {
      this.logger.error({ err: error }, `[BaseAIService.#downloadMedia] Fetch failed.`)

      throw error
    }

    if (!response.ok) {
      this.logger.error(
        { status: response.status, statusText: response.statusText },
        '[BaseAIService.#downloadMedia] Media download failed.'
      )

      throw new Error(`Media download failed: ${response.status}`)
    }

    this.logger.info('[BaseAIService.#downloadMedia] Media download successful.')

    return await response.arrayBuffer()
  }
}
