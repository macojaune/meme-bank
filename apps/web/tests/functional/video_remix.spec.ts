import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import Video from '#models/video'
import VideoTranscription, { TranscriptionStatus } from '#models/video_transcription'
import { videoDisk } from '#services/video_storage'

const origin = 'http://127.0.0.1:46398'
const objectEndpoint = 'http://127.0.0.1:46397'
const publicBucket = 'memebank-remix-fixture'
const privateBucket = 'memebank-remix-fixture-private'
const password = randomUUID()

type Remix = {
  id: string
  status: 'queued' | 'processing' | 'ready' | 'failed'
  videoId: string | null
  error: string | null
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  payload?: object
  key?: string
  skipCsrf?: boolean
}

class Session {
  private cookies = new Map<string, string>()

  async request(path: string, options: RequestOptions = {}) {
    const headers = new Headers({
      accept: 'application/json',
      cookie: [...this.cookies].map(([key, value]) => key + '=' + value).join('; '),
    })
    if (options.method === 'POST' && !options.skipCsrf) {
      headers.set('x-xsrf-token', decodeURIComponent(this.cookies.get('XSRF-TOKEN') ?? ''))
    }
    if (options.key) headers.set('idempotency-key', options.key)
    if (options.payload) headers.set('content-type', 'application/json')
    const response = await fetch(origin + path, {
      headers,
      method: options.method,
      body: JSON.stringify(options.payload),
      redirect: 'manual',
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
    return response
  }

  async login(user: User) {
    await this.request('/login')
    const response = await this.request('/login', {
      method: 'POST',
      payload: { email: user.email, password },
    })
    if (response.headers.get('location') !== '/dashboard') throw new Error('Fixture login failed')
  }

  submit(source: Video, payload: object, key = randomUUID()) {
    return this.request('/api/v1/videos/' + source.id + '/remixes', {
      method: 'POST',
      key,
      payload,
    })
  }

  status(id: string) {
    return this.request('/api/v1/remixes/' + id)
  }
}

// Decode one pixel per frame to prove the clips contain the selected shots.
function colors(bytes: Buffer) {
  const raw = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      'pipe:0',
      '-vf',
      'scale=1:1',
      '-pix_fmt',
      'rgb24',
      '-an',
      '-f',
      'rawvideo',
      'pipe:1',
    ],
    { input: bytes, timeout: 10_000 }
  )
  return Array.from({ length: raw.length / 3 }, (_, i) => {
    const red = raw[i * 3]
    const blue = raw[i * 3 + 2]
    return red > blue + 100 ? 'red' : blue > red + 100 ? 'blue' : 'unknown'
  })
}

async function inspectStreams(bytes: Buffer, path: string) {
  await writeFile(path, bytes, { flag: 'wx' })
  return JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name,duration',
        '-of',
        'json',
        path,
      ],
      { timeout: 10_000, encoding: 'utf8' }
    )
  ) as {
    streams: { codec_type: string; codec_name: string; duration: string }[]
  }
}

