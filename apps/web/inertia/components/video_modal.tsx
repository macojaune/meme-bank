import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Scissors, X } from 'lucide-react'
import { router } from '@inertiajs/react'
import { Button } from '~/components/motion/button/base'
import { MorphingModal } from '~/components/motion/morphing-modal'
import VideoDetailsEditor, { type VideoDetails } from './video_details_editor'
import VideoRemixEditor from './video_remix_editor'
import { categoryTagClass } from './category_picker'

type Person = VideoDetails['persons'][number]

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
  skipAutoTranscription?: boolean
  region: string | null
  createdAt: string
  userId: string
}

type VideoDetailsResponse = VideoDetails & {
  video: Video
  source: { id: string; title: string } | null
}

interface VideoModalProps {
  video: Video | null
  videoIds: readonly string[]
  onNavigate: (videoId: string) => void
  userId: string
  onClose: () => void
  onDelete: (videoId: string) => void
  onPersonClick?: (person: Person) => void
  onDetailsChange?: (details: VideoDetails) => void
  onRemixOpen?: () => void
}

const REGIONS: Record<string, { name: string; flag: string }> = {
  guadeloupe: { name: 'Guadeloupe', flag: '🇬🇵' },
  martinique: { name: 'Martinique', flag: '🇲🇶' },
  guyane: { name: 'Guyane', flag: '🇬🇫' },
  reunion: { name: 'La Reunion', flag: '🇷🇪' },
  mayotte: { name: 'Mayotte', flag: '🇾🇹' },
}

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

