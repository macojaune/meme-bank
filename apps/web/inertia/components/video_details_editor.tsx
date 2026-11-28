import { useState, type FormEvent } from 'react'
import { Button } from '~/components/motion/button/base'
import { Input } from '~/components/motion/input'
import CategoryPicker, { type Category } from './category_picker'
import PersonTagInput from './person_tag_input'
import { VIDEO_TERRITORIES } from '../../shared/video_territories'

export interface VideoDetails {
  id: string
  title: string
  region: string | null
  canEdit: boolean
  canCreateCategory: boolean
  persons: { id: string; name: string; socialMediaHandle: string | null; platform: string | null }[]
  categories: Category[]
  categoryOptions: Category[]
}

async function saveError(response: Response) {
  if (response.status === 401 || response.status === 419) {
    return 'Ta session a expiré. Reconnecte-toi, puis rouvre la fiche.'
  }
  if (response.status === 403) return 'Tu n’as pas l’autorisation de modifier cette fiche.'
  if (response.status === 404) return 'Cette fiche est devenue indisponible.'
  if (response.status === 422) {
    const data = (await response.json().catch(() => null)) as {
      message?: string
      errors?: Array<{ field: string }>
    } | null
    const field = data?.errors?.[0]?.field?.split('.')[0]
    const messages: Record<string, string> = {
      title: 'Le titre doit faire au plus 255 caractères.',
      region: 'Choisis un territoire dans la liste.',
      categoryIds: 'Vérifie les catégories de la fiche.',
      newCategory: 'Le nom de la catégorie doit faire entre 2 et 60 caractères.',
      personIds: 'Vérifie les personnes déjà associées.',
      newPeople: 'Le nom d’une personne doit faire entre 2 et 100 caractères.',
    }
    return (field && messages[field]) || data?.message || 'Vérifie les valeurs de la fiche.'
  }
  return 'Le serveur n’a pas pu enregistrer la fiche. Réessaie dans un instant.'
}

export default function VideoDetailsEditor({
  details,
  onSave,
  onCancel,
}: {
  details: VideoDetails
  onSave: (updated: VideoDetails) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(details.title)
  const [region, setRegion] = useState(details.region ?? '')
  const [persons, setPersons] = useState(details.persons)
  const [categoryIds, setCategoryIds] = useState(() => details.categories.map(({ id }) => id))
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const categoryOptions = [
    ...details.categoryOptions,
    ...details.categories.filter(
      ({ id }) => !details.categoryOptions.some((option) => option.id === id)
    ),
  ]

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')

    try {
      const endpoint = `/api/v1/videos/${details.id}/details`
      const payload = JSON.stringify({
        title,
        region: region === (details.region ?? '') ? undefined : region || null,
        personIds: persons.filter(({ id }) => !id.startsWith('temp-')).map(({ id }) => id),
        newPeople: persons.filter(({ id }) => id.startsWith('temp-')).map(({ name }) => name),
        categoryIds,
        newCategory: newCategory || undefined,
      })
      const send = () => {
        const csrf = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        return fetch(endpoint, {
          method: 'PATCH',
          credentials: 'same-origin',
          redirect: 'error',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-xsrf-token': csrf ? decodeURIComponent(csrf.slice('XSRF-TOKEN='.length)) : '',
          },
          body: payload,
        })
      }

      let response = await send()
      if (response.status === 419) {
        const refresh = await fetch(endpoint, { credentials: 'same-origin', redirect: 'error' })
        response = refresh.ok ? await send() : refresh
      }
      if (!response.ok) {
        setError(await saveError(response))
        return
      }
      onSave(await response.json())
    } catch {
      setError('Impossible d’enregistrer la fiche. Réessaie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      method="post"
      onSubmit={save}
      className="border-4 border-black bg-white p-4"
      aria-label="Modifier la fiche"
    >
      <fieldset disabled={saving} className="space-y-4">
        <Input
          label="Titre"
          value={title}
          onChange={setTitle}
          maxLength={255}
          classNames={{
            field: 'rounded-none border-2 border-black focus-within:ring-2 focus-within:ring-black',
          }}
        />
        <label className="block text-sm font-bold">
          Territoire
          <select
            className="mt-2 block w-full border-2 border-black bg-white px-3 py-2"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            <option value="">Aucun territoire</option>
            {details.region && !VIDEO_TERRITORIES.some(({ id }) => id === details.region) && (
              <option value={details.region}>{details.region}</option>
            )}
            {VIDEO_TERRITORIES.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <h3 className="mb-2 text-sm font-black uppercase">Personnes</h3>
          <PersonTagInput
            selectedPersons={persons}
            onChange={setPersons}
            placeholder="Chercher ou ajouter une personne"
          />
        </div>
        <CategoryPicker
          options={categoryOptions}
          ids={categoryIds}
          newName={newCategory}
          canCreate={details.canCreateCategory}
          disabled={saving}
          onChange={(ids, name) => {
            setCategoryIds(ids)
            setNewCategory(name)
          }}
        />
        {error && (
          <p role="alert" className="font-bold text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="h-auto rounded-none border-2 border-black bg-yellow-400 text-black hover:bg-yellow-300 px-4 py-2 font-black"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-auto rounded-none border-2 border-black px-4 py-2 font-bold"
          >
            Annuler
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
