export async function postPasswordReset(path: string, body: object) {
  const csrfCookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    redirect: 'error',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-xsrf-token': csrfCookie ? decodeURIComponent(csrfCookie.slice('XSRF-TOKEN='.length)) : '',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const { message } = await response.json()
    throw new Error(typeof message === 'string' ? message : 'La demande a échoué. Réessaie.')
  }
}
