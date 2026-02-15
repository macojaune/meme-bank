import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * API Auth middleware is used to authenticate HTTP requests and deny
 * access to unauthenticated users by returning a 401 JSON response.
 */
export default class ApiAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const isAuthenticated = await ctx.auth.check()

    if (isAuthenticated) {
      return next()
    }

    return ctx.response.unauthorized({ error: 'Authentication required' })
  }
}
