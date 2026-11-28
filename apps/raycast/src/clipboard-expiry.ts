import { environment, getPreferenceValues } from '@raycast/api'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const durations = new Set(['0', '2', '5', '15', '30'])

// Raycast temporarily replaces and then restores the pasteboard during a paste.
// Give that operation time to finish and capture the resulting generation.
const expireLater = `
  /bin/sleep 2 || exit
  generation=$(/usr/bin/osascript -l JavaScript "$2" settle "$3" "$4" "$5" "$6") || exit
  [ -n "$generation" ] || exit
  /bin/sleep "$1" && exec /usr/bin/osascript -l JavaScript "$2" expire "$3" "$4" "$generation" "$6"
`

export async function scheduleClipboardExpiry(file: string, kind: 'file' | 'text' = 'file') {
  try {
    await armExpiry(file, kind)
  } catch {
    // The clipboard operation already succeeded and can still be pasted.
    console.error('MemeBank : impossible de programmer l’effacement du presse-papiers.')
  }
}

async function armExpiry(file: string, kind: 'file' | 'text' = 'file') {
  const { clipboardMinutes } = getPreferenceValues<{ clipboardMinutes?: string }>()
  const minutes = clipboardMinutes && durations.has(clipboardMinutes) ? Number(clipboardMinutes) : 5
  if (minutes === 0) return

  const script = join(environment.assetsPath, 'clipboard-expiry.js')
  const nonce = randomUUID()
  const { stdout } = await run('/usr/bin/osascript', [
    '-l',
    'JavaScript',
    script,
    'arm',
    kind,
    file,
    '',
    nonce
  ])
  const generation = stdout.trim()
  if (!/^\d+$/.test(generation)) return

  const worker = spawn(
    '/bin/sh',
    [
      '-c',
      expireLater,
      'memebank-clipboard',
      String(minutes * 60 - 2),
      script,
      kind,
      file,
      generation,
      nonce
    ],
    { detached: true, stdio: 'ignore' }
  )
  await new Promise<void>((resolve, reject) => {
    worker.once('error', reject)
    worker.once('spawn', resolve)
  })
  worker.unref()
}
