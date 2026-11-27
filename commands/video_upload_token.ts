import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import User from '#models/user'
import { UPLOAD_ABILITY, PUBLISH_ABILITY } from '#services/video_upload_tokens'

export default class VideoUploadToken extends BaseCommand {
  static commandName = 'video:upload-token'
  static description = 'Créer ou révoquer un jeton dédié à l’import vidéo'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'issue ou revoke' })
  declare action: string

  @args.string({ description: 'UUID du compte propriétaire' })
  declare userId: string

  @flags.string({ description: 'Fichier privé absolu à créer, jamais écrasé' })
  declare output?: string

  @flags.boolean({ description: 'Autoriser aussi la publication lors de l’import' })
  declare publish: boolean

  @flags.number({ description: 'Identifiant du jeton à révoquer' })
  declare id?: number

  async run() {
    let file: Awaited<ReturnType<typeof open>> | undefined
    let issued: { user: User; id: string | number | BigInt } | undefined
    let completed = false
    try {
      const user = await User.findOrFail(this.userId)
      if (this.action === 'revoke' && Number.isSafeInteger(this.id) && this.id! > 0) {
        if (!(await User.uploadTokens.delete(user, this.id!))) throw new Error('Unknown token')
        this.logger.success('Jeton révoqué.')
        return
      }
      if (this.action !== 'issue' || !this.output || !isAbsolute(this.output)) {
        throw new Error('Invalid arguments')
      }

      file = await open(this.output, 'wx', 0o600)
      const abilities = this.publish ? [UPLOAD_ABILITY, PUBLISH_ABILITY] : [UPLOAD_ABILITY]
      const token = await User.uploadTokens.create(user, abilities, { name: 'MemeBank CLI' })
      issued = { user, id: token.identifier }
      await file.writeFile(token.value!.release() + '\n')
      await file.sync()
      completed = true
      this.logger.success(`Jeton ${token.identifier} enregistré. Validité de 30 jours.`)
    } catch {
      this.exitCode = 1
      this.logger.error('Vérifie le compte, l’action, l’identifiant ou le chemin du fichier neuf.')
    } finally {
      if (file) {
        await file.close()
        if (!completed) {
          await unlink(this.output!).catch(() => {})
          if (issued) await User.uploadTokens.delete(issued.user, issued.id).catch(() => {})
        }
      }
    }
  }
}
