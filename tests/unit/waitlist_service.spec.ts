import { test } from '@japa/runner'
import { createWaitlistService, WaitlistServiceError } from '#services/waitlist_service'

test.group('Waitlist service', () => {
  test('normalizes the email, adds the contact, then sends the welcome template', async ({
    assert,
  }) => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(null, { status: 204 })
    }

    const service = createWaitlistService({
      apiKey: 'test-key',
      listId: 20,
      templateId: 14,
      fetcher,
    })

    const result = await service.subscribe('  TESTEUR@EXAMPLE.COM ')

    assert.deepEqual(result, { email: 'testeur@example.com' })
    assert.lengthOf(calls, 2)
    assert.equal(calls[0].url, 'https://api.brevo.com/v3/contacts')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      email: 'testeur@example.com',
      listIds: [20],
      updateEnabled: true,
    })
    assert.equal(calls[1].url, 'https://api.brevo.com/v3/smtp/email')
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      templateId: 14,
      to: [{ email: 'testeur@example.com' }],
      tags: ['memebank-beta-welcome'],
    })
  })

  test('does not send an email when the contact synchronization fails', async ({ assert }) => {
    const calls: string[] = []
    const service = createWaitlistService({
      apiKey: 'test-key',
      listId: 20,
      templateId: 14,
      fetcher: async (url) => {
        calls.push(String(url))
        return new Response('{"message":"invalid"}', { status: 401 })
      },
    })

    try {
      await service.subscribe('personne@example.com')
      assert.fail('Expected the Brevo request to fail')
    } catch (error) {
      assert.instanceOf(error, WaitlistServiceError)
      assert.equal((error as WaitlistServiceError).step, 'contact')
      assert.equal((error as WaitlistServiceError).status, 401)
    }
    assert.deepEqual(calls, ['https://api.brevo.com/v3/contacts'])
  })
})
