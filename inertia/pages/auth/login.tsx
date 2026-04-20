import { Head, Link, useForm } from '@inertiajs/react'
import { useState, useEffect } from 'react'

export default function Login() {
  const [urlError, setUrlError] = useState<string | null>(null)
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    remember: false,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    if (error === 'invalid') {
      setUrlError('Email ou mot de passe incorrect')
    } else if (error === 'validation') {
      setUrlError('Veuillez remplir tous les champs')
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    post('/login', {
      preserveScroll: true,
    })
  }

  return (
    <>
      <Head title="Connexion - Meme Bank" />

      <div className="min-h-screen bg-white">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <Link
              href="/"
              className="text-2xl md:text-3xl font-black uppercase tracking-tight hover:opacity-70 transition-opacity"
            >
              MEME BANK
            </Link>
            <div className="flex gap-3 items-center">
              <Link href="/" className="font-bold uppercase text-sm px-3 py-2 hover:underline">
                ACCUEIL
              </Link>
            </div>
          </div>
        </header>

        <main className="pt-16 min-h-screen bg-white flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="bg-white border-4 border-black p-6 sm:p-8 shadow-neo-xl">
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
                  CONNEXION
                </h1>
                <p className="mt-2 font-medium">Bon retour parmi nous!</p>
              </div>

              {(urlError || (errors as Record<string, string>).general) && (
                <div className="border-4 border-black bg-red-500 p-4 mb-6 shadow-neo-sm">
                  <div className="flex items-center gap-2 font-bold text-white uppercase text-sm">
                    {urlError || (errors as Record<string, string>).general}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-bold uppercase mb-2 tracking-wide"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="w-full px-4 py-3 border-4 border-black font-bold"
                    placeholder="ton@email.com"
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm font-bold text-red-600 uppercase">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-bold uppercase mb-2 tracking-wide"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    className="w-full px-4 py-3 border-4 border-black font-bold"
                    placeholder="Ton mot de passe"
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm font-bold text-red-600 uppercase">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.remember}
                      onChange={(e) => setData('remember', e.target.checked as false)}
                      className="w-5 h-5 border-4 border-black bg-white appearance-none checked:bg-black cursor-pointer"
                    />
                    <span className="text-sm font-bold uppercase">Se souvenir de moi</span>
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-sm font-bold uppercase hover:underline"
                  >
                    Mot de passe oublie?
                  </Link>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-yellow-400 border-4 border-black px-6 py-4 font-black uppercase text-lg shadow-neo hover:shadow-neo-lg hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Connexion...' : 'SE CONNECTER'}
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-6 border-t-4 border-black">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-sm font-bold uppercase">Pas encore de compte?</span>
                  <Link
                    href="/register"
                    className="bg-black text-white border-4 border-black px-6 py-2 font-bold uppercase text-sm hover:bg-white hover:text-black transition-colors"
                  >
                    CREER UN COMPTE
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link href="/" className="text-sm font-bold hover:underline uppercase">
                Retour a l'accueil
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
