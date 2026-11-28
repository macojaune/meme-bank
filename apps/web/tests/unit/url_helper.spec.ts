import { test } from '@japa/runner'
import { videoAssetUrl } from '#utils/url_helper'

test.group('Video asset URLs', () => {
  test('keeps object and bundled URLs behind the access checks', ({ assert }) => {
    const video = {
      id: 'video',
      filePath: 'https://media.example/file.mp4',
      thumbnailPath: 'seed/memes/thumb.jpg',
    }
    assert.equal(videoAssetUrl(video, 'media'), '/api/v1/videos/video/media')
    assert.equal(videoAssetUrl(video, 'thumbnail', 'preview'), '/preview/video/thumbnail')
    assert.isNull(videoAssetUrl({ ...video, thumbnailPath: null }, 'thumbnail'))
  })
})
