import VideoTranscription from '#models/video_transcription'
import User from '#models/user'

export default class TranscriptionCorrected {
  constructor(
    public transcription: VideoTranscription,
    public user: User
  ) {}
}
