import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'

export function privateBucketName() {
  return env.get('R2_ENDPOINT')
    ? env.get('R2_PRIVATE_BUCKET')
    : env.get('MINIO_PRIVATE_BUCKET', 'memes-agent-private')
}

export function videoDisk(agentImport: boolean) {
  return drive.use(agentImport ? 'agentSpaces' : 'spaces')
}

// Earlier versions stored either object keys or the configured storage URL.
function objectKey(path: string, agentImport: boolean) {
  if (!/^https?:\/\//i.test(path)) return path.replace(/^\//, '')
  const url = new URL(path)
  const bucket = agentImport
    ? privateBucketName()
    : env.get('R2_BUCKET') || env.get('MINIO_BUCKET', 'memes')
  const endpoints = [
    env.get('R2_PUBLIC_URL'),
    ...[env.get('R2_ENDPOINT'), env.get('MINIO_ENDPOINT'), env.get('MINIO_PUBLIC_URL')]
      .filter(Boolean)
      .map((base) => base!.replace(/\/$/, '') + '/' + bucket),
  ]
  for (const endpoint of endpoints) {
    if (!endpoint) continue
    const base = new URL(endpoint.replace(/\/$/, '') + '/')
    if (base.origin === url.origin && url.pathname.startsWith(base.pathname)) {
      return decodeURIComponent(url.pathname.slice(base.pathname.length))
    }
  }
  throw new Error('Unknown video storage endpoint')
}

export async function videoAssetBytes(path: string, agentImport: boolean) {
  const key = objectKey(path, agentImport)
  // The bundled fixtures have UUID filenames. Keep reads inside that directory.
  const bundled = key.match(
    /^(?:seed\/memes\/)?((?:videos|thumbnails)\/[a-f\d-]{36}\.(?:mp4|jpg))$/i
  )
  if (!agentImport && bundled) {
    try {
      return await readFile(app.makePath('resources/seed/memes', bundled[1]))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return videoDisk(agentImport).getBytes(key)
}
