import { lookup } from 'node:dns'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import { basename, extname } from 'node:path'

export const MAX_VIDEO_BYTES = 10 * 1024 * 1024
export const MAX_TRANSCRIPT_BYTES = 64 * 1024

export class CliError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function readBounded(stream, limit, tooLarge) {
  const chunks = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    if (size > limit) throw tooLarge
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

export async function readLocalFile(path, limit, label) {
  const tooLarge = new CliError('FILE_TOO_LARGE', `Le fichier ${label} dépasse ${limit} octets.`)
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK)
    try {
      const stat = await file.stat()
      if (!stat.isFile())
        throw new CliError('INVALID_FILE', `Indique un fichier ${label} ordinaire.`)
      if (stat.size > limit) throw tooLarge
      return await readBounded(
        file.createReadStream({ end: limit, autoClose: false }),
        limit,
        tooLarge
      )
    } finally {
      await file.close()
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError('FILE_READ_FAILED', `Impossible de lire le fichier ${label}.`)
  }
}

const extensions = new Map([
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ogg', 'video/ogg'],
  ['.ogv', 'video/ogg'],
  ['.avi', 'video/x-msvideo'],
])
const mediaTypes = new Map([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/ogg', '.ogg'],
  ['application/ogg', '.ogg'],
  ['video/x-msvideo', '.avi'],
  ['video/avi', '.avi'],
  ['video/msvideo', '.avi'],
])

function videoFile(bytes, originalName, contentType) {
  const originalExt = extname(originalName)
  let ext = contentType ? mediaTypes.get(contentType) : originalExt.toLowerCase()
  if (ext === '.ogv') ext = '.ogg'
  if (!extensions.has(ext)) {
    throw new CliError(
      'UNSUPPORTED_SOURCE',
      'Utilise un fichier vidéo direct MP4, WebM, Ogg ou AVI.'
    )
  }
  if (!bytes.length) throw new CliError('EMPTY_VIDEO', 'Le fichier vidéo est vide.')
  const name = originalExt ? originalName.slice(0, -originalExt.length) : originalName
  const safeName = name.replace(/[\x00-\x1f\x7f/\\"]/g, '').trim()
  const stem = Array.from(safeName).slice(0, 100).join('') || 'video'
  return { bytes, filename: stem + ext, type: extensions.get(ext) }
}

const privateV4 = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
]) {
  privateV4.addSubnet(network, prefix)
}

const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const specialV6 = new BlockList()
specialV6.addSubnet('2001::', 23, 'ipv6')
specialV6.addSubnet('2001:db8::', 32, 'ipv6')
specialV6.addSubnet('2002::', 16, 'ipv6')
specialV6.addSubnet('3fff::', 20, 'ipv6')

function isPublicIp(address) {
  const family = isIP(address)
  if (family === 4) return !privateV4.check(address)
  return family === 6 && globalV6.check(address, 'ipv6') && !specialV6.check(address, 'ipv6')
}

function blockedSource() {
  return new CliError(
    'SOURCE_ADDRESS_BLOCKED',
    'Le lien vidéo doit pointer vers une adresse IP publique.'
  )
}

function lookupPublic(hostname, options, callback) {
  lookup(hostname, { ...options, all: true }, (error, records) => {
    if (error) return callback(error)
    // The addresses passed to the socket are exactly those that were checked.
    const publicRecords = records.filter(({ address }) => isPublicIp(address))
    if (!publicRecords.length) return callback(blockedSource())
    if (options.all) return callback(null, publicRecords)
    callback(null, publicRecords[0].address, publicRecords[0].family)
  })
}

function sourceUrl(value, base) {
  let url
  try {
    url = new URL(value, base)
  } catch {
    throw new CliError('INVALID_SOURCE_URL', 'Indique une URL vidéo HTTP(S) valide.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new CliError('INVALID_SOURCE_URL', 'Indique une URL vidéo HTTP(S) sans identifiants.')
  }
  if (base?.protocol === 'https:' && url.protocol === 'http:') {
    throw new CliError('SOURCE_REDIRECT', 'La source redirige de HTTPS vers HTTP.')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname) && !isPublicIp(hostname)) throw blockedSource()
  return url
}

