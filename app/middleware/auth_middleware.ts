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

  async handle(
    ctx: HttpContext,
    next: NextFn
  ) {
    console.log('Auth middleware - Before authentication check')
    console.log('Request URL:', ctx.request.url())
    console.log('Request method:', ctx.request.method())
    console.log('Session data:', ctx.session.all())
    
    // Check if user is already authenticated
    const isAuthenticated = await ctx.auth.check()
    console.log('Auth status:', isAuthenticated)
    // console.log('Auth user:', ctx.auth.user)
    
    if (isAuthenticated) {
      console.log('User is already authenticated, proceeding to next middleware')
      return next()
    }
    
    // If not authenticated, redirect to login page
    console.log('User is not authenticated, redirecting to:', this.redirectTo)
    return ctx.response.redirect(this.redirectTo)
  }
}
