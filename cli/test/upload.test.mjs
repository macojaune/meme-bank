import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const videoId = '93c4bd71-0fc7-45b9-8bff-05d2862c381d'
const bytes = Buffer.from('synthetic video upload fixture')
const cli = fileURLToPath(new URL('../upload.mjs', import.meta.url))
const transport = new URL('../fixtures/transport.mjs', import.meta.url)
const htmlSecret = 'must-not-appear-in-errors'
const uploads = []
const sources = []
const results = new Set()
let folder
let video
let origin
let server

before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'memebank-cli-test-'))
  video = join(folder, 'recette.mp4')
  await writeFile(video, bytes)
  server = createServer(async (request, response) => {
    if (request.url.startsWith('/source/')) {
      sources.push(request.headers)
      if (request.url === '/source/redirect') {
        response.writeHead(302, { Location: '/source/file' }).end()
      } else if (request.url === '/source/private') {
        response.writeHead(302, { Location: 'http://127.0.0.1/secret' }).end()
      } else if (request.url === '/source/large') {
        response.writeHead(200, { 'Content-Type': 'video/mp4' })
        response.write(Buffer.alloc(10 * 1024 * 1024))
        response.end('x')
      } else if (request.url === '/source/html') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(htmlSecret)
      } else {
        response.writeHead(200, { 'Content-Type': 'video/mp4' }).end(bytes)
      }
      return
    }
    if (request.url !== '/api/agent/video-import') {
      response.writeHead(404).end()
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = new Response(Buffer.concat(chunks), { headers: request.headers })
    const form = await body.formData()
    const file = form.get('video')
    const key = request.headers['idempotency-key']
    uploads.push({
      headers: request.headers,
      key,
      form,
      bytes: Buffer.from(await file.arrayBuffer()),
    })
    switch (key) {
      case 'deny':
        response.writeHead(403).end(htmlSecret)
        return
      case 'redirect':
        response.writeHead(307, { Location: '/source/file' }).end()
        return
    }
    const replayed = results.has(key)
    results.add(key)
    response.writeHead(replayed ? 200 : 201, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({
        videoId,
        replayed,
        isPublished: form.get('publish') === 'true',
        ...(key === 'queue-down' ? { processingQueued: false, secret: htmlSecret } : {}),
      })
    )
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  uploads.length = 0
  sources.length = 0
  results.clear()
})

after(async () => {
  if (server?.listening) {
    server.close()
    await once(server, 'close')
  }
  if (folder) await rm(folder, { recursive: true, force: true })
})

function run(args, env = {}, intercept = false) {
  const config = {
    ...process.env,
    MEMEBANK_URL: origin,
    MEMEBANK_UPLOAD_TOKEN: 'fixture-upload-token',
    MEMEBANK_DEV_BASIC_AUTH: '',
    ...env,
  }
  if (intercept) {
    config.NODE_OPTIONS = `--import=${transport.href}`
    config.MEMEBANK_TEST_ORIGIN = origin
  }
  const command = config.MEMEBANK_TEST_BIN ?? process.execPath
  const argv = config.MEMEBANK_TEST_BIN ? args : [cli, ...args]
  return exec(command, argv, { env: config, timeout: 6000 })
}

async function expectError(args, code, env, intercept) {
  await assert.rejects(run(args, env, intercept), (failure) => {
    assert.equal(failure.code, 1)
    assert.equal(failure.stdout, '')
    assert.equal(JSON.parse(failure.stderr).error.code, code)
    assert.doesNotMatch(failure.stderr, /fixture-upload-token|must-not-appear-in-errors/)
    return true
  })
}

test('le fichier minimal arrive intact et la clé reste stable à la relance', async () => {
  const { stdout, stderr } = await run([video])
  const first = uploads.at(-1)
  assert.equal(stderr, '')
  assert.deepEqual(JSON.parse(stdout), { videoId, replayed: false, isPublished: false })
  assert.equal(first.headers.authorization, 'Bearer fixture-upload-token')
  assert.match(first.key, /^[a-f0-9]{64}$/)
  assert.deepEqual(first.bytes, bytes)
  assert.deepEqual([...first.form.keys()], ['video'])
  assert.equal(first.form.get('video').name, 'recette.mp4')
  assert.equal(first.form.get('video').type, 'video/mp4')

  const replay = await run([video])
  assert.equal(uploads.at(-1).key, first.key)
  assert.equal(JSON.parse(replay.stdout).replayed, true)
})

test('le titre et la transcription UTF-8 changent la clé et gardent l’import privé', async () => {
  await run([video])
  const transcript = join(folder, 'transcription.txt')
  await writeFile(transcript, 'An nou ay.\nKréyòl.')
  const { stdout } = await run([video, '--name', 'Titre créole', '--transcript-file', transcript])
  const attempt = uploads.at(-1)
  assert.equal(attempt.form.get('title'), 'Titre créole')
  assert.equal(attempt.form.get('transcript').replaceAll('\r\n', '\n'), 'An nou ay.\nKréyòl.')
  assert.equal(attempt.form.has('publish'), false)
  assert.notEqual(attempt.key, uploads[0].key)
  assert.equal(JSON.parse(stdout).isPublished, false)
  const inline = await run([
    video,
    '--title',
    'Titre créole',
    '--transcript',
    'An nou ay.\r\nKréyòl.',
  ])
  assert.equal(attempt.key, uploads.at(-1).key)
  assert.equal(JSON.parse(inline.stdout).replayed, true)
})

