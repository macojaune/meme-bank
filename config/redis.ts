import { defineConfig } from '@adonisjs/redis'

export default defineConfig({
  connection: 'main',

  connections: {
    main: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      keyPrefix: process.env.REDIS_PREFIX || 'memebank:',
      retryStrategy: (times) => {
        return times > 10 ? null : times * 50
      },
    },
  },
})
