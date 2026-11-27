import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
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
const htmlSecret = randomUUID()
const testToken = randomUUID()
const uploads = []
const sources = []
const commonsRequests = []
const pageRequests = []
const commonsPage = 'https://commons.wikimedia.org/wiki/File:'
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
    const url = new URL(request.url, 'http://fixture.test')
    if (url.pathname === '/w/api.php') {
      commonsRequests.push({ url, headers: request.headers })
      const title = url.searchParams.get('titles')
      if (title === 'File:OversizedMetadata.webm') {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(' '.repeat(65537))
        return
      }
      const file = {
        mediatype: 'VIDEO',
        mime: 'video/webm',
        url: 'https://upload.wikimedia.org/wikipedia/commons/fixture.webm',
        size: bytes.length,
      }
      if (title === 'File:Missing.webm') file.mediatype = 'UNKNOWN'
      if (title === 'File:Large.webm') file.size = 11 * 1024 * 1024
      if (title === 'File:Truncated.webm') file.size++
      if (title === 'File:Unexpected.webm') file.url = 'https://fixtures.invalid/other.webm'
      if (title === 'File:Redirected.webm')
        file.url = 'https://upload.wikimedia.org/wikipedia/commons/redirect.webm'
      response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ query: { pages: [{ ns: 6, imageinfo: [file] }] } }))
      return
    }
    if (url.pathname.startsWith('/wikipedia/commons/')) {
      commonsRequests.push({ url, headers: request.headers })
      if (url.pathname.endsWith('redirect.webm')) {
        response.writeHead(302, { Location: 'https://commons.wikimedia.org/moved.webm' }).end()
      } else {
        response.writeHead(200, { 'Content-Type': 'video/webm' }).end(bytes)
      }
      return
    }
    if (url.pathname.startsWith('/page/')) {
      pageRequests.push({ url, headers: request.headers })
      const html = (body) => response.writeHead(200, { 'Content-Type': 'text/html' }).end(body)
      const redirect = (location) => response.writeHead(302, { Location: location }).end()
      const media = () => response.writeHead(200, { 'Content-Type': 'video/mp4' }).end(bytes)
      const paths = url.pathname.split('/')
      switch (url.pathname) {
        case '/page/moved':
          return redirect('/page/sub/watch')
        case '/page/sub/watch':
          return html(
            '<base href="http://127.0.0.1/"><video><source src="live.m3u8" type="application/vnd.apple.mpegurl">' +
              '<source src="clip?one=1&amp;two=2" type="Video/MP4; codecs=avc1"></video>'
          )
        case '/page/sub/clip':
          return media()
        case '/page/embed-only':
          return html(
            '<iframe src="/page/inner"></iframe><script>const fake = "<video src=/page/inner>"</script>' +
              '<!-- <video src="/page/inner"> --><template><video src="/page/inner"></video></template>' +
              '<noscript><video src="/page/inner"></video></noscript>'
          )
        case '/page/inner':
          return media()
        case '/page/big':
          return html(' '.repeat(512 * 1024 + 1))
        case '/page/private':
          return html('<video src="http://127.0.0.1/secret"></video>')
        case '/page/downgrade':
          return html('<video src="http://93.184.215.14/page/inner"></video>')
        case '/page/media-redirect':
          return html('<video src="/page/outside"></video>')
        case '/page/outside':
          return redirect('http://127.0.0.1/secret')
        case '/page/not-video':
          return html('<video src="/page/embed-only"></video>')
        case '/page/octet-stream':
          return html('<video src="/page/media.mp4"></video>')
        case '/page/media.mp4':
          return response.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(bytes)
        case '/page/large-media':
          return html('<video src="/page/oversize"></video>')
        case '/page/oversize':
          response.writeHead(200, { 'Content-Type': 'video/mp4' })
          response.write(Buffer.alloc(10 * 1024 * 1024))
          return response.end('x')
      }
      if (paths[2] === 'budget') {
        return paths[3] === '4'
          ? html('<video src="/page/chain/0"></video>')
          : redirect('/page/budget/' + (Number(paths[3]) + 1))
      }
      if (paths[2] === 'chain') {
        return paths[3] === '2' ? media() : redirect('/page/chain/' + (Number(paths[3]) + 1))
      }
    }
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
  commonsRequests.length = 0
  pageRequests.length = 0
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
    MEMEBANK_UPLOAD_TOKEN: testToken,
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
    assert.equal(failure.stderr.includes(testToken), false)
    assert.equal(failure.stderr.includes(htmlSecret), false)
    return true
  })
}

