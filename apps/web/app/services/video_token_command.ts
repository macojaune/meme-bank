import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import User from '#models/user'

export default abstract class VideoTokenCommand extends BaseCommand {
  abstract provider: typeof User.uploadTokens
  abstract tokenName: string
  abstract get abilities(): string[]
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'issue ou revoke' })
  declare action: string

  @args.string({ description: 'UUID du compte propriétaire' })
  declare userId: string

  @flags.string({ description: 'Fichier privé absolu à créer, jamais écrasé' })
  declare output?: string

  @flags.number({ description: 'Identifiant du jeton à révoquer' })
  declare id?: number

  async run() {
    let file: Awaited<ReturnType<typeof open>> | undefined
    let issued: { user: User; id: string | number | BigInt } | undefined
    let completed = false
    try {
      const user = await User.findOrFail(this.userId)
      if (this.action === 'revoke' && Number.isSafeInteger(this.id) && this.id! > 0) {
        if (!(await this.provider.delete(user, this.id!))) throw new Error('Unknown token')
        this.logger.success('Jeton révoqué.')
        return
      }
      if (this.action !== 'issue' || !this.output || !isAbsolute(this.output)) {
        throw new Error('Invalid arguments')
      }

      file = await open(this.output, 'wx', 0o600)
      const token = await this.provider.create(user, this.abilities, { name: this.tokenName })
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
          if (issued) await this.provider.delete(issued.user, issued.id).catch(() => {})
        }
      }
    }
  }
}