test('la publication sans transcription et la clé personnalisée sont explicites', async () => {
  const { stdout } = await run([video, '--publish', '--idempotency-key', 'approval-42'])
  const attempt = uploads.at(-1)
  assert.equal(attempt.key, 'approval-42')
  assert.equal(attempt.form.get('publish'), 'true')
  assert.equal(attempt.form.has('transcript'), false)
  assert.equal(JSON.parse(stdout).isPublished, true)
  await expectError([video, '--publish', '--idempotency-key', 'deny'], 'FORBIDDEN')
})

test('le mode DEV sépare les identifiants ingress et le jeton applicatif', async () => {
  const env = {
    MEMEBANK_URL: 'https://memebank-dev.marvinl.com',
    MEMEBANK_DEV_BASIC_AUTH: 'fixture-user:fixture-password',
  }
  await run([video], env, true)
  const { headers } = uploads.at(-1)
  assert.equal(
    headers.authorization,
    'Basic ' + Buffer.from(env.MEMEBANK_DEV_BASIC_AUTH).toString('base64')
  )
  assert.equal(headers['x-memebank-upload-token'], 'fixture-upload-token')
  await expectError([video], 'INVALID_DEV_AUTH', { ...env, MEMEBANK_URL: origin })
})

test('le lien direct télécharge avant l’envoi et les requêtes source restent anonymes', async () => {
  await run([video])
  const { stdout } = await run(['http://93.184.215.14/source/redirect'], {}, true)
  assert.deepEqual(uploads.at(-1).bytes, bytes)
  assert.equal(uploads.at(-1).key, uploads[0].key)
  assert.deepEqual(JSON.parse(stdout), { videoId, replayed: true, isPublished: false })
  assert.equal(sources.length, 2)
  for (const headers of sources) {
    assert.equal(headers.authorization, undefined)
    assert.equal(headers['x-memebank-upload-token'], undefined)
    assert.equal(headers['idempotency-key'], undefined)
    assert.equal(headers.cookie, undefined)
  }
})

test('une adresse privée, une redirection privée, une page HTML ou un flux trop gros bloquent l’import', async () => {
  const count = uploads.length
  await expectError(['http://127.0.0.1/secret'], 'SOURCE_ADDRESS_BLOCKED')
  await expectError(['http://localhost/secret'], 'SOURCE_ADDRESS_BLOCKED')
  await expectError(['http://[::ffff:127.0.0.1]/secret'], 'SOURCE_ADDRESS_BLOCKED')
  await expectError(['http://93.184.215.14/source/private'], 'SOURCE_ADDRESS_BLOCKED', {}, true)
  await expectError(['http://93.184.215.14/source/html'], 'UNSUPPORTED_SOURCE', {}, true)
  await expectError(['http://93.184.215.14/source/large'], 'SOURCE_TOO_LARGE', {}, true)
  assert.equal(uploads.length, count)
})

test('les redirections MemeBank ne transmettent aucun en-tête à leur destination', async () => {
  const count = sources.length
  await expectError([video, '--idempotency-key', 'redirect'], 'UPLOAD_REDIRECT')
  assert.equal(sources.length, count)
})

test('un défaut de mise en file est visible sans relayer les champs inconnus', async () => {
  const { stdout } = await run([video, '--idempotency-key', 'queue-down'])
  assert.deepEqual(JSON.parse(stdout), {
    videoId,
    replayed: false,
    isPublished: false,
    processingQueued: false,
  })
})

test('les limites locales et un fichier de transcription non UTF-8 bloquent l’envoi', async () => {
  const count = uploads.length
  const large = join(folder, 'large.mp4')
  const transcript = join(folder, 'bad.txt')
  await writeFile(large, '')
  await truncate(large, 10 * 1024 * 1024 + 1)
  await writeFile(transcript, Buffer.from([0xff]))
  await expectError([large], 'FILE_TOO_LARGE')
  await expectError([video, '--transcript-file', transcript], 'INVALID_TRANSCRIPT')
  await expectError([video, '--title', 'x'.repeat(256)], 'INVALID_TITLE')
  await expectError([video, '--title', 'Titre', '--name', 'Nom'], 'INVALID_ARGUMENTS')
  await expectError([video, '--idempotency-key', 'invalid:key'], 'INVALID_IDEMPOTENCY_KEY')
  await writeFile(transcript, 'x\n'.repeat(25_000))
  await expectError([video, '--transcript-file', transcript], 'INVALID_TRANSCRIPT')
  assert.equal(uploads.length, count)
})
