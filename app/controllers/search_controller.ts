import type { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import VideoTranscription from '#models/video_transcription'
import Person from '#models/person'
import logger from '@adonisjs/core/services/logger'

export default class SearchController {
  /**
   * Universal search across videos with filters
   */
  async search({ request, response }: HttpContext) {
    try {
      const query = request.input('q', '')
      const region = request.input('region', '')
      const personId = request.input('personId', '')
      const sortBy = request.input('sortBy', 'newest')
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      console.log('[Search] Query:', { query, region, personId, sortBy })

      // Start with base query - only published videos for public gallery
      let videoQuery = Video.query()
        .where('is_published', true)
        .preload('transcriptions', (q) => {
          q.where('is_current', true)
        })
        .preload('persons')

      // Filter by region
      if (region) {
        videoQuery = videoQuery.where('region', region)
      }

      // Filter by person
      if (personId) {
        videoQuery = videoQuery.whereHas('persons', (q) => {
          q.where('person_id', personId)
        })
      }

      // Text search in title, description, or transcription
      if (query && query.trim().length > 0) {
        const searchTerm = `%${query.toLowerCase()}%`

        // First get video IDs from transcription matches
        const transcriptions = await VideoTranscription.query()
          .where('is_current', true)
          .where('transcription_text', 'ilike', searchTerm)

        const matchingVideoIds = transcriptions.map((t) => t.videoId)

        videoQuery = videoQuery.where((q) => {
          q.where('title', 'ilike', searchTerm)
            .orWhere('description', 'ilike', searchTerm)
            .orWhereIn('id', matchingVideoIds)
        })
      }

      // Apply sorting
      switch (sortBy) {
        case 'oldest':
          videoQuery = videoQuery.orderBy('created_at', 'asc')
          break
        case 'views':
          videoQuery = videoQuery.orderBy('view_count', 'desc')
          break
        case 'likes':
          videoQuery = videoQuery.orderBy('like_count', 'desc')
          break
        case 'newest':
        default:
          videoQuery = videoQuery.orderBy('created_at', 'desc')
      }

      const videos = await videoQuery.paginate(page, limit)

      console.log('[Search] Found:', videos.total)

      // Format results
      const results = videos.all().map((video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnailPath: video.thumbnailPath,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        isPublished: video.isPublished,
        region: video.region,
        createdAt: video.createdAt,
        userId: video.userId,
        persons: video.persons.map((p) => ({
          id: p.id,
          name: p.name,
          socialMediaHandle: p.socialMediaHandle,
        })),
        transcription: video.transcriptions[0]
          ? {
              text: video.transcriptions[0].transcriptionText,
              language: video.transcriptions[0].language,
            }
          : null,
      }))

      return response.ok({
        data: results,
        meta: videos.getMeta(),
      })
    } catch (error) {
      console.error('[Search] Error:', error)
      logger.error('Search error:', error)
      return response.internalServerError({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get videos by specific person
   */
  async byPerson({ params, response }: HttpContext) {
    try {
      const person = await Person.findOrFail(params.personId)

      const videos = await Video.query()
        .where('is_published', true)
        .whereHas('persons', (q) => {
          q.where('person_id', params.personId)
        })
        .orderBy('created_at', 'desc')
        .exec()

      const formattedVideos = videos.map((video) => ({
        id: video.id,
        title: video.title,
        thumbnailPath: video.thumbnailPath,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        region: video.region,
        createdAt: video.createdAt,
      }))

      return response.ok({
        person: {
          id: person.id,
          name: person.name,
          socialMediaHandle: person.socialMediaHandle,
          platform: person.platform,
        },
        videos: formattedVideos,
        total: formattedVideos.length,
      })
    } catch (error) {
      logger.error('By person search error:', error)
      return response.internalServerError({
        error: 'Failed to get videos by person',
      })
    }
  }
}
