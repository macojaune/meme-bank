import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Video from '#models/video'
import VideoTranscription, { TranscriptionStatus } from '#models/video_transcription'

export default class TranscriptionsController {
  /**
   * Get current transcription for a video
   */
  async show({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.videoId)

      const transcription = await VideoTranscription.query()
        .where('videoId', video.id)
        .where('isCurrent', true)
        .first()

      if (!transcription) {
        return response.notFound({
          error: 'Transcription not found',
          message: 'This video has not been transcribed yet',
        })
      }

      return response.ok({
        data: {
          id: transcription.id,
          text: transcription.transcriptionText,
          language: transcription.language,
          status: transcription.status,
          confidence: transcription.confidence,
          revisionNumber: transcription.revisionNumber,
          pointsAwarded: transcription.pointsAwarded,
          correctedByUserId: transcription.correctedByUserId,
          createdAt: transcription.createdAt,
        },
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to fetch transcription',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Submit a community correction
   */
  async correct({ params, request, response, auth }: HttpContext) {
    try {
      if (!auth.user) {
        return response.unauthorized({ error: 'Authentication required' })
      }

      const video = await Video.findOrFail(params.videoId)

      // Get current transcription
      const currentTranscription = await VideoTranscription.query()
        .where('videoId', video.id)
        .where('isCurrent', true)
        .first()

      if (!currentTranscription) {
        return response.notFound({ error: 'No transcription found to correct' })
      }

      const { text, reason } = request.only(['text', 'reason'])

      if (!text || text.trim().length === 0) {
        return response.badRequest({ error: 'Text is required' })
      }

      // Mark current transcription as not current
      currentTranscription.isCurrent = false
      await currentTranscription.save()

      // Create new revision
      const newTranscription = await VideoTranscription.create({
        videoId: video.id,
        revisionNumber: currentTranscription.revisionNumber + 1,
        status: TranscriptionStatus.COMMUNITY_CORRECTED,
        transcriptionText: text.trim(),
        language: currentTranscription.language,
        confidence: null, // Manual correction has no confidence score
        correctedByUserId: auth.user.id,
        isCurrent: true,
        segmentsJson: null, // TODO: Could parse and preserve timestamps
        pointsAwarded: 10, // Points for community correction
        correctionReason: reason || null,
        generatedAt: currentTranscription.generatedAt,
        correctedAt: DateTime.now(),
      })

      return response.created({
        message: 'Correction submitted successfully',
        data: {
          id: newTranscription.id,
          revisionNumber: newTranscription.revisionNumber,
          pointsAwarded: 10,
        },
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to submit correction',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get all revisions for a video
   */
  async history({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.videoId)

      const transcriptions = await VideoTranscription.query()
        .where('videoId', video.id)
        .orderBy('revisionNumber', 'desc')

      return response.ok({
        data: transcriptions.map((t) => ({
          id: t.id,
          text: t.transcriptionText,
          status: t.status,
          revisionNumber: t.revisionNumber,
          pointsAwarded: t.pointsAwarded,
          correctedByUserId: t.correctedByUserId,
          createdAt: t.createdAt,
        })),
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to fetch transcription history',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
