import PointsEarned from '#events/points_earned'
import transmit from '@adonisjs/transmit/services/main'

export default class BroadcastPointsEarned {
  async handle(event: PointsEarned) {
    const { user, points, reason } = event

    console.log(`[Points Toast] User ${user.id} earned +${points} points for ${reason}`)
    console.log(`[Points Toast] Total points: ${user.totalPoints}`)

    transmit.broadcast(`user:${user.id}`, {
      type: 'points_earned',
      userId: user.id,
      points,
      reason,
      totalPoints: user.totalPoints,
      message: `🏆 +${points} points !`,
    })
  }
}
