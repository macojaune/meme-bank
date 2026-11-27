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
