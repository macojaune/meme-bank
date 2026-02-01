import { HttpContext } from '@adonisjs/core/http'
import Person from '#models/person'
import Video from '#models/video'
import logger from '@adonisjs/core/services/logger'

export default class PersonsController {
  /**
   * Search persons by name (for autocomplete)
   */
  async search({ request, response }: HttpContext) {
    try {
      const query = request.input('q', '')

      if (!query || query.trim().length < 2) {
        return response.ok({ data: [] })
      }

      console.log('[Persons] Searching for:', query)

      // Normalize query: remove spaces, dashes, special chars, lowercase
      const normalizedQuery = query
        .toLowerCase()
        .replace(/[-\s]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      console.log('[Persons] Normalized query:', normalizedQuery)

      // Get all persons and filter locally for fuzzy matching
      const allPersons = await Person.query().limit(100)

      const filtered = allPersons
        .filter((person) => {
          const normalizedName = person.name
            .toLowerCase()
            .replace(/[-\s]/g, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')

          return normalizedName.includes(normalizedQuery)
        })
        .slice(0, 10)

      console.log('[Persons] Found:', filtered.length)

      return response.ok({
        data: filtered.map((p) => ({
          id: p.id,
          name: p.name,
          socialMediaHandle: p.socialMediaHandle,
          platform: p.platform,
        })),
      })
    } catch (error) {
      console.error('[Persons] Search error:', error)
      logger.error('Person search error:', error)
      return response.internalServerError({
        error: 'Failed to search persons',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get all persons for a video
   */
  async index({ params, response }: HttpContext) {
    try {
      const video = await Video.findOrFail(params.videoId)
      await video.load('persons')

      return response.ok({
        data: video.persons.map((p) => ({
          id: p.id,
          name: p.name,
          socialMediaHandle: p.socialMediaHandle,
          platform: p.platform,
          notes: p.$extras.pivot_notes,
        })),
      })
    } catch (error) {
      logger.error('Get video persons error:', error)
      return response.internalServerError({
        error: 'Failed to get persons',
      })
    }
  }

  /**
   * Sync persons for a video (add/remove/update)
   */
  async sync({ params, request, response, auth }: HttpContext) {
    try {
      console.log('[Persons Sync] Starting sync for video:', params.videoId)

      if (!auth.user) {
        console.log('[Persons Sync] No auth user')
        return response.unauthorized({ error: 'Authentication required' })
      }

      const video = await Video.findOrFail(params.videoId)
      console.log('[Persons Sync] Found video:', video.id)

      const { persons } = request.only(['persons'])
      console.log('[Persons Sync] Persons data:', persons)

      if (!Array.isArray(persons)) {
        return response.badRequest({ error: 'Persons must be an array' })
      }

      // Detach all existing persons first
      console.log('[Persons Sync] Detaching existing persons')
      await video.related('persons').detach()

      // Create/attach new persons
      for (const personData of persons) {
        console.log('[Persons Sync] Processing person:', personData.name)
        let person: Person

        if (personData.id.startsWith('temp-')) {
          // Create new person
          person = await Person.create({
            name: personData.name,
            socialMediaHandle: personData.socialMediaHandle || null,
            platform: personData.platform || null,
          })
        } else {
          // Use existing person
          person = await Person.findOrFail(personData.id)
        }

        // Attach to video
        console.log('[Persons Sync] Attaching person:', person.id)
        await video.related('persons').attach({
          [person.id]: {
            notes: personData.notes || null,
          },
        })
      }

      console.log('[Persons Sync] Completed successfully')
      return response.redirect().back()
    } catch (error) {
      console.error('[Persons Sync] Error:', error instanceof Error ? error.message : error)
      console.error('[Persons Sync] Error details:', error)
      logger.error('Sync persons error:', error)
      return response.internalServerError({
        error: 'Failed to sync persons',
      })
    }
  }

  /**
   * Remove a person from a video
   */
  async detach({ params, request, response, auth }: HttpContext) {
    try {
      if (!auth.user) {
        return response.unauthorized({ error: 'Authentication required' })
      }

      const video = await Video.findOrFail(params.videoId)
      const { personId } = request.only(['personId'])

      await video.related('persons').detach([personId])

      return response.redirect().back()
    } catch (error) {
      logger.error('Detach person error:', error)
      return response.internalServerError({
        error: 'Failed to detach person',
      })
    }
  }
}
