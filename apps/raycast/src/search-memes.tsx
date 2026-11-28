import { useRef, useState } from 'react'
import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  showInFinder,
  showToast,
} from '@raycast/api'
import { usePromise } from '@raycast/utils'
import { transferAttachment } from './attachment'
import { authorizationFor, defaultOrigin } from './auth'
import { loadThumbnail } from './thumbnail'
import {
  assetUrl,
  catalogOrigin,
  mediaUrl,
  orderByRecentIds,
  searchVideos,
  subtitle,
  type Video,
} from './catalog'
import { getVideoFile } from './media-cache'
import { readRecentIds, rememberVideo } from './recents'

type Result = Video & { recent?: boolean }

async function recentVideos(base: string, signal?: AbortSignal): Promise<Result[]> {
  const ids = await readRecentIds(base)
  if (!ids.length) return []
  const { data } = await searchVideos(base, '', 1, authorizationFor(base), { ids, signal })
  return orderByRecentIds(ids, data).map((video) => ({ ...video, recent: true }))
}

function VideoItem({
  base,
  video,
  query,
  thumbnail,
  refresh,
}: {
  base: string
  video: Video
  query: string
  thumbnail?: string
  refresh: () => void
}) {
  const busy = useRef(false)
  async function useVideo(action: 'paste' | 'copy' | 'finder' | 'path') {
    if (busy.current) return
    busy.current = true
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: 'Préparation de la vidéo…',
    })
    try {
      const url = mediaUrl(base, video)
      const file = await getVideoFile(url, video.title)
      if (action === 'path') {
        await Clipboard.copy(file)
        toast.style = Toast.Style.Success
        toast.title = 'Chemin du fichier copié'
        return
      }
      if (action === 'finder') {
        await showInFinder(file)
        await toast.hide()
        return
      }
      const result = await transferAttachment(file, Clipboard, action === 'paste', async () => {
        // History is best-effort; the copied attachment is still usable if storage fails.
        try {
          await rememberVideo(base, video.id)
        } catch (error) {
          console.error('Historique MemeBank', error)
        }
      })
      if (result !== 'paste-requested') {
        toast.style = Toast.Style.Success
        toast.title =
          result === 'manual-paste' ? 'Fichier copié. Collez-le avec ⌘V.' : 'Fichier vidéo copié'
      } else {
        await toast.hide()
      }
      if (!query) refresh()
    } catch (error) {
      toast.style = Toast.Style.Failure
      toast.title = 'Vidéo indisponible'
      toast.message = error instanceof Error ? error.message : String(error)
    } finally {
      busy.current = false
    }
  }
  const seconds = Math.round(video.durationSeconds ?? 0)
  return (
    <List.Item
      id={video.id}
      title={video.title}
      subtitle={subtitle(video, query)}
      icon={thumbnail ? { source: thumbnail, fallback: Icon.FilmStrip } : Icon.FilmStrip}
      accessories={
        seconds > 0
          ? [{ text: Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') }]
          : []
      }
      actions={
        <ActionPanel>
          <Action
            title="Coller la vidéo"
            icon={Icon.Clipboard}
            onAction={() => useVideo('paste')}
          />
          <Action
            title="Copier le fichier vidéo"
            icon={Icon.CopyClipboard}
            shortcut={{ modifiers: ['cmd'], key: 'c' }}
            onAction={() => useVideo('copy')}
          />
          <Action
            title="Afficher dans le Finder"
            icon={Icon.Finder}
            shortcut={{ modifiers: ['cmd'], key: 'f' }}
            onAction={() => useVideo('finder')}
          />
          <Action
            title="Copier le chemin du fichier"
            icon={Icon.Document}
            shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
            onAction={() => useVideo('path')}
          />
        </ActionPanel>
      }
    />
  )
}

function Catalog({ base }: { base: string }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const abortable = useRef<AbortController | null>(null)
  const { data, error, isLoading, pagination, revalidate } = usePromise(
    (text: string) =>
      async ({ page }: { page: number }) => {
        const signal = abortable.current?.signal
        const [result, recent] = await Promise.all([
          searchVideos(base, text, page + 1, authorizationFor(base), { signal }),
          page === 0 && !text ? recentVideos(base, signal) : [],
        ])
        return { data: [...recent, ...result.data] as Result[], hasMore: result.hasMore }
      },
    [query],
    { abortable, onError: () => {} }
  )
  const recent = data?.filter((video) => video.recent) || []
  const seen = new Set(recent.map((video) => video.id))
  const remaining = (data || []).filter((video) => {
    if (seen.has(video.id)) return false
    seen.add(video.id)
    return true
  })
  const selectedVideo = data?.find((video) => video.id === selected)
  const thumbnailUrl = assetUrl(base, selectedVideo?.thumbnailPath)
  const thumbnailAbort = useRef<AbortController | null>(null)
  const thumbnail = usePromise(
    async (url: string | undefined) => ({
      url,
      source: await loadThumbnail(url, thumbnailAbort.current?.signal),
    }),
    [thumbnailUrl],
    { abortable: thumbnailAbort, onError: () => {} }
  )
  const item = (video: Video) => (
    <VideoItem
      key={video.id}
      base={base}
      query={query}
      video={video}
      thumbnail={
        video.id === selected && thumbnail.data?.url === thumbnailUrl
          ? thumbnail.data?.source
          : undefined
      }
      refresh={revalidate}
    />
  )
  return (
    <List
      navigationTitle="MemeBank"
      searchBarPlaceholder="Un titre, une réplique…"
      filtering={false}
      throttle
      onSelectionChange={setSelected}
      onSearchTextChange={(text) => setQuery(text.trim())}
      isLoading={isLoading}
      pagination={pagination}
    >
      {error ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Catalogue indisponible"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="Réessayer" icon={Icon.Repeat} onAction={revalidate} />
              <Action
                title="Ouvrir les préférences"
                icon={Icon.Gear}
                onAction={openExtensionPreferences}
              />
            </ActionPanel>
          }
        />
      ) : (
        <>
          {!isLoading && !recent.length && !remaining.length && (
            <List.EmptyView
              icon={Icon.FilmStrip}
              title={query ? 'Aucune vidéo trouvée' : 'Aucune vidéo publiée'}
              description={
                query ? 'Essayez un autre titre ou quelques mots d’une réplique.' : undefined
              }
            />
          )}
          {recent.length > 0 && (
            <List.Section title="Dernières vidéos utilisées">{recent.map(item)}</List.Section>
          )}
          <List.Section title={query ? undefined : 'Vidéos publiées'}>
            {remaining.map(item)}
          </List.Section>
        </>
      )}
    </List>
  )
}

export default function Command() {
  const { baseUrl } = getPreferenceValues<{ baseUrl?: string }>()
  try {
    return <Catalog base={catalogOrigin(baseUrl || defaultOrigin)} />
  } catch {
    return (
      <List>
        <List.EmptyView
          title="Adresse de MemeBank invalide"
          description="Saisissez une adresse HTTPS ou une adresse HTTP locale dans les préférences."
          actions={
            <ActionPanel>
              <Action title="Ouvrir les préférences" onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      </List>
    )
  }
}
