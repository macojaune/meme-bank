import type { HttpContext } from '@adonisjs/core/http'
import VideoTranscription from '#models/video_transcription'

export default class SearchController {
  async searchByText({ request, response }: HttpContext) {
    try {
      const query = request.input('q', '')
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      if (!query || query.trim().length === 0) {
        return response.badRequest({ error: 'Search query is required' })
      }

      const transcriptions = await VideoTranscription.query()
        .where('is_current', true)
        .where('transcription_text', 'ilike', `%${query}%`)
        .preload('video')
        .paginate(page, limit)

      const results = transcriptions.all().map((t) => ({
        video: t.video,
        transcription: {
          text: t.transcriptionText,
          language: t.language,
        },
      }))

      return response.ok({ data: results, meta: transcriptions.getMeta() })
    } catch (error) {
      return response.internalServerError({ error: 'Search failed' })
    }
  }
}
