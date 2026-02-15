import { Link, router } from '@inertiajs/react'

interface NavigationProps {
  user: {
    fullName: string
  }
  isLoggedIn: boolean
}

export default function Navigation({ user, isLoggedIn }: NavigationProps) {
  const handleLogout = () => {
    router.post('/logout')
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-black shadow-neo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-black uppercase tracking-tight hover:translate-x-[2px] hover:translate-y-[2px] transition-transform"
          >
            MEME BANK
          </Link>

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-2">
            <Link href="/gallery" className="btn-neo btn-neo-secondary text-sm px-4 py-2">
              Gallery
            </Link>
            {isLoggedIn && (
              <>
                <Link href="/dashboard" className="btn-neo btn-neo-secondary text-sm px-4 py-2">
                  Dashboard
                </Link>
                <Link href="/upload" className="btn-neo btn-neo-primary text-sm px-4 py-2">
                  Upload
                </Link>
              </>
            )}
          </nav>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="hidden sm:inline text-sm font-bold">{user.fullName}</span>
                <button onClick={handleLogout} className="btn-neo-brick text-sm px-4 py-2">
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-neo text-sm px-4 py-2">
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-neo btn-neo-primary text-sm px-4 py-2 hidden sm:inline-block"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden flex items-center gap-2 pb-3 overflow-x-auto">
          <Link
            href="/gallery"
            className="btn-neo btn-neo-secondary text-xs px-3 py-1.5 whitespace-nowrap"
          >
            Gallery
          </Link>
          {isLoggedIn && (
            <>
              <Link
                href="/dashboard"
                className="btn-neo btn-neo-secondary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                Dashboard
              </Link>
              <Link
                href="/upload"
                className="btn-neo btn-neo-primary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                Upload
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
