import env from '#start/env'
import { BusinessMetricsStructure } from '../../../contracts/app.ts'
import BaseAIService from './base_ai_service.ts'
import { GoogleGenAI, Type } from '@google/genai'

export default class GeminiAI extends BaseAIService {
  #gemini = new GoogleGenAI({ apiKey: env.get('GEMINI_API_KEY') })

  #isStandaloneTextCall?: boolean

  constructor(config?: { isStandaloneTextCall?: boolean }) {
    super()
    this.#isStandaloneTextCall = config?.isStandaloneTextCall ?? false
  }
  /**
   * Gemini can translate Nigerian local languages well.
   * But I've observed that the model performs better when transcription and translation are done in one prompot. When split, the transcription is as good as Aethex' (not good).
   */
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      const base64Audio = Buffer.from(audioBuffer).toString('base64')

      const response = await this.#gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'audio/ogg',
              data: base64Audio,
            },
          },
          // 'Transcribe this Nigerian audio note completely and accurately. Retain Pidgin, slang, names, and currency terms perfectly. Do not summarize.',
          `Transcribe this audio note. If it is spoken in a native Nigerian language (like Yoruba, Igbo, Hausa), provide BOTH the raw transcription and a direct English translation.
          
          Return your response as a valid JSON object matching this schema:
          {
            "transcript": "The raw text exactly as spoken in the native dialect",
            "translation": "The direct, accurate English translation"
          }`,
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING },
              translation: { type: Type.STRING },
            },
            required: ['transcript', 'translation'],
          },
        },
      })

      const data = JSON.parse(response.text!)

      // Log both the native and english
      this.logger.info(
        {
          nativeTranscript: data.transcript,
          englishTranslation: data.translation,
        },
        '[GeminiAI.transcribeAudio] Audio processed successfully.'
      )

      // Return the translated English
      return data.translation
    } catch (error) {
      this.logger.error({ err: error }, '[GeminiAI.transcribeAudio] Failed to process audio.')
      throw error
    }
  }

  // Only transcription:
  /*
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      const base64Audio = Buffer.from(audioBuffer).toString('base64')

      const response = await this.#gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'audio/ogg',
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe this audio clip for NairaBook. It features informal marketplace retail conversations spoken in a mix of English, Nigerian Pidgin, Yoruba, Igbo, or Hausa. Output the exact spoken words verbatim. Do not translate it to English yet.',
          },
        ],
      })

      const transcribedText = response.text?.trim()

      if (!transcribedText) {
        throw new Error('Gemini audio transcription returned an empty string.')
      }

      this.logger.info(
        { transcribedText },
        '[GeminiAI.transcribeAudio] Audio transcription successful.'
      )

      return transcribedText
    } catch (error) {
      this.logger.error({ err: error }, '[GeminiAI.transcribeAudio] Failed to transcribe audio.')
      throw error
    }
  }
    */

  async translateText(text: string): Promise<string> {
    /**
     * NB: Since the text coming from `transcribeAudio` (when going through the full Gemini piopeline) is already translated, we skip the extra call to translate again.
     * However, Aethex API calls Gemini's `translateText`. This is where we use the flag `isStandaloneTextCall`
     */
    if (!this.#isStandaloneTextCall) {
      this.logger.info(
        { text },
        '[GeminiAI.translateText] Internal pipeline flow from Gemini ensures text is already translated. Skipping API call.'
      )
      return text
    }

    try {
      this.logger.info(
        { text },
        '[GeminiAI.translateText] External pipeline activates `isStandaloneTextCall` mode. Requesting API translation...'
      )

      const response = await this.#gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate this text: "${text}"`,
        config: {
          systemInstruction: this.translationPrompt,
          temperature: 0.3, // Fluid but deterministic
        },
      })

      const translatedText = response.text?.trim()

      if (!translatedText) {
        this.logger.warn(
          { originalText: text },
          '[GeminiAI.translateText] Translation returned empty content. Falling back to original text.'
        )
        return text
      }

      this.logger.info(
        { originalText: text, translatedText },
        '[GeminiAI.translateText] Text normalization/translation successful.'
      )

      return translatedText
    } catch (error) {
      this.logger.error(
        { err: error, originalText: text },
        '[GeminiAI.translateText] Text translation failed.'
        // Falling back to original text.
      )

      /**
       * @todo: Remove this trycatch fallback after Demo.
       *
       * For now, if Gemini hits a 503/429 during translation, intercept it and pass it to Groq so it gets translated before extraction.
       */
      try {
        const groqFallback = await this.#getFallBackAiService()
        const fallbackTranslation = await groqFallback.translateText(text)

        this.logger.info(
          { originalText: text, translatedText: fallbackTranslation },
          '[GeminiAI.translateText] Emergency Groq translation fallback successful!'
        )

        return fallbackTranslation
      } catch (groqError) {
        this.logger.error(
          { err: groqError, originalText: text },
          '[GeminiAI.translateText] Both translation engines failed. Safely falling back to raw text.'
        )
        // If both completely die, fallback to the original text as a final safety net
        return text
      }

      // Re-enable this after disabling the trycatch
      // return text
    }
  }

  async extractBusinessMetrics(text: string): Promise<BusinessMetricsStructure> {
    try {
      const response = await this.#gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Parse this transcript: "${text}"`,
        config: {
          systemInstruction: this.extractionPrompt,
          temperature: 0.1, // Keep low for deterministic business data
          responseMimeType: 'application/json',
          // Force Gemini to follow the interface layout at the compiler level
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: ['transaction', 'inventory', 'unknown'],
              },
              type: {
                type: Type.STRING,
                enum: ['sale', 'debt', 'repayment', 'expense', 'restock', 'unknown'],
              },
              customerName: {
                type: Type.STRING,
                nullable: true,
              },
              itemName: {
                type: Type.STRING,
                nullable: true,
              },
              quantity: {
                type: Type.INTEGER,
                nullable: true,
              },
              amount: {
                type: Type.STRING,
                nullable: true,
                description:
                  'The financial value formatted as a decimal string with 2 decimal places, e.g., "45000.00"',
              },
            },
            required: ['intent', 'type', 'customerName', 'itemName', 'quantity', 'amount'],
          },
        },
      })

      const content = response.text
      if (!content) {
        const errorMessage = 'Gemini returned an empty structured text payload.'

        this.logger.error(`[GeminiAI.extractBusinessMetrics] ${errorMessage}`)

        throw new Error(errorMessage)
      }

      // Safe to parse because responseSchema guarantees structural integrity
      const metrics = JSON.parse(content) as BusinessMetricsStructure

      this.logger.info(
        { metrics },
        '[GeminiAI.extractBusinessMetrics] Business metrics extraction successful.'
      )

      return metrics
    } catch (error) {
      this.logger.error(
        { err: error },
        '[GeminiAI.extractBusinessMetrics] Business metrics extraction failed.'
      )

      /**
       * @todo: Remove this trycatch fallback after Demo.
       *
       * For now, if Gemini hits a 503/429 during extraction, intercept it and pass it to Groq.
       */
      try {
        const groqFallback = await this.#getFallBackAiService()
        const fallbackMetrics = await groqFallback.extractBusinessMetrics(text)

        this.logger.info(
          { metrics: fallbackMetrics },
          '[GeminiAI.extractBusinessMetrics] Emergency Groq fallback successful!'
        )
        return fallbackMetrics
      } catch (groqError) {
        this.logger.error(
          { err: groqError },
          '[GeminiAI.extractBusinessMetrics] Both AI engines failed.'
        )
        throw groqError
      }

      // Re-enable this after disabling the trycatch
      // throw error
    }
  }

  /**
   * Temporary Fallback to Groq for Demo,
   * in case of 503 and 429 from Gemini.
   */
  async #getFallBackAiService() {
    const GroqAiClass = (await import('./groq_ai.ts')).default

    this.logger.info('[GeminiAI.getFallBackAiService] Getting GroqAI as fallback...')

    return new GroqAiClass()
  }
}
