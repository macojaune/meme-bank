import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BetaInvitation from '#models/beta_invitation'
import User from '#models/user'

const emailValidator = vine.compile(vine.string().email().maxLength(254))
export const INVITATION_MESSAGE =
  'L’accès à la bêta nécessite une invitation valide. Tu peux te préinscrire pour les prochains accès.'

export class InvalidInvitationError extends Error {
  constructor() {
    super(INVITATION_MESSAGE)
  }
}

export default class BetaInvitationService {
  static normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  static hashToken(token: unknown): string | null {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
    return createHash('sha256').update(token).digest('hex')
  }

  static usable(invitation: BetaInvitation | null) {
    return Boolean(
      invitation &&
        !invitation.redeemedAt &&
        !invitation.revokedAt &&
        invitation.expiresAt > DateTime.utc()
    )
  }

  async findUsable(tokenHash: unknown) {
    if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash)) return null
    const invitation = await BetaInvitation.findBy('tokenHash', tokenHash)
    return BetaInvitationService.usable(invitation) ? invitation : null
  }

  async issue(
    email: string,
    options: { days?: number; reissue?: boolean } = {},
    client?: TransactionClientContract
  ): Promise<{ id: string; token: string }> {
    const normalizedEmail = await emailValidator.validate(
      BetaInvitationService.normalizeEmail(email)
    )
    const days = options.days ?? 7
    const expiresAt = DateTime.utc().plus({ days })
    if (!Number.isSafeInteger(days) || days < 1 || !expiresAt.isValid) {
      throw new Error('La durée doit être un nombre entier positif de jours.')
    }
    if (!client) return db.transaction((trx) => this.issue(normalizedEmail, options, trx))

    const existing = await BetaInvitation.query({ client })
      .where('email', normalizedEmail)
      .forUpdate()
      .first()
    if (Boolean(existing) !== Boolean(options.reissue)) {
      throw new Error(
        existing ? 'Utilise la réémission pour cette adresse.' : 'Invitation introuvable.'
      )
    }
    const user = await User.query({ client })
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .first()
    if (user) throw new Error('Un compte existe déjà pour cette adresse.')

    const token = randomBytes(32).toString('hex')
    const invitation = existing ?? new BetaInvitation()
    invitation.useTransaction(client)
    invitation.merge({
      id: existing?.id ?? randomUUID(),
      email: normalizedEmail,
      tokenHash: BetaInvitationService.hashToken(token)!,
      expiresAt,
      redeemedAt: null,
      revokedAt: null,
    })
    await invitation.save()
    return { id: invitation.id, token }
  }

  async revoke(email: string) {
    const normalizedEmail = await emailValidator.validate(
      BetaInvitationService.normalizeEmail(email)
    )
    return db.transaction(async (client) => {
      const invitation = await BetaInvitation.query({ client })
        .where('email', normalizedEmail)
        .forUpdate()
        .first()
      if (!invitation) throw new Error('Invitation introuvable.')
      if (!invitation.revokedAt) {
        invitation.revokedAt = DateTime.utc()
        await invitation.save()
      }
    })
  }

  async register(tokenHash: unknown, data: { email: string; fullName: string; password: string }) {
    if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash)) {
      throw new InvalidInvitationError()
    }
    return db.transaction(async (client) => {
      const invitation = await BetaInvitation.query({ client })
        .where('tokenHash', tokenHash)
        .forUpdate()
        .first()
      const email = BetaInvitationService.normalizeEmail(data.email)
      // Recheck expiry and state AFTER acquiring the lock, including concurrent reissues/redeems.
      if (!invitation || !BetaInvitationService.usable(invitation) || invitation.email !== email) {
        throw new InvalidInvitationError()
      }
      if (await User.query({ client }).whereRaw('lower(email) = ?', [email]).first()) {
        throw new InvalidInvitationError()
      }
      const user = await User.create(
        { email, fullName: data.fullName, password: data.password },
        { client }
      )
      invitation.redeemedAt = DateTime.utc()
      await invitation.save()
      return user
    })
  }
}
