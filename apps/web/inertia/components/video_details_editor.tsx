import { useState, type FormEvent } from 'react'
import { Button } from '~/components/motion/button/base'
import { Input } from '~/components/motion/input'
import PersonTagInput from './person_tag_input'

type Category = { id: string; name: string }

export interface VideoDetails {
  id: string
  title: string
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
  const [persons, setPersons] = useState(details.persons)
  const [categoryIds, setCategoryIds] = useState(details.categories.map(({ id }) => id))
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
        <div>
          <h3 className="mb-2 text-sm font-black uppercase">Personnes</h3>
          <PersonTagInput
            selectedPersons={persons}
            onChange={setPersons}
            placeholder="Chercher ou ajouter une personne"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-black uppercase">Catégories</legend>
          {categoryOptions.length ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {categoryOptions.map(({ id, name }) => (
                <label key={id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(id)}
                    onChange={({ target }) =>
                      setCategoryIds((current) =>
                        target.checked ? [...current, id] : current.filter((value) => value !== id)
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Aucune catégorie disponible.</p>
          )}
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
