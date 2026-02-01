import { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import VideoTranscription from '#models/video_transcription'

export default class VideoStatusController {
  /**
   * Get processing status for a list of video IDs
   * Used for polling by frontend
   */
  async checkStatus({ request, response }: HttpContext) {
    try {
      const { videoIds } = request.only(['videoIds'])

      if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return response.badRequest({ error: 'videoIds array required' })
      }

      // Get all videos with their processing status
      const videos = await Video.query()
        .whereIn('id', videoIds)
        .select('id', 'isPublished', 'thumbnailPath')

      const statuses = await Promise.all(
        videos.map(async (video) => {
          // Check transcription status
          const transcription = await VideoTranscription.query()
            .where('videoId', video.id)
            .where('isCurrent', true)
            .first()

          return {
            id: video.id,
            isPublished: video.isPublished,
            hasTranscription: !!transcription,
            hasThumbnail: !!video.thumbnailPath,
            transcriptionStatus: transcription?.status || null,
            isComplete: video.isPublished && !!transcription && !!video.thumbnailPath,
          }
        })
      )

      return response.ok({
        data: statuses,
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to check video status',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get single video status
   */
  async show({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      const transcription = await VideoTranscription.query()
        .where('videoId', video.id)
        .where('isCurrent', true)
        .first()

      return response.ok({
        data: {
          id: video.id,
          isPublished: video.isPublished,
          hasTranscription: !!transcription,
          hasThumbnail: !!video.thumbnailPath,
          transcriptionStatus: transcription?.status || null,
          isComplete: video.isPublished && !!transcription && !!video.thumbnailPath,
        },
      })
    } catch (error) {
      return response.notFound({
        error: 'Video not found',
      })
    }
  }
}
