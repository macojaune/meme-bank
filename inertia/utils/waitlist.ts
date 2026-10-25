interface WaitlistSignup {
  email: string
  consent: boolean
  website: string
}

const RETRY_MESSAGE = 'La préinscription a échoué. Réessaie dans un instant.'

export async function submitWaitlist(
  signup: WaitlistSignup,
  csrfToken: string,
  fetcher: typeof fetch = fetch
) {
  let response: Response
  try {
    response = await fetcher('/waitlist', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-xsrf-token': csrfToken,
      },
      body: JSON.stringify(signup),
    })
  } catch {
    throw new Error(RETRY_MESSAGE)
  }

  // Shield can redirect an expired session back to the HTML landing.
  if (response.redirected || response.status === 403) {
    throw new Error('La page a expiré. Recharge-la avant de réessayer.')
  }
  if (response.status === 422) throw new Error('Vérifie ton adresse email et réessaie.')

  const payload = (await response.json().catch(() => null)) as { message?: unknown } | null
  if (response.ok && payload) return
  throw new Error(typeof payload?.message === 'string' ? payload.message : RETRY_MESSAGE)
}
