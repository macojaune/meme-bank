import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { createHash, randomUUID } from 'node:crypto'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Person from '#models/person'
import Video from '#models/video'
import env from '#start/env'
import { VIDEO_TERRITORY_IDS } from '../../shared/video_territories.js'
import { canViewVideo } from '#services/video_access'
import { videoAssetUrl } from '#utils/url_helper'

const detailsValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(255).nullable(),
    region: vine.enum(VIDEO_TERRITORY_IDS).nullable().optional(),
    personIds: vine.array(vine.string().uuid()).maxLength(20),
    newPeople: vine.array(vine.string().trim().minLength(2).maxLength(100)).maxLength(20),
    categoryIds: vine.array(vine.string().uuid()).maxLength(20),
    newCategory: vine.string().trim().minLength(2).maxLength(60).optional(),
  })
)

function permissions(video: Video, userId: string) {
  const canCreateCategory = env.get('VIDEO_METADATA_EDITOR_ID') === userId
  return { canEdit: video.userId === userId || canCreateCategory, canCreateCategory }
}

async function details(video: Video, userId: string) {
  const access = permissions(video, userId)
  await video.load('persons', (query) => query.orderBy('name'))
  await video.load('categories', (query) => query.orderBy('name'))

  const categoryOptions = access.canEdit
    ? await Category.query({ client: video.$trx })
        .select('id', 'name')
        .where('is_active', true)
        .orderBy('name')
    : []

  const original = video.remixedFromVideoId ? await Video.find(video.remixedFromVideoId) : null

  return {
    video: {
      id: video.id,
      userId: video.userId,
      title: video.title,
      description: video.description,
      filePath: videoAssetUrl(video, 'media'),
      thumbnailPath: videoAssetUrl(video, 'thumbnail'),
      durationSeconds: video.durationSeconds,
      viewCount: video.viewCount ?? 0,
      likeCount: video.likeCount ?? 0,
      isPublished: video.isPublished,
      skipAutoTranscription: video.skipAutoTranscription,
      region: video.region,
      createdAt: video.createdAt.toISO(),
    },
    source:
      original && canViewVideo(original, userId)
        ? { id: original.id, title: original.title }
        : null,
    id: video.id,
    title: video.title,
    region: video.region,
    ...access,
    persons: video.persons.map(({ id, name, socialMediaHandle, platform }) => ({
      id,
      name,
      socialMediaHandle,
      platform,
    })),
    categories: video.categories.map(({ id, name }) => ({ id, name })),
    categoryOptions: categoryOptions.map(({ id, name }) => ({ id, name })),
  }
}

export default class VideoDetailsController {
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const video = await Video.find(params.id)
    if (!video || !canViewVideo(video, userId)) return response.notFound()
    return response.ok(await details(video, userId))
  }

  async update({ params, response, auth, request }: HttpContext) {
    const userId = auth.user!.id
    return db.transaction(async (trx) => {
      const video = await Video.query({ client: trx }).where('id', params.id).forUpdate().first()
      if (!video || !canViewVideo(video, userId)) return response.notFound()

      const access = permissions(video, userId)
      if (!access.canEdit) return response.forbidden()
      const data = await request.validateUsing(detailsValidator)
      if (
        data.title?.includes('\0') ||
        data.newCategory?.includes('\0') ||
        data.newPeople.some((name) => name.includes('\0'))
      ) {
        return response.unprocessableEntity({
          message: 'Certaines valeurs contiennent un caractère invalide.',
        })
      }
      if (data.newCategory && !access.canCreateCategory) return response.forbidden()

      const people = new Set(data.personIds)
      const categories = new Set(data.categoryIds)
      if (
        people.size + data.newPeople.length > 20 ||
        categories.size + Number(!!data.newCategory) > 20
      ) {
        return response.unprocessableEntity({
          message: 'Sélectionne au plus 20 personnes et 20 catégories.',
        })
      }
      const existingPeople = await Person.query({ client: trx }).whereIn('id', [...people])
      await video.load('categories')
      const currentCategories = new Set(video.categories.map((category) => category.id))
      const selectedCategories = await Category.query({ client: trx }).whereIn('id', [
        ...categories,
      ])
      if (
        existingPeople.length !== people.size ||
        selectedCategories.length !== categories.size ||
        selectedCategories.some(
          (category) => !category.isActive && !currentCategories.has(category.id)
        )
      ) {
        return response.unprocessableEntity({
          message: 'Une personne ou une catégorie sélectionnée est indisponible.',
        })
      }

      if (data.newCategory) {
        const name = data.newCategory.normalize('NFC')
        const key = name.toLowerCase()
        await trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          'memebank-category:' + key,
        ])
        const existing = await Category.query({ client: trx })
          .whereRaw('lower(name) = ?', [key])
          .orderBy('id')
          .first()
        if (existing && !existing.isActive) {
          return response.unprocessableEntity({ message: 'Cette catégorie est désactivée.' })
        }
        const category =
          existing ??
          (await Category.create(
            {
              name,
              slug: 'categorie-' + createHash('sha256').update(key).digest('hex'),
              isActive: true,
              displayOrder: 0,
            },
            { client: trx }
          ))
        categories.add(category.id)
      }

      // Use a stable order before taking advisory locks when a request creates several names.
      const peopleByName = new Map(
        data.newPeople.map((entry) => {
          const name = entry.normalize('NFC')
          return [name.toLowerCase(), name]
        })
      )
      for (const key of [...peopleByName.keys()].sort()) {
        const name = peopleByName.get(key)!
        await trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          'memebank-person:' + key,
        ])
        const existing = await Person.query({ client: trx })
          .whereRaw('lower(name) = ?', [key])
          .orderBy('id')
          .first()
        const person = existing ?? (await Person.create({ name }, { client: trx }))
        people.add(person.id)
      }

      await video.related('persons').sync([...people])
      const removed = [...currentCategories].filter((id) => !categories.has(id))
      if (removed.length) await video.related('categories').detach(removed)
      const added = [...categories].filter((id) => !currentCategories.has(id))
      if (added.length) {
        await video
          .related('categories')
          .attach(Object.fromEntries(added.map((id) => [id, { id: randomUUID() }])))
      }

      video.title = data.title ?? ''
      if (data.region !== undefined) video.region = data.region
      // Touch updated_at even when only a relationship changed.
      video.updatedAt = DateTime.now()
      await video.save()
      return response.ok(await details(video, userId))
    })
  }
}
