import Groq from 'groq-sdk'
import BaseAIService from './base_ai_service.ts'

export default class GroqAI extends BaseAIService {
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        language: 'en',
        file,
      })
    } catch (error) {
      this.logger.error({ err: error }, '[GroqAI.transcribeAudio] Failed to transcribe audio.')

      throw error
    }

    const transcribedText = transcription.text

    this.logger.info(
      { transcribedText },
      '[GroqAI.transcribeAudio] Audio transcription successful.'
    )

    return transcribedText
  }
}
