import { useState, useEffect } from 'react'
import { router } from '@inertiajs/react'
import VideoPlayer from './video_player.js'
import TranscriptionViewer from './transcription_viewer.js'
import TranscriptionHistory from './transcription_history.js'
import PersonTagInput from './person_tag_input.js'

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

interface VideoModalProps {
  video: Video | null
  userId: string
  onClose: () => void
  onDelete: (videoId: string) => void
  onPersonClick?: (person: Person) => void
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

interface Person {
  id: string
  name: string
  socialMediaHandle: string | null
  platform: string | null
}

function VideoPersonsEditor({
  videoId,
  userId,
  videoUserId,
  onPersonClick,
}: {
  videoId: string
  userId: string
  videoUserId: string
  onPersonClick?: (person: Person) => void
}) {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadPersons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  const loadPersons = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/videos/${videoId}/persons`)
      const data = await response.json()
      setPersons(data.data || [])
    } catch (err) {
      console.error('Failed to load persons:', err)
    } finally {
      setLoading(false)
    }
  }

  const savePersons = (newPersons: Person[]) => {
    router.post(
      `/api/v1/videos/${videoId}/persons`,
      { persons: newPersons },
      {
        preserveState: true,
        onSuccess: () => {
          setPersons(newPersons)
          setIsEditing(false)
        },
        onError: (errors) => {
          console.error('Failed to save persons:', errors)
          alert('Erreur lors de la sauvegarde')
        },
      }
    )
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement...</div>
  }

  return (
    <div className="p-3 border-2 border-black bg-white">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-sm uppercase">Personnes présentes</h4>
        {userId === videoUserId && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs btn-neo px-2 py-1"
          >
            {isEditing ? 'Annuler' : '✏️ Modifier'}
          </button>
        )}
      </div>

      {isEditing ? (
        <PersonTagInput
          selectedPersons={persons}
          onChange={savePersons}
          placeholder="Ajoutez des personnes..."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {persons.length > 0 ? (
            persons.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onPersonClick?.(person)}
                className="px-2 py-1 bg-secondary-100 border border-black text-sm font-bold hover:bg-secondary-300 hover:shadow-neo transition-all cursor-pointer"
              >
                {person.name}
                {person.socialMediaHandle && (
                  <span className="text-xs text-gray-600 ml-1">@{person.socialMediaHandle}</span>
                )}
              </button>
            ))
          ) : (
            <span className="text-sm text-gray-500 italic">Aucune personne identifiée</span>
          )}
        </div>
      )}
    </div>
  )
}

function getVideoUrl(videoId: string): string {
  return `/videos/stream/${videoId}`
}

export default function VideoModal({
  video,
  userId,
  onClose,
  onDelete,
  onPersonClick,
}: VideoModalProps) {
  if (!video) return null

  const handlePersonClick = (person: Person) => {
    onClose() // Fermer le modal
    onPersonClick?.(person) // Naviguer vers les vidéos de cette personne
  }

  const handleDownload = async (videoId: string) => {
    try {
      const response = await fetch(`/videos/${videoId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `video-${videoId}.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Erreur lors du téléchargement')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Erreur lors du téléchargement')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        className="card-neo max-w-6xl w-full bg-white relative"
        style={{ maxHeight: 'calc(100vh - 2rem)', height: 'auto' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-4 -right-4 btn-neo-brick w-10 h-10 flex items-center justify-center z-[60]"
        >
          ✕
        </button>

        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4"
          style={{ maxHeight: 'calc(100vh - 4rem)' }}
        >
          {/* Left Column - Video */}
          <div className="flex flex-col overflow-hidden">
            <VideoPlayer videoUrl={getVideoUrl(video.id)} />

            <div className="pt-4 flex-shrink-0">
              <h2 className="text-xl font-black text-black uppercase mb-2">{video.title}</h2>
              <p className="text-gray-600 mb-3">{video.description}</p>
              <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                <span className="badge-neo bg-secondary-300">{getRegionDisplay(video.region)}</span>
                <span className="text-gray-600">{formatDate(video.createdAt)}</span>
                <span className="font-bold">{video.viewCount || 0} vues</span>
              </div>
              {video.userId === userId && (
                <button
                  type="button"
                  onClick={() => onDelete(video.id)}
                  className="btn-neo bg-red-500 text-black border-black text-sm px-4 py-2 font-bold uppercase"
                >
                  Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownload(video.id)}
                className="btn-neo bg-green-500 text-black border-black text-sm px-4 py-2 font-bold uppercase flex items-center gap-2"
              >
                📥 Télécharger
              </button>
            </div>
          </div>

          {/* Right Column - Personnes & Transcription */}
          <div
            className="bg-gray-50 overflow-y-auto gap-2"
            style={{ maxHeight: 'calc(100vh - 6rem)' }}
          >
            <VideoPersonsEditor
              videoId={video.id}
              userId={userId}
              videoUserId={video.userId}
              onPersonClick={handlePersonClick}
            />
            <TranscriptionViewer videoId={video.id} isOwner={video.userId === userId} />
            <TranscriptionHistory videoId={video.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
