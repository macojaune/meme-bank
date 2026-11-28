import axios from 'axios'
import { useState } from 'react'

export default function RaycastAccess() {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function connect() {
    setBusy(true)
    try {
      const result = await axios.post<{ token: string }>('/api/raycast/token')
      setToken(result.data.token)
      setMessage('')
    } catch {
      setMessage('Impossible de créer le jeton. Reconnecte-toi et réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-md">
      {token ? (
        <div className="text-sm">
          Copie ce jeton de lecture dans les préférences de MemeBank sur Raycast. Il expire dans 30
          jours.
          <input
            aria-label="Jeton de lecture MemeBank"
            className="mt-2 w-full border-2 border-black p-2"
            type="text"
            autoComplete="off"
            spellCheck={false}
            readOnly
            value={token}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="mt-2 font-bold underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(token)
                setMessage('Jeton copié.')
              } catch {
                setMessage('Sélectionne le jeton puis copie-le avec ⌘C.')
              }
            }}
          >
            Copier le jeton
          </button>
        </div>
      ) : (
        <button type="button" className="font-bold underline" onClick={connect} disabled={busy}>
          {busy ? 'Création du jeton…' : 'Connecter Raycast'}
        </button>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  )
}
