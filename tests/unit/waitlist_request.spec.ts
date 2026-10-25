import { test } from '@japa/runner'
import { submitWaitlist } from '../../inertia/utils/waitlist.js'

const signup = { email: 'fixture@example.invalid', consent: true, website: '' }

test.group('Waitlist browser request', () => {
  test('negotiates JSON and preserves the CSRF token and consent', async ({ assert }) => {
    await submitWaitlist(signup, 'fixture-csrf', async (url, init) => {
      assert.equal(url, '/waitlist')
      assert.equal(init?.method, 'POST')
      assert.equal(init?.credentials, 'same-origin')
      assert.deepEqual(init?.headers, {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-xsrf-token': 'fixture-csrf',
      })
      assert.deepEqual(JSON.parse(String(init?.body)), signup)
      return new Response('{"questionnaireUrl":"https://tally.so/r/0QWer6"}', { status: 201 })
    })
  })

  test('turns validation errors into a readable message without changing the input', async ({
    assert,
  }) => {
    const invalidSignup = { ...signup, email: 'bad' }
    await assert.rejects(
      () =>
        submitWaitlist(invalidSignup, 'fixture-csrf', async () =>
          Response.json({ errors: [{ field: 'email', rule: 'email' }] }, { status: 422 })
        ),
      'Vérifie ton adresse email et réessaie.'
    )
    assert.deepEqual(invalidSignup, { ...signup, email: 'bad' })
  })

  test('reports provider failures and permits a successful retry', async ({ assert }) => {
    await assert.rejects(
      () =>
        submitWaitlist(signup, 'fixture-csrf', async () =>
          Response.json({ message: 'Ton adresse n’a pas pu être enregistrée.' }, { status: 502 })
        ),
      'Ton adresse n’a pas pu être enregistrée.'
    )
    await submitWaitlist(signup, 'fixture-csrf', async () => Response.json({}, { status: 201 }))
  })

  test('does not expose JSON parsing or network errors to the user', async ({ assert }) => {
    for (const fetcher of [
      async () => new Response('<html>Proxy unavailable</html>', { status: 502 }),
      async () => new Response('<html>Unexpected page</html>', { status: 200 }),
      async () => {
        throw new TypeError('Failed to fetch')
      },
    ]) {
      await assert.rejects(
        () => submitWaitlist(signup, 'fixture-csrf', fetcher),
        'La préinscription a échoué. Réessaie dans un instant.'
      )
    }
  })

  test('explains an expired CSRF session without weakening protection', async ({ assert }) => {
    await assert.rejects(
      () => submitWaitlist(signup, '', async () => new Response(null, { status: 403 })),
      'La page a expiré. Recharge-la avant de réessayer.'
    )
    const redirectedLanding = new Response('<html>Landing</html>', { status: 200 })
    Object.defineProperty(redirectedLanding, 'redirected', { value: true })
    await assert.rejects(
      () => submitWaitlist(signup, '', async () => redirectedLanding),
      'La page a expiré. Recharge-la avant de réessayer.'
    )
  })
})
