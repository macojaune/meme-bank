import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(ctx: HttpContext, next: NextFn) {
    const isAuthenticated = await ctx.auth.check()

    if (isAuthenticated) {
      return next()
    }

    return ctx.response.redirect(this.redirectTo)
  }
}
