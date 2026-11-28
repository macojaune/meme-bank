import { useState, type FormEvent } from 'react'
import { Button } from '~/components/motion/button/base'
import { Input } from '~/components/motion/input'
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from '~/components/motion/multi-select'
import PersonTagInput from './person_tag_input'
import { VIDEO_TERRITORIES } from '../../shared/video_territories'

type Category = { id: string; name: string }

function normalizeCategorySearch(text: string) {
  return text.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu, '')
}

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
      const csrf = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))
      const response = await fetch(`/api/v1/videos/${details.id}/details`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'x-xsrf-token': csrf ? decodeURIComponent(csrf.slice('XSRF-TOKEN='.length)) : '',
        },
        body: JSON.stringify({
          title,
          region: region === (details.region ?? '') ? undefined : region || null,
          personIds: persons.filter(({ id }) => !id.startsWith('temp-')).map(({ id }) => id),
          newPeople: persons.filter(({ id }) => id.startsWith('temp-')).map(({ name }) => name),
          categoryIds,
          newCategory: newCategory.trim() || undefined,
        }),
      })
      if (response.status === 401 || response.status === 403) {
        setError('Tu n’as pas l’autorisation de modifier cette fiche.')
        return
      }
      if (!response.ok) {
        setError('Vérifie le titre, les personnes et les catégories avant de réessayer.')
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
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-black uppercase">Catégories</legend>
          <MultiSelect
            value={categoryIds}
            onValueChange={setCategoryIds}
            disabled={saving}
            filter={(_, query, [name = '']) =>
              normalizeCategorySearch(name).includes(normalizeCategorySearch(query))
            }
            labels={{ removeValue: 'Retirer {label}' }}
          >
            <MultiSelectTrigger className="min-w-0 rounded-none border-2 border-black bg-white text-black focus-within:ring-black">
              <MultiSelectValue
                placeholder=""
                chipClassName="rounded-none border border-black bg-yellow-300 font-bold text-black [&_button]:text-black"
              />
              <MultiSelectInput aria-label="Catégories" placeholder="Rechercher une catégorie" />
            </MultiSelectTrigger>
            <MultiSelectContent className="rounded-none border-2 border-black bg-white text-black shadow-[4px_4px_0px_black]">
              <MultiSelectList ariaLabel="Catégories existantes" className="max-h-48">
                {categoryOptions.map(({ id, name }) => (
                  <MultiSelectItem
                    key={id}
                    value={id}
                    className="rounded-none text-black data-[active]:bg-yellow-300 data-[selected]:font-bold"
                  >
                    {name}
                  </MultiSelectItem>
                ))}
                <MultiSelectEmpty>
                  {categoryOptions.length
                    ? 'Aucune catégorie trouvée.'
                    : 'Aucune catégorie disponible.'}
                </MultiSelectEmpty>
              </MultiSelectList>
            </MultiSelectContent>
          </MultiSelect>
        </fieldset>
        {details.canCreateCategory && (
          <Input
            label="Nouvelle catégorie"
            value={newCategory}
            onChange={setNewCategory}
            maxLength={60}
            classNames={{
              field:
                'rounded-none border-2 border-black focus-within:ring-2 focus-within:ring-black',
            }}
          />
        )}
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
