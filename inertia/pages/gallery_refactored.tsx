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
