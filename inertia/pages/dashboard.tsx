import { Head, router, Link } from '@inertiajs/react'
import { useState } from 'react'

interface DashboardProps {
  auth: {
    user: {
      id: number
      email: string
      fullName: string
    }
    isLoggedIn: boolean
  }
}

export default function Dashboard({ auth }: DashboardProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = () => {
    setIsLoggingOut(true)
    router.post(
      '/logout',
      {},
      {
        onFinish: () => setIsLoggingOut(false),
      }
    )
  }

  return (
    <>
      <Head title="Dashboard" />
      <div className="min-h-screen bg-bg">
        {/* Neobrutalism Navigation */}
        <nav className="border-b-3 border-border bg-surface p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link
              href="/"
              className="text-2xl font-black text-text uppercase tracking-tight hover:text-primary-600 transition-colors"
            >
              🎭 MEME BANK
            </Link>
            <div className="flex items-center gap-4">
              <span className="font-bold text-text">{auth.user.fullName.toUpperCase()}</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn-neo-brick text-sm"
              >
                {isLoggingOut ? '...' : '✕'}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-black text-text uppercase tracking-tight mb-2">
              Bienvenue
            </h1>
            <p className="text-xl font-bold text-text-muted uppercase tracking-wide">
              {auth.user.fullName}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card-neo text-center">
              <div className="text-4xl mb-2">📹</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Videos</h3>
              <p className="text-3xl font-black text-text">0</p>
            </div>

            <div className="card-neo text-center">
              <div className="text-4xl mb-2">👁</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Vues</h3>
              <p className="text-3xl font-black text-text">0</p>
            </div>

            <div className="card-neo text-center">
              <div className="text-4xl mb-2">❤️</div>
              <h3 className="font-bold text-text uppercase text-sm mb-1">Likes</h3>
              <p className="text-3xl font-black text-text">0</p>
            </div>
          </div>

          {/* Account Info Card */}
          <div className="card-neo mb-8">
            <h2 className="text-xl font-black text-text uppercase tracking-tight mb-4 border-b-2 border-border pb-2">
              Informations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Nom
                </label>
                <p className="font-bold text-text">{auth.user.fullName}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Email
                </label>
                <p className="font-bold text-text">{auth.user.email}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/upload" className="btn-neo-primary text-center py-4 text-lg">
              📤 Upload Video
            </Link>
            <Link href="/gallery" className="btn-neo-secondary text-center py-4 text-lg">
              🎬 Voir Gallery
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 p-4 border-t-3 border-border bg-surface text-center">
          <p className="text-sm font-bold text-text-muted uppercase">🎭 Caribbean Meme Bank v1.0</p>
        </footer>
      </div>
    </>
  )
}
