import { Head, Link, router } from '@inertiajs/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import VideoCard from '../components/video_card'
import VideoModal from '../components/video_modal'
import PointsToast from '../components/points_toast'

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

interface GalleryProps {
  videos: VideosResponse | null
  userId: string
  likedVideoIds: string[]
  auth: {
    user: {
      id: number
      fullName: string
    }
    isLoggedIn: boolean
  }
}

interface FilterState {
  query: string
  region: string
  sortBy: 'newest' | 'oldest' | 'views' | 'likes'
}

const REGIONS = [
  { id: '', name: 'TOUS', flag: '🌴' },
  { id: 'guadeloupe', name: 'GPE', flag: '🇬🇵' },
  { id: 'martinique', name: 'MTQ', flag: '🇲🇶' },
  { id: 'guyane', name: 'GUY', flag: '🇬🇫' },
]

const SORT_OPTIONS = [
  { id: 'newest', name: 'RECENTS', icon: '🕒' },
  { id: 'likes', name: 'TOP RATED', icon: '⭐' },
]

const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

export default function Gallery({ videos, userId, likedVideoIds, auth }: GalleryProps) {
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set(likedVideoIds))
  const [videoList, setVideoList] = useState<Video[]>(() => (videos?.data ? [...videos.data] : []))
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(
    videos?.meta && videos.meta.currentPage < videos.meta.lastPage
  )
  const [loading, setLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [filters, setFilters] = useState<FilterState>({
    query: '',
    region: '',
    sortBy: 'newest',
  })

  const performSearch = async (pageNum = 1, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsSearching(true)
    try {
      const params = new URLSearchParams()
      if (filters.query) params.append('q', filters.query)
      if (filters.region) params.append('region', filters.region)
      params.append('sortBy', filters.sortBy)
      params.append('page', pageNum.toString())
      params.append('limit', '20')

      const response = await fetch(`/api/v1/search?${params}`, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Search failed')

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
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Search error:', error)
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleVideoClick = async (video: Video) => {
    fetch(`/videos/stream/${video.id}`).catch(() => {})
    setVideoList((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, viewCount: (v.viewCount || 0) + 1 } : v))
    )
    const updatedVideo = { ...video, viewCount: (video.viewCount || 0) + 1 }
    setSelectedVideo(updatedVideo)
  }

  const handleLike = useCallback(
    async (videoId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const videoIdStr = String(videoId)
      const isLiked = userLikes.has(videoIdStr)

      setUserLikes((prev) => {
        const newSet = new Set(prev)
        isLiked ? newSet.delete(videoIdStr) : newSet.add(videoIdStr)
        return newSet
      })

      setVideoList((prev) =>
        prev.map((v) => {
          if (v.id === videoId) {
            return { ...v, likeCount: isLiked ? v.likeCount - 1 : v.likeCount + 1 }
          }
          return v
        })
      )

      try {
        const response = await fetch(`/api/v1/videos/${videoId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error('Like failed')
      } catch (error) {
        console.error('Like error:', error)
        setUserLikes((prev) => {
          const newSet = new Set(prev)
          isLiked ? newSet.add(videoIdStr) : newSet.delete(videoIdStr)
          return newSet
        })
      }
    },
    [userLikes]
  )

  const handlePersonClick = (person: Person) => {
    setFilters((prev) => ({ ...prev, query: person.name }))
    setVideoList([])
    setPage(1)
    performSearch(1, false)
  }

  const handleDeleteVideo = (videoId: string) => {
    if (!confirm('Supprimer cette video ? Cette action est irreversible.')) return
    router.delete(`/videos/${videoId}`, {
      onSuccess: () => router.visit('/gallery'),
      onError: (errors) => alert('Erreur: ' + (errors.error || 'Erreur inconnue')),
    })
  }

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
      console.error('Error loading more:', error)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page])

  const [isMounted, setIsMounted] = useState(false)

  // Initial load - read URL params and perform search
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const query = urlParams.get('q') || ''
    const region = urlParams.get('region') || ''
    const sortBy = (urlParams.get('sortBy') as FilterState['sortBy']) || 'newest'

    setFilters({
      query,
      region,
      sortBy,
    })

    // Perform search with URL params directly
    const doSearch = async () => {
      const params = new URLSearchParams()
      if (query) params.append('q', query)
      if (region) params.append('region', region)
      params.append('sortBy', sortBy)
      params.append('page', '1')
      params.append('limit', '20')

      try {
        setIsSearching(true)
        const response = await fetch(`/api/v1/search?${params}`)
        if (response.ok) {
          const data = await response.json()
          if (data.data) {
            setVideoList(data.data)
            setPage(1)
            setHasMore(data.meta && 1 < data.meta.lastPage)
          }
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
        setIsMounted(true)
      }
    }

    doSearch()
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
    if (observerRef.current) observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, isMounted, page, isSearching])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setVideoList([])
    setPage(1)
    performSearch(1, false)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <Head title="Gallery - Meme Bank" />
      <div className="min-h-screen bg-white">
        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-white border-b-4 border-black">
          <div className="max-w-full mx-auto px-4 py-3 flex justify-between items-center">
            <Link
              href="/"
              className="text-2xl md:text-3xl font-black uppercase tracking-tight hover:opacity-70 transition-opacity"
            >
              MEME BANK
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/upload"
                className="hidden sm:block bg-yellow-400 border-4 border-black px-4 py-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                DROP UN MEME
              </Link>

              {/* User Avatar */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 bg-white border-4 border-black rounded-full font-black text-sm flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  {getInitials(auth.user.fullName)}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-12 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[160px] z-50">
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 font-bold hover:bg-gray-100 border-b-2 border-black"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        router.post('/logout')
                      }}
                      className="w-full text-left px-4 py-2 font-bold hover:bg-gray-100 text-left"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COMMAND CENTER */}
          <div className="max-w-full mx-auto px-4 pb-4">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mb-4">
              <div className="flex">
                <div className="flex-1 bg-white border-4 border-black border-r-0 p-1">
                  <div className="flex items-center h-full px-3">
                    <SearchIcon />
                    <input
                      type="text"
                      value={filters.query}
                      onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                      placeholder="Cherche une punchline, un mood, un mot créole..."
                      className="flex-1 px-3 py-2 font-medium focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-black text-white border-4 border-black px-6 font-black uppercase hover:bg-gray-800 transition-colors"
                >
                  CHERCHER
                </button>
              </div>
            </form>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Regions */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {REGIONS.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, region: region.id }))
                      setVideoList([])
                      setPage(1)
                      performSearch(1, false)
                    }}
                    className={`px-3 py-1.5 border-2 border-black font-bold text-xs uppercase whitespace-nowrap transition-all ${
                      filters.region === region.id || (region.id === '' && filters.region === '')
                        ? 'bg-black text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {region.flag} {region.name}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-black hidden sm:block"></div>

              {/* Sort */}
              <div className="flex gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: option.id as FilterState['sortBy'],
                      }))
                      setVideoList([])
                      setPage(1)
                      performSearch(1, false)
                    }}
                    className={`px-3 py-1.5 border-2 border-black font-bold text-xs uppercase whitespace-nowrap transition-all ${
                      filters.sortBy === option.id
                        ? 'bg-black text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {option.icon} {option.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="max-w-full mx-auto px-4 py-6">
          {/* Loading indicator */}
          {isSearching && videoList.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm font-bold">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span>Recherche en cours...</span>
            </div>
          )}

          {/* Empty State */}
          {videoList.length === 0 && !isSearching ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="text-2xl font-black uppercase mb-2">Aucune video</h2>
              <p className="text-gray-600 mb-6">Sois le premier a poster un meme!</p>
              <Link
                href="/upload"
                className="bg-yellow-400 border-4 border-black px-6 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all inline-block"
              >
                UPLOAD
              </Link>
            </div>
          ) : (
            <>
              {/* Video Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

              {/* Loading more */}
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-pulse"></div>
                    <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-pulse delay-75"></div>
                    <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-pulse delay-150"></div>
                  </div>
                </div>
              )}

              {/* Observer target */}
              {isMounted && hasMore && !loading && <div ref={observerRef} className="h-4"></div>}
            </>
          )}
        </main>

        {/* Video Modal */}
        <VideoModal
          video={selectedVideo}
          userId={userId}
          onClose={() => setSelectedVideo(null)}
          onDelete={handleDeleteVideo}
          onPersonClick={handlePersonClick}
        />

        {/* Footer */}
        <footer className="border-t-4 border-black py-8 text-center bg-white">
          <p className="font-black text-4xl md:text-6xl uppercase tracking-tighter">MEME BANK</p>
          <p className="text-sm text-gray-500 mt-2">Caribbean Meme Bank</p>
        </footer>

        <PointsToast userId={userId} />
      </div>
    </>
  )
}
