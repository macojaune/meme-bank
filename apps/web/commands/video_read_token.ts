import User from '#models/user'
import VideoTokenCommand from '#services/video_token_command'

export default class VideoReadToken extends VideoTokenCommand {
  static commandName = 'video:read-token'
  static description = 'Créer ou révoquer un accès Raycast aux vidéos publiées'
  provider = User.catalogTokens
  tokenName = 'MemeBank Raycast'

  get abilities() {
    return ['video:read']
  }
}
