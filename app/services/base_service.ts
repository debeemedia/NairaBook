import { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

// Use the logger from the HttpContext, if available, to automatically access and attach request_id to logs.
const resolveLogger = () => HttpContext.get()?.logger || logger

export default class BaseService {
  protected static get logger() {
    return resolveLogger()
  }
  protected get logger() {
    return resolveLogger()
  }
}
