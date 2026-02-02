import { useState, useRef, useCallback } from 'react'
import PersonTagInput from './person_tag_input.js'

interface Person {
  id: string
  name: string
  socialMediaHandle: string | null
  platform: string | null
}

interface UploadData {
  title: string
  description: string
  region: string
  video: File
  persons: Person[]
}

interface VideoUploadFormProps {
  onUpload: (data: UploadData) => void
  onCancel?: () => void
  isProcessing?: boolean
}

const REGIONS = [
  { id: 'guadeloupe', name: 'Guadeloupe' },
  { id: 'martinique', name: 'Martinique' },
  { id: 'guyane', name: 'Guyane' },
]

export default function VideoUploadForm({
  onUpload,
  onCancel,
  isProcessing = false,
}: VideoUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [region, setRegion] = useState('')
  const [persons, setPersons] = useState<Person[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux. Max 10MB.')
      return
    }
    setSelectedFile(file)
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !title.trim()) {
      alert('Veuillez selectionner un fichier et donner un titre')
      return
    }

    onUpload({
      title,
      description,
      region,
      video: selectedFile,
      persons,
    })
  }

  return (
    <div className="space-y-6">
      {/* Zone de fichier */}
      <div className="card-neo p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer text-center py-8 border-2 border-dashed border-black rounded hover:bg-gray-50"
          >
            <div className="text-6xl mb-4">📹</div>
            <p className="font-bold">Cliquez pour selectionner une video</p>
            <p className="text-sm text-gray-500">MP4, WebM, OGG - Max 10MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white border-2 border-black p-4 rounded">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🎬</span>
              <div>
                <p className="font-bold">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null)
                onCancel?.()
              }}
              className="btn-neo-brick px-3 py-1"
              disabled={isProcessing}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold uppercase mb-2">Titre *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border-2 border-black rounded"
            placeholder="Titre de la video"
            required
            disabled={isProcessing}
          />
        </div>

        <div>
          <label className="block text-sm font-bold uppercase mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border-2 border-black rounded min-h-[100px]"
            placeholder="Description optionnelle"
            disabled={isProcessing}
          />
        </div>

        <div>
          <label className="block text-sm font-bold uppercase mb-2">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full p-3 border-2 border-black rounded"
            disabled={isProcessing}
          >
            <option value="">Selectionnez une region</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold uppercase mb-2">Personnes presentes</label>
          <PersonTagInput
            selectedPersons={persons}
            onChange={setPersons}
            placeholder="Ajoutez des personnes"
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || !selectedFile}
          className="w-full btn-neo btn-neo-primary py-3 disabled:opacity-50"
        >
          {isProcessing ? 'Upload en cours...' : '📤 Upload'}
        </button>
      </form>
    </div>
  )
}