const commons = 'https://commons.wikimedia.org'
const commonsApi = commons + '/w/api.php'
const commonsMedia = 'https://upload.wikimedia.org'
const commonsHeaders = {
  'User-Agent': 'memebank-upload/0.2 (https://github.com/macojaune/meme-bank)',
}

function getSource(url, signal, headers) {
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      { agent: false, lookup: lookupPublic, signal, headers },
      resolve
    )
    request.on('error', reject)
  })
}

async function readSource(
  url,
  signal,
  read,
  { checkUrl, headers, redirectBudget = { remaining: 5 } } = {}
) {
  for (;;) {
    checkUrl?.(url)
    const response = await getSource(url, signal, headers)
    try {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (!response.headers.location || redirectBudget.remaining === 0) {
          throw new CliError(
            'SOURCE_REDIRECT',
            'Redirection absente ou trop nombreuses redirections.'
          )
        }
        redirectBudget.remaining--
        url = sourceUrl(response.headers.location, url)
        continue
      }
      if (response.statusCode !== 200) {
        throw new CliError(
          'SOURCE_HTTP_ERROR',
          'La source refuse la récupération. Vérifie que la page ou le fichier est public et réessaie plus tard en cas de panne.',
          response.statusCode
        )
      }
      const encoding = response.headers['content-encoding']?.toLowerCase()
      if (encoding && encoding !== 'identity') {
        throw new CliError('UNSUPPORTED_SOURCE', 'La source doit répondre sans encodage HTTP.')
      }
      const type = response.headers['content-type']?.split(';', 1)[0].trim().toLowerCase()
      return await read(response, url, type)
    } finally {
      response.destroy()
    }
  }
}

const tooLarge = () => new CliError('SOURCE_TOO_LARGE', 'La vidéo dépasse 10 Mio.')

async function readVideoResponse(response, url, mediaType) {
  if (Number(response.headers['content-length']) > MAX_VIDEO_BYTES) throw tooLarge()
  const contentType = mediaType === 'application/octet-stream' ? undefined : mediaType
  const filename = basename(decodeURIComponent(url.pathname))
  const extension = extname(filename).toLowerCase()
  if (contentType ? !mediaTypes.has(contentType) : !extensions.has(extension)) {
    throw new CliError(
      'UNSUPPORTED_SOURCE',
      'Utilise un lien direct MP4, WebM, Ogg ou AVI, une page vidéo Wikimedia Commons prise en charge ou un fichier local.'
    )
  }
  const bytes = await readBounded(response, MAX_VIDEO_BYTES, tooLarge())
  return videoFile(bytes, filename, contentType)
}

async function findPageVideo(response, page) {
  const limit = 512 * 1024
  const tooLargePage = new CliError(
    'PAGE_TOO_LARGE',
    'La page dépasse 512 Kio. Fournis le lien direct du fichier vidéo.'
  )
  if (Number(response.headers['content-length']) > limit) throw tooLargePage
  const html = await readBounded(response, limit, tooLargePage)
  const { parse } = await import('parse5')
  const pending = [parse(html.toString('utf8'), { scriptingEnabled: true })]
  const htmlNamespace = 'http://www.w3.org/1999/xhtml'

  function mediaUrl(node) {
    const type = node.attrs.find((attribute) => attribute.name === 'type')?.value
    if (type && !mediaTypes.has(type.split(';', 1)[0].trim().toLowerCase())) return null
    const src = node.attrs.find((attribute) => attribute.name === 'src')?.value.trim()
    if (!src) return null
    let candidate
    try {
      candidate = new URL(src, page)
    } catch {
      return null
    }
    if (
      !['http:', 'https:'].includes(candidate.protocol) ||
      ['.m3u8', '.mpd'].includes(extname(candidate.pathname).toLowerCase())
    )
      return null
    return sourceUrl(candidate.href, page)
  }

  while (pending.length) {
    const node = pending.pop()
    const children = node.childNodes ?? []
    if (node.namespaceURI === htmlNamespace && node.tagName === 'video') {
      const direct = mediaUrl(node)
      if (direct) return direct
      for (const child of children) {
        if (child.namespaceURI === htmlNamespace && child.tagName === 'source') {
          const candidate = mediaUrl(child)
          if (candidate) return candidate
        }
      }
    }
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index])
  }
  throw new CliError(
    'PAGE_VIDEO_UNAVAILABLE',
    'Le HTML public ne contient pas de fichier vidéo dans une balise video/source. Fournis un lien direct ou un fichier téléchargé avec la fonction officielle du site.'
  )
}

