import { test } from '@japa/runner'
import { canManageVideo } from '#services/video_access'

test.group('Video access', () => {
  test('allows the owner to mutate their video', ({ assert }) => {
    assert.isTrue(canManageVideo('user-1', 'user-1'))
  })

  test('rejects another authenticated user', ({ assert }) => {
    assert.isFalse(canManageVideo('user-1', 'user-2'))
  })
})
