import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'

export default class LeaderboardController {
  /**
   * Get top users by points
   */
  async index({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 20)
      const page = request.input('page', 1)

      const users = await User.query()
        .where('totalPoints', '>', 0)
        .orderBy('totalPoints', 'desc')
        .orderBy('createdAt', 'asc')
        .paginate(page, limit)

      const leaderboard = users.all().map((user, index) => ({
        rank: (users.currentPage - 1) * users.perPage + index + 1,
        id: user.id,
        fullName: user.fullName,
        totalPoints: user.totalPoints,
      }))

      return response.ok({
        data: leaderboard,
        meta: users.getMeta(),
      })
    } catch (error) {
      logger.error('Leaderboard error:', error)
      return response.internalServerError({
        error: 'Failed to fetch leaderboard',
      })
    }
  }

  /**
   * Get current user's rank and stats
   */
  async me({ auth, response }: HttpContext) {
    try {
      if (!auth.user) {
        return response.unauthorized({ error: 'Authentication required' })
      }

      // Count users with more points
      const higherRanked = await User.query()
        .where('totalPoints', '>', auth.user.totalPoints)
        .count('* as count')

      const rank = Number(higherRanked[0].$extras.count) + 1

      // Count total users with points
      const totalUsers = await User.query().where('totalPoints', '>', 0).count('* as count')

      return response.ok({
        data: {
          rank,
          totalRankedUsers: Number(totalUsers[0].$extras.count),
          totalPoints: auth.user.totalPoints,
        },
      })
    } catch (error) {
      logger.error('User stats error:', error)
      return response.internalServerError({
        error: 'Failed to fetch user stats',
      })
    }
  }
}