test.group('Meme remixes — isolated HTTP, storage and worker', (group) => {
  if (process.env.MEMEBANK_REMIX_TESTS !== '1') {
    test('requires the disposable services from tests/scripts/run-video-remix.sh').skip()
    return
  }

  let originalBytes: Buffer
  let fixtureDir: string
  let source: Video
  let privateSource: Video
  let member: User
  const ownerSession = new Session()
  const memberSession = new Session()
  const guest = new Session()
  let worker: ChildProcess
  let workerLog = ''

  async function waitFor(id: string, target: Remix['status'], session = memberSession) {
    for (let i = 0; i < 120; i++) {
      const response = await session.status(id)
      if (!response.ok) throw new Error('Remix status HTTP ' + response.status)
      const state = (await response.json()) as Remix
      if (state.status === target) return state
      if (state.status === 'failed')
        throw new Error('Remix worker failed: ' + state.error + '\n' + workerLog)
      if (worker.exitCode !== null) throw new Error('Remix worker exited: ' + workerLog)
      await sleep(250)
    }
    throw new Error('Remix worker timeout: ' + workerLog)
  }

  group.setup(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.HOST !== '127.0.0.1' ||
      process.env.PORT !== '46398' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '46395' ||
      process.env.DB_DATABASE !== 'memebank_remix_fixture' ||
      process.env.DB_USER !== 'memebank_remix_fixture' ||
      process.env.REDIS_HOST !== '127.0.0.1' ||
      process.env.REDIS_PORT !== '46396' ||
      process.env.MINIO_ENDPOINT !== objectEndpoint ||
      process.env.MINIO_BUCKET !== publicBucket ||
      process.env.MINIO_PRIVATE_BUCKET !== privateBucket ||
      process.env.R2_ENDPOINT ||
      !process.env.MEMEBANK_REMIX_TEST_FILE ||
      (await db.connection().schema.hasTable('users'))
    ) {
      throw new Error('Run tests/scripts/run-video-remix.sh with fresh disposable services')
    }
    const sourceFile = process.env.MEMEBANK_REMIX_TEST_FILE
    originalBytes = await readFile(sourceFile)
    fixtureDir = dirname(sourceFile)
    const migrations = new MigrationRunner(db, app, { direction: 'up' })
    await migrations.run()
    if (migrations.error) throw migrations.error
    const s3 = new S3Client({
      endpoint: objectEndpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
    })
    try {
      for (const Bucket of [publicBucket, privateBucket])
        await s3.send(new CreateBucketCommand({ Bucket }))
    } finally {
      s3.destroy()
    }
    const owner = await User.create({
      fullName: 'Recette source',
      email: 'remix-source@example.invalid',
      password,
    })
    member = await User.create({
      fullName: 'Recette extrait',
      email: 'remix-member@example.invalid',
      password,
    })
    const filePath = 'test-fixtures/remix-source.mp4'
    await videoDisk(false).put(filePath, originalBytes, { contentType: 'video/mp4' })
    await videoDisk(true).put(filePath, originalBytes, { contentType: 'video/mp4' })
    const original = {
      userId: owner.id,
      filePath,
      title: 'Deux répliques',
      region: 'guadeloupe',
      uploadDate: DateTime.now(),
      durationSeconds: 0,
    }
    source = await Video.create({ ...original, isPublished: true, skipAutoTranscription: false })
    privateSource = await Video.create({
      ...original,
      isPublished: false,
      skipAutoTranscription: true,
    })
    await VideoTranscription.create({
      videoId: source.id,
      revisionNumber: 1,
      status: TranscriptionStatus.IMPORTED,
      transcriptionText: 'Première puis deuxième réplique.',
      language: 'fr',
      isCurrent: true,
      pointsAwarded: 0,
      generatedAt: DateTime.now(),
    })
    await Promise.all([
      ownerSession.login(owner),
      memberSession.login(member),
      guest.request('/login'),
    ])
    worker = spawn(process.execPath, ['ace', 'queue:work', 'remix'], { cwd: app.makePath() })
    worker.stdout?.on('data', (data) => {
      workerLog = (workerLog + data).slice(-5000)
    })
    worker.stderr?.on('data', (data) => {
      workerLog = (workerLog + data).slice(-5000)
    })
  })

  group.teardown(async () => {
    if (!worker || worker.exitCode !== null) return
    const closed = once(worker, 'close')
    worker.kill('SIGTERM')
    await Promise.race([closed, sleep(3_000, undefined, { ref: false })])
    if (worker.exitCode === null && worker.signalCode === null) {
      worker.kill('SIGKILL')
      await closed
    }
  })

  test('refuses crossed accounts and invalid bounds or missing CSRF', async ({ assert }) => {
    const payload = { startMs: 350, endMs: 1190, title: 'Première réplique' }
    const privateAttempt = await memberSession.submit(privateSource, payload)
    assert.equal(privateAttempt.status, 404, await privateAttempt.clone().text())
    const anonymous = await guest.submit(source, payload)
    assert.equal(anonymous.status, 401, await anonymous.clone().text())
    const withoutCsrf = await memberSession.request('/api/v1/videos/' + source.id + '/remixes', {
      method: 'POST',
      payload,
      key: randomUUID(),
      skipCsrf: true,
    })
    assert.include([302, 419], withoutCsrf.status)
    const reversedBounds = await memberSession.submit(source, {
      ...payload,
      startMs: 2500,
      endMs: 1000,
    })
    const tooLong = await memberSession.submit(source, { ...payload, endMs: 70_000 })
    assert.equal(reversedBounds.status, 422)
    assert.equal(tooLong.status, 422)
    assert.lengthOf(await db.from('video_remixes'), 0)
  })

  test('creates two distinct private clips then lets only their owner publish', async ({
    assert,
  }) => {
    const first = { startMs: 350, endMs: 1190, title: 'Première réplique' }
    const second = { startMs: 2350, endMs: 3270, title: 'Deuxième réplique' }
    const key = randomUUID()
    const [created, replay, other] = await Promise.all([
      memberSession.submit(source, first, key),
      memberSession.submit(source, first, key),
      memberSession.submit(source, second),
    ])
    for (const response of [created, replay, other]) {
      assert.equal(response.status, 202, await response.clone().text())
    }
    const [one, duplicate, two] = (await Promise.all([
      created.json(),
      replay.json(),
      other.json(),
    ])) as Remix[]
    assert.equal(duplicate.id, one.id)
    assert.notEqual(one.id, two.id)
    const collision = await memberSession.submit(source, { ...first, title: 'Collision' }, key)
    const crossedStatus = await ownerSession.status(one.id)
    const guestStatus = await guest.status(one.id)
    assert.equal(collision.status, 409)
    assert.equal(crossedStatus.status, 404)
    assert.equal(guestStatus.status, 401)
    const [a, b] = await Promise.all([waitFor(one.id, 'ready'), waitFor(two.id, 'ready')])
    assert.isString(a.videoId)
    assert.isString(b.videoId)
    assert.notEqual(a.videoId, b.videoId)
    assert.lengthOf(await db.from('video_remixes').where('requester_id', member.id), 2)
    assert.lengthOf(await Video.query().where('user_id', member.id), 2)
    const existing = await memberSession.submit(source, first, key)
    assert.equal(((await existing.json()) as Remix).videoId, a.videoId)
    assert.sameMembers([...new Set(colors(originalBytes))], ['red', 'blue'])

    const clips = [
      { id: a.videoId!, selection: first, expectedColor: 'red' },
      { id: b.videoId!, selection: second, expectedColor: 'blue' },
    ]
    for (const { id, selection, expectedColor } of clips) {
      const video = await Video.findOrFail(id)
      assert.equal(video.userId, member.id)
      assert.equal(video.title, selection.title)
      assert.isFalse(video.isPublished)
      assert.isTrue(video.skipAutoTranscription)
      assert.isNull(video.region)
      assert.equal(video.remixedFromVideoId, source.id)
      assert.lengthOf(await VideoTranscription.query().where('video_id', id), 0)
      const path = '/api/v1/videos/' + id
      const crossedDetails = await ownerSession.request(path + '/details')
      const crossedMedia = await ownerSession.request(path + '/media')
      assert.equal(crossedDetails.status, 404)
      assert.equal(crossedMedia.status, 404)
      const draft = await memberSession.request(path + '/details')
      assert.equal(draft.status, 200)
      assert.deepEqual(((await draft.json()) as { source: object }).source, {
        id: source.id,
        title: source.title,
      })
      const stored = await memberSession.request(path + '/media')
      assert.equal(stored.status, 200)
      assert.equal(stored.headers.get('content-type'), 'video/mp4')
      const bytes = Buffer.from(await stored.arrayBuffer())
      assert.isFalse(bytes.equals(originalBytes))
      const decodedColors = colors(bytes)
      assert.isAbove(decodedColors.length, 12)
      assert.deepEqual([...new Set(decodedColors)], [expectedColor])
      const { streams } = await inspectStreams(bytes, join(fixtureDir, id + '.mp4'))
      assert.isTrue(
        streams.some(({ codec_type, codec_name }) => codec_type === 'audio' && codec_name === 'aac')
      )
      const duration = Number(streams.find(({ codec_type }) => codec_type === 'video')?.duration)
      assert.closeTo(duration, (selection.endMs - selection.startMs) / 1000, 0.1)
      const raw = await fetch(objectEndpoint + '/' + privateBucket + '/' + video.filePath)
      assert.isFalse(raw.ok)
    }
    assert.isTrue(originalBytes.equals(await videoDisk(false).getBytes(source.filePath)))
    const preserved = await Video.findOrFail(source.id)
    const originalTranscript = await VideoTranscription.query()
      .where('video_id', source.id)
      .firstOrFail()
    assert.equal(preserved.title, 'Deux répliques')
    assert.equal(originalTranscript.transcriptionText, 'Première puis deuxième réplique.')

    const route = '/videos/' + a.videoId + '/publish'
    const crossedPublication = await ownerSession.request(route, { method: 'POST' })
    assert.equal(crossedPublication.status, 403)
    const published = await memberSession.request(route, { method: 'POST' })
    assert.equal(published.headers.get('location'), '/dashboard')
    const publicClip = await Video.findOrFail(a.videoId!)
    const privateClip = await Video.findOrFail(b.videoId!)
    assert.isTrue(publicClip.isPublished)
    assert.isFalse(privateClip.isPublished)
    const open = await ownerSession.request('/api/v1/videos/' + a.videoId + '/media')
    assert.equal(open.status, 200)
    assert.deepEqual([...new Set(colors(Buffer.from(await open.arrayBuffer())))], ['red'])

    await source.merge({ isPublished: false }).save()
    const hidden = await memberSession.request('/api/v1/videos/' + a.videoId + '/details')
    assert.isNull(((await hidden.json()) as { source: object | null }).source)
    await source.delete()
    const withoutSource = await Video.findOrFail(a.videoId!)
    assert.isNull(withoutSource.remixedFromVideoId)
    assert.isTrue(withoutSource.isPublished)
  }).timeout(60_000)

  test('rejects bounds beyond the stored media duration without creating a video', async ({
    assert,
  }) => {
    const accepted = await ownerSession.submit(privateSource, {
      startMs: 4100,
      endMs: 4800,
      title: 'Hors de la vidéo',
    })
    assert.equal(accepted.status, 202, await accepted.clone().text())
    const { id } = (await accepted.json()) as Remix
    const failed = await waitFor(id, 'failed', ownerSession)
    assert.isNull(failed.videoId)
    assert.include(failed.error, 'dépasse la durée')
    assert.lengthOf(await Video.query().where('user_id', privateSource.userId), 1)
  }).timeout(60_000)
})
