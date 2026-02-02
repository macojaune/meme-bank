import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import VideoUploadForm from '../components/video_upload_form.js'
import Navigation from '../components/navigation'

interface UploadProps {
  auth: {
    user: {
      fullName: string
    }
  }
}

export default function Upload({ auth }: UploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleUpload = (formData: FormData) => {
    setIsProcessing(true)

    // Use Inertia's router.post instead of fetch to avoid 302 issues
    router.post('/videos/upload', formData, {
      onSuccess: () => {
        // Inertia handles the redirect automatically
      },
      onError: (errors) => {
        console.error('Upload error:', errors)
        alert("Erreur lors de l'upload")
        setIsProcessing(false)
      },
      onFinish: () => {
        setIsProcessing(false)
      },
    })
  }

  return (
    <>
      <Head title="Upload Video" />
      <div className="min-h-screen bg-bg">
        <Navigation user={{ fullName: auth.user.fullName }} isLoggedIn={true} />

        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <VideoUploadForm onUpload={handleUpload} isProcessing={isProcessing} />
        </div>
      </div>
    </>
  )
}
