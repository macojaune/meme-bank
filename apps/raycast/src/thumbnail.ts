import { authorizationFor } from './auth'

// Raycast image URLs cannot carry a Bearer token. Load the selected thumbnail into memory.
export async function loadThumbnail(url: string | undefined, signal?: AbortSignal) {
  if (!url) return
  const timeout = AbortSignal.timeout(8000)
  const response = await fetch(url, {
    headers: authorizationFor(url),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: 'error',
  })
  const type = response.headers.get('content-type')?.split(';')[0]
  if (!response.ok || !type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    await response.body?.cancel()
    return
  }
  const reader = response.body?.getReader()
  if (!reader) return
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.length
    if (bytes > 1024 * 1024) {
      await reader.cancel()
      return
    }
    chunks.push(value)
  }
  return 'data:' + type + ';base64,' + Buffer.concat(chunks).toString('base64')
}
