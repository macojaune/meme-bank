interface Video {
  id: string
  title: string
  description: string | null
  filePath: string
  thumbnailPath: string | null
  durationSeconds: number | null
  viewCount: number
  likeCount: number
  isPublished: boolean
  region: string | null
  createdAt: string
  userId: string
}

interface VideoCardProps {
  video: Video
  isLiked: boolean
  userId: string
  onVideoClick: (video: Video) => void
  onLikeClick: (videoId: string, e: React.MouseEvent) => void
}

const REGIONS: Record<string, { name: string }> = {
  guadeloupe: { name: 'Guadeloupe' },
  martinique: { name: 'Martinique' },
  guyane: { name: 'Guyane' },
  reunion: { name: 'La Réunion' },
  mayotte: { name: 'Mayotte' },
}

function getRegionDisplay(regionId: string | null): string {
  if (!regionId) return 'Autre'
  return REGIONS[regionId]?.name || 'Autre'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function VideoCard({
  video,
  isLiked,
  userId,
  onVideoClick,
  onLikeClick,
}: VideoCardProps) {
  return (
    <button
      type="button"
      className="card-neo-hover text-left w-full overflow-hidden"
      onClick={() => onVideoClick(video)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 border-b-2 border-black relative overflow-hidden">
        {video.thumbnailPath ? (
          <img src={video.thumbnailPath} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-warm p-4">
            <span className="text-5xl mb-2">🎬</span>
            <p className="text-sm font-bold text-center text-black uppercase line-clamp-2">
              {video.title}
            </p>
          </div>
        )}
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 bg-primary-400 flex items-center justify-center border-2 border-black shadow-neo">
            <span className="text-2xl text-black">▶</span>
          </div>
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3 className="font-black text-black truncate mb-2 uppercase">{video.title}</h3>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="badge-neo bg-secondary-300">{getRegionDisplay(video.region)}</span>
          {!video.isPublished && (
            <span className="badge-neo bg-yellow-400 text-black font-bold">PENDING</span>
          )}
          <span className="font-medium text-gray-600">{formatDate(video.createdAt)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold text-gray-600">
          <span>{video.viewCount || 0} vues</span>
          <div
            onClick={(e) => onLikeClick(video.id, e)}
            className={`flex items-center gap-1 px-2 py-1 border-2 border-black ${
              isLiked ? 'bg-red-100' : 'bg-white'
            } text-black cursor-pointer`}
            role="button"
            tabIndex={0}
          >
            <span>{isLiked ? '❤️' : '🤍'}</span>
            <span>{video.likeCount || 0}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
