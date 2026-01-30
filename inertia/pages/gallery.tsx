import { Head, Link, router } from '@inertiajs/react'
import { useState, useEffect, useRef } from 'react'

const REGIONS = {
  guadeloupe: { name: 'Guadeloupe', flag: '🇬🇵' },
  martinique: { name: 'Martinique', flag: '🇲🇶' },
  guyane: { name: 'Guyane', flag: '🇬🇫' },
}

export default function Gallery({ videos }) {
  const [videoList, setVideoList] = useState(videos?.data || [])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(videos?.meta?.currentPage < videos?.meta?.lastPage)
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const observerRef = useRef(null)

  // Load more videos
  const loadMoreVideos = async () => {
    if (loading || !hasMore) return
    setLoading(true)

    try {
      const nextPage = page + 1
      const response = await fetch(`/api/v1/videos?page=${nextPage}&limit=20`)
      const data = await response.json()

      if (data.data && data.data.length > 0) {
        setVideoList((prev) => [...prev, ...data.data])
        setPage(nextPage)
        setHasMore(nextPage < data.meta.lastPage)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more videos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreVideos()
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, page])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getRegionDisplay = (regionId) => {
    const region = REGIONS[regionId]
    return region ? `${region.flag} ${region.name}` : '🌎 Autre'
  }

  return (
    <>
      <Head title="Gallery" />
      <div className="min-h-screen bg-bg">
        {/* Navigation */}
        <nav className="border-b-2 border-border bg-surface p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-text uppercase tracking-wider">🎬 Gallery</h1>
            <div className="flex gap-2">
              <Link href="/dashboard" className="btn-neo-secondary text-sm">
                Dashboard
              </Link>
              <Link href="/upload" className="btn-neo-primary text-sm">
                Upload
              </Link>
            </div>
          </div>
        </nav>

        {/* Video Grid */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {videoList.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎭</div>
              <h2 className="text-xl font-bold text-text mb-2">Aucune video</h2>
              <p className="text-text-muted mb-4">Soyez le premier a upload un meme!</p>
              <Link href="/upload" className="btn-neo-primary">
                Upload Video
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {videoList.map((video) => (
                  <div
                    key={video.id}
                    className="card-neo-hover cursor-pointer overflow-hidden"
                    onClick={() => setSelectedVideo(video)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gray-100 border-b-2 border-border relative overflow-hidden">
                      {video.thumbnailPath ? (
                        <img
                          src={video.thumbnailPath}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface">
                          <span className="text-4xl">🎬</span>
                        </div>
                      )}
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-primary-500 flex items-center justify-center border-3 border-border shadow-neo">
                          <span className="text-2xl text-white ml-1">▶</span>
                        </div>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-text truncate mb-2 uppercase">{video.title}</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="badge-neo">{getRegionDisplay(video.region)}</span>
                        <span className="text-text-muted">{formatDate(video.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-text-muted">
                        <span>👁 {video.viewCount || 0}</span>
                        <span>❤️ {video.likeCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center gap-1">
                    <div className="w-3 h-3 bg-primary-500 border-2 border-border shadow-neo animate-pulse" />
                    <div className="w-3 h-3 bg-primary-500 border-2 border-border shadow-neo animate-pulse delay-75" />
                    <div className="w-3 h-3 bg-primary-500 border-2 border-border shadow-neo animate-pulse delay-150" />
                  </div>
                  <p className="text-text-muted mt-3 font-bold uppercase text-sm">Chargement...</p>
                </div>
              )}

              {/* Observer target */}
              {hasMore && !loading && <div ref={observerRef} className="h-4" />}
            </>
          )}
        </div>

        {/* Video Player Modal */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <div
              className="card-neo max-w-4xl w-full max-h-[90vh] overflow-auto bg-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video bg-black border-b-2 border-border">
                <video
                  src={selectedVideo.filePath}
                  controls
                  className="w-full h-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  Video not supported
                </video>
              </div>
              <div className="p-4">
                <h2 className="text-xl font-bold text-text uppercase mb-2">
                  {selectedVideo.title}
                </h2>
                <p className="text-text-muted mb-2">{selectedVideo.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="badge-neo">{getRegionDisplay(selectedVideo.region)}</span>
                  <span className="text-text-muted">{formatDate(selectedVideo.createdAt)}</span>
                  <span>Views: {selectedVideo.viewCount || 0}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-3 -right-3 btn-neo-brick w-10 h-10 flex items-center justify-center z-10"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 p-4 border-t-3 border-border bg-surface text-center">
          <p className="text-sm font-bold text-text-muted uppercase">🎭 Caribbean Meme Bank v1.0</p>
        </footer>
      </div>
    </>
  )
}
