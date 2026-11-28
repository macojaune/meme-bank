import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import env from '#start/env'

const RESET_LIFETIME_MINUTES = 60
const RESEND_DELAY_MINUTES = 2

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function issuePasswordReset(email: string) {
  const apiKey = env.get('BREVO_API_KEY')
  const sender = env.get('BREVO_RESET_SENDER_EMAIL')
  const origin = env.get('PASSWORD_RESET_ORIGIN')
  if (!apiKey || !sender || !origin) throw new Error('Password reset email is not configured')

  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.origin !== origin) {
    throw new Error('Password reset origin must be an HTTPS origin')
  }

  const token = randomBytes(32).toString('hex')
  const digest = hashToken(token)
  const recipient = await db.transaction(async (trx) => {
    const user = await User.query({ client: trx }).where('email', email).forUpdate().first()
    if (!user) return null
    const now = DateTime.now()
    if (
      user.resetTokenExpiresAt &&
      user.resetTokenExpiresAt >
        now.plus({ minutes: RESET_LIFETIME_MINUTES - RESEND_DELAY_MINUTES })
    ) {
      return null
    }

    user.resetToken = digest
    user.resetTokenExpiresAt = now.plus({ minutes: RESET_LIFETIME_MINUTES })
    await user.save()
    return user.email
  })
  if (!recipient) return

  const link = new URL('/reset-password', base)
  link.hash = new URLSearchParams({ token }).toString()

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: 'MemeBank', email: sender },
      to: [{ email: recipient }],
      subject: 'Réinitialiser ton mot de passe MemeBank',
      textContent: [
        'Pour choisir un nouveau mot de passe, ouvre ce lien valable une heure :',
        link.href,
        'Si tu n’as rien demandé, tu peux ignorer cet e-mail.',
      ].join('\n\n'),
      tags: ['memebank-password-reset'],
    }),
  })
  if (!response.ok) throw new Error('Brevo rejected the password reset email')
}

export async function consumePasswordReset(token: string, password: string) {
  return db.transaction(async (trx) => {
    const user = await User.query({ client: trx })
      .where('reset_token', hashToken(token))
      .forUpdate()
      .first()
    if (!user?.resetTokenExpiresAt || user.resetTokenExpiresAt <= DateTime.now()) return false

    user.password = password
    user.resetToken = null
    user.resetTokenExpiresAt = null
    await user.save()
    return true
  })
}
