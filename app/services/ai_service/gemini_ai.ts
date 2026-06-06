import env from '#start/env'
import { BusinessMetricsStructure } from '../../../contracts/app.ts'
import BaseAIService from './base_ai_service.ts'
import { GoogleGenAI, Type } from '@google/genai'

export default class GeminiAI extends BaseAIService {
  #gemini = new GoogleGenAI({ apiKey: env.get('GEMINI_API_KEY') })

  // Gemini can translate Nigerian local languages too.
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

  async extractBusinessMetrics(text: string): Promise<BusinessMetricsStructure> {
    try {
      const response = await this.#gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Parse this transcript: "${text}"`,
        config: {
          systemInstruction: this.prompt,
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
      throw error
    }
  }
}
