import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { ImportConflict, importVideo, validatedVideo } from '#services/video_upload'
import { privateBucketName } from '#services/video_storage'
import {
  UPLOAD_ABILITY,
  PUBLISH_ABILITY,
  verifyVideoUploadToken,
} from '#services/video_upload_tokens'

export default class AgentVideoImportsController {
  async store({ request, response }: HttpContext) {
    try {
      const authorization = request.header('authorization')
      const bearer = authorization?.match(/^Bearer ([^ ]+)$/i)?.[1]
      // Traefik may consume the Basic header before the request reaches Adonis.
      const credentials = await verifyVideoUploadToken(
        bearer ?? request.header('x-memebank-upload-token')
      )
      if (!credentials) return response.unauthorized({ error: 'invalid_upload_token' })
      if (!credentials.abilities.includes(UPLOAD_ABILITY)) {
        return response.forbidden({ error: 'upload_not_allowed' })
      }

      const publish = request.input('publish')
      if (publish !== undefined && publish !== null && publish !== 'true' && publish !== 'false') {
        return response.badRequest({ error: 'invalid_publish_value' })
      }
      if (publish === 'true' && !credentials.abilities.includes(PUBLISH_ABILITY)) {
        return response.forbidden({ error: 'publish_not_allowed' })
      }

      const key = request.header('idempotency-key')
      if (!key || !/^[A-Za-z0-9._-]{1,128}$/.test(key)) {
        return response.badRequest({ error: 'invalid_idempotency_key' })
      }

      const title = request.input('title')
      const transcript = request.input('transcript')
      if (
        title !== undefined &&
        title !== null &&
        (typeof title !== 'string' || [...title.trim()].length > 255 || title.includes('\0'))
      ) {
        return response.badRequest({ error: 'invalid_title' })
      }
      if (
        transcript !== undefined &&
        transcript !== null &&
        (typeof transcript !== 'string' ||
          Buffer.byteLength(transcript) > 65536 ||
          transcript.includes('\0'))
      ) {
        return response.badRequest({ error: 'invalid_transcript' })
      }

      const file = validatedVideo(request)
      if (!file || !file.isValid || !file.tmpPath) {
        return response.badRequest({ error: 'invalid_video', details: file?.errors })
      }
      const privateBucket = privateBucketName()
      if (
        !privateBucket ||
        privateBucket === (process.env.R2_BUCKET || process.env.MINIO_BUCKET || 'memes')
      ) {
        return response.status(503).send({ error: 'private_storage_unavailable' })
      }

      const result = await importVideo(file, credentials.user, key, {
        title: title?.trim() || '',
        agent: { publish: publish === 'true', transcript: transcript?.trim() ? transcript : null },
      })
      return response.status(result.replayed ? 200 : 201).send({
        videoId: result.video.id,
        replayed: result.replayed,
        isPublished: result.video.isPublished,
      })
    } catch (error) {
      if (error instanceof ImportConflict) {
        return response.conflict({ error: 'import_conflict', message: error.message })
      }
      logger.error({ code: (error as { code?: string }).code }, 'Agent video import failed')
      return response.internalServerError({ error: 'video_import_failed' })
    }
  }
}
