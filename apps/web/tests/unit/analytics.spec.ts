import { test } from '@japa/runner'
import { trackEvent } from '../../inertia/utils/analytics.js'

function mockWindow(value: object) {
  Object.defineProperty(globalThis, 'window', { value, configurable: true })
}

test.group('Analytics', (group) => {
  group.each.setup(() => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
    return () => {
      if (original) Object.defineProperty(globalThis, 'window', original)
      else Reflect.deleteProperty(globalThis, 'window')
    }
  })

  test('does nothing during server-side rendering', async () => {
    Reflect.deleteProperty(globalThis, 'window')
    await trackEvent('waitlist_success')
  })

  test('does nothing when Umami is blocked or has not loaded', async () => {
    mockWindow({})
    await trackEvent('waitlist_submit')
  })

  test('tracks conversions without personal data', async ({ assert }) => {
    const calls: unknown[][] = []
    mockWindow({ umami: { track: (...args: unknown[]) => calls.push(args) } })

    await trackEvent('waitlist_submit')
    await trackEvent('waitlist_success')
    await trackEvent('waitlist_error')
    await trackEvent('preview_search')

    assert.deepEqual(calls, [
      ['waitlist_submit', undefined],
      ['waitlist_success', undefined],
      ['waitlist_error', undefined],
      ['preview_search', undefined],
    ])
  })

  test('tracks only the selected territory or video ID for preview engagement', async ({
    assert,
  }) => {
    const calls: unknown[][] = []
    mockWindow({ umami: { track: (...args: unknown[]) => calls.push(args) } })

    await trackEvent('preview_filter', { region: 'guadeloupe' })
    await trackEvent('preview_video_play', { video_id: 'preview-video-id' })

    assert.deepEqual(calls, [
      ['preview_filter', { region: 'guadeloupe' }],
      ['preview_video_play', { video_id: 'preview-video-id' }],
    ])
  })

  test('does not propagate synchronous tracking failures', async () => {
    mockWindow({
      umami: {
        track: () => {
          throw new Error('Tracker unavailable')
        },
      },
    })
    await trackEvent('waitlist_success')
  })

  test('does not propagate rejected tracking requests', async () => {
    mockWindow({ umami: { track: () => Promise.reject(new Error('Network blocked')) } })
    await trackEvent('preview_video_play', { video_id: 'preview-video-id' })
  })
})
