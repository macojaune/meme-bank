import Video from '#models/video'
import User from '#models/user'

export default class VideoDownloaded {
  constructor(
    public video: Video,
    public user: User
  ) {}
}
