import { Head, Link } from '@inertiajs/react'
import { FormEvent, useRef, useState } from 'react'
import GalleryPreview, { type PreviewVideo } from '../components/gallery_preview'

interface LeaderboardEntry {
  rank: number
  fullName: string
  totalPoints: number
}

interface HomeProps {
  leaderboard: LeaderboardEntry[]
  previewVideos: PreviewVideo[]
  auth?: {
    isLoggedIn: boolean
    user: { id: string; fullName: string } | null
  }
}

type SignupState = 'idle' | 'loading' | 'success' | 'error'

const EMPTY_LEADERBOARD: LeaderboardEntry[] = []
const EMPTY_PREVIEW: PreviewVideo[] = []

function csrfToken() {
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export default function Home({
  leaderboard = EMPTY_LEADERBOARD,
  previewVideos = EMPTY_PREVIEW,
  auth,
}: HomeProps) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [signupState, setSignupState] = useState<SignupState>('idle')
  const [signupMessage, setSignupMessage] = useState('')
  const submittingRef = useRef(false)

  async function joinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSignupState('loading')
    setSignupMessage('')

    try {
      const response = await fetch('/waitlist', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-xsrf-token': csrfToken(),
        },
        body: JSON.stringify({ email, consent, website }),
      })
      const payload = (await response.json()) as { message?: string }

      if (!response.ok) throw new Error(payload.message ?? 'La préinscription a échoué.')

      setSignupState('success')
      setSignupMessage('Ton adresse est enregistrée. Le questionnaire est aussi dans ton email.')
      setEmail('')
      setConsent(false)
    } catch (error) {
      setSignupState('error')
      setSignupMessage(
        error instanceof Error ? error.message : 'La préinscription a échoué. Réessaie dans un instant.'
      )
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <>
      <Head title="Tous nos mèmes, sans chercher 3 heures">
        <meta
          name="description"
          content="MemeBank rassemble les mèmes vidéo des Antilles-Guyane pour les retrouver, les regarder et les transmettre sans perdre la rèf."
        />
      </Head>

      <a href="#main-content" className="skip-link">Aller au contenu principal</a>

      <div className="min-h-screen bg-[#fff8e7] text-black">
        <header className="sticky top-0 z-50 border-b-4 border-black bg-[#fff8e7]">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3" aria-label="Navigation principale">
            <Link href="/" className="shrink-0 text-xl font-black uppercase tracking-[-0.04em] sm:text-2xl">
              MemeBank
            </Link>
            <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase sm:text-sm">
              <a href="#preview" className="hidden px-2 py-2 hover:underline sm:inline">Voir les mèmes</a>
              {auth?.isLoggedIn ? (
                <>
                  <Link href="/gallery" className="hidden px-2 py-2 hover:underline md:inline">Galerie</Link>
                  <Link href="/dashboard" className="btn-neo-ghost px-3 py-2">Mon compte</Link>
                </>
              ) : (
                <Link href="/login" className="hidden px-2 py-2 hover:underline sm:inline">Se connecter</Link>
              )}
              <a href="#waitlist" className="btn-neo-yellow whitespace-nowrap px-3 py-2 sm:px-4">Rejoindre la bêta</a>
            </div>
          </nav>
        </header>

        <main id="main-content">
          <section className="border-b-4 border-black px-4 py-14 sm:py-20 lg:py-24">
            <div className="mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <h1 className="max-w-[10ch] text-[clamp(3.4rem,10vw,7.5rem)] font-black uppercase leading-[0.84] tracking-[-0.04em]">
                  Tous nos mèmes, sans chercher 3 heures.
                </h1>
              </div>
              <div className="lg:col-span-4 lg:pb-2">
                <p className="max-w-[34rem] text-lg font-semibold leading-7 sm:text-xl">
                  MemeBank rassemble les mèmes vidéo des Antilles-Guyane pour les retrouver, les regarder et les transmettre sans perdre la rèf.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <a href="#waitlist" className="btn-neo-yellow inline-flex items-center justify-center gap-2 px-6 py-4 font-black uppercase">
                    Tester en premier <ArrowIcon />
                  </a>
                  <a href="#preview" className="btn-neo-ghost inline-flex items-center justify-center gap-2 px-6 py-4 font-black uppercase">
                    Voir l’aperçu
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="grid border-b-4 border-black lg:grid-cols-3">
            <div className="border-b-4 border-black bg-[#ffd600] p-7 lg:border-b-0 lg:border-r-4">
              <p className="text-2xl font-black uppercase">Chercher comme on parle</p>
              <p className="mt-3 font-semibold leading-6">Un titre, une expression ou un territoire suffit pour parcourir ce qui est déjà dans la banque.</p>
            </div>
            <div className="border-b-4 border-black bg-white p-7 lg:border-b-0 lg:border-r-4">
              <p className="text-2xl font-black uppercase">Préserver le contexte</p>
              <p className="mt-3 font-semibold leading-6">Chaque vidéo garde son nom, son origine et, avec la communauté, les personnes et les mots qui l’accompagnent.</p>
            </div>
            <div className="bg-[#22d3ee] p-7">
              <p className="text-2xl font-black uppercase">Construire ensemble</p>
              <p className="mt-3 font-semibold leading-6">La bêta servira à éprouver la recherche, enrichir l’archive et décider des fonctions qui comptent vraiment.</p>
            </div>
          </section>

          <GalleryPreview videos={previewVideos} />

          <section id="waitlist" className="scroll-mt-20 border-b-4 border-black bg-[#ffd600] px-4 py-14 sm:py-20">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-6">
                <h2 className="max-w-[10ch] text-5xl font-black uppercase leading-[0.9] tracking-[-0.04em] sm:text-7xl">Entre dans le premier cercle.</h2>
                <p className="mt-6 max-w-xl text-lg font-semibold leading-7">
                  Laisse ton email. Tu recevras le questionnaire de qualification, puis les nouvelles utiles sur l’ouverture de la bêta. Les accès partiront par petits groupes.
                </p>
                <a
                  href="https://tally.so/r/0QWer6?source=landing-direct&utm_source=memebank&utm_medium=website&utm_campaign=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-block font-black underline decoration-4 underline-offset-4 hover:no-underline"
                >
                  Déjà préinscrit·e ? Remplir le questionnaire directement →
                </a>
              </div>

              <form onSubmit={joinWaitlist} className="relative border-4 border-black bg-[#fff8e7] p-5 shadow-neo-xl sm:p-8 lg:col-span-6" noValidate>
                <label htmlFor="waitlist-email" className="block text-lg font-black uppercase">Ton email</label>
                <input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="toi@exemple.com"
                  className="mt-3 w-full border-4 border-black bg-white px-4 py-4 text-lg font-bold outline-none focus:outline focus:outline-4 focus:outline-offset-2 focus:outline-[#22d3ee]"
                  disabled={signupState === 'loading'}
                />

                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="waitlist-website">Site web</label>
                  <input id="waitlist-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-5">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    required
                    className="mt-0.5 h-5 w-5 shrink-0 accent-black"
                    disabled={signupState === 'loading'}
                  />
                  <span>J’accepte de recevoir les informations liées à la bêta MemeBank. Je pourrai me désinscrire à tout moment.</span>
                </label>

                <button
                  type="submit"
                  disabled={signupState === 'loading' || !email || !consent}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 border-4 border-black bg-black px-6 py-4 text-base font-black uppercase text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signupState === 'loading' ? 'Inscription en cours…' : 'Me préinscrire'}
                  {signupState !== 'loading' ? <ArrowIcon /> : null}
                </button>

                <div aria-live="polite" className="mt-4 min-h-6 text-sm font-bold">
                  {signupMessage ? (
                    <p className={signupState === 'error' ? 'text-red-700' : 'text-green-800'}>{signupMessage}</p>
                  ) : null}
                </div>
              </form>
            </div>
          </section>

          {leaderboard.length > 0 ? (
            <section className="border-b-4 border-black bg-[#22d3ee] px-4 py-12">
              <div className="mx-auto max-w-7xl">
                <h2 className="text-3xl font-black uppercase">Celles et ceux qui enrichissent déjà l’archive</h2>
                <ol className="mt-7 grid gap-3 md:grid-cols-5">
                  {leaderboard.map((person) => (
                    <li key={person.rank} className="border-4 border-black bg-white p-4 shadow-neo-sm">
                      <span className="text-sm font-black">#{person.rank}</span>
                      <p className="mt-2 truncate font-black">{person.fullName}</p>
                      <p className="mt-1 text-sm font-bold">{person.totalPoints.toLocaleString('fr-FR')} points</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : null}
        </main>

        <footer className="bg-black px-4 py-10 text-white">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <p className="text-3xl font-black uppercase tracking-[-0.04em]">MemeBank</p>
            <div className="text-sm font-semibold text-neutral-300 sm:text-right">
              <p>Une archive culturelle en construction depuis la Guadeloupe.</p>
              <p className="mt-1">© 2026 MemeBank</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
