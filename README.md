# MemeBank

MemeBank is an AdonisJS + Inertia application for collecting and operating a Caribbean meme video archive.

Core product flows:

- upload short videos
- auto-transcribe them
- let the community correct transcriptions
- tag videos with people/entities
- search the archive
- award points for uploads, corrections, downloads, and milestones

## Stack

- Backend: AdonisJS 6, Lucid ORM, VineJS, Inertia
- Frontend: React 19, Tailwind CSS 4
- Database: PostgreSQL with `pgvector`
- Queueing: BullMQ on Redis
- Object storage: MinIO / S3-compatible bucket
- AI processing:
  - transcription via `whisper.cpp` by default
  - embeddings via Ollama
- Realtime: Adonis Transmit for points toasts

## Repository Map

- `start/routes.ts`: web and API route definitions
- `app/controllers`: auth, videos, search, persons, transcriptions, leaderboard, processing status
- `app/jobs`: background workers for transcription, embeddings, thumbnails, dead-letter logging
- `app/services/queue_service.ts`: BullMQ queue and worker wiring
- `app/services/ai`: AI provider selection and implementations
- `start/events.ts`: points and notification event wiring
- `commands`: custom operator commands for workers, thumbnails, and MinIO policy setup
- `database/migrations`: schema, `uuid-ossp`, and `pgvector` setup

## Product Behavior

### Main user experience

- `/`: public launch landing with a searchable preview of the latest published videos
- `POST /waitlist`: Brevo beta-list signup and transactional welcome email
- `/health`: deployment health check
- `/login`, `/register`, `/forgot-password`, `/reset-password`: auth flows
- `/dashboard`: authenticated user stats and owned content
- `/gallery`: authenticated gallery mixing published videos with the current user's unpublished videos
- `/upload`: authenticated upload page

### Content workflow

1. A user uploads a video.
2. The app stores the file in the S3-compatible `spaces` disk.
3. The upload flow queues a `transcription` job.
4. The transcription worker:
   - downloads the video from object storage
   - extracts audio with `ffmpeg`
   - runs the configured AI transcription provider
   - stores the first `video_transcriptions` revision
   - auto-publishes the video when transcription text exists
   - queues an `embedding` job
   - queues a `videoProcessing` thumbnail job
5. The thumbnail worker extracts a frame with `ffmpeg`, uploads `thumbnails/<videoId>.jpg`, and updates the video.
6. Users can correct the transcription, which creates a new revision and grants points.

### Points system

Event listeners in [`start/events.ts`](/Users/marvinl/Documents/DEV/meme-bank/start/events.ts) drive the points ledger:

- upload: 20 points
- first upload bonus: 10 points
- download: 5 points
- transcription correction: 10 points
- view milestones: 100/500/1000/10000 views grant escalating rewards

Points-earned events are broadcast over Transmit for per-user toast notifications.

## Local Development

### Required services

For a working local environment, you need:

- PostgreSQL with the `vector` extension enabled
- Redis
- MinIO or another S3-compatible object store
- `ffmpeg`
- one AI path:
  - `whisper.cpp` binary + model file, or
  - Ollama for transcription / embeddings

The provided development compose file runs the expected backing services and app containers:

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis minio
```

Optional full-container workflow:

```bash
docker compose -f docker-compose.dev.yml up app workers
```

### App bootstrap

Install dependencies:

```bash
pnpm install
```

Run database migrations:

```bash
node ace migration:run
```

Start the web app:

```bash
pnpm dev
```

Start queue workers in another shell:

```bash
node ace queue:work all
```

The compose setup expects the web app on port `63240`. MinIO is exposed on:

- API: `http://localhost:9000`
- Console: `http://localhost:9001`

Adminer is exposed on `http://localhost:8080`.

### Environment variables

Validated directly by [`start/env.ts`](/Users/marvinl/Documents/DEV/meme-bank/start/env.ts):

- `NODE_ENV`
- `PORT`
- `APP_KEY`
- `HOST`
- `LOG_LEVEL`
- `SESSION_DRIVER`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_DATABASE`

Additional variables are used by config and jobs even though they are not validated in `start/env.ts`:

- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_PREFIX`
- `DRIVE_DISK`
- `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION`
- `AI_PROVIDER`
- `WHISPER_MODEL_PATH`, `WHISPER_CLI_PATH`
- `OLLAMA_URL`, `OLLAMA_TRANSCRIPTION_MODEL`, `OLLAMA_EMBEDDING_MODEL`
- `OPENAI_API_KEY`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_EMBEDDING_MODEL`
- `BREVO_API_KEY`: server-only key for waitlist contact sync and welcome delivery
- `BREVO_BETA_LIST_ID`: beta tester list ID (currently `20`)
- `BREVO_WELCOME_TEMPLATE_ID`: active welcome template ID (currently `14`)

The welcome email links to the published beta questionnaire at
[`https://tally.so/r/0QWer6`](https://tally.so/r/0QWer6). Keep the Brevo API key server-side and
inject it through the deployment environment; never expose it through a `VITE_` variable.

