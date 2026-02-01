import type { Job } from 'bullmq'
import type { JobData, JobResult } from './types.js'
import Video from '../models/video.js'
import drive from '@adonisjs/drive/services/main'
import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

/**
 * Job processor for thumbnail generation
 * Extracts a frame from video using ffmpeg and uploads to S3
 */
export async function processThumbnailJob(job: Job<JobData>): Promise<JobResult> {
  const { videoId, filePath } = job.data as {
    videoId: string
    filePath: string
    timestamp?: number
  }
  const timestamp = (job.data as any).timestamp || 1

  console.log(`[Thumbnail] Processing job ${job.id} for video ${videoId}`)

  let tempVideoPath: string | null = null
  let tempThumbnailPath: string | null = null

  try {
    // Step 1: Download video from S3 to temp location
    console.log(`[Thumbnail] Downloading ${filePath} from S3...`)
    tempVideoPath = await downloadFromS3(filePath)
    console.log(`[Thumbnail] Downloaded to ${tempVideoPath}`)

    // Step 2: Generate thumbnail using ffmpeg
    const tempDir = tmpdir()
    const thumbnailId = uuidv4()
    tempThumbnailPath = join(tempDir, `${thumbnailId}.jpg`)

    console.log(`[Thumbnail] Extracting frame at ${timestamp}s...`)
    await new Promise<void>((resolve, reject) => {
      // Use ffmpeg to extract frame at specific timestamp
      // Scale to 640x360 (16:9) for consistent thumbnails
      const cmd = `ffmpeg -i "${tempVideoPath}" -ss ${timestamp} -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black" -q:v 2 "${tempThumbnailPath}" -y 2>&1`

      exec(cmd, { timeout: 60000 }, (error, _stdout, stderr) => {
        if (error) {
          console.error('[Thumbnail] FFmpeg error:', stderr)
          reject(error)
        } else {
          resolve()
        }
      })
    })

    console.log(`[Thumbnail] Generated: ${tempThumbnailPath}`)

    // Step 3: Upload thumbnail to S3
    const thumbnailKey = `thumbnails/${videoId}.jpg`
    const thumbnailBuffer = await fs.readFile(tempThumbnailPath)

    await drive.use('spaces').put(thumbnailKey, thumbnailBuffer, {
      contentType: 'image/jpeg',
    })

    console.log(`[Thumbnail] Uploaded to ${thumbnailKey}`)

    // Step 4: Update video record
    const video = await Video.find(videoId)
    if (video) {
      video.thumbnailPath = thumbnailKey
      await video.save()
      console.log(`[Thumbnail] Video ${videoId} updated with thumbnail path`)
    }

    return {
      success: true,
      data: {
        videoId,
        thumbnailPath: thumbnailKey,
      },
    }
  } catch (error) {
    console.error(`[Thumbnail] Job ${job.id} failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown thumbnail error',
    }
  } finally {
    // Cleanup temp files
    if (tempVideoPath) {
      try {
        await fs.unlink(tempVideoPath)
      } catch {}
    }
    if (tempThumbnailPath) {
      try {
        await fs.unlink(tempThumbnailPath)
      } catch {}
    }
  }
}

/**
 * Download file from S3/MinIO to temp location
 */
async function downloadFromS3(s3Path: string): Promise<string> {
  const tempDir = tmpdir()
  const fileId = uuidv4()
  const ext = s3Path.split('.').pop() || '.mp4'
  const tempFilePath = join(tempDir, `${fileId}.${ext}`)

  const fileBuffer = await drive.use('spaces').getBytes(s3Path)
  await fs.writeFile(tempFilePath, fileBuffer)

  return tempFilePath
}