function TranscriptionSection({
  videoId,
  skipAutoTranscription,
}: {
  videoId: string
  skipAutoTranscription?: boolean
}) {
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
        <p className="font-bold uppercase text-sm">
          {skipAutoTranscription ? 'Aucune transcription' : 'Transcription en cours...'}
        </p>
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
            <Button
              type="button"
              onClick={submitCorrection}
              disabled={!hasChanges()}
              className="h-auto flex-1 rounded-none bg-green-400 text-black hover:bg-green-300 border-4 border-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckIcon />
              SOUMETTRE (+10 PTS)
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setEditedText(originalText)
                setCorrectionReason('')
              }}
              className="h-auto rounded-none border-4 bg-gray-300 text-black hover:bg-gray-200 border-black px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              ANNULER
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap font-medium text-lg leading-relaxed mb-4">
            {transcription.text}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-black pt-3">
            <span className="text-xs font-bold text-gray-500 uppercase">
              Revision #{transcription.revisionNumber}
            </span>
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              className="h-auto rounded-none border-4 bg-magenta hover:bg-magenta border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 text-white"
            >
              <EditIcon />
              CORRIGER (+10 PTS)
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function PeopleAndCategories({
  details,
  onPersonClick,
}: {
  details: VideoDetails
  onPersonClick?: (person: Person) => void
}) {
  return (
    <section className="space-y-4 border-4 border-black bg-gray-100 p-4">
      <div>
        <h3 className="mb-2 text-sm font-black uppercase">Personnes</h3>
        <div className="flex flex-wrap gap-2">
          {details.persons.length ? (
            details.persons.map((person) =>
              onPersonClick ? (
                <Button
                  key={person.id}
                  type="button"
                  onClick={() => onPersonClick(person)}
                  className="h-auto rounded-none border-2 border-black bg-cyan px-3 py-1.5 text-sm font-bold text-black hover:bg-black hover:text-white"
                >
                  {person.name}
                </Button>
              ) : (
                <span
                  key={person.id}
                  className="border-2 border-black bg-cyan px-3 py-1.5 text-sm font-bold"
                >
                  {person.name}
                </span>
              )
            )
          ) : (
            <span className="text-sm text-gray-600">Aucune personne identifiée</span>
          )}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-black uppercase">Catégories</h3>
        <div className="flex flex-wrap gap-2">
          {details.categories.length ? (
            details.categories.map((category) => (
              <span key={category.id} className={categoryTagClass}>
                {category.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-600">Aucune catégorie</span>
          )}
        </div>
      </div>
    </section>
  )
}

const navigationButtonClass =
  'h-9 gap-1 rounded-none border-2 border-black bg-white px-2 font-black text-black hover:bg-yellow-300 aria-disabled:opacity-40'

export default function VideoModal({
  video,
  videoIds,
  onNavigate,
  onClose,
  ...props
}: VideoModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const lookup = useRef<AbortController | null>(null)
  const [linkedDetails, setLinkedDetails] = useState<{
    anchorId: string
    details: VideoDetailsResponse
  } | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')
  const related = linkedDetails?.anchorId === video?.id ? linkedDetails?.details : undefined
  const currentVideo = related?.video ?? video
  const index = currentVideo ? videoIds.indexOf(currentVideo.id) : -1
  const previous = index > 0 ? videoIds[index - 1] : undefined
  const next = index >= 0 ? videoIds[index + 1] : undefined

  useEffect(() => () => lookup.current?.abort(), [])

  function resetRelatedVideo() {
    lookup.current?.abort()
    lookup.current = null
    setLinkedDetails(null)
    setOpening(false)
    setOpenError('')
  }

  function closeVideo() {
    resetRelatedVideo()
    onClose()
  }

  function goToVideo(id: string) {
    resetRelatedVideo()
    closeRef.current?.focus()
    onNavigate(id)
  }

  async function openRelatedVideo(id: string, kind: 'source' | 'draft') {
    if (!video || lookup.current) return
    const controller = new AbortController()
    lookup.current = controller
    setOpening(true)
    setOpenError('')
    try {
      const response = await fetch(`/api/v1/videos/${id}/details`, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      })
      if (!response.ok) {
        if (!controller.signal.aborted) setOpenError('Cette vidéo est devenue indisponible.')
        return
      }
      const details: VideoDetailsResponse = await response.json()
      if (controller.signal.aborted) return

      setLinkedDetails({ anchorId: video.id, details })
      closeRef.current?.focus()
      if (kind === 'draft') props.onRemixOpen?.()
    } catch {
      if (!controller.signal.aborted) setOpenError('Impossible d’ouvrir cette vidéo.')
    } finally {
      if (!controller.signal.aborted) {
        lookup.current = null
        setOpening(false)
      }
    }
  }

  function navigateWithArrow(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return
    if (!(event.target instanceof Element)) return
    if (
      event.target.closest(
        'form, input, textarea, select, video, [contenteditable], [role="combobox"]'
      )
    )
      return

    const target =
      event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : undefined
    if (!target) return

    event.preventDefault()
    goToVideo(target)
  }

  return (
    <MorphingModal
      viewId={currentVideo ? 'video' : null}
      onClose={closeVideo}
      placement="center"
      ariaLabel="Fiche vidéo"
      labels={{ close: 'Fermer via l’arrière-plan' }}
      className="max-w-6xl rounded-none border-4 border-black bg-white text-black shadow-[8px_8px_0_black]"
      contentClassName="p-0"
      backdropClassName="bg-black/75"
    >
      {currentVideo && (
        <div
          className="flex h-[min(52rem,calc(100dvh-2.5rem))] flex-col"
          onKeyDown={navigateWithArrow}
        >
          <span className="sr-only" role="status">
            {currentVideo.title || 'Sans titre'}
          </span>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b-4 border-black bg-white p-2">
            <nav aria-label="Navigation entre les vidéos" className="flex min-w-0 gap-2">
              <Button
                type="button"
                aria-label="Vidéo précédente"
                aria-keyshortcuts="ArrowLeft"
                aria-disabled={!previous}
                onClick={() => previous && goToVideo(previous)}
                className={navigationButtonClass}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
                <span className="hidden sm:inline">Précédente</span>
              </Button>
              <Button
                type="button"
                aria-label="Vidéo suivante"
                aria-keyshortcuts="ArrowRight"
                aria-disabled={!next}
                onClick={() => next && goToVideo(next)}
                className={navigationButtonClass}
              >
                <span className="hidden sm:inline">Suivante</span>
                <ChevronRight aria-hidden="true" className="size-5" />
              </Button>
              {related && related.video.id !== video?.id && (
                <Button
                  type="button"
                  aria-label="Revenir à la fiche de départ"
                  onClick={() => {
                    resetRelatedVideo()
                    closeRef.current?.focus()
                  }}
                  className={navigationButtonClass}
                >
                  <ArrowLeft aria-hidden="true" className="size-5" />
                  <span className="hidden md:inline">Revenir à la fiche de départ</span>
                </Button>
              )}
            </nav>
            <Button
              ref={closeRef}
              type="button"
              aria-label="Fermer la fiche"
              aria-keyshortcuts="Escape"
              onClick={closeVideo}
              className="h-9 shrink-0 gap-1 rounded-none border-2 border-black bg-red-500 px-2 font-black text-black hover:bg-red-400"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="hidden sm:inline">Fermer</span>
            </Button>
          </div>
          {openError && (
            <p role="alert" className="border-b-2 border-black px-3 py-2 text-red-700">
              {openError}
            </p>
          )}
          <VideoModalContent
            key={currentVideo.id}
            {...props}
            video={currentVideo}
            initialDetails={related}
            openingVideo={opening}
            onOpenVideo={(id, kind) => void openRelatedVideo(id, kind)}
            onClose={closeVideo}
          />
        </div>
      )}
    </MorphingModal>
  )
}

function VideoModalContent({
  video,
  userId,
  onClose,
  onDelete,
  onPersonClick,
  onDetailsChange,
  initialDetails,
  openingVideo,
  onOpenVideo,
}: Omit<VideoModalProps, 'video' | 'videoIds' | 'onNavigate'> & {
  video: Video
  initialDetails?: VideoDetailsResponse
  openingVideo: boolean
  onOpenVideo: (id: string, kind: 'source' | 'draft') => void
}) {
  const [details, setDetails] = useState<VideoDetailsResponse | null>(initialDetails ?? null)
  const [detailsError, setDetailsError] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingRemix, setEditingRemix] = useState(false)
  const player = useRef<HTMLVideoElement>(null)
  const remixButton = useRef<HTMLButtonElement>(null)

  function closeRemixEditor() {
    setEditingRemix(false)
    requestAnimationFrame(() => remixButton.current?.focus())
  }

  useEffect(() => {
    if (initialDetails) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/v1/videos/${video.id}/details`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Details unavailable')
        const data: VideoDetailsResponse = await response.json()
        if (!controller.signal.aborted) setDetails(data)
      } catch {
        if (!controller.signal.aborted) setDetailsError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [initialDetails, video.id])

  const isOwner = video.userId === userId
  const region = getRegionDisplay(details ? details.region : video.region)

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
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1">
      <div className="min-h-0 min-w-0 border-b-4 border-black bg-black lg:border-r-4 lg:border-b-0">
        <video
          ref={player}
          src={
            editingRemix || initialDetails
              ? `/api/v1/videos/${video.id}/media`
              : getVideoUrl(video.id)
          }
          controls
          preload={editingRemix ? 'metadata' : undefined}
          playsInline
          tabIndex={0}
          className="block h-full w-full object-contain"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div
          data-video-details-scroll
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="border-b-4 border-black bg-white p-4">
            <h2 className="mb-3 break-words text-xl leading-tight font-black uppercase md:text-2xl">
              {(details?.title ?? video.title) || 'Sans titre'}
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
          <div className="space-y-4 p-4">
            {details?.source && (
              <Button
                type="button"
                disabled={openingVideo}
                title={details.source.title || 'Sans titre'}
                onClick={() => details.source && onOpenVideo(details.source.id, 'source')}
                className="h-auto rounded-none border-2 border-black bg-white px-3 py-1.5 text-left text-sm font-bold text-black hover:bg-yellow-300"
              >
                Voir le mème d’origine
              </Button>
            )}
            {editingRemix && (
              <VideoRemixEditor
                videoId={video.id}
                title={details?.title ?? video.title}
                player={player}
                opening={openingVideo}
                onOpenVideo={(id) => onOpenVideo(id, 'draft')}
                onClose={closeRemixEditor}
              />
            )}
            {details?.canEdit && !editingDetails && !editingRemix && (
              <Button
                type="button"
                onClick={() => setEditingDetails(true)}
                className="h-auto rounded-none border-2 border-black bg-yellow-400 px-4 py-2 font-black text-black hover:bg-yellow-300"
              >
                Modifier la fiche
              </Button>
            )}
            {details &&
              (editingDetails ? (
                <VideoDetailsEditor
                  details={details}
                  onCancel={() => setEditingDetails(false)}
                  onSave={(updated) => {
                    setDetails(updated)
                    setEditingDetails(false)
                    onDetailsChange?.(updated)
                  }}
                />
              ) : (
                <PeopleAndCategories
                  details={details}
                  onPersonClick={onPersonClick ? handlePersonClick : undefined}
                />
              ))}
            {detailsError && <p role="status">Impossible de charger la fiche.</p>}
            <TranscriptionSection
              videoId={video.id}
              skipAutoTranscription={
                details?.video?.skipAutoTranscription ?? video.skipAutoTranscription
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t-4 border-black bg-gray-50 p-2 sm:p-3">
          <Button
            type="button"
            onClick={() => handleDownload(video.id)}
            className="h-auto gap-2 rounded-none border-2 border-black bg-white px-3 py-1.5 font-black text-black uppercase hover:bg-yellow-300"
          >
            <DownloadIcon />
            Télécharger
          </Button>

          {(isOwner || video.isPublished) && !editingRemix && !editingDetails && (
            <Button
              ref={remixButton}
              type="button"
              onClick={() => setEditingRemix(true)}
              className="h-auto gap-2 rounded-none border-2 border-black bg-yellow-300 px-3 py-1.5 font-black text-black hover:bg-yellow-400"
            >
              <Scissors aria-hidden="true" className="size-4" />
              Créer un extrait
            </Button>
          )}

          {isOwner && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirm('Supprimer cette video ? Cette action est irreversible.')) {
                  onDelete(video.id)
                }
              }}
              className="h-auto rounded-none border-transparent px-2 py-1 text-xs font-bold text-gray-600 hover:text-red-700"
            >
              Supprimer cette vidéo
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
