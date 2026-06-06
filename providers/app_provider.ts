import type { ApplicationService } from '@adonisjs/core/types'
import BaseAIService from '../app/services/ai_service/base_ai_service.ts'
import env from '#start/env'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
    this.app.container.bind(BaseAIService, async () => {
      const aethexAiService = (await import('../app/services/ai_service/aethex_ai.ts')).default
      const groqAiService = (await import('../app/services/ai_service/groq_ai.ts')).default
      const geminiAiService = (await import('../app/services/ai_service/gemini_ai.ts')).default

      const aiServiceProvider = env.get('AI_SERVICE_PROVIDER').toLowerCase()

      return aiServiceProvider === 'aethex'
        ? new aethexAiService()
        : aiServiceProvider === 'gemini'
          ? new geminiAiService()
          : new groqAiService()
    })
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {}
}
