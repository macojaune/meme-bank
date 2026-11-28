import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '#models/user'

export default class CatalogReadMiddleware {
  async handle({ auth, request, response }: HttpContext, next: NextFn) {
    response.header('Cache-Control', 'private, no-store')
    if (auth.isAuthenticated) return next()

    const value = request
      .header('authorization')
      ?.match(/^Bearer (mbr_[a-zA-Z0-9._-]{1,160})$/i)?.[1]
    if (value) {
      const token = await User.catalogTokens.verify(new Secret(value))
      if (token?.allows('video:read')) return next()
    }
    return response.unauthorized({ error: 'catalog_authentication_required' })
  }
}
