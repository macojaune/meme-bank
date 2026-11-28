// Keep operator commands and the existing root .env working in the workspace.
import { fileURLToPath } from 'node:url'

process.env.ENV_PATH ??= fileURLToPath(new URL('.', import.meta.url))
process.chdir(fileURLToPath(new URL('./apps/web', import.meta.url)))
await import('./apps/web/ace.js')
