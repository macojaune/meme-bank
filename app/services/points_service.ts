import emitter from '@adonisjs/core/services/emitter'
import User from '#models/user'
import Video from '#models/video'
import VideoTranscription from '#models/video_transcription'
import PointsEarned from '#events/points_earned'

export interface GrantPointsOptions {
  user: User
  points: number
  reason:
    | 'upload'
    | 'download'
    | 'correction'
    | 'milestone_100'
    | 'milestone_500'
    | 'milestone_1000'
    | 'milestone_10000'
    | 'first_upload'
  reference?: {
    id: string
    type: 'video' | 'transcription'
  }
}

export default class PointsService {
  /**
   * Grant points to a user and emit PointsEarned event
   */
  static async grant(options: GrantPointsOptions): Promise<void> {
    const { user, points, reason, reference } = options

    // Create history entry
    const { default: PointsHistory } = await import('#models/points_history')
    await PointsHistory.create({
      userId: user.id,
      points,
      reason,
      referenceId: reference?.id || null,
      referenceType: reference?.type || null,
    })

    // Update user total points
    user.totalPoints += points
    await user.save()

    // Emit event for frontend toast notification
    await emitter.emit(PointsEarned, new PointsEarned(user, points, reason))

    console.log(`[Points] User ${user.id} earned ${points} points for ${reason}`)
  }

  /**
   * Handle video upload points
   */
  static async onVideoUpload(video: Video, user: User): Promise<void> {
    // Grant upload points
    await this.grant({
      user,
      points: 20,
      reason: 'upload',
      reference: { id: video.id, type: 'video' },
    })

    // Check if it's the user's first video
    const videoCount = await Video.query().where('user_id', user.id).count('* as count')

    if (videoCount[0].$extras.count === 1) {
      // Bonus for first upload
      await this.grant({
        user,
        points: 10,
        reason: 'first_upload',
        reference: { id: video.id, type: 'video' },
      })
    }
  }

  /**
   * Handle video download points
   */
  static async onVideoDownload(video: Video, user: User): Promise<void> {
    await this.grant({
      user,
      points: 5,
      reason: 'download',
      reference: { id: video.id, type: 'video' },
    })
  }

  /**
   * Handle transcription correction points
   */
  static async onTranscriptionCorrection(
    transcription: VideoTranscription,
    user: User
  ): Promise<void> {
    await this.grant({
      user,
      points: 10,
      reason: 'correction',
      reference: { id: transcription.id, type: 'transcription' },
    })
  }

  /**
   * Handle view milestone points
   */
  static async onViewMilestone(video: Video, milestone: number): Promise<void> {
    const pointsMap: Record<number, number> = {
      100: 20,
      500: 30,
      1000: 50,
      10000: 100,
    }

    const points = pointsMap[milestone]
    if (!points) return

    // Get video owner
    const owner = await User.find(video.userId)
    if (!owner) return

    await this.grant({
      user: owner,
      points,
      reason: `milestone_${milestone}` as any,
      reference: { id: video.id, type: 'video' },
    })
  }
}
