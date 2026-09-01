import { useMemo, useState } from 'react'

export interface PreviewVideo {
  id: string
  title: string
  thumbnailPath: string | null
  filePath: string
  region: string | null
  durationSeconds: number | null
}

interface GalleryPreviewProps {
  videos: PreviewVideo[]
}

const PREVIEW_REGIONS = [
  { id: '', label: 'Tous' },
  { id: 'guadeloupe', label: 'GPE' },
  { id: 'martinique', label: 'MTQ' },
  { id: 'guyane', label: 'GUY' },
]

const REGION_LABELS: Record<string, string> = {
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function formatRegion(region: string | null) {
  if (!region) return 'Antilles-Guyane'
  return REGION_LABELS[region.toLocaleLowerCase('fr')] ?? region
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

export default function GalleryPreview({ videos }: GalleryPreviewProps) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')

    return videos.filter((video) => {
      const videoRegion = video.region?.toLocaleLowerCase('fr') ?? ''
      const matchesQuery =
        !normalizedQuery ||
        [video.title, formatRegion(video.region)].some((value) =>
          value.toLocaleLowerCase('fr').includes(normalizedQuery)
        )
      const matchesRegion = !region || videoRegion === region

      return matchesQuery && matchesRegion
    })
  }, [query, region, videos])

  return (
    <section
      id="preview"
      className="scroll-mt-24 border-b-4 border-black bg-white px-4 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-5 lg:grid-cols-12 lg:items-end">
          <h2 className="max-w-[12ch] text-4xl font-black uppercase leading-none tracking-[-0.035em] sm:text-6xl lg:col-span-7">
            La médiathèque, en vrai.
          </h2>
          <p className="max-w-xl text-lg font-medium leading-7 lg:col-span-5">
            Cherche, filtre, fais défiler et lance les vidéos. Ce que tu vois vient directement de
            la base MemeBank.
          </p>
        </div>

        <div className="mt-10 overflow-hidden border-4 border-black bg-black shadow-neo-2xl">
          <div className="flex h-12 items-center justify-between gap-3 border-b-4 border-black bg-[#fff8e7] px-3 sm:px-4">
            <div className="flex shrink-0 gap-2" aria-hidden="true">
              <span className="h-3 w-3 rounded-full border-2 border-black bg-[#ff5c8a]" />
              <span className="h-3 w-3 rounded-full border-2 border-black bg-[#ffd600]" />
              <span className="h-3 w-3 rounded-full border-2 border-black bg-[#22d3ee]" />
            </div>
            <p className="hidden min-w-0 border-2 border-black bg-white px-4 py-1 text-center text-xs font-black uppercase sm:block">
              Aperçu de la galerie
            </p>
            <p className="shrink-0 text-xs font-black uppercase tabular-nums">
              {videos.length} mème{videos.length > 1 ? 's' : ''}
            </p>
          </div>

          <div
            className="app-preview-scroll h-[38rem] overflow-y-auto overscroll-contain bg-[#f4f4f0] sm:h-[44rem]"
            role="region"
            aria-label="Aperçu interactif de la galerie MemeBank"
            tabIndex={0}
          >
            <div className="sticky top-0 z-20 border-b-4 border-black bg-white">
              <div className="flex items-center justify-between gap-4 border-b-2 border-black px-4 py-3 sm:px-5">
                <p className="text-xl font-black uppercase tracking-[-0.04em] sm:text-2xl">
                  Meme Bank
                </p>
                <span className="bg-[#ffd600] px-3 py-1 text-[0.7rem] font-black uppercase sm:text-xs">
                  Aperçu public
                </span>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                <label htmlFor="preview-search" className="sr-only">
                  Chercher dans l’aperçu
                </label>
                <div className="flex min-w-0 border-4 border-black bg-white focus-within:outline focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-[#ffd600]">
                  <span className="grid shrink-0 place-items-center px-3">
                    <SearchIcon />
                  </span>
                  <input
                    id="preview-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Une punchline, un nom, un territoire…"
                    className="min-w-0 flex-1 px-1 py-3 text-sm font-bold outline-none sm:px-2 sm:text-base"
                  />
                </div>

                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  aria-label="Filtrer par territoire"
                >
                  {PREVIEW_REGIONS.map((previewRegion) => (
                    <button
                      key={previewRegion.id}
                      type="button"
                      aria-pressed={region === previewRegion.id}
                      onClick={() => setRegion(previewRegion.id)}
                      className={`shrink-0 border-2 border-black px-3 py-1.5 text-xs font-black uppercase transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] ${
                        region === previewRegion.id
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-[#ffd600]'
                      }`}
                    >
                      {previewRegion.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredVideos.length > 0 ? (
              <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                {filteredVideos.map((video) => (
                  <article
                    key={video.id}
                    className="overflow-hidden border-4 border-black bg-white"
                  >
                    <video
                      controls
                      preload="metadata"
                      poster={video.thumbnailPath ?? undefined}
                      src={video.filePath}
                      className="aspect-video w-full border-b-4 border-black bg-black object-cover"
                      aria-label={`Lire ${video.title}`}
                    />
                    <div className="p-4">
                      <h3 className="min-h-[2.5rem] text-sm font-black uppercase leading-5 [overflow-wrap:anywhere] sm:text-base">
                        {video.title}
                      </h3>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-black pt-3 text-xs font-black uppercase">
                        <span>{formatRegion(video.region)}</span>
                        {formatDuration(video.durationSeconds) ? (
                          <span className="shrink-0 bg-black px-2 py-1 text-white tabular-nums">
                            {formatDuration(video.durationSeconds)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center p-6 text-center">
                <div>
                  <p className="text-xl font-black uppercase">
                    {videos.length === 0
                      ? 'La médiathèque sera visible dès sa connexion.'
                      : 'Aucun mème ne correspond à ces filtres.'}
                  </p>
                  {videos.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setRegion('')
                      }}
                      className="mt-5 border-b-4 border-black font-black uppercase"
                    >
                      Réinitialiser les filtres
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
