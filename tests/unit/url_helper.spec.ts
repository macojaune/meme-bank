import { test } from '@japa/runner'
import { buildObjectPublicUrl, getPublicUrl, getVideoPublicUrl } from '#utils/url_helper'

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

  test('builds an R2 public URL without adding the bucket name', ({ assert }) => {
    assert.equal(
      buildObjectPublicUrl('/videos/meme-creole.mp4', 'https://pub-example.r2.dev/'),
      'https://pub-example.r2.dev/videos/meme-creole.mp4'
    )
  })

  test('keeps the bucket segment for MinIO-compatible public URLs', ({ assert }) => {
    assert.equal(
      buildObjectPublicUrl('videos/meme-creole.mp4', 'http://localhost:9000', 'memes'),
      'http://localhost:9000/memes/videos/meme-creole.mp4'
    )
  })
})
