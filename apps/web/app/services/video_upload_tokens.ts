import { Secret } from '@adonisjs/core/helpers'
import User from '#models/user'

export const UPLOAD_ABILITY = 'video:upload'
export const PUBLISH_ABILITY = 'video:publish'

export async function verifyVideoUploadToken(value?: string) {
  if (!value || !/^mbu_[a-zA-Z0-9._-]{1,160}$/.test(value)) return null
  const token = await User.uploadTokens.verify(new Secret(value))
  if (!token) return null
  const user = await User.find(String(token.tokenableId))
  return user ? { user, abilities: token.abilities } : null
}
