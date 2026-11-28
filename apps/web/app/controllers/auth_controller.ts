import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import BetaInvitationService, {
  InvalidInvitationError,
  INVITATION_MESSAGE,
} from '#services/beta_invitation_service'

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
    token: vine.string(),
    password: vine.string().minLength(8),
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

  /**
   * Request password reset token
   */
  async forgotPassword({ request, response }: HttpContext) {
    try {
      // Validate request data using VineJS
      const { email } = await forgotPasswordValidator.validate(request.body())

      // Find user by email
      const user = await User.findBy('email', email)

      // Generate reset token even if user doesn't exist (security best practice)
      const token = randomBytes(32).toString('hex')
      const expiresAt = DateTime.now().plus({ hours: 1 })

      if (user) {
        // Store token and expiry in user record
        user.resetToken = token
        user.resetTokenExpiresAt = expiresAt
        await user.save()

        // Email delivery is intentionally handled outside logs so reset tokens never leak.
      }

      // Always return success to prevent email enumeration
      return response.ok({
        message: 'If your email is registered, you will receive a password reset link',
      })
    } catch (error) {
      return response.badRequest({
        message: 'Password reset request failed. Please try again.',
      })
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword({ request, response }: HttpContext) {
    try {
      // Validate request data using VineJS
      const data = await resetPasswordValidator.validate(request.body())

      // Find user by reset token
      const user = await User.findBy('resetToken', data.token)

      // Check if user exists and token is valid
      if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < DateTime.now()) {
        return response.badRequest({ message: 'Invalid or expired token' })
      }

      // Update password
      user.password = data.password
      user.resetToken = null
      user.resetTokenExpiresAt = null
      await user.save()

      return response.ok({ message: 'Password has been reset successfully' })
    } catch (error) {
      return response.badRequest({
        message: 'Password reset failed. Please try again.',
      })
    }
  }
}
