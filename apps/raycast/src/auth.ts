import { getPreferenceValues } from '@raycast/api'
import { bearerForOrigin, catalogOrigin } from './catalog'

export const defaultOrigin = 'https://dev-memebank.marvinl.com'

export function authorizationFor(url: string): Record<string, string> {
  const { baseUrl, readToken } = getPreferenceValues<{ baseUrl?: string; readToken: string }>()
  return bearerForOrigin(url, catalogOrigin(baseUrl || defaultOrigin), readToken)
}
