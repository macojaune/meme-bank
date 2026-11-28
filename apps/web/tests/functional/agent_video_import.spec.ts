import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import { Queue, QueueEvents, Worker } from 'bullmq'
import User from '#models/user'
import Video from '#models/video'
import VideoTranscription from '#models/video_transcription'
import { processTranscriptionJob } from '#jobs/transcription_job'

type ImportResult = {
  videoId: string
  replayed: boolean
  isPublished: boolean
}

const baseUrl = 'http://127.0.0.1:46388'
const transcript = 'Une transcription de recette importée avec la vidéo synthétique.'
const password = randomUUID()
const redis = { host: '127.0.0.1', port: 46386 }
const objectEndpoint = 'http://127.0.0.1:46387'
const privateBucket = 'memebank-agent-fixture-private'

class WebSession {
  private cookies = new Map<string, string>()
  private version?: string

  async request(
    path: string,
    options: { login?: string; inertia?: boolean; upload?: FormData; post?: boolean; skipCsrf?: boolean } = {}
  ): Promise<Response> {
    const headers = new Headers({
      cookie: Array.from(this.cookies, ([key, value]) => `${key}=${value}`).join('; '),
    })
    if (options.inertia) {
      headers.set('x-inertia', 'true')
      headers.set('accept', 'text/html, application/xhtml+xml')
      if (this.version) headers.set('x-inertia-version', this.version)
    }
    if ((options.login || options.upload || options.post) && !options.skipCsrf) {
      headers.set('x-xsrf-token', decodeURIComponent(this.cookies.get('XSRF-TOKEN') ?? ''))
    }
    if (options.post) headers.set('accept', 'application/json')
    if (options.login) headers.set('content-type', 'application/json')
    const response = await fetch(baseUrl + path, {
      method: options.login || options.upload || options.post ? 'POST' : 'GET',
      headers,
      body: options.login ? JSON.stringify({ email: options.login, password }) : options.upload,
      redirect: 'manual',
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
    if (options.inertia && response.status === 409 && !this.version) {
      this.version = ((await response.json()) as { version: string }).version
      return this.request(path, options)
    }
    return response
  }

  async login(email: string) {
    await this.request('/login', { inertia: true })
    return this.request('/login', { login: email })
  }
}

// This suite runs migrations and leaves fixtures for the disposable services to remove.
test.group('Agent video import — isolated HTTP and queues', (group) => {
  if (process.env.MEMEBANK_AGENT_VIDEO_TESTS !== '1') {
    test('requires disposable PostgreSQL, Redis and MinIO services and a synthetic MP4', () => {}).skip()
    return
  }

  let fixture: Uint8Array<ArrayBuffer>
  let owner: User
  let otherMember: User
  let uploadToken: string
  let publishToken: string
  let otherToken: string
  let unscopedToken: string

  group.setup(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.HOST !== '127.0.0.1' ||
      process.env.PORT !== '46388' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '46385' ||
      process.env.DB_DATABASE !== 'memebank_agent_fixture' ||
      process.env.DB_USER !== 'memebank_fixture' ||
      process.env.REDIS_HOST !== redis.host ||
      process.env.REDIS_PORT !== String(redis.port) ||
      process.env.MINIO_ENDPOINT !== objectEndpoint ||
      process.env.MINIO_BUCKET !== 'memebank-agent-fixture' ||
      process.env.MINIO_PRIVATE_BUCKET !== privateBucket ||
      process.env.R2_ENDPOINT ||
      !process.env.MEMEBANK_AGENT_VIDEO_TEST_FILE
    ) {
      throw new Error('Use the dedicated local fixtures and set MEMEBANK_AGENT_VIDEO_TEST_FILE')
    }
    fixture = Uint8Array.from(await readFile(process.env.MEMEBANK_AGENT_VIDEO_TEST_FILE))
    if (await db.connection().schema.hasTable('users')) {
      throw new Error('The disposable database must start without the users table')
    }
    const migrations = new MigrationRunner(db, app, { direction: 'up' })
    await migrations.run()
    if (migrations.error) throw migrations.error

    owner = await User.create({ email: 'agent-fixture@example.invalid', password })
    otherMember = await User.create({ email: 'other-fixture@example.invalid', password })
    const token = async (user: User, abilities: string[]) => {
      const issued = await User.uploadTokens.create(user, abilities, { expiresIn: '15m' })
      return issued.value!.release()
    }
    uploadToken = await token(owner, ['video:upload'])
    publishToken = await token(owner, ['video:upload', 'video:publish'])
    otherToken = await token(otherMember, ['video:upload'])
    unscopedToken = await token(owner, ['video:publish'])
  })

  async function upload(
    key: string,
    token?: string,
    fields: Record<string, string> = {},
    transport: 'bearer' | 'basic' = 'bearer'
  ) {
    const headers = new Headers({ 'accept': 'application/json', 'idempotency-key': key })
    if (token && transport === 'basic') {
      headers.set(
        'authorization',
        `Basic ${Buffer.from(`fixture:${randomUUID()}`).toString('base64')}`
      )
      headers.set('x-memebank-upload-token', token)
    } else if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    const form = new FormData()
    form.set('video', new Blob([fixture], { type: 'video/mp4' }), 'fixture.mp4')
    for (const [name, value] of Object.entries(fields)) form.set(name, value)
    return fetch(baseUrl + '/api/agent/video-import', {
      method: 'POST',
      headers,
      body: form,
      redirect: 'manual',
    })
  }

  test('rejects invalid credentials and scopes before creating a video', async ({ assert }) => {
    const before = await Video.all()
    for (const token of [undefined, 'invalid-fixture-token']) {
      const denied = await upload(randomUUID(), token)
      assert.equal(denied.status, 401)
    }
    const deniedUpload = await upload(randomUUID(), unscopedToken)
    const deniedPublish = await upload(randomUUID(), uploadToken, { publish: 'true' })
    assert.equal(deniedUpload.status, 403)
    assert.equal(deniedPublish.status, 403)

    const revoked = await User.uploadTokens.create(owner, ['video:upload'])
    await User.uploadTokens.delete(owner, revoked.identifier)
    const deniedRevoked = await upload(randomUUID(), revoked.value!.release())
    assert.equal(deniedRevoked.status, 401)
    const after = await Video.all()
    assert.lengthOf(after, before.length)
  })

  test('issues personal read tokens only from a session with CSRF and rejects crossed scopes', async ({ assert }) => {
    const session = new WebSession()
    await session.request('/login', { inertia: true })
    const route = '/api/raycast/token'
    assert.equal((await session.request(route, { post: true })).status, 401)
    assert.equal((await session.login(owner.email)).headers.get('location'), '/dashboard')
    assert.equal((await session.request(route, { post: true, skipCsrf: true })).status, 403)
    const issued = await session.request(route, { post: true })
    assert.equal(issued.status, 201)
    assert.equal(issued.headers.get('cache-control'), 'private, no-store')
    const { token } = await issued.json() as { token: string }
    const catalog = (value: string) => fetch(baseUrl + '/api/v1/search', {
      headers: { Authorization: 'Bearer ' + value },
    })
    assert.equal((await catalog(token)).status, 200)
    assert.equal((await catalog(uploadToken)).status, 401)
    assert.equal((await upload(randomUUID(), token)).status, 401)
    const row = await db.from('video_upload_tokens')
      .where({ type: 'video_catalog_token', tokenable_id: owner.id })
      .orderBy('id', 'desc').firstOrFail()
    assert.deepEqual(JSON.parse(row.abilities), ['video:read'])
    const tokens = () => db.from('video_upload_tokens').where('id', row.id)
    await tokens().update({ expires_at: new Date(Date.now() - 60000) })
    assert.equal((await catalog(token)).status, 401)
    await tokens().update({ expires_at: row.expires_at })
    assert.equal(await User.uploadTokens.delete(owner, row.id), 0)
    assert.equal(await User.catalogTokens.delete(otherMember, row.id), 0)
    assert.equal((await catalog(token)).status, 200)
    await User.catalogTokens.delete(owner, row.id)
    assert.equal((await catalog(token)).status, 401)
  })

  test('keeps a minimal import private and replays within each account', async ({ assert }) => {
    const key = randomUUID()
    const attempts = await Promise.all([upload(key, uploadToken), upload(key, uploadToken)])
    assert.deepEqual(attempts.map((response) => response.status).sort(), [200, 201])
    const created = attempts.find((response) => response.status === 201)!
    const simultaneousReplay = attempts.find((response) => response.status === 200)!
    const saved = (await created.json()) as ImportResult
    assert.deepEqual(saved, {
      videoId: saved.videoId,
      replayed: false,
      isPublished: false,
    })
    assert.deepEqual(await simultaneousReplay.json(), { ...saved, replayed: true })

    const replay = await upload(key, uploadToken, {}, 'basic')
    assert.equal(replay.status, 200)
    assert.deepEqual(await replay.json(), { ...saved, replayed: true })
    const collision = await upload(key, uploadToken, { title: 'Different title' })
    assert.equal(collision.status, 409)

    const other = await upload(key, otherToken)
    assert.equal(other.status, 201)
    const otherVideo = (await other.json()) as ImportResult
    assert.notEqual(otherVideo.videoId, saved.videoId)
    const otherSaved = await Video.findOrFail(otherVideo.videoId)
    assert.equal(otherSaved.userId, otherMember.id)

    const video = await Video.findOrFail(saved.videoId)
    assert.equal(video.userId, owner.id)
    assert.equal(video.title, '')
    assert.equal(await VideoTranscription.query().where('videoId', video.id).first(), null)
    const uploadPoints = await db.from('points_history').where({
      user_id: owner.id,
      reason: 'upload',
      reference_id: video.id,
    })
    assert.lengthOf(uploadPoints, 1)
    const anonymousObject = await fetch(`${objectEndpoint}/${privateBucket}/${video.filePath}`)
    assert.equal(anonymousObject.status, 403)
    await anonymousObject.body?.cancel()

    const ownerWeb = new WebSession()
    const otherWeb = new WebSession()
    const ownerLogin = await ownerWeb.login(owner.email)
    const otherLogin = await otherWeb.login(otherMember.email)
    assert.equal(ownerLogin.headers.get('location'), '/dashboard')
    assert.equal(otherLogin.headers.get('location'), '/dashboard')
    for (const [web, visible] of [
      [ownerWeb, true],
      [otherWeb, false],
    ] as const) {
      const gallery = await web.request('/gallery', { inertia: true })
      assert.equal(gallery.status, 200)
      const page = (await gallery.json()) as { props: { videos: { data: { id: string }[] } } }
      assert.equal(
        page.props.videos.data.some((entry) => entry.id === video.id),
        visible
      )
    }
    const ownerStatus = await ownerWeb.request(`/api/v1/videos/${video.id}/status`)
    assert.equal(ownerStatus.status, 200)
    assert.include(((await ownerStatus.json()) as { data: object }).data, {
      isPublished: false,
      hasThumbnail: false,
      hasTranscription: false,
      isComplete: true,
    })
    const ownerStream = await ownerWeb.request(`/videos/stream/${video.id}`)
    assert.equal(ownerStream.status, 200)
    assert.deepEqual(new Uint8Array(await ownerStream.arrayBuffer()), fixture)
    const denied = await otherWeb.request(`/videos/stream/${video.id}`)
    assert.include([403, 404], denied.status)
    const anonymousMedia = await fetch(baseUrl + `/api/v1/videos/${video.id}/media`)
    assert.equal(anonymousMedia.status, 401)
    assert.equal((await fetch(baseUrl + `/preview/${video.id}/media`)).status, 404)
    const recent = await otherWeb.request(`/api/v1/search?videoIds=${video.id}`)
    assert.equal(recent.status, 200)
    assert.deepEqual(((await recent.json()) as { data: unknown[] }).data, [])
  })

  test('publishes with scope and preserves the imported transcription through a worker job', async ({
    assert,
  }) => {
    const created = await upload(randomUUID(), publishToken, {
      title: 'Recette publication',
      transcript,
      publish: 'true',
    })
    assert.equal(created.status, 201)
    const { videoId, replayed, isPublished } = (await created.json()) as ImportResult
    assert.isFalse(replayed)
    assert.isTrue(isPublished)
    const video = await Video.findOrFail(videoId)
    assert.isTrue(video.isPublished)

    const thumbnails = new Queue('video-processing', { connection: redis })
    try {
      assert.isUndefined(await thumbnails.getJob(`upload-${videoId}`))
    } finally {
      await thumbnails.close()
    }

    const queue = new Queue('transcription', { connection: redis })
    const events = new QueueEvents('transcription', { connection: redis })
    const worker = new Worker('transcription', processTranscriptionJob, { connection: redis })
    try {
      await events.waitUntilReady()
      const job = await queue.add('transcription', { videoId, filePath: video.filePath })
      const outcome = await job.waitUntilFinished(events, 5000)
      assert.isTrue(outcome.success)
      assert.isTrue(outcome.data.skipped)
      const rows = await VideoTranscription.query().where('videoId', videoId)
      assert.lengthOf(rows, 1)
      assert.equal(rows[0].transcriptionText, transcript)
      assert.equal(rows[0].status, 'imported')
      assert.equal(rows[0].correctedByUserId, owner.id)
      assert.isTrue(rows[0].isCurrent)
    } finally {
      await Promise.all([worker.close(), events.close(), queue.close()])
    }

    const preview = await fetch(baseUrl + `/preview/${videoId}/media`, { headers: { range: 'bytes=0-15' } })
    assert.equal(preview.status, 206)
    assert.equal(preview.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(new Uint8Array(await preview.arrayBuffer()), fixture.subarray(0, 16))

    const member = new WebSession()
    assert.equal((await member.login(otherMember.email)).headers.get('location'), '/dashboard')
    for (const path of ['/search', '/videos', `/videos/${videoId}/media`, `/videos/${videoId}/transcription`]) {
      assert.equal((await fetch(baseUrl + '/api/v1' + path)).status, 401)
    }
    const media = await member.request(`/api/v1/videos/${videoId}/media`)
    assert.equal(media.status, 200)
    assert.deepEqual(new Uint8Array(await media.arrayBuffer()), fixture)
    const publicList = await member.request('/api/v1/search?q=Recette%20publication')
    assert.equal(publicList.status, 200)
    const { data } = (await publicList.json()) as { data: { id: string }[] }
    assert.isTrue(data.some((entry) => entry.id === videoId))

    const recent = await member.request(`/api/v1/search?videoIds=${randomUUID()},${videoId}`)
    assert.equal(recent.status, 200)
    const recentRows = (await recent.json()) as { data: { id: string }[] }
    assert.deepEqual(recentRows.data.map((row) => row.id), [videoId])
    const unknown = await member.request(`/api/v1/search?videoIds=${randomUUID()}`)
    assert.deepEqual(((await unknown.json()) as { data: unknown[] }).data, [])
    const invalid = await member.request('/api/v1/search?videoIds=invalid')
    assert.equal(invalid.status, 400)

    const current = await member.request(`/api/v1/videos/${videoId}/transcription`)
    assert.equal(current.status, 200)
    const body = (await current.json()) as { data: { text: string } }
    assert.equal(body.data.text, transcript)
  })

  test('enforces separate file and multipart ceilings', async ({ assert }) => {
    async function sendVideo(size: number) {
      const content = new Uint8Array(size)
      content.set(fixture)
      const form = new FormData()
      form.set('video', new Blob([content], { type: 'video/mp4' }), 'limit.mp4')
      return fetch(baseUrl + '/api/agent/video-import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${uploadToken}`, 'Idempotency-Key': randomUUID() },
        body: form,
      })
    }
    const ceiling = 50 * 1024 * 1024
    const accepted = await sendVideo(ceiling - 1)
    assert.equal(accepted.status, 201)
    await accepted.body?.cancel()

    const oversizedFile = await sendVideo(ceiling + 1)
    assert.equal(oversizedFile.status, 400)
    const result = (await oversizedFile.json()) as { error: string }
    assert.equal(result.error, 'invalid_video')

    const oversizedRequest = await sendVideo(52 * 1024 * 1024 + 1)
    assert.equal(oversizedRequest.status, 413)
    await oversizedRequest.body?.cancel()
  })

  test('keeps the existing web form upload and its automatic transcription job', async ({
    assert,
  }) => {
    const web = new WebSession()
    const login = await web.login(owner.email)
    assert.equal(login.headers.get('location'), '/dashboard')
    const form = new FormData()
    form.set('video', new Blob([fixture], { type: 'video/mp4' }), 'fixture.mp4')
    form.set('title', 'Recette formulaire web')
    const uploadResponse = await web.request('/videos/upload', { upload: form })
    assert.equal(uploadResponse.status, 302)
    assert.equal(uploadResponse.headers.get('location'), '/gallery')

    const video = await Video.query()
      .where({ userId: owner.id, title: 'Recette formulaire web' })
      .firstOrFail()
    assert.isFalse(video.isPublished)
    assert.isFalse(video.skipAutoTranscription)
    const queue = new Queue('transcription', { connection: redis })
    try {
      const waiting = await queue.getJobs(['waiting'])
      assert.isTrue(waiting.some((job) => job.data.videoId === video.id))
    } finally {
      await queue.close()
    }
  })
})
