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
        accessKeyId: env.get('R2_ACCESS_KEY_ID') || env.get('MINIO_ACCESS_KEY') || '',
        secretAccessKey: env.get('R2_SECRET_ACCESS_KEY') || env.get('MINIO_SECRET_KEY') || '',
      },
      region: env.get('R2_REGION') || env.get('MINIO_REGION', 'us-east-1'),
      bucket: env.get('R2_BUCKET') || env.get('MINIO_BUCKET') || 'memes',
      endpoint: env.get('R2_ENDPOINT') || env.get('MINIO_ENDPOINT') || 'http://localhost:9000',
      forcePathStyle: true,
      supportsACL: !env.get('R2_ENDPOINT'),
      visibility: 'public',
    }),
  },
})

export default driveConfig
