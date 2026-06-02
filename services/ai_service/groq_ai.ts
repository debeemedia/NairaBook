import env from '#start/env'
import Groq from 'groq-sdk'
import BaseAIService from './base_ai_service.ts'

export default class GroqAI extends BaseAIService {
  #grok = new Groq({ apiKey: env.get('GROQ_API_KEY') })

  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.#grok.audio.transcriptions.create({
        model: 'whisper-large-v3',
        language: 'en',
        file,
      })
    } catch (error) {
      this.logger.error({ err: error }, '[GroqAI.transcribeAudio] Failed to transcribe audio.')

      throw error
    }

    this.logger.info('[GroqAI.transcribeAudio] Audio transcription successful.')

    return transcription.text
  }
}
