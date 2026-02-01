import { useState } from 'react'

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

/**
 * Get the public URL for a thumbnail from MinIO
 * Thumbnails are stored as: thumbnails/{videoId}.jpg
 * SSR-safe: returns default URL during server-side rendering
 */
function getThumbnailUrl(videoId: string): string {
  // Default URL for SSR (server-side rendering)
  const defaultUrl = 'http://localhost:9000'

  // Check if we're in the browser
  if (typeof window === 'undefined') {
    return `${defaultUrl}/memes/thumbnails/${videoId}.jpg`
  }

  // In browser: use actual hostname
  const isLocalhost = window.location.hostname === 'localhost'
  const minioUrl = isLocalhost ? 'http://localhost:9000' : `http://${window.location.hostname}:9000`

  return `${minioUrl}/memes/thumbnails/${videoId}.jpg`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Animated loader component
 */
function ProcessingLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg">⏳</span>
        </div>
      </div>
      <p className="text-sm font-bold text-black uppercase">Traitement...</p>
    </div>
  )
}

export default function VideoCard({
  video,
  isLiked,
  userId,
  onVideoClick,
  onLikeClick,
}: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const isProcessing = !video.isPublished

  return (
    <div
      className={`card-neo-hover text-left w-full overflow-hidden ${
        isProcessing ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={() => !isProcessing && onVideoClick(video)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 border-b-2 border-black relative overflow-hidden">
        {!imageError && (
          <img
            src={getThumbnailUrl(video.id)}
            alt={video.title}
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } ${isProcessing ? 'grayscale' : ''}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Placeholder shown while loading or on error */}
        {(!imageLoaded || imageError) && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-warm p-4 absolute inset-0">
            <span className="text-5xl mb-2">🎬</span>
            <p className="text-sm font-bold text-center text-black uppercase line-clamp-2">
              {video.title}
            </p>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <ProcessingLoader />
          </div>
        )}

        {/* Play button overlay - only for published videos */}
        {!isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 bg-primary-400 flex items-center justify-center border-2 border-black shadow-neo">
              <span className="text-2xl text-black">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3
          className={`font-black truncate mb-2 uppercase ${isProcessing ? 'text-gray-500' : 'text-black'}`}
        >
          {video.title}
        </h3>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="badge-neo bg-secondary-300">{getRegionDisplay(video.region)}</span>
          {isProcessing ? (
            <span className="badge-neo bg-yellow-400 text-black font-bold animate-pulse">
              ⏳ TRAITEMENT
            </span>
          ) : (
            <span className="badge-neo bg-green-400 text-black font-bold">✓ PUBLIÉ</span>
          )}
          <span className="font-medium text-gray-600">{formatDate(video.createdAt)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold text-gray-600">
          <span>{video.viewCount || 0} vues</span>
          {!isProcessing && (
            <div
              onClick={(e) => onLikeClick(video.id, e)}
              className={`flex items-center gap-1 px-2 py-1 border-2 border-black ${
                isLiked ? 'bg-red-100' : 'bg-white'
              } text-black cursor-pointer hover:shadow-neo transition-shadow`}
              role="button"
              tabIndex={0}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{video.likeCount || 0}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
