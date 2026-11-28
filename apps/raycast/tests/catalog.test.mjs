import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assetUrl,
  bearerForOrigin,
  catalogOrigin,
  mediaUrl,
  orderByRecentIds,
  searchVideos,
  subtitle,
} from '../src/catalog.ts'
import { transferAttachment } from '../src/attachment.ts'

test('recherche une réplique contenant des caractères spéciaux sur la bonne page', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ data: [{ id: '2', title: 'Souvenir' }], meta: { currentPage: 2, lastPage: 3 } })
  )
  const result = await searchVideos('https://catalog.example', 'thé & café', 2, {
    Authorization: 'Bearer test',
  })
  const url = request.mock.calls[0].arguments[0]
  assert.equal(url.pathname, '/api/v1/search')
  assert.equal(url.searchParams.get('q'), 'thé & café')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(result.hasMore, true)
})

test('réhydrate seulement les récents encore publiés, dans leur ordre local', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      data: [{ id: 'a' }, { id: 'autre' }, { id: 'b' }],
      meta: { currentPage: 1, lastPage: 1 },
    })
  )
  const ids = ['b', 'disparu', 'a']
  const { data, hasMore } = await searchVideos('https://catalog.example', '', 1, {}, { ids })
  assert.equal(request.mock.calls[0].arguments[0].searchParams.get('videoIds'), ids.join(','))
  assert.deepEqual(
    orderByRecentIds(ids, data).map((v) => v.id),
    ['b', 'a']
  )
  assert.equal(hasMore, false)
})

test('résout les médias importés et ceux sur CDN', () => {
  const base = catalogOrigin('https://catalog.example/')
  assert.equal(
    mediaUrl(base, { id: 'a', filePath: 'https://cdn.example/a.mp4' }),
    'https://cdn.example/a.mp4'
  )
  assert.equal(mediaUrl(base, { id: 'a', filePath: '/seed/a.mp4' }), base + '/seed/a.mp4')
  assert.equal(
    mediaUrl(base, { id: 'a', skipAutoTranscription: true }),
    base + '/api/v1/videos/a/media'
  )
  assert.throws(() => mediaUrl(base, { id: 'a' }), /mise à jour/)
  assert.equal(assetUrl(base, 'file:///tmp/video.mp4'), undefined)
  assert.throws(() => catalogOrigin('https://user:pass@catalog.example'), /identifiants/)
  assert.equal(catalogOrigin('http://127.0.0.1:3333/'), 'http://127.0.0.1:3333')
})

test('une réplique trouvée loin dans la transcription apparaît dans la liste', () => {
  const text = 'Ce matin, '.repeat(100) + 'il pleuvait.'
  assert.match(subtitle({ transcription: { text } }, 'pleuvait'), /pleuvait/)
})

for (const mode of ['copy', 'paste', 'refused']) {
  test('pièce jointe macOS et historique (' + mode + ')', async () => {
    const calls = []
    const clipboard = {
      copy: async (content) => {
        calls.push(['copy', content])
      },
      paste: async (content) => {
        calls.push(['paste', content])
        if (mode === 'refused') throw new Error('focus')
      },
    }
    const file = '/tmp/meme.mp4'
    const outcome = await transferAttachment(file, clipboard, mode !== 'copy', async () => {
      calls.push(['history'])
    })
    assert.deepEqual(calls, [
      ['copy', { file }],
      ['history'],
      ...(mode === 'copy' ? [] : [['paste', { file }]]),
    ])
    assert.equal(
      outcome,
      { copy: 'copied', paste: 'paste-requested', refused: 'manual-paste' }[mode]
    )
  })
}

test('une copie échouée ne compte pas comme une utilisation', async () => {
  const clipboard = {
    copy: async () => {
      throw new Error('clipboard')
    },
    paste: assert.fail,
  }
  await assert.rejects(transferAttachment('/tmp/a.mp4', clipboard, true, assert.fail), /clipboard/)
})

test('le jeton reste sur son origine et les appels authentifiés refusent les redirections', async (t) => {
  const base = 'https://catalog.example'
  const token = 'jeton-simule'
  const headers = bearerForOrigin(base + '/api/v1/search', base, token)
  assert.deepEqual(headers, { Authorization: 'Bearer ' + token })
  assert.deepEqual(bearerForOrigin('https://catalog.example.cdn.test/file', base, token), {})
  assert.deepEqual(bearerForOrigin('http://catalog.example/file', base, token), {})
  assert.deepEqual(bearerForOrigin(base + ':444/file', base, token), {})
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }))
  await assert.rejects(searchVideos(base, '', 1, headers), /jeton/)
  const opts = fetch.mock.calls[0].arguments[1]
  assert.deepEqual(opts.headers, headers)
  assert.equal(opts.redirect, 'error')
})
