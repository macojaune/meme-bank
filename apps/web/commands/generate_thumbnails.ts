import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Video from '#models/video'
import QueueService from '#services/queue_service'
import drive from '@adonisjs/drive/services/main'

export default class GenerateMissingThumbnails extends BaseCommand {
  static commandName = 'thumbnails:generate-missing'
  static description = 'Generate thumbnails for videos that dont have one'

  @args.string({ description: 'Process only specific video ID', required: false })
  declare videoId: string

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Checking for missing thumbnails...')

    try {
      // Get videos to process
      let videos: Video[]

      if (this.videoId) {
        // Process specific video
        const video = await Video.find(this.videoId)
        if (!video) {
          this.logger.error(`Video ${this.videoId} not found`)
          return
        }
        videos = [video]
      } else {
        // Get all published videos
        videos = await Video.query().where('is_published', true).orderBy('created_at', 'desc')
      }

      this.logger.info(`Found ${videos.length} videos to check`)

      const queueService = new QueueService()
      let generated = 0
      let skipped = 0
      let errors = 0

      for (const video of videos) {
        const thumbnailKey = `thumbnails/${video.id}.jpg`

        try {
          // Check if thumbnail exists in MinIO by trying to get it
          await drive.use('spaces').getBytes(thumbnailKey)

          // Thumbnail exists, check if video record is up to date
          if (!video.thumbnailPath) {
            video.thumbnailPath = thumbnailKey
            await video.save()
            this.logger.info(`✅ Updated record for video ${video.id}`)
            skipped++
          } else {
            this.logger.info(`⏭️  Skipped video ${video.id} (thumbnail exists)`)
            skipped++
          }
        } catch {
          // Thumbnail doesn't exist, queue generation job
          try {
            await queueService.addJob('videoProcessing', {
              videoId: video.id,
              filePath: video.filePath,
            })
            this.logger.info(`🎬 Queued thumbnail generation for video ${video.id}`)
            generated++
          } catch (queueError) {
            this.logger.error(`❌ Failed to queue job for video ${video.id}:`, queueError)
            errors++
          }
        }
      }

      this.logger.info('')
      this.logger.success('Thumbnail generation complete!')
      this.logger.info(`📊 Stats: ${generated} queued, ${skipped} skipped, ${errors} errors`)

      if (generated > 0) {
        this.logger.info('')
        this.logger.info('💡 Make sure the thumbnail worker is running:')
        this.logger.info(
          '   docker compose -f docker-compose.dev.yml exec workers node ace queue:work videoProcessing'
        )
      }
    } catch (error) {
      this.logger.error('Failed to generate thumbnails:', error)
    }
  }
}
