import Video from '#models/video'

export function homePreview() {
  return Video.query()
    .where('is_published', true)
    .orderBy('created_at', 'desc')
    .orderBy('id')
    .limit(6)
}
