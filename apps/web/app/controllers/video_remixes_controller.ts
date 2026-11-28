import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import VideoRemix from '#models/video_remix'
import {
  enqueueRemix,
  MAX_REMIX_DURATION_MS,
  MIN_REMIX_DURATION_MS,
  reserveRemix,
  viewRemix,
} from '#services/video_remix'

const detailsValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    startMs: vine.number().withoutDecimals().min(0).max(2_147_483_647),
    endMs: vine.number().withoutDecimals().min(1).max(2_147_483_647),
  })
)

const keyValidator = vine.compile(vine.object({ key: vine.string().uuid() }))

export default class VideoRemixesController {
  async store({ auth, params, request, response }: HttpContext) {
    const { key } = await keyValidator.validate({ key: request.header('Idempotency-Key') })
    const data = await request.validateUsing(detailsValidator)
    if (
      data.title.includes('\0') ||
      data.endMs - data.startMs < MIN_REMIX_DURATION_MS ||
      data.endMs - data.startMs > MAX_REMIX_DURATION_MS
    ) {
      return response.unprocessableEntity({
        error: 'Choisis un titre et un extrait compris entre 0,1 et 60 secondes.',
      })
    }

    const result = await reserveRemix(auth.user!.id, params.id, key.toLowerCase(), data)
    if (result.kind === 'not_found') return response.notFound()
    if (result.kind === 'conflict') {
      return response.conflict({ error: 'Cette clé correspond déjà à un autre extrait.' })
    }

    if (result.remix.status === 'queued' && !(await enqueueRemix(result.remix.id))) {
      return response.serviceUnavailable({
        error: 'Le montage est momentanément indisponible. Réessaie cet extrait.',
      })
    }
    await result.remix.refresh()
    return response.status(202).send(viewRemix(result.remix))
  }

  async show({ auth, params, response }: HttpContext) {
    const remix = await VideoRemix.query()
      .where({ id: params.id, requesterId: auth.user!.id })
      .first()
    return remix ? response.ok(viewRemix(remix)) : response.notFound()
  }
}