## Operator Commands

Verified via `node ace list`:

- `node ace queue:work all`
- `node ace queue:work transcription`
- `node ace queue:work embedding`
- `node ace queue:work videoProcessing`
- `node ace queue:work deadLetter`
- `node ace thumbnails:generate-missing [videoId]`
- `node ace thumbnails:regenerate-all [videoId] [--delete-old]`
- `node ace minio:setup-policy`

## HTTP Surface

### Public API routes

All are under `/api/v1`:

- `GET /videos`: paginated public videos, plus the current user's unpublished videos when authenticated
- `GET /videos/:id`: public video detail redirect behavior is currently minimal
- `GET /videos/:videoId/transcription`
- `GET /videos/:videoId/transcription/history`
- `POST /videos/:videoId/transcription/correct`
- `GET /persons/search`
- `GET /videos/:videoId/persons`
- `POST /videos/:videoId/persons`
- `DELETE /videos/:videoId/persons`
- `GET /search`
- `GET /persons/:personId/videos`
- `GET /leaderboard`
- `GET /leaderboard/me`
- `POST /videos/status`
- `GET /videos/:id/status`
- `POST /videos/:id/like`

### Authenticated web routes

- `POST /logout`
- `GET /dashboard`
- `GET /gallery`
- `GET /upload`
- `GET /videos/stream/:id`
- `POST /videos/upload`
- `GET /videos`
- `GET /videos/:id`
- `POST /videos/:id/publish`
- `GET /videos/:id/url`
- `DELETE /videos/:id`
- `GET /videos/:id/download`

## Background Jobs

### `transcription`

Defined in [`app/jobs/transcription_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/transcription_job.ts).

- retries up to 3 times with increasing delays
- stores a failed transcription row on terminal failure
- pushes failed work to `deadLetter`
- auto-publishes videos when transcription succeeds

### `embedding`

Defined in [`app/jobs/embedding_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/embedding_job.ts).

- generates an embedding from transcription text
- depends on Ollama health and model availability
- does not currently persist the vector, even though the schema and model exist

### `videoProcessing`

Defined in [`app/jobs/thumbnail_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/thumbnail_job.ts).

- downloads the original video from object storage
- extracts a frame with `ffmpeg`
- uploads a public JPEG thumbnail

### `deadLetter`

Defined in [`app/jobs/dead_letter_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/dead_letter_job.ts).

- structured logging sink for exhausted job failures
- no alerting integration yet

## Search and Discovery

Current search behavior is database-backed, not vector-backed:

- title and description search via `ILIKE`
- transcription search via the current transcription text
- region filter
- person/entity filter
- sorting by newest, oldest, views, or likes

`pgvector` infrastructure exists in the schema, but semantic retrieval is not wired into runtime search yet.

## Storage Notes

- uploads are written to the `spaces` disk, not the local disk
- the upload path is `videos/<uuid>.<ext>`
- generated thumbnails are written to `thumbnails/<videoId>.jpg`
- the app includes an operator helper to document MinIO public-read policy for thumbnails

## Known Gaps

- `Dockerfile` has a health check against `/health`, but no `/health` route exists today.
- `embedding` jobs do not yet persist vectors into `video_embeddings`.
- `start/env.ts` validates only the core app/database/session variables; storage and AI variables are read directly from `process.env` or config defaults.
- some route/controller pairs still redirect rather than returning complete API payloads, especially around direct video detail and signed URL flows.

## Useful Files

- [`start/routes.ts`](/Users/marvinl/Documents/DEV/meme-bank/start/routes.ts)
- [`app/controllers/video_controller.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/controllers/video_controller.ts)
- [`app/controllers/search_controller.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/controllers/search_controller.ts)
- [`app/controllers/transcriptions_controller.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/controllers/transcriptions_controller.ts)
- [`app/services/queue_service.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/services/queue_service.ts)
- [`app/jobs/transcription_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/transcription_job.ts)
- [`app/jobs/thumbnail_job.ts`](/Users/marvinl/Documents/DEV/meme-bank/app/jobs/thumbnail_job.ts)
- [`docker-compose.dev.yml`](/Users/marvinl/Documents/DEV/meme-bank/docker-compose.dev.yml)
