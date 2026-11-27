import type { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import Like from '#models/like'
import { videoDisk } from '#services/video_storage'
import { canViewVideo } from '#services/video_access'
import logger from '@adonisjs/core/services/logger'
import emitter from '@adonisjs/core/services/emitter'
import { validatedVideo, persistWebUpload, dispatchVideoUpload } from '#services/video_upload'
import VideoDownloaded from '#events/video_downloaded'

export default class VideoUploadController {
  async upload({ request, response, auth }: HttpContext) {
    const file = validatedVideo(request)
    if (!file || !file.isValid || !file.tmpPath) {
      return response.badRequest({ error: 'Invalid video', message: file?.errors })
    }
    try {
      const user = auth.user!
      const video = await persistWebUpload(file, user, {
        title: request.input('title') ?? file.clientName,
        description: request.input('description'),
        region: request.input('region'),
        personsData: request.input('persons'),
      })
      await dispatchVideoUpload(video, user)
      return response.redirect().toPath('/gallery')
    } catch (error) {
      logger.error({ err: error }, 'Upload failed')
      return response.internalServerError({ error: 'Upload failed' })
    }
  }

  /**
   * Get all public videos (for public API)
   * Includes published videos + current user's unpublished videos (for processing visibility)
   */
  async publicIndex({ request, response, auth }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search')
    const language = request.input('language')

    const query = Video.query().where((builder) => {
      builder.where('is_published', true)
      // If user is authenticated, also show their unpublished videos
      if (auth.user) {
        builder.orWhere((subBuilder) => {
          subBuilder.where('is_published', false).where('user_id', auth.user!.id)
        })
      }
    })

    // Apply search filter
    if (search) {
      query.where((filter) => {
        filter.where('title', 'ilike', `%${search}%`).orWhere('description', 'ilike', `%${search}%`)
      })
    }

    // Apply language filter
    if (language) {
      // Without preloading for now
      // query.whereHas('metadata', (metadataQuery) => {
      //   query.where('language', language)
      // })
    }

    // Basic query without problematic preloading for now
    const videos = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return response.ok(videos)
  }

  /**
   * Get video details (for public viewing)
   */
  async show({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      // Check if video is published
      if (!video.isPublished) {
        return response.redirect('/gallery')
      }

      // Increment view count
      video.viewCount++
      await video.save()

      return response.ok(video)
    } catch (error) {
      return response.redirect('/gallery') // was: notFound({
    }
  }

  /**
   * Delete a video
   */
  async delete({ params, response, auth, request }: HttpContext) {
    logger.info(`[Delete] DELETE request received for video ID: ${params.id}`)
    logger.info(`[Delete] Auth user: ${auth.user?.id || 'not authenticated'}`)
    logger.info(`[Delete] Request URL: ${request.url()}`)

    try {
      logger.info(`[Delete] Starting deletion for video ${params.id}`)
      const video = await Video.findOrFail(params.id)
      logger.info(`[Delete] Found video ${video.id}, userId: ${video.userId}`)

      // Check if user owns the video or is admin
      if (video.userId !== auth.user!.id) {
        return response.forbidden({
          error: 'You do not have permission to delete this video',
        })
      }

      // Delete file from storage
      const driveService = videoDisk(video.skipAutoTranscription)
      logger.info(`[Delete] Deleting video file: ${video.filePath}`)
      await driveService.delete(video.filePath)

      if (video.thumbnailPath) {
        logger.info(`[Delete] Deleting thumbnail: ${video.thumbnailPath}`)
        await driveService.delete(video.thumbnailPath)
      }

      // Delete video record
      logger.info(`[Delete] Deleting video record from database`)
      await video.delete()
      logger.info(`[Delete] Successfully deleted video ${video.id}`)

      // Return success - Inertia compatible redirect
      return response.redirect('/gallery')
    } catch (error) {
      logger.error(`[Delete] Failed to delete video ${params.id}: ${error.message}`)
      return response.internalServerError({
        error: 'Failed to delete video',
        message: error.message,
      })
    }
  }

  async media({ params, request, response, auth }: HttpContext) {
    const video = await Video.find(params.id)
    if (!video || !video.skipAutoTranscription || !canViewVideo(video, auth.user?.id)) {
      return response.notFound()
    }

    const thumbnail = params.asset === 'thumbnail'
    const key = thumbnail ? video.thumbnailPath : video.filePath
    if (!key) return response.notFound()

    const disk = videoDisk(true)
    const contents = await disk.getBytes(key)
    const ext = key.split('.').pop()
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      avi: 'video/x-msvideo',
      jpg: 'image/jpeg',
    }
    response.header('Content-Type', mimeTypes[ext ?? ''] ?? 'application/octet-stream')
    response.header('Cache-Control', 'private, no-store')
    response.header('Accept-Ranges', 'bytes')

    const range = request.header('range')?.match(/^bytes=(\d*)-(\d*)$/)
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, contents.length - Number(range[2]))
      const end =
        range[1] && range[2] ? Math.min(Number(range[2]), contents.length - 1) : contents.length - 1
      if (start > end) {
        response.header('Content-Range', `bytes */${contents.length}`)
        return response.status(416).send('')
      }
      response.header('Content-Range', `bytes ${start}-${end}/${contents.length}`)
      return response.status(206).send(contents.subarray(start, end + 1))
    }
    return response.send(contents)
  }

  /**
   * Get signed URL for video (for private videos)
   */
  async getSignedUrl({ params, response, auth }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      if (!video.isPublished && video.userId !== auth.user!.id) {
        return response.forbidden({ error: 'This video is private' })
      }

      // Increment view count when serving video
      video.viewCount++
      await video.save()

      // Generate signed URL
      if (video.skipAutoTranscription) {
        return response.ok({ url: `/api/v1/videos/${video.id}/media` })
      }
      const driveService = videoDisk(video.skipAutoTranscription)
      const url = await driveService.getSignedUrl(video.filePath, {
        expiresIn: '1h',
      })

      return response.ok({ url })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to generate signed URL',
        message: error.message,
      })
    }
  }

  /**
   * Increment video view count
   */
  async incrementViews({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      // Increment view count
      video.viewCount++
      await video.save()

      // Return redirect
      return response.redirect('/gallery')
    } catch (error) {
      return response.redirect('/gallery')
    }
  }

  /**
   * Publish a video (manual publish for pending videos)
   */
  async publish({ params, response, auth }: HttpContext) {
    try {
      if (!auth.user) {
        return response.unauthorized({ error: 'Authentication required' })
      }

      const video = await Video.findOrFail(params.id)

      // Only owner can publish
      if (video.userId !== auth.user.id) {
        return response.forbidden({ error: 'Not authorized' })
      }

      video.isPublished = true
      await video.save()

      return response.redirect('/dashboard')
    } catch (error) {
      console.error('Publish error:', error)
      return response.redirect('/dashboard')
    }
  }

  /**
   * Toggle like on/off for a video
   */
  async toggleLike({ params, response, auth }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      if (!canViewVideo(video, auth.user?.id)) return response.notFound()

      // Check if user already liked the video
      const existingLike = await Like.query()
        .where('user_id', auth.user!.id)
        .where('video_id', video.id)
        .first()

      let isLiked: boolean
      if (existingLike) {
        // Unlike: remove the like and decrement likeCount
        await existingLike.delete()
        video.likeCount--
        await video.save()
        isLiked = false
      } else {
        // Like: create new like and increment likeCount
        await Like.create({
          userId: auth.user!.id,
          videoId: video.id,
        })
        video.likeCount++
        await video.save()
        isLiked = true
      }

      // Return JSON instead of redirect for AJAX requests
      return response.ok({
        success: true,
        isLiked,
        likeCount: video.likeCount,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        error: 'Failed to toggle like',
      })
    }
  }

  /**
   * Download a video and track it
   */
  async download({ params, response, auth }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      logger.info(`[Download] Starting download for video ${video.id}, filePath: ${video.filePath}`)

      // Vérifier si le fichier existe avant de tenter de le récupérer
      if (!canViewVideo(video, auth.user?.id)) return response.notFound()
      const exists = await videoDisk(video.skipAutoTranscription).exists(video.filePath)
      if (!exists) {
        logger.error(`[Download] File not found in storage: ${video.filePath}`)
        return response.notFound({ error: 'Video file not found in storage' })
      }

      // Log the download
      const { default: Download } = await import('#models/download')
      await Download.create({
        userId: auth.user!.id,
        videoId: video.id,
      })

      // Emit event for points
      await emitter.emit(VideoDownloaded, new VideoDownloaded(video, auth.user!))

      // Stream the video
      logger.info(`[Download] Retrieving file from storage: ${video.filePath}`)
      const videoBuffer = await videoDisk(video.skipAutoTranscription).getBytes(video.filePath)

      logger.info(`[Download] File retrieved successfully, size: ${videoBuffer.length} bytes`)

      response.header('Content-Type', 'video/mp4')
      response.header(
        'Content-Disposition',
        `attachment; filename="${video.skipAutoTranscription ? 'video' : video.title}.mp4"`
      )

      return response.send(videoBuffer)
    } catch (error) {
      logger.error('[Download] Error:', error)
      logger.error('[Download] Error stack:', error.stack)
      return response.internalServerError({
        error: 'Download failed',
        message: error.message,
      })
    }
  }
}
