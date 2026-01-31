import type { HttpContext } from '@adonisjs/core/http'
import Video from '#models/video'
import Like from '#models/like'
import drive from '@adonisjs/drive/services/main'
import QueueService from '#services/queue_service'
import queueConfig from '#config/queue'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'

export default class VideoUploadController {
  /**
   * Ensure bucket exists
   */
  private async ensureBucket() {
    const { S3Client, CreateBucketCommand, BucketAlreadyOwnedByYou } = await import(
      '@aws-sdk/client-s3'
    )
    const client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
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

      // Queue transcription job after successful upload
      try {
        const queueService = new QueueService()
        await queueService.addJob(queueConfig.queues.transcription.name, {
          videoId: video.id,
          filePath: filePath,
          language: 'fr', // Default to French for Caribbean memes
        })
        console.log(`[Upload] Transcription job queued for video ${video.id}`)
      } catch (queueError) {
        // Don't fail the upload if queuing fails, just log it
        console.error('[Upload] Failed to queue transcription job:', queueError)
      }

      // Redirect back to gallery on success
      return response.redirect('/gallery')
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

      return response.redirect('/gallery') // was: response.ok({
    } catch (error) {
      return response.redirect('/gallery') // was: notFound({
    }
  }

  /**
   * Delete a video
   */
  async delete({ params, response, auth }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.id)

      // Check if user owns the video or is admin
      if (video.userId !== auth.user!.id) {
        return response.forbidden({
          error: 'You do not have permission to delete this video',
        })
      }

      // Delete file from storage
      const driveService = drive.use('spaces')
      await driveService.delete(video.filePath)

      if (video.thumbnailPath) {
        await driveService.delete(video.thumbnailPath)
      }

      // Delete video record
      await video.delete()

      // Return success for API/Inertia
      return response.redirect('/gallery') // was: response.ok({
    } catch (error) {
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

      // Increment view count when serving video
      video.viewCount++
      await video.save()

      // Generate signed URL
      const driveService = drive.use('spaces')
      const url = await driveService.getSignedUrl(video.filePath, {
        expiresIn: '1h',
      })

      return response.redirect('/gallery') // was: response.ok({
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

      if (existingLike) {
        // Unlike: remove the like and decrement likeCount
        await existingLike.delete()
        video.likeCount--
        await video.save()

        return response.redirect('/gallery')
      } else {
        // Like: create new like and increment likeCount
        await Like.create({
          userId: auth.user!.id,
          videoId: video.id,
        })
        video.likeCount++
        await video.save()

        return response.redirect('/gallery')
      }
    } catch (error) {
      return response.redirect('/gallery')
    }
  }
}
