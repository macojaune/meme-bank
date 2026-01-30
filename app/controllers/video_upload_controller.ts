import type { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import VideoMetadata from '#models/video_metadata'
import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'

@inject()
export default class VideoUploadController {
  /**
   * Upload a new video file
   */
  async upload({ request, response, auth }: HttpContext) {
    try {
      // Validate the uploaded file
      const file = request.file('video', {
        size: '10mb',
        extnames: ['mp4', 'webm', 'ogg', 'avi'],
      })

      if (!file) {
        return response.badRequest({ error: 'No video file provided' })
      }

      // Validate file properties
      if (!file.isValid) {
        return response.badRequest({
          error: 'Invalid file format',
          message: file.errors || 'File validation failed',
        })
      }

      // Generate filename with timestamp to avoid conflicts
      const timestamp = Date.now()
      const filename = `${timestamp}-${file.clientName}`
      const directory = 'videos'
      const filePath = `${directory}/${filename}`

      // Upload file to MinIO using Drive
      await file.move(`./${filePath}`)

      // Get region from request
      const region = request.input('region')

      // Validate region (optional, but must be one of allowed values if provided)
      const allowedRegions = ['guadeloupe', 'martinique', 'guyane']
      const validatedRegion = region && allowedRegions.includes(region) ? region : null

      // Create video record in database
      const video = await Video.create({
        userId: auth.user!.id,
        title: request.input('title', file.clientName),
        description: request.input('description'),
        filePath: filePath,
        thumbnailPath: null, // Will be set after processing
        durationSeconds: 0, // Will be extracted from video
        uploadDate: DateTime.now(),
        isPublished: false,
        isFeatured: false,
        viewCount: 0,
        likeCount: 0,
        region: validatedRegion,
      })

      // Create video metadata record
      await VideoMetadata.create({
        videoId: video.id,
        transcription: null, // Will be set after AI processing
        metadata: {
          originalName: file.clientName,
          mimeType: 'unknown',
          size: file.size,
        },
        embedding: null, // Will be set after processing
        analysisResults: null, // Will be set after AI processing
        language: request.input('language', 'fr'),
        hasCaptions: false,
      })

      return response.created({
        message: 'Video uploaded successfully',
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          filePath: video.filePath,
          thumbnailPath: video.thumbnailPath,
          durationSeconds: video.durationSeconds,
          isPublished: video.isPublished,
          uploadDate: video.uploadDate,
          metadata: {
            language: request.input('language', 'fr'),
            fileSize: file.size,
            mimeType: 'unknown',
          },
          nextSteps: [
            'Process video (extract metadata, generate thumbnail)',
            'Transcript the video (AI processing)',
            'Add tags and categories',
            'Publish the video',
          ],
        },
      })
    } catch (error) {
      console.error('Upload error:', error)
      return response.internalServerError({
        error: 'Upload failed',
        message: error.message,
      })
    }
  }

  /**
   * Get all videos for the authenticated user
   */
  async index({ auth, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const filters = {
      isPublished: request.input('published'),
      isFeatured: request.input('featured'),
    }

    const query = Video.query().where('userId', auth.user!.id)

    // Apply filters
    if (filters.isPublished !== undefined) {
      query.where('is_published', filters.isPublished)
    }
    if (filters.isFeatured !== undefined) {
      query.where('is_featured', filters.isFeatured)
    }

    // Eager load metadata and user
    query.preload('metadata').preload('tags').preload('categories')

    const videos = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return response.ok(videos)
  }

  /**
   * Get all public videos (for public API)
   */
  async publicIndex({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search')
    const language = request.input('language')

    const query = Video.query().where('is_published', true)

    // Apply search filter
    if (search) {
      query.where('title', 'ilike', `%${search}%`).orWhere('description', 'ilike', `%${search}%`)
    }

    // Apply language filter
    if (language) {
      // Without preloading for now
      // query.whereHas('metadata', (metadataQuery) => {
      //   metadataQuery.where('language', language)
      // })
    }

    // Basic query without problematic preloading for now
    const videos = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return response.ok({
      meta: {
        total: videos.getMeta().total,
        perPage: videos.getMeta().per_page,
        currentPage: videos.getMeta().current_page,
        lastPage: videos.getMeta().last_page,
      },
      data: videos.all(),
    })
  }

  /**
   * Get details of a specific video
   */
  async show({ params, response }: HttpContext) {
    const video = await Video.query()
      .where('id', params.id)
      .preload('metadata')
      .preload('user')
      .preload('tags')
      .preload('categories')
      .preload('comments')
      .preload('likes')
      .preload('views')
      .firstOrFail()

    return response.ok(video)
  }

  /**
   * Publish a video
   */
  async publish({ params, auth, response }: HttpContext) {
    const video = await Video.findOrFail(params.id)

    // Check ownership
    if (video.userId !== auth.user!.id) {
      return response.forbidden({ error: 'You can only publish your own videos' })
    }

    video.isPublished = true
    await video.save()

    return response.ok({
      message: 'Video published successfully',
      video,
    })
  }

  /**
   * Get video signed URL for direct access
   */
  async getSignedUrl({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      // Generate signed URL (will expire after 1 hour)
      const url = await getSignedUrl(video.filePath, {
        expiresIn: 3600, // 1 hour
      })

      return response.ok({
        url,
        filename: video.filePath,
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to generate URL',
        message: error.message,
      })
    }
  }

  /**
   * Delete a video
   */
  async destroy({ params, auth, response }: HttpContext) {
    const video = await Video.findOrFail(params.id)

    // Check ownership
    if (video.userId !== auth.user!.id) {
      return response.forbidden({ error: 'You can only delete your own videos' })
    }

    // Delete file from storage
    const driveService = drive.use('spaces')
    await driveService.delete(video.filePath)

    if (video.thumbnailPath) {
      await driveService.delete(video.thumbnailPath)
    }

    // Delete database records
    await video.metadata.delete()
    await video.delete()

    return response.ok({
      message: 'Video deleted successfully',
    })
  }
}

// Helper function to generate signed URL
async function getSignedUrl(filePath: string, _options?: { expiresIn: number }) {
  // This would use Drive's signed URL functionality
  // For now, return a placeholder URL
  return drive.use('spaces').getUrl(filePath)
}
