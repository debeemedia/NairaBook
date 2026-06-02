import env from '#start/env'
import BaseAIService from './base_ai_service.ts'

export default class AethexAI extends BaseAIService {
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
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
          '[AethexAI.transcribeAudio] Aethex API responded with non-success.'
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

      this.logger.info({ data }, '[AethexAI.transcribeAudio] Transcription success.')

      return data.text
    } catch (error) {
      this.logger.error({ err: error }, '[AethexAI.transcribeAudio] Failed to send to Aethex AI.')

      throw error
    }
  }
}
