import Groq from 'groq-sdk'
import BaseService from './base_service.ts'
import env from '#start/env'

export default class AiService extends BaseService {
  static #grok = new Groq({ apiKey: env.get('GROQ_API_KEY') })

  public static async processVoiceNote(mediaUrl: string) {
    const downloadedBuffer = await this.#downloadMedia(mediaUrl)

    const text = await this.#transcribeAudioWithAethex(downloadedBuffer)

    console.log('here is the text: ', text)
    /**
     * @todo: prompt to extract the business data and create db records accordingly
     */
  }

  static async #transcribeAudioWithAethex(audioBuffer: ArrayBuffer): Promise<string> {
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' })

    const formData = new FormData()
    formData.append('file', audioBlob, 'voice_note.ogg')
    // formData.append('language', 'english')

    try {
      const response = await fetch('https://api.aethexai.com/api/v1/transcribe', {
        method: 'POST',
        headers: {
          'X-API-Key': env.get('AETHEX_API_KEY'),
        },
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown Error')

        this.logger.error(
          { status: response.status, statusText: response.statusText, errorBody },
          '[AiService.#transcribeAudioWithAethex] Aethex API responded with non-success.'
        )

        throw new Error(`Aethex API responded with status ${response.status}: ${errorBody}`)
      }

      const data = (await response.json()) as {
        id: string
        text: string
        language: string
        duration_seconds: number
        segments: []
        status: string
        processing_time_ms: number
        created_at: string
      }

      this.logger.info({ data }, '[AiService.#transcribeAudioWithAethex] Transcription success.')

      return data.text
    } catch (error) {
      this.logger.error(
        { err: error },
        '[AiService.#transcribeAudioWithAethex] Failed to send to Aethex AI.'
      )

      throw error
    }
  }

  static async #transcribeAudioWithGroq(audioBuffer: ArrayBuffer) {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.#grok.audio.transcriptions.create({
        model: 'whisper-large-v3',
        language: 'en',
        file,
      })
    } catch (error) {
      this.logger.error(
        { err: error },
        '[AiService.#transcribeAudioWithGroq] Failed to transcribe audio.'
      )

      throw error
    }

    this.logger.info('[AiService.#transcribeAudioWithGroq] Audio transcription successful.')

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
