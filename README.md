# MemeBank

MemeBank collects short Caribbean videos and their transcriptions. The web application, Raycast extension, and upload CLI share a pnpm workspace with Turborepo.

| Project | Directory |
| --- | --- |
| Web app and HTTP API | [apps/web](apps/web/README.md) |
| Raycast for macOS | [apps/raycast](apps/raycast) |
| Video upload CLI | [cli](llm.txt) |

Use Node.js 22 and pnpm 10.20.0. From the repository root, run `pnpm install --frozen-lockfile`.

- `pnpm dev` starts the web app with the repository's existing `.env`.
- `pnpm dev:raycast` loads the local command into Raycast for testing.
- `pnpm build:web` builds the web app. `pnpm build` builds all apps.
- `pnpm typecheck` checks all packages that define a typecheck script.
- `node ace` runs Adonis operator commands from the repository root.

See the [web setup](apps/web/README.md#local-development) for PostgreSQL, Redis, object storage, and workers.
