type VideoAssets = { id: string; filePath: string; thumbnailPath: string | null }

export function videoAssetUrl(
  video: VideoAssets,
  asset: 'media' | 'thumbnail',
  audience: 'member' | 'preview' = 'member'
) {
  if (!(asset === 'media' ? video.filePath : video.thumbnailPath)) return null
  const prefix = audience === 'preview' ? '/preview' : '/api/v1/videos'
  return `${prefix}/${video.id}/${asset}`
}
