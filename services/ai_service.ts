import Groq from 'groq-sdk'
import BaseService from './base_service.ts'
import env from '#start/env'

export default class AiService extends BaseService {
  static #grok = new Groq({ apiKey: env.get('GROQ_API_KEY') })

  public static async processVoiceNote(mediaUrl: string) {
    const downloadedBuffer = await this.#downloadMedia(mediaUrl)

    const text = await this.#transcribeAudio(downloadedBuffer)

    console.log('here is the text: ', text)
    /**
     * @todo: prompt to extract the business data and create db records accordingly
     */
  }

  static async #transcribeAudio(audioBuffer: ArrayBuffer) {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.#grok.audio.transcriptions.create({
        model: 'whisper-large-v3',
        language: 'en',
        file,
      })
    } catch (error) {
      this.logger.error({ err: error }, '[AiService.#transcribeAudio] Failed to transcribe audio.')

      throw error
    }

    this.logger.info('[AiService.#transcribeAudio] Audio transcription successful.')

    return transcription.text
  }

  static async #downloadMedia(mediaUrl: string) {
    let response: Response
    try {
      response = await fetch(mediaUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.get('TWILIO_ACCOUNT_SID')}:${env.get('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
        },
      })
    } catch (error) {
      this.logger.error({ err: error }, `[AiService.#downloadMedia] Fetch failed.`)

      throw error
    }

    if (!response.ok) {
      this.logger.error(
        { status: response.status, statusText: response.statusText },
        '[AiService.#downloadMedia] Media download failed.'
      )

      throw new Error(`Media download failed: ${response.status}`)
    }

    this.logger.info('[AiService.#downloadMedia] Media download successful.')

    return await response.arrayBuffer()
  }
}
