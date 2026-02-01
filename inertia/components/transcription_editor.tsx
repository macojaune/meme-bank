import { useState } from 'react'

interface TranscriptionEditorProps {
  videoId: string
  initialText: string
  onCancel: () => void
  onSubmit: (text: string, reason: string) => void
}

export default function TranscriptionEditor({
  videoId,
  initialText,
  onCancel,
  onSubmit,
}: TranscriptionEditorProps) {
  const [text, setText] = useState(initialText)
  const [reason, setReason] = useState('')

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim(), reason.trim())
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-32 p-3 border-2 border-black resize-none focus:outline-none focus:border-primary-500"
        placeholder="Corrigez la transcription..."
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
        placeholder="Raison de la correction (optionnel)"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="btn-neo text-sm px-4 py-2 font-bold"
          disabled={!text.trim()}
        >
          Soumettre (+10 pts)
        </button>
        <button type="button" onClick={onCancel} className="btn-neo-brick text-sm px-4 py-2">
          Annuler
        </button>
      </div>
    </div>
  )
}
