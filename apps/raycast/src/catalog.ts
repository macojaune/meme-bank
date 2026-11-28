export interface Video {
  id: string
  title: string
  tags?: { name: string }[]
  persons?: { name: string }[]
  description?: string | null
  thumbnailPath?: string | null
  filePath?: string | null
  skipAutoTranscription?: boolean
  durationSeconds?: number | null
  transcription?: { text: string } | null
}

interface SearchResponse {
  data: Video[]
  meta: { currentPage: number; lastPage: number }
}

export function catalogOrigin(value: string) {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Utilisez une adresse HTTPS ou une adresse HTTP locale, sans chemin ni identifiants.'
    )
  }
  return url.origin
}

export function bearerForOrigin(
  url: string,
  origin: string,
  token: string
): Record<string, string> {
  if (new URL(url).origin !== origin) return {}
  const value = token.trim()
  if (!value) throw new Error('Renseignez votre jeton de lecture dans les préférences de MemeBank.')
  return { Authorization: 'Bearer ' + value }
}

export function assetUrl(base: string, path?: string | null) {
  if (!path || !URL.canParse(path, base)) return
  const url = new URL(path, base)
  if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return
  return url.href
}

export function mediaUrl(base: string, video: Video) {
  const url = assetUrl(base, video.filePath)
  if (url) return url
  // Older servers expose this route only for imported videos.
  if (video.skipAutoTranscription)
    return new URL('/api/v1/videos/' + encodeURIComponent(video.id) + '/media', base).href
  throw new Error(
    'Cette instance MemeBank doit être mise à jour pour fournir le fichier de cette vidéo.'
  )
}

export async function searchVideos(
  base: string,
  query: string,
  page: number,
  headers: Record<string, string>,
  options: { ids?: string[]; signal?: AbortSignal } = {}
) {
  const url = new URL('/api/v1/search', base)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(options.ids?.length || 25))
  if (query) url.searchParams.set('q', query)
  if (options.ids) url.searchParams.set('videoIds', options.ids.join(','))
  const timeout = AbortSignal.timeout(20000)
  const result = await fetch(url, {
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    headers,
    redirect: 'error',
  })
  if (result.status === 401)
    throw new Error(
      'Votre jeton de lecture est absent, expiré ou révoqué. Vérifiez les préférences de MemeBank.'
    )
  if (!result.ok) throw new Error('MemeBank a renvoyé HTTP ' + result.status + '.')
  const { data, meta }: SearchResponse = await result.json()
  if (!Array.isArray(data) || !meta) throw new Error('Réponse du catalogue illisible.')
  return { data, hasMore: meta.currentPage < meta.lastPage }
}

export function orderByRecentIds(ids: string[], videos: Video[]) {
  const byId = new Map(videos.map((video) => [video.id, video]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

export function videoLabels(video: Video) {
  const names = [...(video.tags ?? []), ...(video.persons ?? [])].map(({ name }) => name.trim())
  return [...new Set(names.filter(Boolean))]
}

export function subtitle(video: Video, query: string) {
  const text = (video.transcription?.text || '').replace(/\s+/g, ' ').trim()
  const hit = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : 0
  const start = Math.max(0, hit - 20)
  return (
    (start ? '…' : '') + text.slice(start, start + 120) + (start + 120 < text.length ? '…' : '')
  )
}
