#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { CliError, MAX_TRANSCRIPT_BYTES, readBounded, readLocalFile, readVideo } from './source.mjs'

const usage = {
  usage: 'memebank-upload <fichier-ou-url> [options]',
  options: {
    '--title, --name': 'Titre facultatif.',
    '--transcript-file': 'Chemin du fichier de transcription en texte UTF-8.',
    '--transcript': 'Transcription en texte. Alternative à --transcript-file.',
    '--publish': 'Demande la publication. Le jeton doit avoir ce droit.',
    '--idempotency-key': 'Clé personnalisée pour répéter un import.',
    '--help': 'Affiche cette aide.',
  },
  environment: [
    'MEMEBANK_URL',
    'MEMEBANK_UPLOAD_TOKEN',
    'MEMEBANK_DEV_BASIC_AUTH (DEV uniquement)',
  ],
}

function multipartText(value) {
  // FormData uses CRLF on the wire. Hash and size-check the same text we send.
  return value?.replace(/\r\n|\r|\n/g, '\r\n')
}

function argumentsFrom(argv) {
  let args
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        'title': { type: 'string' },
        'name': { type: 'string' },
        'transcript-file': { type: 'string' },
        'transcript': { type: 'string' },
        'publish': { type: 'boolean' },
        'idempotency-key': { type: 'string' },
        'help': { type: 'boolean' },
      },
    })
  } catch {
    throw new CliError('INVALID_ARGUMENTS', 'Options invalides. Consulte memebank-upload --help.')
  }
  const { values, positionals } = args
  if (values.help) return { help: true }
  if (positionals.length !== 1 || !positionals[0]) {
    throw new CliError('INVALID_ARGUMENTS', 'Indique un seul fichier vidéo ou une URL vidéo.')
  }
  if (values.title !== undefined && values.name !== undefined) {
    throw new CliError('INVALID_ARGUMENTS', 'Utilise soit --title, soit --name.')
  }
  if (values.transcript !== undefined && values['transcript-file'] !== undefined) {
    throw new CliError('INVALID_ARGUMENTS', 'Utilise soit --transcript, soit --transcript-file.')
  }
  const title = multipartText((values.title ?? values.name)?.trim()) || undefined
  if (title && Array.from(title).length > 255) {
    throw new CliError('INVALID_TITLE', 'Le titre dépasse 255 caractères.')
  }
  const key = values['idempotency-key']
  if (key !== undefined && !/^[A-Za-z0-9._-]{1,128}$/.test(key)) {
    throw new CliError(
      'INVALID_IDEMPOTENCY_KEY',
      'La clé doit contenir 1 à 128 caractères ASCII alphanumériques ou les caractères . _ -'
    )
  }
  return {
    source: positionals[0],
    title,
    transcript: values.transcript,
    transcriptFile: values['transcript-file'],
    publish: values.publish === true,
    key,
  }
}

function configFrom(env) {
  let base
  try {
    base = new URL(env.MEMEBANK_URL)
  } catch {
    throw new CliError('INVALID_MEMEBANK_URL', 'Indique une URL valide dans MEMEBANK_URL.')
  }
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname)
  const secure = base.protocol === 'https:'
  if (
    !(secure || (local && base.protocol === 'http:')) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  ) {
    throw new CliError(
      'INVALID_MEMEBANK_URL',
      'MEMEBANK_URL doit contenir l’origine HTTPS de MemeBank seule. HTTP est réservé à la boucle locale.'
    )
  }

  const token = env.MEMEBANK_UPLOAD_TOKEN
  if (!token || !/^[\x21-\x7e]+$/.test(token)) {
    throw new CliError(
      'INVALID_UPLOAD_TOKEN',
      'Fournis un jeton d’import valide dans MEMEBANK_UPLOAD_TOKEN.'
    )
  }
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const ingress = env.MEMEBANK_DEV_BASIC_AUTH
  if (ingress) {
    if (
      base.origin !== 'https://memebank-dev.marvinl.com' ||
      !/^[^:\r\n]+:[^\r\n]+$/.test(ingress)
    ) {
      throw new CliError(
        'INVALID_DEV_AUTH',
        'MEMEBANK_DEV_BASIC_AUTH attend utilisateur:motdepasse et s’applique uniquement à https://memebank-dev.marvinl.com.'
      )
    }
    headers.Authorization = `Basic ${Buffer.from(ingress, 'utf8').toString('base64')}`
    headers['X-MemeBank-Upload-Token'] = token
  }
  return { endpoint: new URL('/api/agent/video-import', base), headers }
}

