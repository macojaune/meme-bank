import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Button } from '~/components/motion/button/base'
import { Input } from '~/components/motion/input'

const minClipMs = 100
const maxClipMs = 60_000
const timeStepMs = 1

const buttonClass =
  'h-auto rounded-none border-2 border-black bg-white px-3 py-2 font-black text-black hover:bg-yellow-300'
const inputClasses = {
  field: 'rounded-none border-2 border-black focus-within:ring-2 focus-within:ring-black',
}
const timelineThumbClass =
  'pointer-events-none absolute inset-0 m-0 h-full w-full appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-ew-resize [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-black [&::-moz-range-thumb]:bg-yellow-300 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:bg-yellow-300'

type Remix = {
  id: string
  status: 'queued' | 'processing' | 'ready' | 'failed'
  videoId: string | null
  error: string | null
}

type Bounds = { startMs: number; endMs: number }

function timeMs(value: string) {
  return value.trim() ? Math.round(Number(value) * 1000) : NaN
}

function timeLabel(ms: number) {
  return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} s`
}

function clipError({ startMs, endMs }: Bounds, duration: number) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs > duration) {
    return 'Les deux repères doivent être dans la vidéo.'
  }
  if (endMs - startMs < minClipMs) return 'L’extrait doit durer au moins 0,1 seconde.'
  if (endMs - startMs > maxClipMs) return 'L’extrait doit durer au plus 60 secondes.'
  return ''
}

function csrfToken() {
  const raw = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
  return raw ? decodeURIComponent(raw.slice('XSRF-TOKEN='.length)) : ''
}

async function submitRemix(videoId: string, body: string, key: string, signal: AbortSignal) {
  const endpoint = `/api/v1/videos/${videoId}`
  const send = () =>
    fetch(`${endpoint}/remixes`, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        'X-XSRF-TOKEN': csrfToken(),
      },
      body,
      signal,
    })

  const response = await send()
  if (response.status !== 419) return response

  const refresh = await fetch(`${endpoint}/details`, { signal, redirect: 'error' })
  return refresh.ok ? send() : refresh
}

function creationError(status: number) {
  if (status === 401 || status === 419) return 'Ta session a expiré. Reconnecte-toi pour continuer.'
  if (status === 403 || status === 404)
    return 'Cette vidéo n’est plus disponible pour créer un extrait.'
  if (status === 422) return 'Vérifie le titre et les bornes de l’extrait.'
  return 'Impossible de lancer la création. Réessaie dans un instant.'
}

function TrimTimeline({
  bounds,
  duration,
  onStart,
  onEnd,
}: {
  bounds: Bounds
  duration: number
  onStart: (value: number) => void
  onEnd: (value: number) => void
}) {
  const { startMs, endMs } = bounds
  const safeStart = Number.isFinite(startMs) ? Math.max(0, Math.min(startMs, duration)) : 0
  const safeEnd = Number.isFinite(endMs) ? Math.max(0, Math.min(endMs, duration)) : duration
  const startPercent = (safeStart / duration) * 100
  const endPercent = (safeEnd / duration) * 100

  return (
    <div className="space-y-1" role="group" aria-label="Timeline de l’extrait">
      <div className="relative h-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-2.5 top-3 h-2 border border-black bg-gray-200"
        >
          <div
            className="absolute inset-y-0 bg-yellow-300"
            style={{
              left: `${startPercent}%`,
              right: `${100 - Math.max(startPercent, endPercent)}%`,
            }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={safeStart}
          aria-label="Début sur la timeline"
          aria-valuetext={timeLabel(safeStart)}
          onChange={(event) =>
            onStart(Math.min(event.currentTarget.valueAsNumber, Math.max(0, safeEnd - minClipMs)))
          }
          className={`${timelineThumbClass} ${safeStart === 0 ? 'z-10' : 'focus:z-10'}`}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={safeEnd}
          aria-label="Fin sur la timeline"
          aria-valuetext={timeLabel(safeEnd)}
          onChange={(event) =>
            onEnd(
              Math.max(event.currentTarget.valueAsNumber, Math.min(duration, safeStart + minClipMs))
            )
          }
          className={`${timelineThumbClass} focus:z-10`}
        />
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs font-bold text-gray-600">
        <span>0 s</span> <span>{timeLabel(duration)}</span>
      </div>
    </div>
  )
}

export default function VideoRemixEditor({
  videoId,
  title: sourceTitle,
  player,
  opening,
  onOpenVideo,
  onClose,
}: {
  videoId: string
  title: string
  player: RefObject<HTMLVideoElement | null>
  opening: boolean
  onOpenVideo: (videoId: string) => void
  onClose: () => void
}) {
  const [duration, setDuration] = useState(0)
  const [mediaError, setMediaError] = useState(false)
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState('')
  const [title, setTitle] = useState(sourceTitle.trim() || 'Sans titre')
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [job, setJob] = useState<Remix | null>(null)
  const [pollError, setPollError] = useState(false)
  const preview = useRef<Bounds | null>(null)
  const submission = useRef<{ key: string; body: string } | null>(null)
  const submitController = useRef<AbortController | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const bounds = { startMs: timeMs(start), endMs: timeMs(end) }
  const invalidClip = duration ? clipError(bounds, duration) : ''
  const canPreview = duration > 0 && !mediaError && !invalidClip
  const activeJob = job?.status === 'queued' || job?.status === 'processing'
  const pollingId = activeJob && !pollError ? job.id : null

  useEffect(() => {
    titleRef.current?.focus()
    return () => submitController.current?.abort()
  }, [])

  useEffect(() => {
    const video = player.current
    if (!video) return
    let frame: number | undefined

    function cancelFrame() {
      if (frame !== undefined) video?.cancelVideoFrameCallback(frame)
      frame = undefined
    }

    function syncDuration() {
      if (!video) return
      const length = Math.floor(video.duration * 1000)
      const valid = Number.isFinite(length) && length >= minClipMs
      setDuration(valid ? length : 0)
      setMediaError(!valid)
      if (valid) setEnd((current) => current || String(Math.min(length, maxClipMs) / 1000))
    }

    function markMediaError() {
      setMediaError(true)
    }

    function stop() {
      preview.current = null
      setPreviewing(false)
      cancelFrame()
    }

    function checkBoundary(position: number) {
      const interval = preview.current
      if (!video || !interval || video.seeking) return

      if (position * 1000 >= interval.endMs) {
        video.pause()
        video.currentTime = interval.endMs / 1000
        stop()
      } else if (position * 1000 < interval.startMs) {
        video.currentTime = interval.startMs / 1000
      }
    }

    function watchFrame() {
      cancelFrame()
      const check = (_now: number, { mediaTime }: VideoFrameCallbackMetadata) => {
        checkBoundary(mediaTime)
        if (preview.current) frame = video?.requestVideoFrameCallback(check)
      }
      if (preview.current) frame = video?.requestVideoFrameCallback?.(check)
    }

    const onTimeUpdate = () => checkBoundary(video.currentTime)
    video.addEventListener('loadedmetadata', syncDuration)
    video.addEventListener('error', markMediaError)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', watchFrame)
    video.addEventListener('pause', stop)
    video.addEventListener('ended', stop)
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) syncDuration()

    return () => {
      cancelFrame()
      preview.current = null
      video.pause()
      video.removeEventListener('loadedmetadata', syncDuration)
      video.removeEventListener('error', markMediaError)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', watchFrame)
      video.removeEventListener('pause', stop)
      video.removeEventListener('ended', stop)
    }
  }, [player])

  useEffect(() => {
    if (!pollingId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let errors = 0

    async function poll() {
      try {
        const response = await fetch(`/api/v1/remixes/${pollingId}`, {
          signal: controller.signal,
          redirect: 'error',
          headers: { Accept: 'application/json' },
        })
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setPollError(true)
          return
        }
        if (!response.ok) throw new Error('Remix status unavailable')

        const update: Remix = await response.json()
        if (controller.signal.aborted) return
        errors = 0
        setJob(update)
        if (update.status === 'queued' || update.status === 'processing') {
          timer = setTimeout(poll, 1500)
        }
      } catch {
        if (controller.signal.aborted) return
        if (++errors >= 3) setPollError(true)
        else timer = setTimeout(poll, 2000)
      }
    }

    timer = setTimeout(poll, 1000)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [pollingId])

  function pausePreview() {
    const video = player.current
    if (preview.current) video?.pause()
    preview.current = null
    setPreviewing(false)
  }

  function changeTime(setTime: (value: string) => void, value: string) {
    pausePreview()
    setTime(value)
  }

  async function playPreview() {
    const video = player.current
    if (!video || !canPreview) return
    if (preview.current) {
      pausePreview()
      return
    }

    setRequestError('')
    preview.current = bounds
    setPreviewing(true)
    video.currentTime = bounds.startMs / 1000
    try {
      await video.play()
    } catch {
      if (!preview.current) return
      preview.current = null
      setPreviewing(false)
      setRequestError('Impossible de lire l’extrait. Réessaie dans un instant.')
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canPreview || !title.trim() || submitController.current || job) return

    player.current?.pause()
    pausePreview()
    const body = JSON.stringify({ ...bounds, title: title.trim() })
    if (submission.current?.body !== body) submission.current = { key: crypto.randomUUID(), body }

    const controller = new AbortController()
    submitController.current = controller
    setSubmitting(true)
    setRequestError('')
    try {
      const response = await submitRemix(videoId, body, submission.current.key, controller.signal)
      if (response.status !== 202) {
        setRequestError(creationError(response.status))
        return
      }
      const accepted: Remix = await response.json()
      if (!controller.signal.aborted) setJob(accepted)
    } catch {
      if (!controller.signal.aborted) setRequestError(creationError(0))
    } finally {
      submitController.current = null
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  function editAnother() {
    submission.current = null
    setJob(null)
    setPollError(false)
    if (job?.status === 'ready') setTitle(sourceTitle.trim() || 'Sans titre')
  }

  return (
    <form
      className="space-y-3 border-4 border-black bg-yellow-50 p-3"
      aria-label="Créer un extrait"
      onSubmit={create}
    >
      <h3 className="font-black uppercase">Créer un extrait</h3>
      {!job && (
        <fieldset disabled={submitting} className="space-y-3">
          <Input
            ref={titleRef}
            label="Titre de l’extrait"
            value={title}
            onChange={setTitle}
            maxLength={255}
            required
            classNames={inputClasses}
          />
          {mediaError && <p role="alert">Ce média ne peut pas être prévisualisé.</p>}
          {!mediaError && !duration && <p role="status">Chargement de la durée…</p>}
          {!!duration && (
            <>
              <TrimTimeline
                bounds={bounds}
                duration={duration}
                onStart={(value) => changeTime(setStart, String(value / 1000))}
                onEnd={(value) => changeTime(setEnd, String(value / 1000))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Début de l’extrait"
                  type="number"
                  min={0}
                  max={duration / 1000}
                  step={timeStepMs / 1000}
                  value={start}
                  onChange={(value) => changeTime(setStart, value)}
                  classNames={inputClasses}
                />
                <Input
                  label="Fin de l’extrait"
                  type="number"
                  min={0}
                  max={duration / 1000}
                  step={timeStepMs / 1000}
                  value={end}
                  onChange={(value) => changeTime(setEnd, value)}
                  classNames={inputClasses}
                />
              </div>
              <p className="text-sm">
                {invalidClip || `Durée : ${timeLabel(bounds.endMs - bounds.startMs)}`}
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canPreview}
              onClick={() => void playPreview()}
              className={buttonClass}
            >
              {previewing ? 'Mettre en pause' : 'Prévisualiser l’extrait'}
            </Button>
            <Button
              type="submit"
              disabled={!canPreview || !title.trim()}
              className={`${buttonClass} bg-yellow-300`}
            >
              {submitting ? 'Envoi…' : 'Créer le mème'}
            </Button>
            <Button type="button" onClick={onClose} className={buttonClass}>
              Annuler
            </Button>
          </div>
        </fieldset>
      )}
      {activeJob && (
        <p role="status">
          {job.status === 'queued' ? 'Extrait en attente…' : 'Création de l’extrait…'}
        </p>
      )}
      {pollError && (
        <div>
          <p role="alert">Suivi de l’extrait interrompu.</p>
          <Button type="button" onClick={() => setPollError(false)} className={buttonClass}>
            Reprendre le suivi
          </Button>
        </div>
      )}
      {job?.status === 'ready' && job.videoId && (
        <>
          <p role="status">Ton extrait privé est prêt dans Mes archives.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={opening}
              onClick={() => job.videoId && onOpenVideo(job.videoId)}
              className={`${buttonClass} bg-yellow-300`}
            >
              Ouvrir le brouillon
            </Button>
            <Button type="button" onClick={editAnother} className={buttonClass}>
              Créer un autre extrait
            </Button>
          </div>
        </>
      )}
      {job?.status === 'failed' && (
        <>
          <p role="alert">La création a échoué. Tu peux modifier l’extrait et réessayer.</p>
          <Button type="button" onClick={editAnother} className={buttonClass}>
            Modifier les réglages
          </Button>
        </>
      )}
      {requestError && (
        <p role="alert" className="font-bold text-red-700">
          {requestError}
        </p>
      )}
    </form>
  )
}
