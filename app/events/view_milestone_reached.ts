import Video from '#models/video'

export default class ViewMilestoneReached {
  constructor(
    public video: Video,
    public milestone: number
  ) {}
}