test('le fichier minimal arrive intact et la clé reste stable à la relance', async () => {
  const { stdout, stderr } = await run([video])
  const first = uploads.at(-1)
  assert.equal(stderr, '')
  assert.deepEqual(JSON.parse(stdout), { videoId, replayed: false, isPublished: false })
  assert.equal(first.headers.authorization, `Bearer ${testToken}`)
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
    MEMEBANK_DEV_BASIC_AUTH: `fixture:${randomUUID()}`,
  }
  await run([video], env, true)
  const { headers } = uploads.at(-1)
  assert.equal(
    headers.authorization,
    'Basic ' + Buffer.from(env.MEMEBANK_DEV_BASIC_AUTH).toString('base64')
  )
  assert.equal(headers['x-memebank-upload-token'], testToken)
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
  await expectError(['http://93.184.215.14/source/html'], 'PAGE_VIDEO_UNAVAILABLE', {}, true)
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

test('une fiche Wikimedia Commons résout le WebM original et le rejeu garde le même identifiant', async () => {
  const link = commonsPage + 'Vid%C3%A9o_d%27essai.webm'
  const initial = await run([link], {}, true)
  assert.deepEqual(JSON.parse(initial.stdout), { videoId, replayed: false, isPublished: false })
  assert.deepEqual(uploads[0].bytes, bytes)
  assert.equal(uploads[0].form.get('video').type, 'video/webm')
  assert.deepEqual([...uploads[0].form.keys()], ['video'])
  assert.equal(commonsRequests[0].url.searchParams.get('titles'), "File:Vidéo_d'essai.webm")
  assert.equal(commonsRequests[1].url.pathname, '/wikipedia/commons/fixture.webm')
  for (const { headers } of commonsRequests) {
    assert.match(headers['user-agent'], /^memebank-upload\//)
    assert.equal(headers.authorization, undefined)
    assert.equal(headers.cookie, undefined)
    assert.equal(headers['x-memebank-upload-token'], undefined)
  }

  const replay = await run([link], {}, true)
  assert.deepEqual(JSON.parse(replay.stdout), { videoId, replayed: true, isPublished: false })
  assert.equal(uploads[0].key, uploads[1].key)
})

test('une fiche Wikimedia sans vidéo ou avec une réponse incohérente est refusée', async () => {
  await expectError([commonsPage + 'Missing.webm'], 'COMMONS_VIDEO_UNAVAILABLE', {}, true)
  await expectError([commonsPage + 'OversizedMetadata.webm'], 'COMMONS_INVALID_RESPONSE', {}, true)
  await expectError([commonsPage + 'Truncated.webm'], 'COMMONS_INVALID_RESPONSE', {}, true)
  await expectError([commonsPage + 'Sample.webm?oldid=12'], 'COMMONS_VIDEO_UNAVAILABLE', {}, true)
  await expectError([commonsPage + 'Sample%7CInjected.webm'], 'COMMONS_VIDEO_UNAVAILABLE', {}, true)
  assert.equal(uploads.length, 0)
})

test('la taille annoncée et les destinations Wikimedia hors périmètre bloquent avant envoi', async () => {
  await expectError([commonsPage + 'Large.webm'], 'SOURCE_TOO_LARGE', {}, true)
  await expectError([commonsPage + 'Unexpected.webm'], 'COMMONS_UNEXPECTED_ORIGIN', {}, true)
  assert.equal(commonsRequests.length, 2)
  await expectError([commonsPage + 'Redirected.webm'], 'COMMONS_UNEXPECTED_ORIGIN', {}, true)
  assert.equal(commonsRequests.length, 4)
  assert.equal(uploads.length, 0)
})

const publicPage = 'http://93.184.215.14/page/'

test('une page HTML redirigée fournit un média relatif et décode la requête HTML', async () => {
  const result = await run([publicPage + 'moved'], {}, true)
  assert.equal(JSON.parse(result.stdout).isPublished, false)
  assert.equal(uploads[0].form.get('video').type, 'video/mp4')
  assert.deepEqual(uploads[0].bytes, bytes)
  assert.deepEqual(
    pageRequests.map(({ url }) => url.pathname),
    ['/page/moved', '/page/sub/watch', '/page/sub/clip']
  )
  assert.equal(pageRequests[2].url.search, '?one=1&two=2')
  for (const { headers } of pageRequests) {
    for (const name of ['cookie', 'authorization', 'referer', 'x-memebank-upload-token']) {
      assert.equal(headers[name], undefined)
    }
  }
  const replay = await run([publicPage + 'moved'], {}, true)
  assert.equal(JSON.parse(replay.stdout).replayed, true)
  assert.equal(uploads[0].key, uploads[1].key)
})

test('un lecteur intégré et du HTML inactif ne déclenchent aucun téléchargement', async () => {
  await expectError([publicPage + 'embed-only'], 'PAGE_VIDEO_UNAVAILABLE', {}, true)
  assert.deepEqual(
    pageRequests.map(({ url }) => url.pathname),
    ['/page/embed-only']
  )
  assert.equal(uploads.length, 0)
})

test('les limites HTML et les contrôles média s’appliquent à la seconde requête', async () => {
  await expectError([publicPage + 'big'], 'PAGE_TOO_LARGE', {}, true)
  await expectError([publicPage + 'private'], 'SOURCE_ADDRESS_BLOCKED', {}, true)
  await expectError(['https://93.184.215.14/page/downgrade'], 'SOURCE_REDIRECT', {}, true)
  await expectError([publicPage + 'media-redirect'], 'SOURCE_ADDRESS_BLOCKED', {}, true)
  await expectError([publicPage + 'not-video'], 'PAGE_MEDIA_NOT_FILE', {}, true)
  await expectError([publicPage + 'octet-stream'], 'PAGE_MEDIA_NOT_FILE', {}, true)
  await expectError([publicPage + 'large-media'], 'SOURCE_TOO_LARGE', {}, true)
  assert.equal(uploads.length, 0)
})

test('la page et le média partagent cinq redirections au total', async () => {
  await expectError([publicPage + 'budget/0'], 'SOURCE_REDIRECT', {}, true)
  assert.equal(pageRequests.length, 7)
  assert.equal(pageRequests.at(-1).url.pathname, '/page/chain/1')
  assert.equal(uploads.length, 0)
})
