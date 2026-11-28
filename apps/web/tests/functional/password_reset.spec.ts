import { test } from '@japa/runner'
import { createHash, randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import { DateTime } from 'luxon'
import User from '#models/user'
import env from '#start/env'

const local = 'http://127.0.0.1:46388'
const origin = 'https://memebank.example.invalid'
const email = 'reset-test@example.invalid'
const httpFetch = globalThis.fetch

test.group('Password reset via HTTP', (group) => {
  if (process.env.MEMEBANK_PASSWORD_RESET_TESTS !== '1') {
    test('requires a disposable PostgreSQL database').skip()
    return
  }

  const sent: { to: { email: string }[]; textContent: string }[] = []
  const previousPassword = randomUUID()
  const newPassword = randomUUID()

  group.setup(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.PORT !== '46388' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '46385' ||
      process.env.DB_DATABASE !== 'memebank_reset_fixture' ||
      (await db.connection().schema.hasTable('users'))
    ) {
      throw new Error('Password reset tests require a clean disposable database')
    }
    const migrations = new MigrationRunner(db, app, { direction: 'up' })
    await migrations.run()
    if (migrations.error) throw migrations.error
    await User.create({ email, password: previousPassword })

    env.set('BREVO_API_KEY', 'fixture')
    env.set('BREVO_RESET_SENDER_EMAIL', 'sender@example.invalid')
    env.set('PASSWORD_RESET_ORIGIN', origin)
    globalThis.fetch = async (target, options) => {
      if (target !== 'https://api.brevo.com/v3/smtp/email' || options?.method !== 'POST') {
        throw new Error('Unexpected outbound request')
      }
      sent.push(JSON.parse(String(options.body)))
      return new Response(null, { status: 201 })
    }
  })
  group.teardown(() => {
    globalThis.fetch = httpFetch
  })

  test('sends a private single-use link and allows login with the new password', async ({
    assert,
  }) => {
    const cookies = new Map<string, string>()
    let version: string | undefined
    async function request(path: string, data?: object, csrf = true): Promise<Response> {
      const headers = new Headers({
        accept: 'application/json',
        cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '),
      })
      if (!data) {
        headers.set('x-inertia', 'true')
        if (version) headers.set('x-inertia-version', version)
      } else {
        headers.set('content-type', 'application/json')
        if (csrf) headers.set('x-xsrf-token', decodeURIComponent(cookies.get('XSRF-TOKEN') ?? ''))
      }
      const response = await httpFetch(local + path, {
        headers,
        method: data ? 'POST' : 'GET',
        body: data ? JSON.stringify(data) : undefined,
        redirect: 'manual',
      })
      for (const setCookie of response.headers.getSetCookie()) {
        const pair = setCookie.split(';', 1)[0]
        const separator = pair.indexOf('=')
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
      }
      if (!data && response.status === 409 && !version) {
        version = ((await response.json()) as { version: string }).version
        return request(path)
      }
      return response
    }

    const page = await request('/reset-password')
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(((await page.json()) as { component: string }).component, 'auth/reset-password')

    const csrfFailure = await request('/forgot-password', { email }, false)
    assert.equal(csrfFailure.status, 302)
    assert.lengthOf(sent, 0)
    const unknown = await request('/forgot-password', { email: 'unknown@example.invalid' })
    const known = await request('/forgot-password', { email })
    assert.equal(known.status, 200)
    assert.deepEqual(await known.json(), await unknown.json())
    assert.lengthOf(sent, 1)
    assert.deepEqual(sent[0].to, [{ email }])
    const link = new URL(sent[0].textContent.split('\n\n')[1])
    assert.equal(link.origin + link.pathname + link.search, origin + '/reset-password')
    const token = new URLSearchParams(link.hash.slice(1)).get('token')!
    assert.match(token, /^[a-f0-9]{64}$/)

    const user = await User.findByOrFail('email', email)
    assert.equal(user.resetToken, createHash('sha256').update(token).digest('hex'))
    await request('/forgot-password', { email })
    assert.lengthOf(sent, 1)

    const passwordData = { token, password: newPassword, passwordConfirmation: newPassword }
    const wrongConfirmation = await request('/reset-password', {
      ...passwordData,
      passwordConfirmation: previousPassword,
    })
    assert.equal(wrongConfirmation.status, 400)

    const outcomes = await Promise.all([
      request('/reset-password', passwordData),
      request('/reset-password', passwordData),
    ])
    assert.deepEqual(outcomes.map((result) => result.status).sort(), [200, 400])
    await user.refresh()
    assert.isNull(user.resetToken)
    assert.isNull(user.resetTokenExpiresAt)

    const oldLogin = await request('/login', { email, password: previousPassword })
    const newLogin = await request('/login', { email, password: newPassword })
    assert.equal(oldLogin.headers.get('location'), '/login?error=invalid')
    assert.equal(newLogin.headers.get('location'), '/dashboard')

    user.resetToken = createHash('sha256').update(token).digest('hex')
    user.resetTokenExpiresAt = DateTime.now().minus({ minutes: 1 })
    await user.save()
    const expired = await request('/reset-password', passwordData)
    assert.equal(expired.status, 400)
  })
})
