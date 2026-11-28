import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import { DateTime } from 'luxon'
import User from '#models/user'
import Video from '#models/video'
import Person from '#models/person'
import env from '#start/env'

const origin = 'http://127.0.0.1:46388'
const password = randomUUID()
const authPayload = { title: 'Titre corrigé', personIds: [], newPeople: [], categoryIds: [] }

class Session {
  private cookies = new Map<string, string>()

  async request(path: string, method = 'GET', payload?: object, csrf = true) {
    const headers = new Headers({ accept: 'application/json' })
    headers.set('cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '))
    if (payload) {
      headers.set('content-type', 'application/json')
      if (csrf)
        headers.set('x-xsrf-token', decodeURIComponent(this.cookies.get('XSRF-TOKEN') ?? ''))
    }

    const response = await fetch(origin + path, {
      headers,
      method,
      body: JSON.stringify(payload),
      redirect: 'manual',
    })

    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
    return response
  }

  async login(user: User) {
    await this.request('/login')
    const response = await this.request('/login', 'POST', { email: user.email, password })
    if (response.headers.get('location') !== '/dashboard') throw new Error('Fixture login failed')
  }
}

test.group('Video details — isolated HTTP and PostgreSQL', (group) => {
  if (process.env.MEMEBANK_VIDEO_DETAILS_TESTS !== '1') {
    test('requires a disposable PostgreSQL database').skip()
    return
  }

  const owner = new Session()
  const editor = new Session()
  const member = new Session()
  let ownedVideo: Video
  let privateVideo: Video
  let path: string
  let person: Person

  group.setup(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '46385' ||
      process.env.DB_DATABASE !== 'memebank_details_fixture' ||
      process.env.PORT !== '46388' ||
      (await db.connection().schema.hasTable('users'))
    ) {
      throw new Error('Use a fresh disposable PostgreSQL database')
    }
    const migrations = new MigrationRunner(db, app, { direction: 'up' })
    await migrations.run()
    if (migrations.error) throw migrations.error

    const [videoOwner, videoEditor, videoMember] = await Promise.all(
      ['owner', 'editor', 'member'].map((role) =>
        User.create({ email: `${role}@example.invalid`, password })
      )
    )
    env.set('VIDEO_METADATA_EDITOR_ID', videoEditor.id)
    person = await Person.create({ name: 'Personne déjà liée' })
    const fixture = {
      title: '',
      filePath: 'videos/fixture.mp4',
      userId: videoOwner.id,
      uploadDate: DateTime.now(),
      skipAutoTranscription: true,
    }
    ownedVideo = await Video.create({ ...fixture, isPublished: true })
    privateVideo = await Video.create({ ...fixture, isPublished: false })
    await ownedVideo.related('persons').attach({ [person.id]: { notes: 'Notes existantes' } })
    path = `/api/v1/videos/${ownedVideo.id}/details`
    await Promise.all([
      owner.login(videoOwner),
      editor.login(videoEditor),
      member.login(videoMember),
    ])
  })

  test('only the owner or configured metadata editor may change visible video details', async ({
    assert,
  }) => {
    const anonymous = new Session()
    const guest = await anonymous.request(path)
    const ordinaryRead = await member.request(path)
    const ordinaryWrite = await member.request(path, 'PATCH', authPayload)
    const privateEdit = await editor.request(
      `/api/v1/videos/${privateVideo.id}/details`,
      'PATCH',
      authPayload
    )
    const noCsrf = await owner.request(path, 'PATCH', authPayload, false)
    const noCategoryCreation = await owner.request(path, 'PATCH', {
      ...authPayload,
      newCategory: 'Réactions',
    })
    assert.equal(guest.status, 401)
    assert.equal(ordinaryRead.status, 200)
    assert.equal(((await ordinaryRead.json()) as { canEdit: boolean }).canEdit, false)
    assert.equal(ordinaryWrite.status, 403)
    assert.equal(privateEdit.status, 404)
    assert.equal(noCsrf.status, 302)
    assert.equal(noCategoryCreation.status, 403)
  })

  test('keeps existing notes, creates and reuses categories, and persists edits after reread', async ({
    assert,
  }) => {
    const edit = await editor.request(path, 'PATCH', {
      ...authPayload,
      personIds: [person.id],
      newPeople: ['Nouvelle personne'],
      newCategory: 'Réactions',
    })
    assert.equal(edit.status, 200, await edit.clone().text())
    const data = (await edit.json()) as {
      title: string
      persons: { id: string }[]
      categories: { id: string; name: string }[]
      categoryOptions: { id: string }[]
    }
    assert.equal(data.title, authPayload.title)
    assert.lengthOf(data.persons, 2)
    assert.equal(data.categories[0].name, 'Réactions')
    assert.equal(data.categoryOptions[0].id, data.categories[0].id)

    const reread = await editor.request(path)
    assert.deepEqual(await reread.json(), data)
    const notes = await db
      .from('video_persons')
      .where('video_id', ownedVideo.id)
      .where('person_id', person.id)
      .first()
    assert.equal(notes.notes, 'Notes existantes')

    for (const query of ['Nouvelle personne', 'Réactions']) {
      const search = await member.request('/api/v1/search?' + new URLSearchParams({ q: query }))
      assert.equal(search.status, 200)
      const results = (await search.json()) as { data: { id: string }[] }
      assert.deepEqual(
        results.data.map(({ id }) => id),
        [ownedVideo.id]
      )
    }

    const invalid = await editor.request(path, 'PATCH', {
      ...authPayload,
      personIds: [randomUUID()],
    })
    const afterInvalid = await editor.request(path)
    assert.equal(invalid.status, 422)
    assert.deepEqual(await afterInvalid.json(), data)

    const replay = await editor.request(path, 'PATCH', {
      ...authPayload,
      personIds: [person.id],
      newPeople: ['nouvelle personne'],
      newCategory: 'réactions',
    })
    assert.equal(replay.status, 200)
    assert.deepEqual(await replay.json(), data)

    const remove = await owner.request(path, 'PATCH', {
      ...authPayload,
      title: '',
      categoryIds: [],
    })
    assert.equal(remove.status, 200, await remove.clone().text())
    const removed = (await remove.json()) as {
      title: string
      persons: unknown[]
      categories: unknown[]
    }
    assert.equal(removed.title, '')
    assert.lengthOf(removed.persons, 0)
    assert.lengthOf(removed.categories, 0)
    const ownerId = ownedVideo.userId
    await ownedVideo.refresh()
    assert.equal(ownedVideo.userId, ownerId)
    assert.isTrue(ownedVideo.isPublished)
    assert.equal(ownedVideo.filePath, 'videos/fixture.mp4')
  })
})
