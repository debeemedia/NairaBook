import Groq from 'groq-sdk'
import BaseAIService from './base_ai_service.ts'
import { BusinessMetricsStructure } from '../../../contracts/app.ts'
import env from '#start/env'

export default class GroqAI extends BaseAIService {
  #groq = new Groq({ apiKey: env.get('GROQ_API_KEY') })

  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.#groq.audio.transcriptions.create({
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

  async extractBusinessMetrics(text: string): Promise<BusinessMetricsStructure> {
    try {
      const response = await this.#groq.chat.completions.create({
        model: 'qwen/qwen3-32b', // Better (but perhaps slower) than "llama-3.1-8b-instant"
        // model: 'llama-3.1-8b-instant',
        // model: 'meta-llama/llama-4-scout-17b-16e-instruct', // supports json_schema response format
        messages: [
          { role: 'system', content: this.prompt },
          { role: 'user', content: `Parse this transcript: "${text}"` },
        ],
        response_format: {
          type: 'json_object',
          /*
          type: 'json_schema',
          json_schema: {
            name: 'ledger_extraction',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  enum: ['transaction', 'inventory', 'unknown'],
                },
                type: {
                  type: 'string',
                  enum: ['sale', 'debt', 'expense', 'restock', 'unknown'],
                },
                customerName: {
                  type: ['string', 'null'],
                },
                itemName: {
                  type: ['string', 'null'],
                },
                quantity: {
                  type: ['integer', 'null'],
                },
                amount: {
                  type: 'string',
                  description:
                    'The financial value formatted as a decimal string with 2 decimal places, e.g., "45000.00"',
                },
              },
              required: ['intent', 'type', 'customerName', 'itemName', 'quantity', 'amount'],
              additionalProperties: false,
            },
          },
          */
        },
        temperature: 0.1, // Keep it low for predictable data parsing
      })

      const content = response.choices[0].message.content
      if (!content) {
        const errorMessage = 'Groq returned an empty response payload.'

        this.logger.error(`GroqAI.extractBusinessMetrics] ${errorMessage}`)

        throw new Error(errorMessage)
      }

      const metrics = JSON.parse(content)

      this.logger.info(
        { metrics },
        '[GroqAI.extractBusinessMetrics] Business metrics extraction successful.'
      )

      return metrics
    } catch (error) {
      this.logger.error(
        { err: error },
        'GroqAI.extractBusinessMetrics] Business metrics extraction failed.'
      )
      throw error
    }
  }
}
