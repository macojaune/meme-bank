import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { transferAttachment } from '../src/attachment.ts'

const script = fileURLToPath(new URL('../assets/clipboard-expiry.js', import.meta.url))
const jxa = (...args) =>
  execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', ...args], { encoding: 'utf8' }).trim()

test(
  'capture et expiration respectent le contenu et la génération du presse-papiers macOS',
  { skip: process.platform !== 'darwin' },
  (t) => {
    const board = 'com.memebank.test.' + randomUUID()
    const file = '/tmp/Essai raycast.mp4'
    const fixture = `ObjC.import('AppKit'); function run([name, mode, path, owner]) {
    const p = $.NSPasteboard.pasteboardWithName(name)
    if (mode === 'release') { p.releaseGlobally; return }
    p.clearContents
    if (mode === 'file') p.setStringForType($.NSURL.fileURLWithPath(path).absoluteString, $.NSPasteboardTypeFileURL)
    if (mode === 'text') p.setStringForType(path, $.NSPasteboardTypeString)
    if (owner) {
      p.setStringForType(owner, 'com.memebank.raycast.copy-id')
      p.setStringForType('', 'com.raycast.RestoredType')
    }
  }`
    t.after(() => jxa('-e', fixture, board, 'release', ''))
    for (const kind of ['file', 'text']) {
      const owner = randomUUID()
      const change = (...args) => jxa(script, ...args, owner, board)
      jxa('-e', fixture, board, kind, file)
      assert.equal(change('arm', kind, file + '.other', ''), '')
      const first = change('arm', kind, file, '')
      assert.match(first, /^\d+$/)
      // Simulate Raycast restoring the saved pasteboard item with its custom types.
      jxa('-e', fixture, board, kind, file, owner)
      const restored = change('settle', kind, file, first)
      assert.match(restored, /^\d+$/)
      assert.notEqual(first, restored)
      jxa('-e', fixture, board, kind, file, owner)
      change('expire', kind, file, restored)
      const later = change('settle', kind, file, first)
      assert.match(later, /^\d+$/)
      assert.notEqual(later, restored)
      change('expire', kind, file, later)
      assert.equal(change('settle', kind, file, first), '')
      // An independent copy of the very same file does not carry MemeBank's stamp.
      jxa('-e', fixture, board, kind, file)
      assert.equal(change('settle', kind, file, first), '')
    }
  }
)

test('programme l’expiration de la copie masquée avant que le collage ferme Raycast', async () => {
  const file = '/tmp/fichier.mp4'
  for (const outcome of ['copy', 'paste', 'refused']) {
    const order = []
    const clipboard = {
      async copy(content, options) {
        assert.deepEqual(content, { file })
        assert.deepEqual(options, { concealed: true })
        order.push('copy')
      },
      async paste() {
        order.push('paste')
        if (outcome === 'refused') throw Error('focus')
      }
    }
    await transferAttachment(
      file,
      clipboard,
      outcome !== 'copy',
      async () => {},
      async (value) => {
        assert.equal(value, file)
        order.push('schedule')
      }
    )
    assert.deepEqual(
      order,
      outcome === 'copy' ? ['copy', 'schedule'] : ['copy', 'schedule', 'paste']
    )
  }
})
