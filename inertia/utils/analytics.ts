type AnalyticsEvent =
  | 'waitlist_submit'
  | 'waitlist_success'
  | 'waitlist_error'
  | 'preview_search'
  | 'preview_filter'
  | 'preview_filters_reset'
  | 'preview_video_play'

interface AnalyticsData {
  region?: string
  video_id?: string
}

interface Umami {
  track: (event: AnalyticsEvent, data?: AnalyticsData) => Promise<unknown> | void
}

/** Never send emails, search text, or raw error messages to analytics. */
export async function trackEvent(event: AnalyticsEvent, data?: AnalyticsData): Promise<void> {
  const browser = (globalThis as { window?: { umami?: Umami } }).window
  if (!browser) return

  try {
    await browser.umami?.track(event, data)
  } catch {
    // Analytics must never interrupt signup or video playback (e.g. ad blockers).
  }
}
