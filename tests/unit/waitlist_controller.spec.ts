import { test } from '@japa/runner'
import { HttpContextFactory } from '@adonisjs/core/factories/http'
import WaitlistController from '#controllers/waitlist_controller'
import env from '#start/env'

test.group('Waitlist destination', () => {
  test('refuses missing or invalid destination IDs before contacting Brevo', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    const originalKey = env.get('BREVO_API_KEY')
    const originalList = env.get('BREVO_BETA_LIST_ID')
    const originalTemplate = env.get('BREVO_WELCOME_TEMPLATE_ID')
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response(null, { status: 204 })
    }
    env.set('BREVO_API_KEY', 'simulated-key')

    try {
      const destinations = [
        [undefined, 14],
        [10, undefined],
        [0, 14],
        [10, -1],
        [1.5, 14],
      ]
      for (const [index, [listId, templateId]] of destinations.entries()) {
        env.set('BREVO_BETA_LIST_ID', listId)
        env.set('BREVO_WELCOME_TEMPLATE_ID', templateId)
        const ctx = new HttpContextFactory().create()
        ctx.request.ip = () => `destination-test-${index}`
        ctx.request.updateBody({ email: 'fixture@example.invalid', consent: true })
        await new WaitlistController().store(ctx)
        assert.equal(ctx.response.getStatus(), 503)
      }
      assert.lengthOf(calls, 0)

      // IDs are account-specific: preserve exactly the operator's explicit destination.
      for (const listId of [10, 913]) {
        env.set('BREVO_BETA_LIST_ID', listId)
        env.set('BREVO_WELCOME_TEMPLATE_ID', 714)
        const ctx = new HttpContextFactory().create()
        ctx.request.ip = () => `configured-destination-${listId}`
        ctx.request.updateBody({ email: 'fixture@example.invalid', consent: true })
        await new WaitlistController().store(ctx)
        assert.equal(ctx.response.getStatus(), 201)
        assert.deepEqual(calls.at(-2)?.body.listIds, [listId])
        assert.equal(calls.at(-1)?.body.templateId, 714)
      }
      assert.lengthOf(calls, 4)
    } finally {
      globalThis.fetch = originalFetch
      env.set('BREVO_API_KEY', originalKey)
      env.set('BREVO_BETA_LIST_ID', originalList)
      env.set('BREVO_WELCOME_TEMPLATE_ID', originalTemplate)
    }
  })
})
