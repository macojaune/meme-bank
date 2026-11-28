import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import vine from '@vinejs/vine'
import BetaInvitationService, {
  InvalidInvitationError,
  INVITATION_MESSAGE,
} from '#services/beta_invitation_service'

import logger from '@adonisjs/core/services/logger'
import { issuePasswordReset, consumePasswordReset } from '#services/password_reset_service'

const INVITATION_SESSION_KEY = 'betaInvitationHash'

export const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(100),
    email: vine.string().email().maxLength(255),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().maxLength(255),
    password: vine.string(),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().maxLength(255),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().regex(/^[a-f0-9]{64}$/),
    password: vine.string().minLength(8).maxLength(256),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export default class AuthController {
  async showRegister({ session, response, inertia }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')
    const invitation = await new BetaInvitationService().findUsable(
      session.get(INVITATION_SESSION_KEY)
    )
    if (!invitation) {
      session.forget(INVITATION_SESSION_KEY)
      response.status(403)
    }
    return inertia.render('auth/register', {
      invitation: invitation ? { email: invitation.email } : null,
    })
  }

  async acceptInvitation({ request, session, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')
    session.forget(INVITATION_SESSION_KEY)
    try {
      const tokenHash = BetaInvitationService.hashToken(request.input('token'))
      const invitation = await new BetaInvitationService().findUsable(tokenHash)
      if (!tokenHash || !invitation) return response.forbidden({ message: INVITATION_MESSAGE })
      // Only the hash enters the encrypted HTTP-only session, never the raw link token.
      session.put(INVITATION_SESSION_KEY, tokenHash)
      return response.ok({ redirect: '/register' })
    } catch {
      // Never pass an exchange request containing a token to a verbose error handler.
      return response.serviceUnavailable({
        message: 'Invitation indisponible. Réessaie plus tard.',
      })
    }
  }

  /**
   * Handle user registration
   */
  async register({ request, response, auth, session, inertia }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    const invitations = new BetaInvitationService()
    const tokenHash = session.get(INVITATION_SESSION_KEY)
    try {
      if (!(await invitations.findUsable(tokenHash))) throw new InvalidInvitationError()
      // Validate request data using VineJS
      const data = await registerValidator.validate(request.body())
      const user = await invitations.register(tokenHash, data)
      session.forget(INVITATION_SESSION_KEY)
      // register resolves only AFTER user creation and invitation redemption commit together.
      await auth.use('web').login(user)

      return response.redirect('/dashboard')
    } catch (error) {
      // Handle validation errors
      if (error.code === 'E_VALIDATION_ERROR') {
        // Match Adonis' negotiation, including its default HTML response.
        const responseType = request.accepts(['html', 'application/vnd.api+json', 'json'])
        if (request.header('x-inertia') || !responseType || responseType === 'html') {
          // The invitation page hides its referrer. Do not rely on redirect().back(),
          // which would send an invalid form to the landing and discard its input.
          // HTML and Inertia flash only messages. flashValidationErrors also copies input,
          // including camelCase passwordConfirmation and any extra token field.
          session.flashErrors(
            Object.fromEntries(
              error.messages.map((message: { field: string; message: string }) => [
                message.field,
                message.message,
              ])
            )
          )
          return response.redirect('/register')
        }
        throw error
      }
      if (error instanceof InvalidInvitationError) {
        session.forget(INVITATION_SESSION_KEY)
        response.status(403)
        return inertia.render('auth/register', { invitation: null })
      }
      session.flash('errorsBag', { general: 'L’inscription a échoué. Réessaie dans un instant.' })
      return response.redirect('/register')
    }
  }

  /**
   * Handle user login
   */
  async login({ request, response, auth }: HttpContext) {
    try {
      const { email, password } = await loginValidator.validate(request.body())

      try {
        const user = await User.verifyCredentials(email, password)
        await auth.use('web').login(user)
        return response.redirect('/dashboard')
      } catch (error) {
        return response.redirect('/login?error=invalid')
      }
    } catch (error) {
      return response.redirect('/login?error=validation')
    }
  }

  /**
   * Handle user logout
   */
  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/')
  }

  async showResetPassword({ response, inertia }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')
    return inertia.render('auth/reset-password')
  }

  async forgotPassword({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    let data: Awaited<ReturnType<typeof forgotPasswordValidator.validate>>
    try {
      data = await forgotPasswordValidator.validate(request.body())
    } catch {
      return response.badRequest({ message: 'Saisis une adresse e-mail valide.' })
    }

    try {
      await issuePasswordReset(data.email.trim().toLowerCase())
    } catch {
      logger.error('Password reset email could not be requested')
    }

    // Use the same response for unknown accounts and delivery failures.
    return response.ok({
      message: 'Si un compte correspond à cette adresse, tu recevras un lien de réinitialisation.',
    })
  }

  async resetPassword({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    let data: Awaited<ReturnType<typeof resetPasswordValidator.validate>>
    try {
      data = await resetPasswordValidator.validate(request.body())
    } catch {
      return response.badRequest({
        message: 'Le lien doit être valide et les deux mots de passe doivent correspondre.',
      })
    }

    try {
      if (!(await consumePasswordReset(data.token, data.password))) {
        return response.badRequest({ message: 'Ce lien est invalide, expiré ou déjà utilisé.' })
      }
      return response.ok({ reset: true })
    } catch {
      logger.error('Password reset could not be completed')
      return response.serviceUnavailable({ message: 'Réinitialisation indisponible. Réessaie.' })
    }
  }
}
