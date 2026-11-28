import { useState, type FormEvent } from 'react'
import { Head } from '@inertiajs/react'
import { postPasswordReset } from './password_reset_request'

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false)
  const [email, setEmail] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (processing) return
    setProcessing(true)
    setError('')
    try {
      await postPasswordReset('/forgot-password', { email })
      setEmailSent(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'La demande a échoué. Réessaie.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <Head title="Mot de passe oublié" />

      <div className="min-h-screen flex items-center justify-center bg-sand-1">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">Mot de passe oublié ?</h1>
            <p className="mt-2 text-sm text-gray-600">
              Saisis l’adresse e-mail de ton compte pour demander un lien de réinitialisation.
            </p>
          </div>

          {emailSent ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              <p>
                Si un compte correspond à cette adresse, tu recevras un lien de réinitialisation.
              </p>
              <p className="mt-4">
                <a href="/login" className="font-medium text-primary hover:text-primary-dark">
                  Retour à la connexion
                </a>
              </p>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                />
                {error && (
                  <p role="alert" className="mt-1 text-sm text-red-500">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a href="/login" className="font-medium text-primary hover:text-primary-dark">
                    Retour à la connexion
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {processing ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
