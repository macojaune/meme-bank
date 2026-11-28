import VideoDownloaded from '#events/video_downloaded'
import PointsService from '#services/points_service'

export default class GrantDownloadPoints {
  async handle(event: VideoDownloaded) {
    const { video, user } = event

    console.log(`[Listener] Processing download points for video ${video.id}`)

    await PointsService.onVideoDownload(video, user)
  }
}