async function readTranscript({ transcript, transcriptFile }) {
  if (transcriptFile !== undefined) {
    const bytes = await readLocalFile(transcriptFile, MAX_TRANSCRIPT_BYTES, 'de transcription')
    try {
      transcript = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new CliError('INVALID_TRANSCRIPT', 'Enregistre la transcription en texte UTF-8.')
    }
  }
  transcript = multipartText(transcript)
  if (transcript?.includes('\0')) {
    throw new CliError('INVALID_TRANSCRIPT', 'La transcription contient un caractère NUL.')
  }
  if (transcript !== undefined && Buffer.byteLength(transcript) > MAX_TRANSCRIPT_BYTES) {
    throw new CliError('INVALID_TRANSCRIPT', 'La transcription dépasse 64 Kio.')
  }
  return transcript?.trim() ? transcript : undefined
}

function idempotencyKey(bytes, { title, transcript, publish }) {
  const video = createHash('sha256').update(bytes).digest('hex')
  const payload = JSON.stringify({
    video,
    title: title ?? null,
    transcript: transcript ?? null,
    publish,
  })
  return createHash('sha256').update(payload).digest('hex')
}

const httpErrors = new Map([
  [
    400,
    [
      'INVALID_UPLOAD',
      'MemeBank a refusé les champs ou le fichier. Vérifie le format et les options.',
    ],
  ],
  [401, ['UNAUTHORIZED', 'Vérifie le jeton d’import et, sur DEV, le secret d’accès.']],
  [403, ['FORBIDDEN', 'Le jeton ou son utilisateur ne dispose pas du droit demandé.']],
  [404, ['ENDPOINT_NOT_FOUND', 'Vérifie MEMEBANK_URL et la disponibilité de la route d’import.']],
  [
    409,
    [
      'IDEMPOTENCY_CONFLICT',
      'Vérifie que la clé d’idempotence correspond à ces mêmes données avant de relancer.',
    ],
  ],
  [413, ['UPLOAD_TOO_LARGE', 'Le serveur refuse la taille du fichier ou de la requête.']],
  [422, ['INVALID_UPLOAD', 'Vérifie le format vidéo, la taille et les métadonnées.']],
  [429, ['RATE_LIMITED', 'Attends avant de relancer avec la même clé d’idempotence.']],
])

async function upload({ endpoint, headers }, video, metadata, key) {
  const body = new FormData()
  body.set('video', new Blob([video.bytes], { type: video.type }), video.filename)
  if (metadata.title !== undefined) body.set('title', metadata.title)
  if (metadata.transcript !== undefined) body.set('transcript', metadata.transcript)
  if (metadata.publish) body.set('publish', 'true')
  const signal = AbortSignal.timeout(120_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': key },
      body,
      redirect: 'manual',
      signal,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      if (response.status >= 300 && response.status < 400) {
        throw new CliError(
          'UPLOAD_REDIRECT',
          'MemeBank redirige la requête. Indique directement son origine finale.',
          response.status
        )
      }
      const [code, message] = httpErrors.get(response.status) ?? [
        'UPLOAD_FAILED',
        'MemeBank a refusé ou interrompu l’import. Relance avec la même clé si l’échec est temporaire.',
      ]
      throw new CliError(code, message, response.status)
    }
    const invalid = new CliError(
      'INVALID_RESPONSE',
      'MemeBank a renvoyé une réponse inattendue. Relance avec la même clé.',
      response.status
    )
    if (!response.body) throw invalid
    const bytes = await readBounded(response.body, 16 * 1024, invalid)
    let result
    try {
      result = JSON.parse(bytes.toString('utf8'))
    } catch {
      throw invalid
    }
    if (
      typeof result?.videoId !== 'string' ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(result.videoId) ||
      typeof result.replayed !== 'boolean' ||
      typeof result.isPublished !== 'boolean'
    ) {
      throw invalid
    }
    const { videoId, replayed, isPublished, processingQueued } = result
    return {
      videoId,
      replayed,
      isPublished,
      ...(typeof processingQueued === 'boolean' ? { processingQueued } : {}),
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    if (signal.aborted) {
      throw new CliError(
        'UPLOAD_TIMEOUT',
        'L’envoi a dépassé 120 secondes. Relance avec la même clé.'
      )
    }
    throw new CliError(
      'UPLOAD_NETWORK_ERROR',
      'Connexion à MemeBank interrompue. Vérifie MEMEBANK_URL et relance avec la même clé.'
    )
  }
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2))
  if (args.help) return usage
  const config = configFrom(process.env)
  const transcript = await readTranscript(args)
  const video = await readVideo(args.source)
  const metadata = { title: args.title, transcript, publish: args.publish }
  return upload(config, video, metadata, args.key ?? idempotencyKey(video.bytes, metadata))
}

try {
  console.log(JSON.stringify(await main()))
} catch (error) {
  const { code, message, status } =
    error instanceof CliError
      ? error
      : new CliError('INTERNAL_ERROR', 'Erreur inattendue avant la fin de l’import.')
  console.error(JSON.stringify({ error: { code, message, status } }))
  process.exitCode = 1
}
