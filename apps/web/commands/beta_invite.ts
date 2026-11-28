import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import BetaInvitationService from '#services/beta_invitation_service'

export default class BetaInvite extends BaseCommand {
  static commandName = 'beta:invite'
  static description = 'Créer, réémettre ou révoquer une invitation bêta sans envoyer d’email'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'issue, reissue ou revoke' })
  declare action: string

  @args.string({ description: 'Adresse choisie par l’opérateur' })
  declare email: string

  @flags.string({ description: 'Fichier privé absolu à créer (jamais écrasé)' })
  declare output: string | undefined

  @flags.string({ description: 'Origine explicite de l’application cible, sans chemin' })
  declare origin: string | undefined

  @flags.number({ description: 'Validité en jours, 7 par défaut' })
  declare days: number | undefined

  async run() {
    const service = new BetaInvitationService()
    let file: Awaited<ReturnType<typeof open>> | undefined
    let completed = false
    try {
      if (this.action === 'revoke') {
        await service.revoke(this.email)
        this.logger.success('Invitation révoquée. Aucun email envoyé.')
        return
      }
      if (!['issue', 'reissue'].includes(this.action) || !this.output || !isAbsolute(this.output)) {
        throw new Error('Action ou fichier de sortie invalide.')
      }
      const origin = new URL(this.origin ?? '')
      const localHttp =
        origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      if (
        (!localHttp && origin.protocol !== 'https:') ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash
      )
        throw new Error('Origine invalide.')

      // Refuse existing files/symlinks. No token in stdout, process arguments or logs.
      file = await open(this.output, 'wx', 0o600)
      await db.transaction(async (client) => {
        const issued = await service.issue(
          this.email,
          { days: this.days, reissue: this.action === 'reissue' },
          client
        )
        await file!.writeFile(`${origin.origin}/register#invitation=${issued.token}\n`, 'utf8')
        await file!.sync()
      })
      completed = true
      this.logger.success(
        'Invitation enregistrée dans le fichier privé demandé. Aucun email envoyé.'
      )
    } catch {
      // Database and filesystem errors can contain private input. Do not log the raw exception.
      this.exitCode = 1
      this.logger.error(
        'Opération refusée. Vérifie action, adresse, durée, origine et fichier de sortie neuf ; issue nécessite une nouvelle adresse, reissue une invitation existante sans compte.'
      )
    } finally {
      if (file) {
        await file.close()
        if (!completed) await unlink(this.output!).catch(() => {})
      }
    }
  }
}
