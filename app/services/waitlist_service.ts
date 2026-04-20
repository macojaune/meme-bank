const BREVO_API_URL = 'https://api.brevo.com/v3'

type Fetcher = typeof fetch

interface WaitlistServiceOptions {
  apiKey: string
  listId: number
  templateId: number
  fetcher?: Fetcher
}

export class WaitlistServiceError extends Error {
  constructor(
    public readonly step: 'contact' | 'welcome',
    public readonly status: number
  ) {
    super(`Brevo ${step} request failed with status ${status}`)
    this.name = 'WaitlistServiceError'
  }
}

export function createWaitlistService(options: WaitlistServiceOptions) {
  const fetcher = options.fetcher ?? fetch
  const headers = {
    'accept': 'application/json',
    'api-key': options.apiKey,
    'content-type': 'application/json',
  }

  async function request(path: string, body: object, step: WaitlistServiceError['step']) {
    const response = await fetcher(`${BREVO_API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new WaitlistServiceError(step, response.status)
    }
  }

  return {
    async subscribe(rawEmail: string) {
      const email = rawEmail.trim().toLowerCase()

      await request(
        '/contacts',
        {
          email,
          listIds: [options.listId],
          updateEnabled: true,
        },
        'contact'
      )

      await request(
        '/smtp/email',
        {
          templateId: options.templateId,
          to: [{ email }],
          tags: ['memebank-beta-welcome'],
        },
        'welcome'
      )

      return { email }
    },
  }
}
