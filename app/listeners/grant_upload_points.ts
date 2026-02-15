import VideoUploaded from '#events/video_uploaded'
import PointsService from '#services/points_service'

export default class GrantUploadPoints {
  async handle(event: VideoUploaded) {
    const { video, user } = event

    console.log(`[Listener] Processing upload points for video ${video.id}`)

    await PointsService.onVideoUpload(video, user)
  }
}
