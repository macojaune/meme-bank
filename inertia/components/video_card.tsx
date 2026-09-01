import { useState } from 'react'

interface Person {
  id: string
  name: string
  socialMediaHandle: string | null
}

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
  persons?: Person[]
}

interface VideoCardProps {
  video: Video
  isLiked: boolean
  userId: string
  onVideoClick: (video: Video) => void
  onLikeClick: (videoId: string, e: React.MouseEvent) => void
  onPersonClick?: (person: Person) => void
}

const REGIONS: Record<string, { name: string; flag: string }> = {
  guadeloupe: { name: 'GPE', flag: '🇬🇵' },
  martinique: { name: 'MTQ', flag: '🇲🇶' },
  guyane: { name: 'GUY', flag: '🇬🇫' },
  reunion: { name: 'REU', flag: '🇷🇪' },
  mayotte: { name: 'MAY', flag: '🇾🇹' },
}

function getRegionDisplay(regionId: string | null): { name: string; flag: string } {
  if (!regionId) return { name: 'AUTRE', flag: '🌴' }
  return REGIONS[regionId] || { name: 'AUTRE', flag: '🌴' }
}

function getThumbnailUrl(videoId: string): string {
  const defaultUrl = 'http://localhost:9000'
  if (typeof window === 'undefined') {
    return `${defaultUrl}/memes/thumbnails/${videoId}.jpg`
  }
  const isLocalhost = window.location.hostname === 'localhost'
  const minioUrl = isLocalhost ? 'http://localhost:9000' : `http://${window.location.hostname}:9000`
  return `${minioUrl}/memes/thumbnails/${videoId}.jpg`
}

function formatViewCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

const PlayIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const EyeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

function ProcessingLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">⏳</span>
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
  onPersonClick,
}: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isProcessing = !video.isPublished
  const persons = video.persons || []
  const region = getRegionDisplay(video.region)

  return (
    <div
      className={`bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 cursor-pointer overflow-hidden group ${
        isProcessing
          ? 'opacity-75'
          : 'hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isProcessing && onVideoClick(video)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
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

        {/* Placeholder */}
        {(!imageLoaded || imageError) && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-yellow-300 to-pink-400 p-4 absolute inset-0">
            <span className="text-4xl mb-2">🎬</span>
            <p className="text-sm font-bold text-center text-black uppercase line-clamp-2">
              {video.title}
            </p>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
            <ProcessingLoader />
          </div>
        )}

        {/* Play overlay - only for published videos */}
        {!isProcessing && (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="w-20 h-20 bg-white border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <PlayIcon />
            </div>
          </div>
        )}

        {/* Region badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-white border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {region.flag} {region.name}
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3
          className={`font-black uppercase truncate mb-2 text-sm leading-tight ${isProcessing ? 'text-gray-500' : 'text-black'}`}
        >
          {video.title}
        </h3>

        {/* Tags */}
        {persons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {persons.slice(0, 3).map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPersonClick?.(person)
                }}
                className="px-2 py-0.5 bg-cyan border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-colors"
              >
                {person.name}
              </button>
            ))}
            {persons.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-200 border-2 border-black text-xs font-bold text-gray-600">
                +{persons.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t-2 border-gray-100">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-600">
            <EyeIcon />
            <span>{formatViewCount(video.viewCount || 0)}</span>
          </div>

          {!isProcessing && (
            <button
              type="button"
              onClick={(e) => onLikeClick(video.id, e)}
              className={`flex items-center gap-1 px-3 py-1 border-2 border-black font-bold text-sm transition-all ${
                isLiked
                  ? 'bg-red-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black hover:bg-red-100'
              }`}
            >
              <span className={isLiked ? 'animate-pulse' : ''}>
                <HeartIcon filled={isLiked} />
              </span>
              <span>{video.likeCount || 0}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
