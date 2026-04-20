import env from '#start/env'

function getBundledAssetUrl(filePath: string): string | null {
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath
  return cleanPath.startsWith('seed/') ? `/${cleanPath}` : null
}

export function buildObjectPublicUrl(
  filePath: string,
  publicEndpoint: string,
  bucket?: string
): string {
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const baseUrl = publicEndpoint.replace(/\/$/, '')

  return bucket ? `${baseUrl}/${bucket}/${cleanPath}` : `${baseUrl}/${cleanPath}`
}

/** Convert an internal object URL or key to its browser-facing URL. */
export function getPublicUrl(internalUrl: string): string {
  const bundledAssetUrl = getBundledAssetUrl(internalUrl)
  if (bundledAssetUrl) return bundledAssetUrl

  const internalEndpoint = env.get('R2_ENDPOINT') || env.get('MINIO_ENDPOINT', 'http://minio:9000')
  const publicEndpoint =
    env.get('R2_PUBLIC_URL') || env.get('MINIO_PUBLIC_URL', 'http://localhost:9000')

  if (internalUrl.startsWith(internalEndpoint)) {
    return internalUrl.replace(internalEndpoint, publicEndpoint)
  }

  if (!/^https?:\/\//.test(internalUrl)) {
    return getVideoPublicUrl(internalUrl)
  }

  return internalUrl
}

/**
 * Get the public URL for a video file
 */
export function getVideoPublicUrl(filePath: string): string {
  if (/^https?:\/\//.test(filePath)) return filePath

  const bundledAssetUrl = getBundledAssetUrl(filePath)
  if (bundledAssetUrl) return bundledAssetUrl

  const r2PublicUrl = env.get('R2_PUBLIC_URL')
  const publicEndpoint = r2PublicUrl || env.get('MINIO_PUBLIC_URL', 'http://localhost:9000')
  const bucket = env.get('R2_BUCKET') || env.get('MINIO_BUCKET', 'memes')

  return buildObjectPublicUrl(filePath, publicEndpoint, r2PublicUrl ? undefined : bucket)
}
