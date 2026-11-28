import { unlink } from 'node:fs/promises'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class CleanupVideoUploadMiddleware {
  async handle({ request, route, logger }: HttpContext, next: NextFn) {
    if (
      request.method() !== 'POST' ||
      !['/videos/upload', '/api/agent/video-import'].includes(route?.pattern ?? '')
    ) {
      return next()
    }

    try {
      return await next()
    } finally {
      const paths = new Set<string>()
      const pending: unknown[] = [request.allFiles()]
      while (pending.length) {
        const item = pending.pop()
        if (item instanceof MultipartFile) {
          if (item.tmpPath) paths.add(item.tmpPath)
        } else if (item && typeof item === 'object') {
          pending.push(...Object.values(item))
        }
      }

      await Promise.all(
        Array.from(paths, (path) =>
          unlink(path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') logger.warn('Unable to remove a temporary video upload')
          })
        )
      )
    }
  }
}
