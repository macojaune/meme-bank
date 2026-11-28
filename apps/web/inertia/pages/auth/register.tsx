import { Head, Link, useForm } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'

export default function Register({ invitation }: { invitation: { email: string } | null }) {
  const exchangeStarted = useRef(false)
  const [invitationMessage, setInvitationMessage] = useState(
    'Les accès à la bêta sont ouverts sur invitation, progressivement.'
  )
  const { data, setData, post, processing, errors, reset } = useForm({
    fullName: '',
    email: invitation?.email ?? '',
    password: '',
    passwordConfirmation: '',
  })

  useEffect(() => {
    if (exchangeStarted.current) return
    const token = new URLSearchParams(window.location.hash.slice(1)).get('invitation')
    if (!token) return
    exchangeStarted.current = true
    // Fragments never reach HTTP access logs/referrers. Remove it before exchanging the token.
    window.history.replaceState(null, '', '/register')
    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
    setInvitationMessage('Vérification de ton invitation…')
    void fetch('/register/invitation', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-xsrf-token': cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '',
      },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (response.redirected || !response.ok) throw new Error('invalid invitation')
        const result = await response.json()
        if (result.redirect !== '/register') throw new Error('invalid invitation')
        window.location.replace('/register')
      })
      .catch(() => setInvitationMessage('Cette invitation est invalide, expirée ou déjà utilisée.'))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    post('/register', {
      onSuccess: () => {
        reset()
      },
      preserveScroll: true,
    })
  }

  return (
    <>
      <Head title="Inscription - Meme Bank" />

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
                  {invitation ? 'INSCRIPTION' : 'ACCÈS SUR INVITATION'}
                </h1>
                <p className="mt-2 font-medium">
                  {invitation
                    ? 'Ton invitation te permet de rejoindre la bêta.'
                    : invitationMessage}
                </p>
              </div>

              {(errors as Record<string, string>).general && (
                <div className="border-4 border-black bg-red-500 p-4 mb-6 shadow-neo-sm">
                  <div className="flex items-center gap-2 font-bold text-white uppercase text-sm">
                    {(errors as Record<string, string>).general}
                  </div>
                </div>
              )}

              {invitation ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-sm font-bold uppercase mb-2 tracking-wide"
                    >
                      Nom complet
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={data.fullName}
                      onChange={(e) => setData('fullName', e.target.value)}
                      className="w-full px-4 py-3 border-4 border-black font-bold"
                      placeholder="Ton pseudo ou prenom"
                    />
                    {errors.fullName && (
                      <p className="mt-2 text-sm font-bold text-red-600 uppercase">
                        {errors.fullName}
                      </p>
                    )}
                  </div>

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
                      readOnly
                      value={data.email}
                      className="w-full px-4 py-3 border-4 border-black font-bold"
                      placeholder="ton@email.com"
                    />
                    {errors.email && (
                      <p className="mt-2 text-sm font-bold text-red-600 uppercase">
                        {errors.email}
                      </p>
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
                      autoComplete="new-password"
                      required
                      value={data.password}
                      onChange={(e) => setData('password', e.target.value)}
                      className="w-full px-4 py-3 border-4 border-black font-bold"
                      placeholder="8 caracteres minimum"
                    />
                    {errors.password && (
                      <p className="mt-2 text-sm font-bold text-red-600 uppercase">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="passwordConfirmation"
                      className="block text-sm font-bold uppercase mb-2 tracking-wide"
                    >
                      Confirmer le mot de passe
                    </label>
                    <input
                      id="passwordConfirmation"
                      name="passwordConfirmation"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={data.passwordConfirmation}
                      onChange={(e) => setData('passwordConfirmation', e.target.value)}
                      className="w-full px-4 py-3 border-4 border-black font-bold"
                      placeholder="Reinis le mot de passe"
                    />
                    {errors.passwordConfirmation && (
                      <p className="mt-2 text-sm font-bold text-red-600 uppercase">
                        {errors.passwordConfirmation}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full bg-yellow-400 border-4 border-black px-6 py-4 font-black uppercase text-lg shadow-neo hover:shadow-neo-lg hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {processing ? 'Inscription...' : 'CREER MON COMPTE'}
                    </button>
                  </div>
                </form>
              ) : (
                <a
                  href="/#waitlist"
                  className="block border-4 border-black bg-yellow-400 p-4 text-center font-black uppercase"
                >
                  Me préinscrire pour les prochains accès
                </a>
              )}

              <div className="mt-8 pt-6 border-t-4 border-black">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-sm font-bold uppercase">Deja inscrit?</span>
                  <Link
                    href="/login"
                    className="bg-black text-white border-4 border-black px-6 py-2 font-bold uppercase text-sm hover:bg-white hover:text-black transition-colors"
                  >
                    SE CONNECTER
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
