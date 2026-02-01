import env from '#start/env'

/**
 * Convert internal MinIO URL to public URL
 * The internal URL (http://minio:9000) is used inside Docker containers
 * The public URL (http://localhost:9000) is used by the browser
 */
export function getPublicUrl(internalUrl: string): string {
  const internalEndpoint = env.get('MINIO_ENDPOINT', 'http://minio:9000')
  const publicEndpoint = env.get('MINIO_PUBLIC_URL', 'http://localhost:9000')

  if (internalUrl.startsWith(internalEndpoint)) {
    return internalUrl.replace(internalEndpoint, publicEndpoint)
  }

  return internalUrl
}

/**
 * Get the public URL for a video file
 */
export function getVideoPublicUrl(filePath: string): string {
  const publicEndpoint = env.get('MINIO_PUBLIC_URL', 'http://localhost:9000')
  const bucket = env.get('MINIO_BUCKET', 'memes')

  // Remove leading slash if present
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath

  return `${publicEndpoint}/${bucket}/${cleanPath}`
}
