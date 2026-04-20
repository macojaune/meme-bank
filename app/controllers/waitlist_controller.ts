import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import vine from '@vinejs/vine'
import env from '#start/env'
import { createWaitlistService } from '#services/waitlist_service'

const waitlistValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().maxLength(255),
    consent: vine.boolean(),
    website: vine.string().trim().maxLength(200).optional(),
  })
)

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

function isRateLimited(ip: string, now = Date.now()) {
  const current = attempts.get(ip)
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  current.count += 1
  return current.count > MAX_ATTEMPTS
}

export default class WaitlistController {
  async store({ request, response }: HttpContext) {
    if (isRateLimited(request.ip())) {
      return response.tooManyRequests({
        message: 'Trop de tentatives. Réessaie dans quelques minutes.',
      })
    }

    const data = await request.validateUsing(waitlistValidator)

    // Honeypot: report success without creating a contact.
    if (data.website) {
      return response.created({ questionnaireUrl: 'https://tally.so/r/0QWer6' })
    }

    if (!data.consent) {
      return response.badRequest({
        message: 'Ton accord est nécessaire pour recevoir les nouvelles de la bêta.',
      })
    }

    const apiKey = env.get('BREVO_API_KEY')
    if (!apiKey) {
      logger.error('BREVO_API_KEY is missing; waitlist signup is unavailable')
      return response.serviceUnavailable({
        message: 'La préinscription est momentanément indisponible. Réessaie un peu plus tard.',
      })
    }

    try {
      const service = createWaitlistService({
        apiKey,
        listId: env.get('BREVO_BETA_LIST_ID', 20),
        templateId: env.get('BREVO_WELCOME_TEMPLATE_ID', 14),
      })
      await service.subscribe(data.email)

      return response.created({ questionnaireUrl: 'https://tally.so/r/0QWer6' })
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Waitlist signup failed'
      )
      return response.badGateway({
        message: 'Ton adresse n’a pas pu être enregistrée. Réessaie dans un instant.',
      })
    }
  }
}
