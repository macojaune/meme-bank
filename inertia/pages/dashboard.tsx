import { Head, router, Link } from '@inertiajs/react'
import { useState } from 'react'
import VideoModal from '../components/video_modal'

/**
 * Get the public URL for a thumbnail from MinIO
 * SSR-safe for dashboard rendering
 */
function getThumbnailUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath) return null

  // If it's already a full URL, return it
  if (thumbnailPath.startsWith('http')) {
    return thumbnailPath
  }

  // Default URL (works for both SSR and browser)
  const minioUrl =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `http://${window.location.hostname}:9000`
      : 'http://localhost:9000'

  const bucket = 'memes'
  const cleanPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath

  return `${minioUrl}/${bucket}/${cleanPath}`
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
  persons: Array<{ id: string; name: string }>
  transcription: string | null
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
  stats: {
    videos: number
    views: number
    likes: number
  }
  videos: Video[]
}

export default function Dashboard({ auth, stats, videos }: DashboardProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  const handleLogout = () => {
    setIsLoggingOut(true)
    router.post(
      '/logout',
      {},
      {
        onFinish: () => setIsLoggingOut(false),
      }
    )
  }

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video)
  }

  return (
    <>
      <Head title="Dashboard" />
      <div className="min-h-screen bg-bg">
        {/* Navigation */}
        <nav className="border-b-2 border-black bg-white px-4 py-3 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-2xl font-black uppercase tracking-tight">
              MEME BANK
            </Link>
            <div className="flex items-center gap-4">
              <span className="font-bold text-text">{auth.user.fullName.toUpperCase()}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn-neo-brick text-sm px-3 py-2"
              >
                {isLoggingOut ? '...' : '✕'}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-black text-text uppercase tracking-tight mb-2">
              Bienvenue
            </h1>
            <p className="text-xl font-bold text-text-muted uppercase tracking-wide">
              {auth.user.fullName}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card-neo text-center">
              <div className="text-4xl mb-2">📹</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Videos</h3>
              <p className="text-3xl font-black text-text">{stats.videos}</p>
            </div>

            <div className="card-neo text-center">
              <div className="text-4xl mb-2">👁</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Vues</h3>
              <p className="text-3xl font-black text-text">{stats.views}</p>
            </div>

            <div className="card-neo text-center">
              <div className="text-4xl mb-2">❤️</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Likes</h3>
              <p className="text-3xl font-black text-text">{stats.likes}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/upload"
              className="btn-neo btn-neo-primary text-center py-4 text-lg no-underline"
            >
              📤 Upload Video
            </Link>
            <Link
              href="/gallery"
              className="btn-neo btn-neo-secondary text-center py-4 text-lg no-underline"
            >
              🎬 Voir Gallery
            </Link>
          </div>
        </div>

        {/* My Videos Section */}
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-text uppercase tracking-tight mb-6">
            Mes vidéos
          </h2>
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="card-neo overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleVideoClick(video)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-100 border-b-2 border-black relative">
                    {getThumbnailUrl(video.thumbnailPath) ? (
                      <img
                        src={getThumbnailUrl(video.thumbnailPath)!}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          const img = e.target as HTMLImageElement
                          img.style.display = 'none'
                          const parent = img.parentElement
                          if (parent) {
                            const placeholder = document.createElement('div')
                            placeholder.className =
                              'w-full h-full flex items-center justify-center bg-gray-200'
                            placeholder.innerHTML = '<span class="text-4xl">🎬</span>'
                            parent.appendChild(placeholder)
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-warm">
                        <span className="text-4xl">🎬</span>
                      </div>
                    )}
                    {!video.isPublished && (
                      <span className="absolute top-2 right-2 px-2 py-1 bg-yellow-400 text-black text-xs font-bold">
                        PENDING
                      </span>
                    )}
                    {video.isPublished && (
                      <span className="absolute top-2 right-2 px-2 py-1 bg-green-400 text-black text-xs font-bold">
                        PUBLIÉ
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2 truncate">{video.title}</h3>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {video.persons.map((p) => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-1 bg-secondary-100 border border-black"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{video.viewCount} vues</span>
                      <span>{video.likeCount} likes</span>
                    </div>
                    {/* Manual publish button for pending videos */}
                    {!video.isPublished && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.post(
                            `/videos/${video.id}/publish`,
                            {},
                            {
                              onSuccess: () => router.reload(),
                            }
                          )
                        }}
                        className="mt-2 w-full btn-neo btn-neo-primary text-sm py-1"
                      >
                        🚀 Publier maintenant
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Aucune vidéo pour le moment.{' '}
              <Link href="/upload" className="text-primary-600 underline">
                Uploader une vidéo
              </Link>
            </p>
          )}
        </div>

        <VideoModal
          video={selectedVideo}
          userId={auth.user.id.toString()}
          onClose={() => setSelectedVideo(null)}
          onDelete={() => {
            setSelectedVideo(null)
            router.reload()
          }}
        />

        {/* Footer */}
        <footer className="mt-16 p-4 border-t-2 border-black bg-white text-center">
          <p className="text-sm font-bold text-text-muted uppercase">Caribbean Meme Bank v1.0</p>
        </footer>
      </div>
    </>
  )
}
