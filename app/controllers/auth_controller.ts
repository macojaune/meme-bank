import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

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
  /**
   * Handle user registration
   */
  async register({ request, response, auth }: HttpContext) {
    try {
      // Validate request data using VineJS
      const data = await registerValidator.validate(request.body())

      // Create user
      const user = await User.create({
        email: data.email,
        password: data.password, // Will be hashed by the model hook
        fullName: data.fullName,
      })

      // Auto-login the user after registration
      await auth.use('web').login(user)

      return response.redirect('/dashboard')
    } catch (error) {
      // Handle validation errors
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.redirect().back()
      }

      // Handle other errors
      return response.redirect().back()
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
