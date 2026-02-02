import emitter from '@adonisjs/core/services/emitter'

// Import event classes
import VideoUploaded from '#events/video_uploaded'
import VideoDownloaded from '#events/video_downloaded'
import TranscriptionCorrected from '#events/transcription_corrected'
import ViewMilestoneReached from '#events/view_milestone_reached'
import PointsEarned from '#events/points_earned'

// Import listeners
import GrantUploadPoints from '#listeners/grant_upload_points'
import GrantDownloadPoints from '#listeners/grant_download_points'
import GrantCorrectionPoints from '#listeners/grant_correction_points'
import GrantMilestonePoints from '#listeners/grant_milestone_points'
import BroadcastPointsEarned from '#listeners/broadcast_points_earned'

// Register event listeners
emitter.on(VideoUploaded, (event) => new GrantUploadPoints().handle(event))
emitter.on(VideoDownloaded, (event) => new GrantDownloadPoints().handle(event))
emitter.on(TranscriptionCorrected, (event) => new GrantCorrectionPoints().handle(event))
emitter.on(ViewMilestoneReached, (event) => new GrantMilestonePoints().handle(event))
emitter.on(PointsEarned, (event) => new BroadcastPointsEarned().handle(event))

console.log('[Events] Event listeners registered')
