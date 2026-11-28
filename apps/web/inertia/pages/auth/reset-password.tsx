import { Head, Link } from '@inertiajs/react'
import { useEffect, useState, type FormEvent } from 'react'
import { postPasswordReset } from './password_reset_request'

export default function ResetPassword() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get('token')
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    if (fragment && /^[a-f0-9]{64}$/.test(fragment)) setToken(fragment)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || pending) return
    setPending(true)
    setError('')
    try {
      await postPasswordReset('/reset-password', {
        token,
        password,
        passwordConfirmation: confirmation,
      })
      window.location.replace('/login')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'La demande a échoué. Réessaie.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-sand-1 p-4">
      <Head title="Réinitialiser le mot de passe" />
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-md shadow-md">
        <h1 className="text-2xl font-bold">Choisis un nouveau mot de passe</h1>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            Nouveau mot de passe
            <input
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
              disabled={!token || pending}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block">
            Confirme le mot de passe
            <input
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              type="password"
              name="passwordConfirmation"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
              disabled={!token || pending}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <button
            className="rounded-md bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={!token || pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
        <Link href="/forgot-password" className="text-primary underline">
          Demander un nouveau lien
        </Link>
      </div>
    </main>
  )
}
