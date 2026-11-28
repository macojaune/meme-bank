import limits from 'memebank-upload/upload-limits.json'
import { useState, useRef } from 'react'
import { Button } from '~/components/motion/button/base'
import { Card } from '~/components/motion/card'
import { Input } from '~/components/motion/input'
import { VIDEO_TERRITORIES } from '../../shared/video_territories'
import PersonTagInput from './person_tag_input.js'

type Person = {
  id: string
  name: string
  socialMediaHandle: string | null
  platform: string | null
}

export type UploadData = {
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
    if (file.size > limits.videoMiB * 1024 * 1024) {
      alert(`Le fichier dépasse la limite de ${limits.videoMiB} Mio.`)
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
      <Card className="card-neo gap-0 rounded-none border-black bg-white p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {!selectedFile ? (
          <Button
            type="button"
            aria-label="Choisir une vidéo"
            onClick={() => fileInputRef.current?.click()}
            className="h-auto w-full flex-col gap-0 rounded bg-white text-black py-8 border-2 border-dashed border-black hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true" className="text-6xl mb-4">
              📹
            </span>
            <span className="font-bold">Choisir une vidéo</span>
            <span className="text-sm text-gray-500">
              MP4, WebM, Ogg ou AVI · {limits.videoMiB} Mio maximum
            </span>
          </Button>
        ) : (
          <div className="flex items-center justify-between bg-white border-2 border-black p-4 rounded">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🎬</span>
              <div>
                <p className="font-bold">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} Mio
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
      </Card>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titre"
          name="title"
          type="text"
          value={title}
          onChange={setTitle}
          classNames={{
            label: 'block text-sm font-bold uppercase mb-2',
            field:
              'h-auto rounded border-2 border-black focus-within:ring-2 focus-within:ring-black',
            input: 'p-3 text-black',
          }}
          placeholder="Titre de la vidéo"
          required
          disabled={isProcessing}
        />

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
            {VIDEO_TERRITORIES.map((r) => (
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

        <Button
          type="submit"
          disabled={isProcessing || !selectedFile}
          className="h-auto w-full rounded-none btn-neo btn-neo-primary py-3 bg-yellow-400 text-black hover:bg-yellow-400 focus-visible:outline-2"
        >
          {isProcessing ? 'Envoi en cours…' : 'Ajouter la vidéo'}
        </Button>
      </form>
    </div>
  )
}
