import { test } from '@japa/runner'
import { getPublicUrl, getVideoPublicUrl } from '#utils/url_helper'

test.group('URL helper', () => {
  test('serves bundled seed media from the application origin', ({ assert }) => {
    assert.equal(
      getVideoPublicUrl('seed/memes/videos/example.mp4'),
      '/seed/memes/videos/example.mp4'
    )
    assert.equal(
      getPublicUrl('/seed/memes/thumbnails/example.jpg'),
      '/seed/memes/thumbnails/example.jpg'
    )
  })

  test('keeps absolute video URLs unchanged', ({ assert }) => {
    assert.equal(
      getVideoPublicUrl('https://media.example.com/meme.mp4'),
      'https://media.example.com/meme.mp4'
    )
  })
})
