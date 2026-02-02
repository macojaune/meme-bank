import ViewMilestoneReached from '#events/view_milestone_reached'
import PointsService from '#services/points_service'

export default class GrantMilestonePoints {
  async handle(event: ViewMilestoneReached) {
    const { video, milestone } = event

    console.log(`[Listener] Processing milestone ${milestone} points for video ${video.id}`)

    await PointsService.onViewMilestone(video, milestone)
  }
}
