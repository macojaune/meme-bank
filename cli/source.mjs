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

function getSource(url, signal) {
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const request = client.get(url, { agent: false, lookup: lookupPublic, signal }, resolve)
    request.on('error', reject)
  })
}

async function downloadVideo(value) {
  const signal = AbortSignal.timeout(60_000)
  let url = sourceUrl(value)
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await getSource(url, signal)
      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          if (!response.headers.location || redirects === 5) {
            throw new CliError(
              'SOURCE_REDIRECT',
              'Redirection vidéo absente ou trop nombreuses redirections.'
            )
          }
          url = sourceUrl(response.headers.location, url)
          continue
        }
        if (response.statusCode !== 200) {
          throw new CliError(
            'SOURCE_HTTP_ERROR',
            'Le serveur source ne renvoie pas de fichier complet.',
            response.statusCode
          )
        }
        const tooLarge = new CliError('SOURCE_TOO_LARGE', 'La vidéo dépasse 10 Mio.')
        if (Number(response.headers['content-length']) > MAX_VIDEO_BYTES) throw tooLarge
        const encoding = response.headers['content-encoding']?.toLowerCase()
        if (encoding && encoding !== 'identity') {
          throw new CliError(
            'UNSUPPORTED_SOURCE',
            'La source doit envoyer le fichier vidéo sans encodage HTTP.'
          )
        }
        const mediaType = response.headers['content-type']?.split(';', 1)[0].trim().toLowerCase()
        const contentType = mediaType === 'application/octet-stream' ? undefined : mediaType
        const pathname = decodeURIComponent(url.pathname)
        const filename = basename(pathname)
        const extension = extname(filename).toLowerCase()
        if (contentType ? !mediaTypes.has(contentType) : !extensions.has(extension)) {
          throw new CliError(
            'UNSUPPORTED_SOURCE',
            'Cette URL doit servir directement un fichier MP4, WebM, Ogg ou AVI.'
          )
        }
        const bytes = await readBounded(response, MAX_VIDEO_BYTES, tooLarge)
        return videoFile(bytes, filename, contentType)
      } finally {
        response.destroy()
      }
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    if (signal.aborted)
      throw new CliError('SOURCE_TIMEOUT', 'Le téléchargement a dépassé 60 secondes.')
    throw new CliError(
      'SOURCE_DOWNLOAD_FAILED',
      'Impossible de télécharger la vidéo depuis la source.'
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
