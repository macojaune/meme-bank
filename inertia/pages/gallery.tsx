import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import VideoCard from '../components/video_card'
import VideoModal from '../components/video_modal'

const UPLOAD_REGIONS = [
  { id: 'guadeloupe', name: 'Guadeloupe' },
  { id: 'martinique', name: 'Martinique' },
  { id: 'guyane', name: 'Guyane' },
]

interface Video {
  id: string
  title: string
  description: string
  filePath: string
  thumbnailPath: string | null
  region: string
  createdAt: string
  viewCount: number
  likeCount: number
  userId: number
  isPublished: boolean
}

interface VideosResponse {
  data: Video[]
  meta: {
    currentPage: number
    lastPage: number
  }
}

const REGIONS: Record<string, { name: string }> = {
  guadeloupe: { name: 'Guadeloupe' },
  martinique: { name: 'Martinique' },
  guyane: { name: 'Guyane' },
}

interface GalleryProps {
  videos: VideosResponse | null
  userId: number
  likedVideoIds: string[]
}

// Helper to get video stream URL
const getVideoUrl = (videoId: string) => {
  return `/videos/stream/${videoId}`
}

// Delete video handler
const handleDeleteVideo = (videoId: string) => {
  console.log('[Gallery] Attempting to delete video:', videoId)

  if (!confirm('Supprimer cette video ? Cette action est irreversible.')) {
    return
  }

  // Use Inertia router.delete() - handles CSRF, cookies, redirects automatically
  router.delete(`/videos/${videoId}`, {
    onSuccess: () => {
      console.log('[Gallery] Video deleted successfully')
      router.visit('/gallery')
    },
    onError: (errors) => {
      console.error('[Gallery] Delete failed:', errors)
      alert('Erreur lors de la suppression: ' + (errors.error || 'Erreur inconnue'))
    },
  })
}

