import type { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import Person from '#models/person'
import Like from '#models/like'
import drive from '@adonisjs/drive/services/main'
import QueueService from '#services/queue_service'
import logger from '@adonisjs/core/services/logger'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import VideoUploaded from '#events/video_uploaded'
import VideoDownloaded from '#events/video_downloaded'

export default class VideoUploadController {
  /**
   * Ensure bucket exists
   */
  private async ensureBucket() {
    const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3')
    const accessKeyId = process.env.MINIO_ACCESS_KEY
    const secretAccessKey = process.env.MINIO_SECRET_KEY

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Object storage credentials are not configured')
    }

    const client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })

    try {
      await client.send(
        new CreateBucketCommand({
          Bucket: process.env.MINIO_BUCKET || 'memes',
        })
      )
    } catch (error: any) {
      // Bucket already exists - ignore
      if (
        error.name === 'BucketAlreadyOwnedByYou' ||
        error.name === 'BucketAlreadyExists' ||
        error.message?.includes('already own it')
      ) {
        return
      }
      throw error
    }
  }

  /**
   * Upload a new video file
   */
  async upload({ request, response, auth }: HttpContext) {
    try {
      // Ensure bucket exists
      await this.ensureBucket()

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

      // Generate secure random filename
      const fileExt = file.extname || 'mp4'
      const filename = `${randomUUID()}.${fileExt}`
      const filePath = `videos/${filename}`

      // Read file content and upload to Drive (MinIO)
      const fs = await import('node:fs')
      const fileContent = fs.readFileSync(file.tmpPath!)
      await drive.use('spaces').put(filePath, fileContent)

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

      // Attach persons to video if provided
      const personsData = request.input('persons')
      if (personsData && Array.isArray(personsData) && personsData.length > 0) {
        const personIds: string[] = []

        for (const personData of personsData) {
          let person: Person | null = null

          if (personData.id && personData.id.startsWith('temp-')) {
            // Create new person for temporary IDs
            person = await Person.create({
              name: personData.name,
              socialMediaHandle: personData.socialMediaHandle || null,
              platform: personData.platform || null,
              bio: null,
            })
          } else if (personData.id) {
            // Find existing person by ID
            person = await Person.find(personData.id)
          }

          if (person) {
            personIds.push(person.id)
          }
        }

        // Attach all persons to the video
        if (personIds.length > 0) {
          await video.related('persons').attach(personIds)
        }
      }

      // Queue transcription job after successful upload
      try {
        const queueService = new QueueService()
        await queueService.addJob('transcription', {
          videoId: video.id,
          filePath: filePath,
          language: 'fr', // Default to French for Caribbean memes
        })
        console.log(`[Upload] Transcription job queued for video ${video.id}`)
      } catch (queueError) {
        // Don't fail the upload if queuing fails, just log it
        console.error('[Upload] Failed to queue transcription job:', queueError)
      }

      // Emit event for points system
      await emitter.emit(VideoUploaded, new VideoUploaded(video, auth.user!))

      // Redirect to gallery after successful upload (Inertia will handle this)
      return response.redirect().toPath('/gallery')
    } catch (error) {
      console.error('Upload error:', error)
      return response.internalServerError({
        error: 'Upload failed',
        message: error.message,
      })
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
      query.where('title', 'ilike', `%${search}%`).orWhere('description', 'ilike', `%${search}%`)
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
      const driveService = drive.use('spaces')
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
      const driveService = drive.use('spaces')
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

      // Allow liking even if not published (user's own videos)
      // Skip this check

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
      const exists = await drive.use('spaces').exists(video.filePath)
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
      const videoBuffer = await drive.use('spaces').getBytes(video.filePath)

      logger.info(`[Download] File retrieved successfully, size: ${videoBuffer.length} bytes`)

      response.header('Content-Type', 'video/mp4')
      response.header('Content-Disposition', `attachment; filename="${video.title}.mp4"`)

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
