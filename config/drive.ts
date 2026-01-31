import env from '#start/env'
import app from '@adonisjs/core/services/app'

import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK', 'local') as 'local' | 'spaces',

  services: {
    /**
     * Local filesystem storage
     */
    local: services.fs({
      location: app.makePath('storage'),
      serveFiles: true,
      routeBasePath: '/uploads',
      visibility: 'public',
    }),

    /**
     * MinIO S3-compatible storage
     */
    spaces: services.s3({
      credentials: {
        accessKeyId: env.get('MINIO_ACCESS_KEY') || '',
        secretAccessKey: env.get('MINIO_SECRET_KEY') || '',
      },
      region: env.get('MINIO_REGION', 'us-east-1'),
      bucket: env.get('MINIO_BUCKET') || 'memes',
      endpoint: env.get('MINIO_ENDPOINT') || 'http://localhost:9000',
      forcePathStyle: true,
      visibility: 'public',
    }),
  },
})

export default driveConfig
