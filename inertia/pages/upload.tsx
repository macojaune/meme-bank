import { Head, useForm, router } from '@inertiajs/react'
import { useState, useRef, useCallback } from 'react'

const REGIONS = [
  { id: 'guadeloupe', name: 'Guadeloupe' },
  { id: 'martinique', name: 'Martinique' },
  { id: 'guyane', name: 'Guyane' },
]

export default function Upload() {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const { data, setData, post, processing, errors, reset } = useForm({
    title: '',
    description: '',
    region: '',
    video: null,
  })

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }, [])

  const handleFile = (file) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      alert('Format video non supporte')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux. Max 10MB.')
      return
    }
    setSelectedFile(file)
    setData('video', file)
    if (!data.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      setData('title', fileName)
    }
  }

  const handleFileInput = (e) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('Selectionnez une video')
      return
    }
    if (!data.title.trim()) {
      alert('Donnez un titre')
      return
    }
    post('/videos/upload', {
      onProgress: (progress) => {
        setUploadProgress(progress.loaded / progress.total)
      },
      onSuccess: () => {
        reset()
        setSelectedFile(null)
        setUploadProgress(0)
        router.visit('/dashboard')
      },
      onError: (errors) => {
        console.error('Upload errors:', errors)
        setUploadProgress(0)
      },
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <Head title="Upload Video" />
      <div className="min-h-screen bg-bg">
        <nav className="border-b-2 border-border bg-surface p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-text uppercase tracking-wider">Upload</h1>
            <button
              onClick={() => router.visit('/dashboard')}
              className="btn-neo-secondary text-sm"
            >
              Retour
            </button>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div
            className={`card-neo p-6 sm:p-8 mb-6 transition-all duration-200 ${
              dragActive ? 'border-primary-500 bg-primary-50' : ''
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/avi"
              onChange={handleFileInput}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer text-center py-8 sm:py-12 border-2 border-dashed border-border rounded-lg hover:border-primary-500 hover:bg-surface transition-colors"
              >
                <div className="text-6xl mb-4">📹</div>
                <h2 className="text-lg font-bold text-text mb-2">
                  Glissez-deposez votre video ici
                </h2>
                <p className="text-sm text-text-muted mb-4">ou cliquez pour selectionner</p>
                <p className="text-xs text-text-muted">MP4, WebM, OGG, AVI - Max 10MB</p>
              </div>
            ) : (
              <div className="bg-surface border-2 border-border rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🎬</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text truncate">{selectedFile.name}</p>
                    <p className="text-sm text-text-muted">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setData('video', null)
                    }}
                    className="btn-neo-brick text-sm px-3 py-1"
                    disabled={processing}
                  >
                    ✕
                  </button>
                </div>
                {processing && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-text-muted uppercase">
                        Upload en cours...
                      </span>
                      <span className="font-black text-primary-600">
                        {Math.round(uploadProgress * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-surface border-2 border-border h-4">
                      <div
                        className="bg-primary-500 h-full transition-all duration-300 border-r-2 border-border"
                        style={{ width: `${uploadProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="card-neo p-6 sm:p-8">
            <h2 className="text-lg font-bold text-text mb-6 uppercase tracking-wider">Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-text mb-2 uppercase">Titre *</label>
                <input
                  type="text"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  className="input-neo"
                  placeholder="Titre de la video"
                  required
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-2 uppercase">
                  Description
                </label>
                <textarea
                  value={data.description}
                  onChange={(e) => setData('description', e.target.value)}
                  className="input-neo min-h-[100px] resize-none"
                  placeholder="Description optionnelle"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text mb-2 uppercase">Region</label>
                <select
                  value={data.region}
                  onChange={(e) => setData('region', e.target.value)}
                  className="input-neo"
                >
                  <option value="">Selectionnez une region</option>
                  {REGIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={processing || !selectedFile}
                className="btn-neo-primary w-full disabled:opacity-50"
              >
                {processing ? 'Upload en cours...' : '📤 Upload Video'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
