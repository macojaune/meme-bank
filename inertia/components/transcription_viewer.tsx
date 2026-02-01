import { useState, useEffect } from 'react'
import { router } from '@inertiajs/react'

interface TranscriptionViewerProps {
  videoId: string
  isOwner: boolean
}

interface Transcription {
  id: string
  text: string
  language: string
  status: string
  confidence: number | null
  revisionNumber: number
  pointsAwarded: number
  correctedByUserId: string | null
}

export default function TranscriptionViewer({ videoId, isOwner }: TranscriptionViewerProps) {
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      setError('Transcription non disponible')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = () => {
    return editedText.trim() !== originalText.trim()
  }

  const submitCorrection = () => {
    if (!editedText.trim()) return

    if (!hasChanges()) {
      alert('Aucune modification détectée. Modifiez la transcription avant de soumettre.')
      return
    }

    router.post(
      `/api/v1/videos/${videoId}/transcription/correct`,
      {
        text: editedText,
        reason: correctionReason,
      },
      {
        preserveState: true,
        preserveScroll: true,
        onSuccess: () => {
          setIsEditing(false)
          setCorrectionReason('')
          // Reload transcription data from server
          loadTranscription()
        },
        onError: (errors) => {
          console.error('Correction error:', errors)
          setError('Erreur lors de la soumission')
        },
      }
    )
  }

  if (loading) {
    return (
      <div className="mt-4 p-4 border-2 border-black bg-gray-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!transcription) {
    return (
      <div className="mt-4 p-4 border-2 border-black bg-yellow-50">
        <p className="text-sm text-gray-600">Transcription en cours de traitement...</p>
      </div>
    )
  }

  return (
    <div className='my-2'>
      <div className="p-3 bg-gray-100 border-b-2 border-black flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase">Transcription</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-blue-100 rounded">{transcription.language}</span>
          <span
            className={`text-xs px-2 py-1 rounded ${transcription.status === 'auto_generated'
                ? 'bg-yellow-100'
                : transcription.status === 'community_corrected'
                  ? 'bg-green-100'
                  : 'bg-purple-100'
              }`}
          >
            {transcription.status === 'auto_generated' && '🤖 Auto'}
            {transcription.status === 'community_corrected' && '👥 Communauté'}
            {transcription.status === 'admin_validated' && '✅ Validé'}
          </span>
          {transcription.pointsAwarded > 0 && (
            <span className="text-xs px-2 py-1 bg-green-200 rounded font-bold">
              +{transcription.pointsAwarded} pts
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full h-32 p-3 border-2 border-black resize-none focus:outline-none focus:border-primary-500"
              placeholder="Corrigez la transcription..."
            />
            <input
              type="text"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
              placeholder="Raison de la correction (optionnel)"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitCorrection}
                className={`btn-neo text-sm px-4 py-2 font-bold ${!hasChanges() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                disabled={!editedText.trim() || !hasChanges()}
                title={!hasChanges() ? 'Modifiez le texte pour soumettre une correction' : ''}
              >
                Soumettre (+10 pts)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditedText(transcription.text)
                  setCorrectionReason('')
                }}
                className="btn-neo-brick text-sm px-4 py-2"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {transcription.text}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Révision #{transcription.revisionNumber}
                {transcription.confidence && (
                  <span className="ml-2">
                    Confiance: {Math.round(transcription.confidence * 100)}%
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-neo text-xs px-3 py-1"
              >
                ✏️ Corriger (+10 pts)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