function checkCommonsMedia(url) {
  if (url.origin !== commonsMedia || !url.pathname.startsWith('/wikipedia/commons/')) {
    throw new CliError(
      'COMMONS_UNEXPECTED_ORIGIN',
      'Wikimedia Commons renvoie vers un hôte ou un chemin média inattendu. Fournis un lien direct vérifié.'
    )
  }
}

async function downloadCommonsVideo(page, title, signal) {
  const unavailable = new CliError(
    'COMMONS_VIDEO_UNAVAILABLE',
    'Ouvre la fiche File: d’une vidéo publique sur Wikimedia Commons ou fournis un fichier local.'
  )
  if (
    !/^File:.+$/u.test(title) ||
    /[|\x00-\x1f\x7f]/u.test(title) ||
    page.searchParams.has('oldid')
  ) {
    throw unavailable
  }
  const api = new URL(commonsApi)
  api.search = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|mediatype',
    iilimit: '1',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    titles: title,
  })
  const invalid = new CliError(
    'COMMONS_INVALID_RESPONSE',
    'La réponse de Wikimedia Commons est invalide. Réessaie plus tard ou fournis le fichier original.'
  )
  const pages = await readSource(
    api,
    signal,
    async (response, _url, type) => {
      const limit = 64 * 1024
      if (type !== 'application/json' || Number(response.headers['content-length']) > limit) {
        throw invalid
      }
      const bytes = await readBounded(response, limit, invalid)
      try {
        return JSON.parse(bytes.toString('utf8'))?.query?.pages
      } catch {
        throw invalid
      }
    },
    {
      headers: commonsHeaders,
      checkUrl(url) {
        if (url.href !== api.href) throw invalid
      },
    }
  )
  const result = Array.isArray(pages) && pages.length === 1 ? pages[0] : null
  const file = result?.imageinfo?.[0]
  if (
    result?.ns !== 6 ||
    file?.mediatype !== 'VIDEO' ||
    typeof file.url !== 'string' ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.mime !== 'video/webm'
  ) {
    throw unavailable
  }
  if (file.size > MAX_VIDEO_BYTES) throw tooLarge()
  const video = await readSource(sourceUrl(file.url), signal, readVideoResponse, {
    headers: commonsHeaders,
    checkUrl: checkCommonsMedia,
  })
  if (video.type !== file.mime || video.bytes.length !== file.size) throw invalid
  return video
}

async function downloadVideo(value) {
  const signal = AbortSignal.timeout(60_000)
  const url = sourceUrl(value)
  try {
    if (url.origin === commons && url.pathname.startsWith('/wiki/')) {
      const title = decodeURIComponent(url.pathname.slice(6))
      if (title.startsWith('File:')) return await downloadCommonsVideo(url, title, signal)
    }
    const redirectBudget = { remaining: 5 }
    const options = { redirectBudget }
    const source = await readSource(
      url,
      signal,
      (response, finalUrl, type) =>
        type === 'text/html'
          ? findPageVideo(response, finalUrl)
          : readVideoResponse(response, finalUrl, type),
      options
    )
    if (!(source instanceof URL)) return source
    return await readSource(
      source,
      signal,
      (response, finalUrl, type) => {
        if (!mediaTypes.has(type)) {
          throw new CliError(
            'PAGE_MEDIA_NOT_FILE',
            'La source de la balise vidéo ne renvoie pas un fichier vidéo pris en charge. Fournis un lien direct ou un fichier local.'
          )
        }
        return readVideoResponse(response, finalUrl, type)
      },
      options
    )
  } catch (error) {
    if (error instanceof CliError) throw error
    if (signal.aborted)
      throw new CliError('SOURCE_TIMEOUT', 'La récupération a dépassé 60 secondes.')
    throw new CliError(
      'SOURCE_DOWNLOAD_FAILED',
      'Impossible de récupérer la vidéo depuis la source.'
    )
  }
}

export async function readVideo(source) {
  if (/^https?:/i.test(source)) return downloadVideo(source)
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(source)) {
    throw new CliError('INVALID_SOURCE_URL', 'Seules les URLs HTTP(S) sont acceptées.')
  }
  return videoFile(await readLocalFile(source, MAX_VIDEO_BYTES, 'vidéo'), basename(source))
}
