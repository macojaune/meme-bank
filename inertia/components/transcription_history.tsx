import { useState, useEffect } from 'react'

interface TranscriptionRevision {
  id: string
  text: string
  status: string
  revisionNumber: number
  pointsAwarded: number
  correctedByUserId: string | null
  createdAt: string
}

interface TranscriptionHistoryProps {
  videoId: string
}

export default function TranscriptionHistory({ videoId }: TranscriptionHistoryProps) {
  const [revisions, setRevisions] = useState<TranscriptionRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [videoId])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/videos/${videoId}/transcription/history`)
      const data = await response.json()
      if (data.data) {
        setRevisions(data.data)
      }
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (revisionId: string) => {
    setExpandedRevision(expandedRevision === revisionId ? null : revisionId)
  }

  if (loading) {
    return (
      <div className="p-4 border-2 border-black bg-gray-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (revisions.length <= 1) {
    return null // Don't show history if only one revision
  }

  return (
    <div className="border-2 border-black bg-white">
      <div className="p-3 bg-gray-100 border-b-2 border-black">
        <h4 className="font-bold text-sm uppercase">
          Historique des corrections ({revisions.length} versions)
        </h4>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {revisions.map((revision, index) => (
          <div
            key={revision.id}
            className={`p-3 border-b border-gray-200 last:border-b-0 ${index === 0 ? 'bg-green-50' : ''
              }`}
          >
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleExpand(revision.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">#{revision.revisionNumber}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${revision.status === 'auto_generated'
                      ? 'bg-yellow-100'
                      : revision.status === 'community_corrected'
                        ? 'bg-green-100'
                        : 'bg-purple-100'
                    }`}
                >
                  {revision.status === 'auto_generated' && '🤖 Auto'}
                  {revision.status === 'community_corrected' && '👥 Communauté'}
                  {revision.status === 'admin_validated' && '✅ Validé'}
                </span>
                {revision.pointsAwarded > 0 && (
                  <span className="text-xs px-2 py-1 bg-green-200 rounded font-bold">
                    +{revision.pointsAwarded} pts
                  </span>
                )}
                {index === 0 && (
                  <span className="text-xs px-2 py-1 bg-blue-200 rounded font-bold">ACTUEL</span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(revision.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>

            {expandedRevision === revision.id && (
              <div className="mt-2 p-2 bg-gray-50 border-l-4 border-gray-400">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{revision.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
