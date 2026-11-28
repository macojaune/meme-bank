import { useState } from 'react'
import { Button } from '~/components/motion/button/base'
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

export type Category = { id: string; name: string }
export const categoryTagClass = 'border-2 border-black bg-yellow-300 px-3 py-1.5 text-sm font-bold'
const newCategoryValue = 'new-category'

function normalizeName(text: string) {
  return text.trim().toLocaleLowerCase('fr').normalize('NFC')
}

function searchText(text: string) {
  return normalizeName(text).normalize('NFD').replace(/\p{M}/gu, '')
}

export default function CategoryPicker({
  options,
  ids,
  newName,
  canCreate,
  disabled,
  onChange,
  onAdd,
}: {
  options: Category[]
  ids: string[]
  newName: string
  canCreate: boolean
  disabled: boolean
  onChange: (ids: string[], newName: string) => void
  onAdd: (name: string) => Promise<boolean>
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const candidate = query.trim()
  const canAdd =
    canCreate &&
    candidate.length >= 2 &&
    candidate.length <= 60 &&
    !options.some(({ name }) => normalizeName(name) === normalizeName(candidate))
  const draft = newName || (canAdd ? candidate : '')
  const values = newName ? [...ids, newCategoryValue] : ids

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-black uppercase">Catégories</legend>
      <MultiSelect
        value={values}
        onValueChange={(next) =>
          onChange(
            next.filter((id) => id !== newCategoryValue),
            next.includes(newCategoryValue) ? draft : ''
          )
        }
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        disabled={disabled}
        filter={(_, text, [name = '']) => searchText(name).includes(searchText(text))}
        labels={{ removeValue: 'Retirer {label}' }}
      >
        <div className="flex items-start gap-2">
          <MultiSelectTrigger className="min-w-0 rounded-none border-2 border-black bg-white text-black focus-within:ring-black">
            <MultiSelectValue
              placeholder=""
              chipClassName={`${categoryTagClass} h-auto rounded-none [clip-path:none]! text-black [&_button]:text-black`}
            />
            <MultiSelectInput
              aria-label="Catégories"
              placeholder={
                canCreate ? 'Rechercher ou ajouter une catégorie' : 'Rechercher une catégorie'
              }
            />
          </MultiSelectTrigger>
          {canCreate && (
            <Button
              type="button"
              aria-label="Valider l’ajout de la catégorie"
              title="Valider l’ajout de la catégorie"
              disabled={disabled || !draft}
              onClick={async () => {
                if (draft && (await onAdd(draft))) {
                  setQuery('')
                  setOpen(false)
                }
              }}
              className="size-11 shrink-0 rounded-none border-2 border-black bg-yellow-400 p-0 text-xl font-black text-black hover:bg-yellow-300 focus-visible:outline-2"
            >
              <span aria-hidden="true">+</span>
            </Button>
          )}
        </div>
        <MultiSelectContent className="rounded-none border-2 border-black bg-white text-black shadow-[4px_4px_0px_black]">
          <MultiSelectList ariaLabel="Catégories existantes" className="max-h-48">
            {options.map(({ id, name }) => (
              <MultiSelectItem
                key={id}
                value={id}
                className="rounded-none text-black data-[active]:bg-yellow-300 data-[selected]:font-bold"
              >
                {name}
              </MultiSelectItem>
            ))}
            {draft && (
              <MultiSelectItem
                value={newCategoryValue}
                textValue={draft}
                className="rounded-none border-t border-black text-black data-[active]:bg-yellow-300"
              >
                {newName ? newName : `Ajouter « ${draft} »`}
              </MultiSelectItem>
            )}
            <MultiSelectEmpty>
              {options.length ? 'Aucune catégorie trouvée.' : 'Aucune catégorie disponible.'}
            </MultiSelectEmpty>
          </MultiSelectList>
          {canCreate && !newName && !query && (
            <p className="border-t border-black px-3 py-2 text-xs">
              Tape un nom pour ajouter une catégorie.
            </p>
          )}
        </MultiSelectContent>
      </MultiSelect>
    </fieldset>
  )
}
