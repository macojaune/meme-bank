import { test } from '@japa/runner'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import app from '@adonisjs/core/services/app'
import encryption from '@adonisjs/core/services/encryption'
import { CookieClient } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import { DateTime } from 'luxon'
import BetaInvitation from '#models/beta_invitation'
import User from '#models/user'
import BetaInvitationService, { InvalidInvitationError } from '#services/beta_invitation_service'

const execute = promisify(execFile)
const service = new BetaInvitationService()
const password = 'Synthetic-fixture-password-369!'
const registration = (email: string) => ({ fullName: 'Fixture locale', email, password })
const invitationMigration = '1792900000000_create_beta_invitations_table.ts'

// Explicit opt-in: never migrate/truncate an application's ordinary development database.
test.group('Beta invitations — isolated PostgreSQL and real HTTP', (group) => {
  if (process.env.MAR369_INVITATION_TESTS !== '1') {
    test('requires the documented disposable PostgreSQL fixture', () => {}).skip()
    return
  }

  let migrationDirectory: string
  let privateDirectory: string
  let originalPaths: string[] | undefined
  let preservedUser: Record<string, unknown> & { id: string }
  const originalFetch = globalThis.fetch
  const url = `http://127.0.0.1:${process.env.PORT}`

  async function migrate(direction: 'up' | 'down', batch?: number) {
    const runner = new MigrationRunner(db, app, { direction, batch })
    await runner.run()
    if (runner.error) throw runner.error
    return runner
  }

  class Browser {
    cookies = new Map<string, string>()
    version?: string
    session() {
      const client = new CookieClient(encryption)
      const id = client.parse(
        'adonis-session',
        decodeURIComponent(this.cookies.get('adonis-session') ?? '')
      )
      return client.decrypt(id, decodeURIComponent(this.cookies.get(id) ?? '')) as Record<
        string,
        unknown
      >
    }
    async request(
      path: string,
      data?: object,
      csrf = true,
      inertia = true,
      accept = inertia ? 'text/html, application/xhtml+xml' : 'application/json'
    ): Promise<Response> {
      const headers: Record<string, string> = {
        accept,
        cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      }
      if (inertia) headers['x-inertia'] = 'true'
      if (this.version) headers['x-inertia-version'] = this.version
      if (data) {
        headers['content-type'] = 'application/json'
        if (csrf) headers['x-xsrf-token'] = decodeURIComponent(this.cookies.get('XSRF-TOKEN') ?? '')
      }
      const response = await originalFetch(`${url}${path}`, {
        method: data ? 'POST' : 'GET',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        redirect: 'manual',
      })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0]
        const separator = pair.indexOf('=')
        this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
      }
      // Negotiate the actual served asset version; do not disable Inertia's version guard.
      if (response.status === 409 && !this.version && !data) {
        this.version = ((await response.json()) as { version: string }).version
        return this.request(path, data, csrf, inertia, accept)
      }
      return response
    }
    async invitation(token: string) {
      await this.request('/register')
      return this.request('/register/invitation', { token }, true, false)
    }
  }

  async function counts() {
    const rows1 = await db.from('users').count('* as count')
    const rows2 = await db.from('beta_invitations').count('* as count')
    return {
      users: Number(rows1[0].count),
      invitations: Number(rows2[0].count),
    }
  }

  async function noAuthenticatedSession(browser: Browser, assert: any) {
    const response = await browser.request('/login')
    assert.equal(response.status, 200)
    const page = (await response.json()) as any
    assert.isFalse(page.props.auth.isLoggedIn)
  }

  group.setup(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      !['46380', '46384'].includes(process.env.DB_PORT ?? '') ||
      process.env.DB_DATABASE !== 'mar369_invitations_fixture' ||
      process.env.DB_USER !== 'mar369_fixture' ||
      process.env.PORT !== '46379'
    ) {
      throw new Error('Refusing any database or HTTP port outside the dedicated invitation fixture')
    }
    // Provider calls fail closed, including helpers. Browser traffic uses only the loopback URL above.
    globalThis.fetch = async () => {
      throw new Error('External provider access disabled in invitation tests')
    }
    if (await db.connection().schema.hasTable('users'))
      throw new Error('Fixture must start without users table')
    await mkdir(app.tmpPath(), { recursive: true })
    migrationDirectory = await mkdtemp(app.tmpPath('invitation-migrations-'))
    privateDirectory = await mkdtemp(app.tmpPath('invitation-private-'))
    const config = db.getRawConnection('postgres')!.config
    originalPaths = config.migrations?.paths
    config.migrations = { ...config.migrations, paths: [migrationDirectory] }
    for (const filename of [
      '1749780238747_create_users_table.ts',
      '1749802831282_create_add_reset_token_to_users_table.ts',
      '1769927084000_add_total_points_to_users.ts',
    ])
      await copyFile(app.migrationsPath(filename), join(migrationDirectory, filename))
    await migrate('up')
    const existing = await User.create({
      ...registration('existing@example.invalid'),
      totalPoints: 37,
    })
    preservedUser = await db.from('users').where('id', existing.id).first()
    await copyFile(
      app.migrationsPath(invitationMigration),
      join(migrationDirectory, invitationMigration)
    )
    await migrate('up')
  })

  group.teardown(async () => {
    globalThis.fetch = originalFetch
    if (migrationDirectory) {
      await migrate('down', 0)
      db.getRawConnection('postgres')!.config.migrations!.paths = originalPaths
      await rm(migrationDirectory, { recursive: true, force: true })
    }
    if (privateDirectory) await rm(privateDirectory, { recursive: true, force: true })
  })

  test('additive migration replays, rolls back and returns without changing an existing user', async ({
    assert,
  }) => {
    const migration3 = await migrate('up')
    assert.equal(migration3.status, 'skipped')
    await migrate('down')
    assert.isFalse(await db.connection().schema.hasTable('beta_invitations'))
    assert.deepEqual(await db.from('users').where('id', preservedUser.id).first(), preservedUser)
    await migrate('up')
    const migration4 = await migrate('up')
    assert.equal(migration4.status, 'skipped')
    assert.deepEqual(await db.from('users').where('id', preservedUser.id).first(), preservedUser)
  })

  test('normalizes email, hashes a 32-byte token and defaults to seven days', async ({
    assert,
  }) => {
    const before = DateTime.utc()
    const issued = await service.issue('  Normalized@Example.Invalid  ')
    const row = await BetaInvitation.findOrFail(issued.id)
    assert.equal(row.email, 'normalized@example.invalid')
    assert.isTrue(/^[a-f0-9]{64}$/.test(issued.token))
    assert.isTrue(row.tokenHash === BetaInvitationService.hashToken(issued.token))
    assert.isTrue(row.tokenHash !== issued.token)
    assert.isFalse(JSON.stringify(row.serialize()).includes(row.tokenHash))
    assert.isTrue(row.expiresAt >= before.plus({ days: 7 }).minus({ seconds: 1 }))
    assert.isTrue(row.expiresAt <= DateTime.utc().plus({ days: 7 }))
    const columns = await db
      .from('information_schema.columns')
      .where('table_name', 'beta_invitations')
      .select('column_name')
    assert.isFalse(columns.some((column) => column.column_name === 'token'))
  })

  test('refuses invalid addresses, durations, duplicate issue and existing accounts', async ({
    assert,
  }) => {
    const before = await counts()
    await assert.rejects(() => service.issue('not-an-address'))
    for (const days of [0, -1, 1.5, Number.NaN])
      await assert.rejects(() => service.issue('days@example.invalid', { days }))
    await assert.rejects(() => service.issue('normalized@example.invalid'))
    await assert.rejects(() => service.issue(' EXISTING@EXAMPLE.INVALID '))
    await assert.rejects(() => service.issue('missing@example.invalid', { reissue: true }))
    assert.deepEqual(await counts(), before)
  })

  test('reissue invalidates the old token and revoke is idempotent', async ({ assert }) => {
    const first = await service.issue('replace@example.invalid')
    const second = await service.issue('replace@example.invalid', { reissue: true, days: 2 })
    assert.equal(first.id, second.id)
    assert.isTrue(first.token !== second.token)
    assert.isNull(await service.findUsable(BetaInvitationService.hashToken(first.token)))
    assert.isNotNull(await service.findUsable(BetaInvitationService.hashToken(second.token)))
    await service.revoke(' REPLACE@EXAMPLE.INVALID ')
    await service.revoke('replace@example.invalid')
    assert.isNull(await service.findUsable(BetaInvitationService.hashToken(second.token)))
    const third = await service.issue('replace@example.invalid', { reissue: true })
    assert.isNotNull(await service.findUsable(BetaInvitationService.hashToken(third.token)))
  })

  test('missing, malformed, unknown, expired, revoked and mismatched invitations never create users', async ({
    assert,
  }) => {
    const totals5 = await counts()
    const before = Number(totals5.users)
    for (const token of [undefined, '', 'invalid', '0'.repeat(64)]) {
      await assert.rejects(async () => {
        await service.register(token, registration('denied@example.invalid'))
      }, /L’accès à la bêta nécessite une invitation valide/)
    }
    for (const state of ['expired', 'revoked', 'mismatch']) {
      const issued = await service.issue(`${state}@example.invalid`)
      const row = await BetaInvitation.findOrFail(issued.id)
      if (state === 'expired') row.expiresAt = DateTime.utc().minus({ seconds: 1 })
      if (state === 'revoked') row.revokedAt = DateTime.utc()
      await row.save()
      await assert.rejects(async () => {
        await service.register(
          BetaInvitationService.hashToken(issued.token),
          registration(state === 'mismatch' ? 'other@example.invalid' : row.email)
        )
      }, /L’accès à la bêta nécessite une invitation valide/)
      await row.refresh()
      assert.isNull(row.redeemedAt)
    }
    const totals6 = await counts()
    assert.equal(totals6.users, before)
  })

  test('creates the user and consumes the invitation once, preserving password authentication', async ({
    assert,
  }) => {
    const issued = await service.issue('success@example.invalid')
    const tokenHash = BetaInvitationService.hashToken(issued.token)
    const user = await service.register(tokenHash, registration(' SUCCESS@EXAMPLE.INVALID '))
    assert.equal(user.email, 'success@example.invalid')
    const authenticated7 = await User.verifyCredentials(user.email, password)
    assert.equal(authenticated7.id, user.id)
    const invitation8 = await BetaInvitation.findOrFail(issued.id)
    assert.isNotNull(invitation8.redeemedAt)
    await assert.rejects(async () => {
      await service.register(tokenHash, registration(user.email))
    }, /L’accès à la bêta nécessite une invitation valide/)
    await assert.rejects(() => service.issue(user.email, { reissue: true }))
    const rows9 = await db.from('users').where('email', user.email).count('* as count')
    assert.equal(Number(rows9[0].count), 1)
  })

  test('rolls back user creation when recording redemption fails', async ({ assert }) => {
    const issued = await service.issue('rollback@example.invalid')
    await db.rawQuery(
      `CREATE FUNCTION fixture_reject_redemption() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'fixture redemption failure'; END IF; RETURN NEW; END $$`
    )
    await db.rawQuery(
      'CREATE TRIGGER fixture_redemption BEFORE UPDATE ON beta_invitations FOR EACH ROW EXECUTE FUNCTION fixture_reject_redemption()'
    )
    try {
      await assert.rejects(() =>
        service.register(
          BetaInvitationService.hashToken(issued.token),
          registration('rollback@example.invalid')
        )
      )
      assert.isNull(await User.findBy('email', 'rollback@example.invalid'))
      const invitation10 = await BetaInvitation.findOrFail(issued.id)
      assert.isNull(invitation10.redeemedAt)
    } finally {
      await db.rawQuery('DROP TRIGGER fixture_redemption ON beta_invitations')
      await db.rawQuery('DROP FUNCTION fixture_reject_redemption()')
    }
  })

  test('two concurrent transactions yield exactly one account and one refusal', async ({
    assert,
  }) => {
    const issued = await service.issue('race@example.invalid')
    const tokenHash = BetaInvitationService.hashToken(issued.token)
    // Hold the row so both requests contend for the same PostgreSQL lock before release.
    const lock = await db.transaction()
    await lock.from('beta_invitations').where('id', issued.id).forUpdate().first()
    const attempts = [
      service.register(tokenHash, registration('race@example.invalid')),
      service.register(tokenHash, registration('race@example.invalid')),
    ]
    const settled = Promise.allSettled(attempts)
    let blocked = 0
    try {
      for (let attempt = 0; attempt < 80; attempt++) {
        const waiting = await db.rawQuery(
          `SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%beta_invitations%'`
        )
        blocked = waiting.rows[0].count
        if (blocked >= 2) break
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    } finally {
      await lock.commit()
    }
    const results = await settled
    assert.equal(blocked, 2, 'Both independent transactions must actually wait on PostgreSQL locks')
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(
      results.filter(
        (result) => result.status === 'rejected' && result.reason instanceof InvalidInvitationError
      ).length,
      1
    )
    const rows11 = await db.from('users').where('email', 'race@example.invalid').count('* as count')
    assert.equal(Number(rows11[0].count), 1)
    const invitation12 = await BetaInvitation.findOrFail(issued.id)
    assert.isNotNull(invitation12.redeemedAt)
  })

  test('an account created meanwhile is preserved and cannot be overwritten by redemption', async ({
    assert,
  }) => {
    const issued = await service.issue('meanwhile@example.invalid')
    const existing = await User.create({
      ...registration('MEANWHILE@example.invalid'),
      fullName: 'Preserved',
    })
    const before = await db.from('users').where('id', existing.id).first()
    await assert.rejects(async () => {
      await service.register(
        BetaInvitationService.hashToken(issued.token),
        registration('meanwhile@example.invalid')
      )
    }, /L’accès à la bêta nécessite une invitation valide/)
    assert.deepEqual(await db.from('users').where('id', existing.id).first(), before)
    const invitation13 = await BetaInvitation.findOrFail(issued.id)
    assert.isNull(invitation13.redeemedAt)
  })

  test('GET and POST register without invitation refuse account and authenticated session', async ({
    assert,
  }) => {
    const browser = new Browser()
    const before = await counts()
    const get = await browser.request('/register?token=ignored')
    assert.equal(get.status, 403)
    const page = (await get.json()) as any
    assert.equal(page.component, 'auth/register')
    assert.isNull(page.props.invitation)
    assert.isFalse(page.props.auth.isLoggedIn)
    const post = await browser.request('/register', {
      ...registration('bypass@example.invalid'),
      passwordConfirmation: password,
    })
    assert.equal(post.status, 403)
    assert.deepEqual(await counts(), before)
    await noAuthenticatedSession(browser, assert)
  })

  test('CSRF protects both invitation exchange and registration, including a valid invitation', async ({
    assert,
  }) => {
    const issued = await service.issue('csrf@example.invalid')
    const browser = new Browser()
    await browser.request('/register')
    const noCsrf = await browser.request(
      '/register/invitation',
      { token: issued.token },
      false,
      false
    )
    assert.equal(noCsrf.status, 403)
    const noCsrfBody = await noCsrf.text()
    assert.isTrue(noCsrfBody.includes('session a expiré'))
    assert.isFalse(noCsrfBody.includes(issued.token))
    assert.isFalse(JSON.stringify(browser.session()).includes(issued.token))
    const response14 = await browser.request('/register')
    assert.equal(response14.status, 403)
    const exchange15 = await browser.invitation(issued.token)
    assert.equal(exchange15.status, 200)
    const before = await counts()
    const rejectedInput = {
      ...registration('csrf@example.invalid'),
      passwordConfirmation: 'Distinct-confirmation-must-not-be-flashed',
      token: issued.token,
    }
    const denied = await browser.request('/register', rejectedInput, false, false)
    assert.equal(denied.status, 403)
    const deniedBody = (await denied.json()) as { message: string }
    assert.deepEqual(Object.keys(deniedBody), ['message'])
    assert.include(deniedBody.message, 'session a expiré')
    // Decrypt only in RAM, and assert booleans: never print a session or submitted secrets.
    for (const value of Object.values(rejectedInput)) {
      assert.isFalse(JSON.stringify(browser.session()).includes(value))
      assert.isFalse(JSON.stringify(deniedBody).includes(value))
    }
    assert.deepEqual(await counts(), before)
    const afterJsonRefusal = await BetaInvitation.findOrFail(issued.id)
    assert.isNull(afterJsonRefusal.redeemedAt)
    const deniedInertia = await browser.request('/register', rejectedInput, false)
    assert.equal(deniedInertia.status, 302)
    assert.equal(deniedInertia.headers.get('location'), '/register')
    const rejectedSession = browser.session()
    for (const value of Object.values(rejectedInput))
      assert.isFalse(JSON.stringify(rejectedSession).includes(value))
    assert.isTrue(
      rejectedSession.betaInvitationHash === BetaInvitationService.hashToken(issued.token)
    )
    const refusedPageResponse = await browser.request('/register')
    const refusedPage = (await refusedPageResponse.json()) as any
    assert.deepEqual(Object.keys(refusedPage.props.errors), ['general'])
    assert.include(refusedPage.props.errors.general, 'session a expiré')
    for (const value of [password, rejectedInput.passwordConfirmation, issued.token])
      assert.isFalse(JSON.stringify(refusedPage).includes(value))
    assert.deepEqual(await counts(), before)
    assert.isNull(await User.findBy('email', 'csrf@example.invalid'))
    const invitation16 = await BetaInvitation.findOrFail(issued.id)
    assert.isNull(invitation16.redeemedAt)
    await noAuthenticatedSession(browser, assert)
    const validCsrf = await browser.request('/register', {
      ...registration('csrf@example.invalid'),
      passwordConfirmation: password,
    })
    assert.equal(validCsrf.status, 302)
    assert.equal(validCsrf.headers.get('location'), '/dashboard')
    const afterValidCsrf = await BetaInvitation.findOrFail(issued.id)
    assert.isNotNull(afterValidCsrf.redeemedAt)
    assert.isNotNull(await User.findBy('email', 'csrf@example.invalid'))
  })

  const representations = [
    { name: 'JSON', inertia: false, accept: 'application/json' },
    { name: 'HTML', inertia: false, accept: 'text/html' },
    { name: 'Inertia', inertia: true, accept: 'text/html, application/xhtml+xml' },
  ]
  for (const suffix of ['', '/']) {
    for (const representation of representations) {
      for (const endpoint of ['/register', '/register/invitation']) {
        const path = `${endpoint}${suffix}`
        test(`CSRF privacy matrix: ${path} ${representation.name}`, async ({ assert }) => {
          const email = `csrf-${endpoint.endsWith('invitation') ? 'exchange' : 'register'}-${suffix ? 'slash' : 'plain'}-${representation.name.toLowerCase()}@example.invalid`
          const issued = await service.issue(email)
          const browser = new Browser()
          const exchange = await browser.invitation(issued.token)
          assert.equal(exchange.status, 200)
          const before = await counts()
          const rejectedInput = {
            ...registration(email),
            passwordConfirmation: 'Distinct rejected confirmation',
            token: issued.token,
            unexpectedSecret: 'Extra submitted input must not be flashed',
          }
          const refused = await browser.request(
            path,
            rejectedInput,
            false,
            representation.inertia,
            representation.accept
          )
          // Never print a decrypted session or an input value, even on a failing regression.
          const session = browser.session()
          for (const value of Object.values(rejectedInput))
            assert.isFalse(JSON.stringify(session).includes(value), 'No submitted input in session')
          assert.isTrue(
            session.betaInvitationHash === BetaInvitationService.hashToken(issued.token)
          )
          const refusalBody = await refused.text()
          for (const value of Object.values(rejectedInput))
            assert.isFalse(refusalBody.includes(value), 'No submitted input in response')
          if (endpoint === '/register' && representation.inertia) {
            assert.equal(refused.status, 302)
            assert.equal(refused.headers.get('location'), '/register')
            const pageResponse = await browser.request('/register')
            const page = (await pageResponse.json()) as any
            assert.deepEqual(Object.keys(page.props.errors), ['general'])
            assert.include(page.props.errors.general, 'session a expiré')
          } else {
            assert.equal(refused.status, 403)
            assert.include(refused.headers.get('content-type') ?? '', 'application/json')
            assert.deepEqual(Object.keys(JSON.parse(refusalBody)), ['message'])
          }
          assert.deepEqual(await counts(), before)
          assert.isNull(await User.findBy('email', email))
          const invitationAfterRefusal = await BetaInvitation.findOrFail(issued.id)
          assert.isNull(invitationAfterRefusal.redeemedAt)
          await noAuthenticatedSession(browser, assert)
          if (endpoint === '/register/invitation') {
            const acceptedExchange = await browser.request(
              path,
              { token: issued.token },
              true,
              representation.inertia,
              representation.accept
            )
            assert.equal(acceptedExchange.status, 200)
          }
          const retry = await browser.request(
            `/register${suffix}`,
            { ...registration(email), passwordConfirmation: password },
            true,
            representation.inertia,
            representation.accept
          )
          assert.equal(retry.status, 302)
          assert.equal(retry.headers.get('location'), '/dashboard')
          assert.isNotNull(await User.findBy('email', email))
          const invitationAfterRetry = await BetaInvitation.findOrFail(issued.id)
          assert.isNotNull(invitationAfterRetry.redeemedAt)
        })
      }
      test(`Validation privacy matrix: /register${suffix} ${representation.name}`, async ({
        assert,
      }) => {
        const email = `validation-${suffix ? 'slash' : 'plain'}-${representation.name.toLowerCase()}@example.invalid`
        const issued = await service.issue(email)
        const browser = new Browser()
        const exchange = await browser.invitation(issued.token)
        assert.equal(exchange.status, 200)
        const before = await counts()
        const rejectedInput = {
          ...registration(email),
          password: 'short',
          passwordConfirmation: 'Distinct invalid confirmation',
          token: issued.token,
          unexpectedSecret: 'Extra validation input must not be flashed',
        }
        // True HTML negotiation without X-Inertia or Referer must be safe as well.
        const refused = await browser.request(
          `/register${suffix}`,
          rejectedInput,
          true,
          representation.inertia,
          representation.accept
        )
        const session = browser.session()
        for (const value of Object.values(rejectedInput))
          assert.isFalse(JSON.stringify(session).includes(value), 'No submitted input in session')
        assert.isTrue(session.betaInvitationHash === BetaInvitationService.hashToken(issued.token))
        const refusalBody = await refused.text()
        for (const value of Object.values(rejectedInput))
          assert.isFalse(refusalBody.includes(value), 'No submitted input in response')
        if (representation.name === 'JSON') {
          assert.equal(refused.status, 422)
          const fields = JSON.parse(refusalBody).errors.map(
            (error: { field: string }) => error.field
          )
          assert.sameMembers(fields, ['password', 'passwordConfirmation'])
        } else {
          assert.equal(refused.status, 302)
          assert.equal(refused.headers.get('location'), '/register')
          const pageResponse = await browser.request('/register')
          const page = (await pageResponse.json()) as any
          assert.sameMembers(Object.keys(page.props.errors), ['password', 'passwordConfirmation'])
          for (const value of [
            rejectedInput.password,
            rejectedInput.passwordConfirmation,
            issued.token,
            rejectedInput.unexpectedSecret,
          ])
            assert.isFalse(JSON.stringify(page).includes(value), 'No sensitive input in page props')
        }
        assert.deepEqual(await counts(), before)
        assert.isNull(await User.findBy('email', email))
        const invitationAfterRefusal = await BetaInvitation.findOrFail(issued.id)
        assert.isNull(invitationAfterRefusal.redeemedAt)
        await noAuthenticatedSession(browser, assert)
        const retry = await browser.request(
          `/register${suffix}`,
          { ...registration(email), passwordConfirmation: password },
          true,
          representation.inertia,
          representation.accept
        )
        assert.equal(retry.status, 302)
        assert.equal(retry.headers.get('location'), '/dashboard')
        assert.isNotNull(await User.findBy('email', email))
        const invitationAfterRetry = await BetaInvitation.findOrFail(issued.id)
        assert.isNotNull(invitationAfterRetry.redeemedAt)
      })
    }
  }

  test('HTTP rejects bad, expired, revoked and replayed tokens without a session', async ({
    assert,
  }) => {
    const expired = await BetaInvitation.findByOrFail('email', 'expired@example.invalid')
    const revoked = await service.issue('http-revoked@example.invalid')
    await service.revoke('http-revoked@example.invalid')
    const expiredNew = await service.issue('http-expired@example.invalid')
    await db
      .from('beta_invitations')
      .where('id', expiredNew.id)
      .update({ expires_at: expired.expiresAt.toSQL() })
    for (const token of ['', 'invalid', '0'.repeat(64), revoked.token, expiredNew.token]) {
      const browser = new Browser()
      const response = await browser.invitation(token)
      assert.equal(response.status, 403)
      const refusalBody = await response.text()
      assert.isFalse(refusalBody.includes(token || 'not-a-token'))
      await noAuthenticatedSession(browser, assert)
    }
  })

  test('HTTP validation keeps the invitation, rejects wrong email, then admits exactly once', async ({
    assert,
  }) => {
    const issued = await service.issue('http@example.invalid')
    const browser = new Browser()
    const exchange = await browser.invitation(issued.token)
    assert.equal(exchange.status, 200)
    assert.equal(exchange.headers.get('cache-control'), 'no-store')
    const anonymousSession = browser.session()
    assert.isTrue(
      anonymousSession.betaInvitationHash === BetaInvitationService.hashToken(issued.token)
    )
    assert.isFalse(JSON.stringify(anonymousSession).includes(issued.token))
    assert.isFalse(Object.keys(anonymousSession).some((key) => key.startsWith('auth_')))
    assert.isFalse([...browser.cookies.values()].some((cookie) => cookie.includes(issued.token)))
    const form = await browser.request('/register')
    assert.equal(form.status, 200)
    const page = (await form.json()) as any
    assert.equal(page.props.invitation.email, 'http@example.invalid')
    assert.isFalse(JSON.stringify(page).includes(issued.token))
    const invalid = await browser.request(
      '/register',
      { ...registration('http@example.invalid'), password: 'short', passwordConfirmation: 'short' },
      true,
      false
    )
    assert.equal(invalid.status, 422)
    const inertiaInvalid = await browser.request('/register', {
      ...registration('http@example.invalid'),
      fullName: 'A',
      password: 'short',
      passwordConfirmation: 'short',
      token: issued.token,
      unexpectedSecret: 'do-not-flash-this-input',
    })
    assert.equal(inertiaInvalid.status, 302)
    assert.equal(inertiaInvalid.headers.get('location'), '/register')
    const invalidSession = browser.session()
    assert.isTrue(
      invalidSession.betaInvitationHash === BetaInvitationService.hashToken(issued.token)
    )
    assert.isFalse(JSON.stringify(invalidSession).includes(issued.token))
    assert.isFalse(JSON.stringify(invalidSession).includes('do-not-flash-this-input'))
    assert.isFalse(JSON.stringify(invalidSession).includes('short'))
    const invalidPageResponse = await browser.request('/register')
    const invalidPage = (await invalidPageResponse.json()) as any
    assert.property(invalidPage.props.errors, 'fullName')
    assert.property(invalidPage.props.errors, 'password')
    assert.equal(invalidPage.props.invitation.email, 'http@example.invalid')
    assert.isFalse(JSON.stringify(invalidPage).includes(issued.token))
    const invitation18 = await BetaInvitation.findOrFail(issued.id)
    assert.isNull(invitation18.redeemedAt)
    const response19 = await browser.request('/register')
    assert.equal(response19.status, 200)
    const mismatch = await browser.request('/register', {
      ...registration('different@example.invalid'),
      passwordConfirmation: password,
    })
    assert.equal(mismatch.status, 403)
    await noAuthenticatedSession(browser, assert)
    const exchange20 = await browser.invitation(issued.token)
    assert.equal(exchange20.status, 200)
    const accepted = await browser.request('/register', {
      ...registration('http@example.invalid'),
      passwordConfirmation: password,
    })
    assert.equal(accepted.status, 302)
    assert.equal(accepted.headers.get('location'), '/dashboard')
    assert.isNotNull(await User.findBy('email', 'http@example.invalid'))
    const invitation21 = await BetaInvitation.findOrFail(issued.id)
    assert.isNotNull(invitation21.redeemedAt)
    const response22 = await browser.request('/login')
    assert.equal(response22.headers.get('location'), '/dashboard')
    const replay = new Browser()
    const exchange23 = await replay.invitation(issued.token)
    assert.equal(exchange23.status, 403)
    const response24 = await replay.request('/register', {
      ...registration('http@example.invalid'),
      passwordConfirmation: password,
    })
    assert.equal(response24.status, 403)
    await noAuthenticatedSession(replay, assert)
  })

  test('existing login and pre-migration user data remain intact', async ({ assert }) => {
    const browser = new Browser()
    await browser.request('/login')
    const loggedIn = await browser.request('/login', {
      email: 'existing@example.invalid',
      password,
    })
    assert.equal(loggedIn.headers.get('location'), '/dashboard')
    const response25 = await browser.request('/login')
    assert.equal(response25.headers.get('location'), '/dashboard')
    assert.deepEqual(await db.from('users').where('id', preservedUser.id).first(), preservedUser)
  })

  test('public candidature with a simulated provider creates neither account nor invitation', async ({
    assert,
  }) => {
    const before = await counts()
    const calls: string[] = []
    const blockedFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      calls.push(String(input))
      return new Response(null, { status: 204 })
    }
    try {
      const browser = new Browser()
      await browser.request('/register')
      const response = await browser.request(
        '/waitlist',
        { email: 'candidature@example.invalid', consent: true, website: '' },
        true,
        false
      )
      assert.equal(response.status, 201)
      assert.equal(calls.length, 2)
      assert.deepEqual(await counts(), before)
    } finally {
      globalThis.fetch = blockedFetch
    }
  })

  test('operator command writes a private link, never stdout, refuses clobber and supports reissue/revoke', async ({
    assert,
  }) => {
    const firstFile = join(privateDirectory, 'first.txt')
    async function command(action: string, file?: string) {
      return execute(
        process.execPath,
        [
          'ace',
          'beta:invite',
          action,
          'operator@example.invalid',
          ...(file ? ['--output', file, '--origin', url] : []),
        ],
        { cwd: app.makePath(), env: process.env }
      )
    }
    const first = await command('issue', firstFile)
    const content26 = await readFile(firstFile, 'utf8')
    const link = new URL(content26.trim())
    const token = new URLSearchParams(link.hash.slice(1)).get('invitation')!
    assert.isTrue(/^[a-f0-9]{64}$/.test(token))
    assert.isFalse(`${first.stdout}${first.stderr}`.includes(token))
    const fileStats27 = await stat(firstFile)
    assert.equal(fileStats27.mode & 0o777, 0o600)
    assert.equal(link.pathname, '/register')
    assert.equal(link.search, '')
    const invitation28 = await BetaInvitation.findByOrFail('email', 'operator@example.invalid')
    const before = invitation28.tokenHash
    await assert.rejects(() => command('reissue', firstFile))
    const invitation29 = await BetaInvitation.findByOrFail('email', 'operator@example.invalid')
    assert.isTrue(invitation29.tokenHash === before)
    const secondFile = join(privateDirectory, 'second.txt')
    await command('reissue', secondFile)
    assert.isNull(await service.findUsable(BetaInvitationService.hashToken(token)))
    await command('revoke')
    const invitation30 = await BetaInvitation.findByOrFail('email', 'operator@example.invalid')
    assert.isNotNull(invitation30.revokedAt)
    const failedFile = join(privateDirectory, 'failed.txt')
    await assert.rejects(() => command('issue', failedFile))
    await assert.rejects(() => stat(failedFile))
  }).timeout(60000)
})
