import { Head, Link, router, useForm, usePage } from '@inertiajs/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import VideoCard from '../components/video_card.js'
import VideoModal from '../components/video_modal.js'
import SearchBar, { type SearchFilters } from '../components/search_bar.js'
import PointsToast from '../components/points_toast'
import VideoUploadForm from '../components/video_upload_form.js'
import Navigation from '../components/navigation'

const UPLOAD_REGIONS = [
  { id: 'guadeloupe', name: 'Guadeloupe' },
  { id: 'martinique', name: 'Martinique' },
  { id: 'guyane', name: 'Guyane' },
  { id: 'reunion', name: 'La Réunion' },
  { id: 'mayotte', name: 'Mayotte' },
]

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
  region: string | null
  createdAt: string
  viewCount: number
  likeCount: number
  userId: string
  isPublished: boolean
  persons?: Person[]
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
  userId: string
  likedVideoIds: string[]
  auth: {
    user: {
      fullName: string
    }
  }
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

export default function Gallery({ videos, userId, likedVideoIds, auth }: GalleryProps) {
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

  // Search states
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    region: '',
    persons: [],
    sortBy: 'newest',
  })
  const [isSearching, setIsSearching] = useState(false)

  // Abort controller for cancelling pending requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Search videos
  const performSearch = async (pageNum = 1, append = false, customFilters?: SearchFilters) => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    // Use custom filters if provided, otherwise use current state
    const filters = customFilters || searchFilters

    setIsSearching(true)
    try {
      const params = new URLSearchParams()
      if (filters.query) params.append('q', filters.query)
      if (filters.region) params.append('region', filters.region)
      for (const person of filters.persons) {
        params.append('personId', person.id)
      }
      params.append('sortBy', filters.sortBy)
      params.append('page', pageNum.toString())
      params.append('limit', '20')

      const response = await fetch(`/api/v1/search?${params}`, {
        signal: abortControllerRef.current.signal,
      })

      // Check if request was aborted
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()

      if (data.data) {
        if (append) {
          setVideoList((prev) => [...prev, ...data.data])
        } else {
          setVideoList(data.data)
        }
        setPage(pageNum)
        setHasMore(data.meta && pageNum < data.meta.lastPage)
      }
    } catch (error) {
      // Don't log aborted requests as errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Search error:', error)
      }
    } finally {
      setIsSearching(false)
    }
  }

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

  // Update URL based on current filters
  const updateUrlWithFilters = (filters: SearchFilters) => {
    const params = new URLSearchParams()
    if (filters.query) params.append('q', filters.query)
    if (filters.region) params.append('region', filters.region)
    for (const person of filters.persons) {
      params.append('personId', person.id)
      params.append('personName', person.name)
    }
    if (filters.sortBy !== 'newest') params.append('sortBy', filters.sortBy)

    const url = params.toString() ? `/gallery?${params}` : '/gallery'
    window.history.pushState({}, '', url)
  }

  // Handle person click - add person to filters
  const handlePersonClick = (person: Person) => {
    // Replace current selection with clicked person (don't add to list)
    const newFilters = {
      ...searchFilters,
      persons: [{ id: person.id, name: person.name }],
    }

    updateUrlWithFilters(newFilters)
    setSearchFilters(newFilters)
    setVideoList([])
    setPage(1)
    performSearch(1, false, newFilters)
  }

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

      // Optimistic update
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

      // API call using fetch (not Inertia router) to avoid page reload
      try {
        const response = await fetch(`/api/v1/videos/${videoId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
        })

        if (!response.ok) {
          throw new Error('Like failed')
        }

        const data = await response.json()

        // Update with server response if different
        if (data.likeCount !== undefined) {
          setVideoList((prev: Video[]) =>
            prev.map((v: Video) => {
              if (v.id === videoId) {
                return { ...v, likeCount: data.likeCount }
              }
              return v
            })
          )
        }
      } catch (error) {
        console.error('Like error:', error)
        // Revert optimistic update on error
        setUserLikes((prev: Set<string>) => {
          const newSet = new Set(prev)
          if (isLiked) {
            newSet.add(videoIdStr)
          } else {
            newSet.delete(videoIdStr)
          }
          return newSet
        })

        setVideoList((prev: Video[]) =>
          prev.map((v: Video) => {
            if (v.id === videoId) {
              return { ...v, likeCount: isLiked ? v.likeCount + 1 : v.likeCount - 1 }
            }
            return v
          })
        )
      }
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

  // Read URL params on mount and update filters
  useEffect(() => {
    setIsMounted(true)

    // Parse URL query params
    const urlParams = new URLSearchParams(window.location.search)
    const personIds = urlParams.getAll('personId')
    const personNames = urlParams.getAll('personName')
    const region = urlParams.get('region')
    const query = urlParams.get('q')
    const sortBy = (urlParams.get('sortBy') as SearchFilters['sortBy']) || 'newest'

    // Build persons array from URL params
    const persons: { id: string; name: string }[] = []
    for (let i = 0; i < personIds.length; i++) {
      if (personIds[i]) {
        persons.push({
          id: personIds[i],
          name: personNames[i] || 'Personne',
        })
      }
    }

    // Update filters from URL
    setSearchFilters({
      query: query || '',
      region: region || '',
      persons,
      sortBy,
    })

    // Initial search load
    performSearch(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isSearching) {
          performSearch(page + 1, true)
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadMoreVideos, isMounted])

  // Polling for processing videos - update status every 5 seconds
  useEffect(() => {
    if (!isMounted) return

    const processingVideos = videoList.filter((v) => !v.isPublished)
    if (processingVideos.length === 0) return

    const interval = setInterval(async () => {
      try {
        const videoIds = processingVideos.map((v) => v.id)
        const response = await fetch('/api/v1/videos/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds }),
        })

        if (response.ok) {
          const data = await response.json()

          // Update videos that are now complete
          setVideoList((prev) =>
            prev.map((video) => {
              const status = data.data.find((s: any) => s.id === video.id)
              if (status && status.isComplete && !video.isPublished) {
                return { ...video, isPublished: true }
              }
              return video
            })
          )
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [videoList, isMounted])

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
      onSuccess: (page) => {
        reset()
        setSelectedFile(null)
        setUploadProgress(0)
        setShowUploadModal(false)

        // Add the new video to the list immediately
        const newVideo = page.props.data as Video
        if (newVideo) {
          setVideoList((prev) => [newVideo, ...prev])
        }
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
        <Navigation user={{ fullName: auth.user.fullName }} isLoggedIn={true} />

        {/* Search Bar */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-0">
          <SearchBar
            filters={searchFilters}
            onChange={setSearchFilters}
            onSearch={(filters) => {
              const filtersToUse = filters || searchFilters
              if (filters) {
                setSearchFilters(filters)
              }
              updateUrlWithFilters(filtersToUse)
              performSearch(1, false, filtersToUse)
            }}
            regions={UPLOAD_REGIONS}
          />
        </div>

        {/* Video Grid */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Searching indicator - shows above results */}
          {isSearching && videoList.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Recherche en cours...</span>
            </div>
          )}

          {videoList.length === 0 && !isSearching ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎭</div>
              <h2 className="text-xl font-bold text-black mb-2">Aucune video</h2>
              <p className="text-gray-600 mb-4">Soyez le premier a upload un meme!</p>
              <Link href="/upload" className="btn-neo btn-neo-primary text-sm px-4 py-2">
                📤 Upload
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
                    onPersonClick={handlePersonClick}
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
          onPersonClick={handlePersonClick}
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

              <VideoUploadForm
                onUpload={(formData) => {
                  fetch('/videos/upload', {
                    method: 'POST',
                    body: formData,
                  }).then((response) => {
                    if (response.ok) {
                      setShowUploadModal(false)
                      // Refresh the video list
                      performSearch(1, false)
                    }
                  })
                }}
                onCancel={() => setShowUploadModal(false)}
                isProcessing={false}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 p-4 border-t-3 border-black bg-white text-center">
          <p className="text-sm font-bold text-gray-600 uppercase">🎭 Caribbean Meme Bank v1.0</p>
        </footer>

        <PointsToast userId={userId} />
      </div>
    </>
  )
}
