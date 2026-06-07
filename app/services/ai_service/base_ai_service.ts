import BaseService from '../base_service.ts'
import MediaService from '../media_service.ts'

export default abstract class BaseAIService extends BaseService {
  public async processVoiceNote(mediaUrl: string) {
    const downloadedBuffer = await MediaService.download(mediaUrl)

    const text = await this.transcribeAudio(downloadedBuffer)

    console.log('here is the text: ', text)
    /**
     * @todo: prompt to extract the business data and create db records accordingly
     */
  }

  protected abstract transcribeAudio(audioBuffer: ArrayBuffer): Promise<string>
}