export default function Gallery({ videos, userId, likedVideoIds }: GalleryProps) {
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set(likedVideoIds))
  // Ensure videos are only loaded once on mount to prevent hydration issues
  const [videoList, setVideoList] = useState<Video[]>(() => {
    // Use function initializer to ensure stable initial state
    return videos?.data ? [...videos.data] : []
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(
    videos?.meta && videos.meta.currentPage < videos.meta.lastPage
  )
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  // Upload states
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, setData, post, processing, reset } = useForm({
    title: '',
    description: '',
    region: '',
    video: null as File | null,
  })

  // Handle video click - increment view count and open modal
  const handleVideoClick = async (video: Video) => {
    // Increment view count via stream endpoint (which tracks views)
    fetch(`/videos/stream/${video.id}`).catch(() => {})
    // Increment view count via stream endpoint (which tracks views)
    fetch(`/videos/stream/${video.id}`).catch(() => {})

    // Optimistically update view count locally
    setVideoList((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, viewCount: (v.viewCount || 0) + 1 } : v))
    )

    // Update the selected video with new count
    const updatedVideo = { ...video, viewCount: (video.viewCount || 0) + 1 }
    setSelectedVideo(updatedVideo)
  }

  // Toggle like on video
  const handleLike = useCallback(
    async (videoId: string, e: React.MouseEvent) => {
      e.stopPropagation()

      const videoIdStr = String(videoId)
      const isLiked = userLikes.has(videoIdStr)

      setUserLikes((prev: Set<string>) => {
        const newSet = new Set(prev)
        if (isLiked) {
          newSet.delete(videoIdStr)
        } else {
          newSet.add(videoIdStr)
        }
        return newSet
      })

      setVideoList((prev: Video[]) =>
        prev.map((v: Video) => {
          if (v.id === videoId) {
            return { ...v, likeCount: isLiked ? v.likeCount - 1 : v.likeCount + 1 }
          }
          return v
        })
      )

      router.post(
        `/videos/${videoId}/like`,
        {},
        {
          preserveState: false,
          onError: (errors) => console.error('Like error:', errors),
        }
      )
    },
    [userLikes]
  )

  // Load more videos
  const loadMoreVideos = useCallback(async () => {
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
  }, [loading, hasMore, page])

  // Infinite scroll observer - only enable after initial mount to prevent hydration issues
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Mark as mounted after initial render to prevent hydration mismatches
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

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
  }, [hasMore, loading, loadMoreVideos, isMounted])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getRegionDisplay = (regionId: string) => {
    const region = REGIONS[regionId]
    return region ? region.name : 'Autre'
  }

  // Upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }, [])

  const handleFile = (file: File) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      alert('Format video non supporte')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux. Max 10MB.')
      return
    }
    setSelectedFile(file)
    setData('video', file)
    if (!data.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      setData('title', fileName)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('Selectionnez une video')
      return
    }
    if (!data.title.trim()) {
      alert('Donnez un titre')
      return
    }
    post('/videos/upload', {
      onProgress: (progress) => {
        if (progress && progress.total && progress.total > 0) {
          setUploadProgress(progress.loaded / progress.total)
        }
      },
      onSuccess: () => {
        reset()
        setSelectedFile(null)
        setUploadProgress(0)
        setShowUploadModal(false)
        // Refresh page to show new video
        window.location.reload()
      },
      onError: () => {
        setUploadProgress(0)
      },
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <Head title="Gallery" />
      <div className="min-h-screen bg-bg">
        {/* Navigation */}
        <nav className="border-b-2 border-black bg-white p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-black text-black uppercase tracking-tight">Galerie</h1>
            <div className="flex gap-3">
              <Link href="/dashboard" className="btn-neo btn-neo-secondary text-sm px-4 py-2">
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="btn-neo btn-neo-primary text-sm px-4 py-2"
              >
                Upload
              </button>
            </div>
          </div>
        </nav>

        {/* Video Grid */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {videoList.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎭</div>
              <h2 className="text-xl font-bold text-black mb-2">Aucune video</h2>
              <p className="text-gray-600 mb-4">Soyez le premier a upload un meme!</p>
              <Link href="/upload" className="btn-neo-primary">
                Upload Video
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videoList.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isLiked={userLikes.has(String(video.id))}
                    userId={userId}
                    onVideoClick={handleVideoClick}
                    onLikeClick={handleLike}
                  />
                ))}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center gap-1">
                    <div className="w-3 h-3 bg-primary-400 border-2 border-black shadow-neo animate-pulse" />
                    <div className="w-3 h-3 bg-primary-400 border-2 border-black shadow-neo animate-pulse delay-75" />
                    <div className="w-3 h-3 bg-primary-400 border-2 border-black shadow-neo animate-pulse delay-150" />
                  </div>
                  <p className="text-gray-600 mt-3 font-bold uppercase text-sm">Chargement...</p>
                </div>
              )}

              {/* Observer target - only render after mount to prevent hydration issues */}
              {isMounted && hasMore && !loading && <div ref={observerRef} className="h-4" />}
            </>
          )}
        </div>

        <VideoModal
          video={selectedVideo}
          userId={userId}
          onClose={() => setSelectedVideo(null)}
          onDelete={handleDeleteVideo}
        />

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="card-neo max-w-2xl w-full max-h-[90vh] overflow-auto bg-white relative">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="absolute -top-4 -right-4 btn-neo-brick w-10 h-10 flex items-center justify-center z-[60]"
              >
                ✕
              </button>

              <div className="p-6">
                <h2 className="text-2xl font-black uppercase mb-6">Upload Video</h2>

                {/* Drop Zone */}
                <div
                  className={`card-neo p-6 mb-6 transition-all ${dragActive ? 'border-primary-400 bg-primary-100' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/avi"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer text-center py-8 border-2 border-dashed border-black rounded hover:border-primary-400 transition-colors"
                    >
                      <div className="text-5xl mb-3">📹</div>
                      <p className="font-bold">Glissez-deposez votre video ici</p>
                      <p className="text-sm text-gray-600 mt-2">ou cliquez pour selectionner</p>
                      <p className="text-xs text-gray-500 mt-1">MP4, WebM, OGG, AVI - Max 10MB</p>
                    </div>
                  ) : (
                    <div className="bg-white border-2 border-black p-4">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">🎬</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{selectedFile.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null)
                            setData('video', null)
                          }}
                          className="btn-neo-brick text-sm px-2 py-1"
                          disabled={processing}
                        >
                          ✕
                        </button>
                      </div>
                      {processing && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-bold">Upload en cours...</span>
                            <span className="font-black">{Math.round(uploadProgress * 100)}%</span>
                          </div>
                          <div className="w-full bg-white border-2 border-black h-4">
                            <div
                              className="bg-primary-400 h-full border-r-2 border-black transition-all"
                              style={{ width: `${uploadProgress * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form */}
                <form onSubmit={handleUploadSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block font-bold uppercase text-sm mb-2">Titre *</label>
                      <input
                        type="text"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        className="input-neo"
                        placeholder="Titre de la video"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-sm mb-2">Description</label>
                      <textarea
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        className="input-neo min-h-[80px] resize-none"
                        placeholder="Description optionnelle"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-sm mb-2">Region</label>
                      <select
                        value={data.region}
                        onChange={(e) => setData('region', e.target.value)}
                        className="input-neo"
                      >
                        <option value="">Selectionnez une region</option>
                        {UPLOAD_REGIONS.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={processing || !selectedFile}
                      className="btn-neo btn-neo-primary w-full disabled:opacity-50"
                    >
                      {processing ? 'Upload en cours...' : '📤 Upload Video'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 p-4 border-t-3 border-black bg-white text-center">
          <p className="text-sm font-bold text-gray-600 uppercase">🎭 Caribbean Meme Bank v1.0</p>
        </footer>
      </div>
    </>
  )
}
