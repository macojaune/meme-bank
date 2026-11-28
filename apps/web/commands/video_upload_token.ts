import { flags } from '@adonisjs/core/ace'
import User from '#models/user'
import VideoTokenCommand from '#services/video_token_command'
import { UPLOAD_ABILITY, PUBLISH_ABILITY } from '#services/video_upload_tokens'

export default class VideoUploadToken extends VideoTokenCommand {
  static commandName = 'video:upload-token'
  static description = 'Créer ou révoquer un jeton dédié à l’import vidéo'

  provider = User.uploadTokens
  tokenName = 'MemeBank CLI'

  @flags.boolean({ description: 'Autoriser aussi la publication lors de l’import' })
  declare publish: boolean

  get abilities() {
    return this.publish ? [UPLOAD_ABILITY, PUBLISH_ABILITY] : [UPLOAD_ABILITY]
  }
}
