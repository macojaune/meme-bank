import { Head, router, Link } from '@inertiajs/react'
import { useState } from 'react'
import VideoModal from '../components/video_modal'
import PointsToast from '../components/points_toast'

interface Person {
  id: string
  name: string
  socialMediaHandle?: string | null
}

interface Video {
  id: string
  title: string
  description: string | null
  filePath: string
  thumbnailPath: string | null
  durationSeconds: number | null
  isPublished: boolean
  region: string | null
  viewCount: number
  likeCount: number
  createdAt: string
  userId: string
  persons: Person[]
}

interface UserStats {
  videos: number
  views: number
  likes: number
  points: number
}

interface DashboardProps {
  auth: {
    user: {
      id: number
      email: string
      fullName: string
    }
    isLoggedIn: boolean
  }
  stats: UserStats
  videos: Video[]
  likedVideos?: Video[]
}

function getThumbnailUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath) return null
  if (thumbnailPath.startsWith('http')) return thumbnailPath

  const minioUrl =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `http://${window.location.hostname}:9000`
      : 'http://localhost:9000'

  const bucket = 'memes'
  const cleanPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath
  return `${minioUrl}/${bucket}/${cleanPath}`
}

const VideoIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)

const EyeIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const HeartIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const TrophyIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const UploadIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const PlayIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`${color} border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`}>
      <div className="flex justify-center mb-2">
        <div className="text-black">{icon}</div>
      </div>
      <h3 className="font-black uppercase text-center text-sm mb-2">{label}</h3>
      <p className="font-black text-center text-5xl md:text-6xl leading-none">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function VideoCard({
  video,
  onClick,
  onPublish,
}: {
  video: Video
  onClick: () => void
  onPublish?: () => void
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const thumbnailUrl = getThumbnailUrl(video.thumbnailPath)

  return (
    <div
      className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden group cursor-pointer hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {!imageError && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.title}
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-300 to-pink-400 absolute inset-0">
            <span className="text-4xl">🎬</span>
          </div>
        )}

        {/* Play overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="w-16 h-16 bg-white border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <PlayIcon />
          </div>
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          {video.isPublished ? (
            <span className="px-3 py-1 bg-green-400 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              PUBLIE
            </span>
          ) : (
            <span className="px-3 py-1 bg-yellow-400 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              EN ATTENTE
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-black uppercase truncate mb-2 text-sm leading-tight">{video.title}</h3>

        {/* Tags */}
        {video.persons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {video.persons.slice(0, 2).map((person) => (
              <span
                key={person.id}
                className="px-2 py-0.5 bg-cyan border-2 border-black text-xs font-bold"
              >
                {person.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t-2 border-gray-100">
          <span className="text-xs font-bold text-gray-600">{video.viewCount} vues</span>
          <span className="text-xs font-bold text-gray-600">{video.likeCount} likes</span>
        </div>

        {/* Publish button for pending videos */}
        {!video.isPublished && onPublish && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPublish()
            }}
            className="mt-3 w-full bg-yellow-400 border-4 border-black px-4 py-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            PUBLIER
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ auth, stats, videos, likedVideos = [] }: DashboardProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video)
  }

  const handlePublish = (videoId: string) => {
    router.post(`/videos/${videoId}/publish`, {}, { onSuccess: () => router.reload() })
  }

  const handleDelete = () => {
    setSelectedVideo(null)
    router.reload()
  }

  return (
    <>
      <Head title="Dashboard - Meme Bank" />
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
          <div className="max-w-full mx-auto px-4 py-3 flex justify-between items-center">
            <Link
              href="/"
              className="text-2xl md:text-3xl font-black uppercase tracking-tight hover:opacity-70 transition-opacity"
            >
              MEME BANK
            </Link>
            <div className="flex gap-3 items-center">
              <Link
                href="/gallery"
                className="font-bold uppercase text-sm px-3 py-2 hover:underline"
              >
                GALLERIE
              </Link>
              <Link href="/" className="font-bold uppercase text-sm px-3 py-2 hover:underline">
                ACCUEIL
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="max-w-full mx-auto px-4 py-8 md:py-12 pt-20">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase text-center mb-4 leading-none">
            BIENVENUE,
            <br />
            <span className="text-yellow-400">{auth.user.fullName}</span>
          </h1>

          <div className="text-center">
            <Link
              href="/upload"
              className="inline-block bg-yellow-400 border-4 border-black px-8 py-4 font-black uppercase text-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 mx-auto w-fit"
            >
              <UploadIcon />
              UPLOADER UN NOUVEAU MEME
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-full mx-auto px-4 pb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<VideoIcon />} label="Videos" value={stats.videos} color="bg-cyan" />
            <StatCard icon={<EyeIcon />} label="Vues" value={stats.views} color="bg-pink-400" />
            <StatCard icon={<HeartIcon />} label="Likes" value={stats.likes} color="bg-red-500" />
            <StatCard
              icon={<TrophyIcon />}
              label="Points de Karma"
              value={stats.points}
              color="bg-yellow-400"
            />
          </div>
        </div>

        {/* Favorites */}
        {likedVideos.length > 0 && (
          <div className="max-w-full mx-auto px-4 py-8 border-t-4 border-black">
            <h2 className="text-3xl md:text-4xl font-black uppercase mb-6">MES FAVORIS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {likedVideos.map((video) => (
                <VideoCard key={video.id} video={video} onClick={() => handleVideoClick(video)} />
              ))}
            </div>
          </div>
        )}

        {/* My Videos */}
        <div className="max-w-full mx-auto px-4 py-8 border-t-4 border-black">
          <h2 className="text-3xl md:text-4xl font-black uppercase mb-6">MES ARCHIVES</h2>

          {videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={() => handleVideoClick(video)}
                  onPublish={() => handlePublish(video.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-bold mb-4">Aucune video pour le moment</p>
              <Link
                href="/upload"
                className="inline-block bg-yellow-400 border-4 border-black px-6 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              >
                UPLOADER
              </Link>
            </div>
          )}
        </div>

        {/* Modal */}
        <VideoModal
          video={selectedVideo}
          userId={auth.user.id.toString()}
          onClose={() => setSelectedVideo(null)}
          onDelete={handleDelete}
        />

        {/* Footer */}
        <footer className="border-t-4 border-black py-8 text-center bg-black text-white">
          <p className="font-black text-4xl md:text-6xl uppercase tracking-tighter">MEME BANK</p>
        </footer>

        <PointsToast userId={auth.user.id.toString()} />
      </div>
    </>
  )
}
