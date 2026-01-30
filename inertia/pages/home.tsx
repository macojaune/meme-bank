import { Head, Link } from '@inertiajs/react'

export default function Home() {
  return (
    <>
      <Head title="Meme Bank - Archive Video des Caraibes" />

      <div className="min-h-screen bg-bg">
        {/* Navigation */}
        <nav className="border-b-2 border-black bg-white px-4 py-3 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-2xl font-black uppercase tracking-tight">
              MEME BANK
            </Link>
            <div className="flex gap-3">
              <Link href="/login" className="btn-neo text-sm px-4 py-2">
                Connexion
              </Link>
              <Link href="/register" className="btn-neo btn-neo-primary text-sm px-4 py-2">
                Inscription
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-6xl mb-6">🔥</div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight mb-6 leading-tight">
              Archive Video
              <br />
              <span style={{ color: '#facc15' }}>Des Caraibes</span>
            </h1>
            <p className="text-xl md:text-2xl font-bold text-text-muted mb-8 max-w-2xl mx-auto">
              Partagez, decouvrez et revivez les meilleurs memes video de Guadeloupe, Martinique et
              Guyane
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="btn-neo btn-neo-primary text-lg px-8 py-4">
                Rejoindre la Communaute
              </Link>
              <Link href="/gallery" className="btn-neo text-lg px-8 py-4">
                Explorer les Memes
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-white border-y-2 border-black">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-black uppercase text-center mb-12">
              Pourquoi Meme Bank ?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card-neo text-center">
                <div className="text-5xl mb-4">📹</div>
                <h3 className="text-xl font-black uppercase mb-3">Upload Simple</h3>
                <p className="font-medium text-text-muted">
                  Partagez vos videos en quelques clics. Drag and drop rapide et facile
                </p>
              </div>

              <div className="card-neo text-center">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-xl font-black uppercase mb-3">IA Intelligente</h3>
                <p className="font-medium text-text-muted">
                  Transcription automatique et tags intelligents pour retrouver vos memes favoris
                </p>
              </div>

              <div className="card-neo text-center">
                <div className="text-5xl mb-4">🌴</div>
                <h3 className="text-xl font-black uppercase mb-3">100 Caraibe</h3>
                <p className="font-medium text-text-muted">
                  Contenu local de Guadeloupe, Martinique et Guyane
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Regions */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-black uppercase text-center mb-12">Nos Regions</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card-neo-hover">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase mb-2">Guadeloupe</h3>
                  <p className="font-medium text-text-muted">Les meilleurs memes de la region</p>
                </div>
              </div>

              <div className="card-neo-hover">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase mb-2">Martinique</h3>
                  <p className="font-medium text-text-muted">La culture creole en video</p>
                </div>
              </div>

              <div className="card-neo-hover">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase mb-2">Guyane</h3>
                  <p className="font-medium text-text-muted">L'Amazonie francaise humour</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t-2 border-black bg-white">
          <div className="max-w-6xl mx-auto text-center">
            <p className="font-bold uppercase text-sm text-text-muted">
              2025 Caribbean Meme Bank. Tous droits reserves.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
