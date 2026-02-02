import TranscriptionCorrected from '#events/transcription_corrected'
import PointsService from '#services/points_service'

export default class GrantCorrectionPoints {
  async handle(event: TranscriptionCorrected) {
    const { transcription, user } = event

    console.log(`[Listener] Processing correction points for transcription ${transcription.id}`)

    await PointsService.onTranscriptionCorrection(transcription, user)
  }
}
