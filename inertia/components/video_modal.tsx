import { useState, useEffect } from 'react'
import { router } from '@inertiajs/react'

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
  viewCount: number
  likeCount: number
  isPublished: boolean
  region: string | null
  createdAt: string
  userId: string
  persons?: Person[]
}

interface VideoModalProps {
  video: Video | null
  userId: string
  onClose: () => void
  onDelete: (videoId: string) => void
  onPersonClick?: (person: Person) => void
}

const REGIONS: Record<string, { name: string; flag: string }> = {
  guadeloupe: { name: 'Guadeloupe', flag: '🇬🇵' },
  martinique: { name: 'Martinique', flag: '🇲🇶' },
  guyane: { name: 'Guyane', flag: '🇬🇫' },
  reunion: { name: 'La Reunion', flag: '🇷🇪' },
  mayotte: { name: 'Mayotte', flag: '🇾🇹' },
}

const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const DownloadIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const TrashIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const EditIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function getRegionDisplay(regionId: string | null): { name: string; flag: string } {
  if (!regionId) return { name: 'AUTRE', flag: '🌴' }
  return REGIONS[regionId] || { name: 'AUTRE', flag: '🌴' }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getVideoUrl(videoId: string): string {
  return `/videos/stream/${videoId}`
}

interface Transcription {
  id: string
  text: string
  language: string
  status: string
  confidence: number | null
  revisionNumber: number
  pointsAwarded: number
}

function TranscriptionSection({ videoId }: { videoId: string }) {
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  useEffect(() => {
    loadTranscription()
  }, [videoId])

  const loadTranscription = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/videos/${videoId}/transcription`)
      const data = await response.json()
      if (data.data) {
        setTranscription(data.data)
        setEditedText(data.data.text)
        setOriginalText(data.data.text)
      }
    } catch (err) {
      console.error('Failed to load transcription')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = () => editedText.trim() !== originalText.trim()

  const submitCorrection = () => {
    if (!editedText.trim() || !hasChanges()) return

    router.post(
      `/api/v1/videos/${videoId}/transcription/correct`,
      { text: editedText, reason: correctionReason },
      {
        preserveState: true,
        onSuccess: () => {
          setIsEditing(false)
          setCorrectionReason('')
          loadTranscription()
        },
      }
    )
  }

  if (loading) {
    return (
      <div className="bg-yellow-50 border-4 border-black p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!transcription) {
    return (
      <div className="bg-yellow-50 border-4 border-black p-4">
        <p className="font-bold uppercase text-sm">Transcription en cours...</p>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border-4 border-black p-4">
      <div className="flex justify-between items-center mb-3 border-b-2 border-black pb-2">
        <h3 className="font-black uppercase text-sm">TRANSCRIPTION</h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-black text-white text-xs font-bold uppercase">
            {transcription.language}
          </span>
          {transcription.pointsAwarded > 0 && (
            <span className="px-2 py-1 bg-green-400 text-black text-xs font-bold uppercase border-2 border-black">
              +{transcription.pointsAwarded} PTS
            </span>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-40 p-3 border-4 border-black bg-white focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none text-base font-medium resize-none"
            placeholder="Corrigez la transcription..."
          />
          <input
            type="text"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            className="w-full p-3 border-4 border-black bg-white focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none text-base font-medium"
            placeholder="Raison de la correction (optionnel)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitCorrection}
              disabled={!hasChanges()}
              className="flex-1 bg-green-400 border-4 border-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckIcon />
              SOUMETTRE (+10 PTS)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setEditedText(originalText)
                setCorrectionReason('')
              }}
              className="bg-gray-300 border-4 border-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              ANNULER
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap font-medium text-lg leading-relaxed mb-4">
            {transcription.text}
          </p>
          <div className="flex justify-between items-center pt-3 border-t-2 border-black">
            <span className="text-xs font-bold text-gray-500 uppercase">
              Revision #{transcription.revisionNumber}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="bg-magenta border-4 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 text-white"
            >
              <EditIcon />
              CORRIGER (+10 PTS)
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PersonsSection({
  videoId,
  onPersonClick,
}: {
  videoId: string
  onPersonClick?: (person: Person) => void
}) {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPersons()
  }, [videoId])

  const loadPersons = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/videos/${videoId}/persons`)
      const data = await response.json()
      setPersons(data.data || [])
    } catch (err) {
      console.error('Failed to load persons')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-100 border-4 border-black p-4 text-sm font-bold">Chargement...</div>
    )
  }

  return (
    <div className="bg-gray-100 border-4 border-black p-4">
      <div className="flex justify-between items-center mb-3 border-b-2 border-black pb-2">
        <h3 className="font-black uppercase text-sm">PERSONNES</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {persons.length > 0 ? (
          persons.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onPersonClick?.(person)}
              className="px-3 py-1.5 bg-cyan border-2 border-black font-bold text-sm hover:bg-black hover:text-white transition-colors"
            >
              {person.name}
            </button>
          ))
        ) : (
          <span className="text-sm font-medium text-gray-500 italic">
            Aucune personne identifiee
          </span>
        )}
      </div>
    </div>
  )
}

export default function VideoModal({
  video,
  userId,
  onClose,
  onDelete,
  onPersonClick,
}: VideoModalProps) {
  if (!video) return null

  const isOwner = video.userId === userId
  const region = getRegionDisplay(video.region)

  const handleDownload = async (videoId: string) => {
    try {
      const response = await fetch(`/videos/${videoId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `meme-${videoId}.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const handlePersonClick = (person: Person) => {
    onClose()
    onPersonClick?.(person)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 bg-red-500 border-4 border-black w-10 h-10 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all z-10"
        >
          <CloseIcon />
        </button>

        {/* Layout: Video Left, Content Right */}
        <div className="flex flex-col lg:flex-row">
          {/* LEFT - Video */}
          <div className="lg:w-3/5 bg-black flex items-center justify-center border-b-4 lg:border-b-0 lg:border-r-4 border-black">
            <video
              src={getVideoUrl(video.id)}
              controls
              className="w-full h-auto max-h-[50vh] lg:max-h-[none] object-contain"
            />
          </div>

          {/* RIGHT - Content */}
          <div className="lg:w-2/5 flex flex-col">
            {/* Header: Title + Tags */}
            <div className="p-4 border-b-4 border-black bg-white">
              <h2 className="text-xl md:text-2xl font-black uppercase mb-3 leading-tight break-words">
                {video.title}
              </h2>

              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-black text-white font-bold text-sm uppercase whitespace-nowrap">
                  {region.flag} {region.name}
                </span>
                <span className="px-3 py-1 bg-gray-200 border-2 border-black font-bold text-sm uppercase whitespace-nowrap">
                  {formatDate(video.createdAt)}
                </span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <PersonsSection videoId={video.id} onPersonClick={handlePersonClick} />
              <TranscriptionSection videoId={video.id} />
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t-4 border-black bg-gray-50 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDownload(video.id)}
                className="w-full bg-white border-4 border-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
              >
                <DownloadIcon />
                TELECHARGER
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Supprimer cette video ? Cette action est irreversible.')) {
                      onDelete(video.id)
                    }
                  }}
                  className="w-full text-sm font-bold uppercase hover:underline text-gray-500 hover:text-red-500 transition-colors text-center py-2"
                >
                  Supprimer cette video
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
