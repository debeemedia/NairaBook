import Groq from 'groq-sdk'
import BaseAIService from './base_ai_service.ts'
import { BusinessMetricsStructure } from '../../../contracts/app.ts'
import env from '#start/env'

export default class GroqAI extends BaseAIService {
  #groq = new Groq({ apiKey: env.get('GROQ_API_KEY') })

  /**
   * Note that Groq Whisper is useless for transcribing Nigerian local languages.
   * Kept here as fallback. Useful for English, maybe Pidgin. Unlimited tries with no rate limits when testing.
   */
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    const file = new File([audioBuffer], 'voice_note.ogg', { type: 'audio/ogg' })

    let transcription: Groq.Audio.Transcriptions.Transcription | null = null

    try {
      transcription = await this.#groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        prompt:
          'NairaBook app transcript. Recording informal marketplace retail transactions, spoken in a mix of English, Nigerian Pidgin and local languages like Igbo, Yoruba, and Hausa. Tracking cash flow, sales, customer debts, and inventory restocks.',
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

  async translateText(text: string): Promise<string> {
    try {
      const response = await this.#groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: this.translationPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3, // Slightly higher for natural translation fluidity, but keeping it grounded
      })

      const translatedText = response.choices[0].message.content?.trim()

      // Strip off any "think" block that may come with the translation.
      const cleanTranslatedText = translatedText
        ? translatedText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        : ''

      if (!cleanTranslatedText) {
        this.logger.warn(
          { originalText: text },
          '[GroqAI.translateText] Translation returned empty content. Falling back to original text.'
        )
        return text
      }

      this.logger.info(
        { originalText: text, cleanTranslatedText },
        '[GroqAI.translateText] Text normalization/translation successful.'
      )

      return cleanTranslatedText
    } catch (error) {
      this.logger.error(
        { err: error, originalText: text },
        '[GroqAI.translateText] Text translation failed. Falling back to original text to prevent crash.'
      )

      return text
    }
  }

  async extractBusinessMetrics(text: string): Promise<BusinessMetricsStructure> {
    try {
      const response = await this.#groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: this.extractionPrompt },
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
                  type: ['string', 'null'],
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
