import { useState, useEffect, useRef } from 'react'

interface Person {
  id: string
  name: string
  socialMediaHandle: string | null
  platform: string | null
}

interface PersonTagInputProps {
  selectedPersons: Person[]
  onChange: (persons: Person[]) => void
  placeholder?: string
}

export default function PersonTagInput({
  selectedPersons,
  onChange,
  placeholder = 'Ajouter une personne (ex: Naima)...',
}: PersonTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch suggestions when typing
  useEffect(() => {
    if (inputValue.trim().length < 2) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/v1/persons/search?q=${encodeURIComponent(inputValue)}`)
        const data = await response.json()
        // Filter out already selected persons
        const filtered = (data.data || []).filter(
          (p: Person) => !selectedPersons.find((sp) => sp.id === p.id)
        )
        setSuggestions(filtered)
      } catch (err) {
        console.error('Failed to fetch suggestions:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timeout = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timeout)
  }, [inputValue, selectedPersons])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addPerson = (person: Person) => {
    if (!selectedPersons.find((p) => p.id === person.id)) {
      onChange([...selectedPersons, person])
    }
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const createNewPerson = () => {
    if (!inputValue.trim()) return

    // Create a new person on the fly
    const newPerson: Person = {
      id: `temp-${Date.now()}`,
      name: inputValue.trim(),
      socialMediaHandle: null,
      platform: null,
    }

    onChange([...selectedPersons, newPerson])
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removePerson = (personId: string) => {
    onChange(selectedPersons.filter((p) => p.id !== personId))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0) {
        addPerson(suggestions[0])
      } else if (inputValue.trim()) {
        createNewPerson()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected persons tags */}
      {selectedPersons.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedPersons.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-1 px-2 py-1 bg-primary-100 border-2 border-black text-sm font-bold"
            >
              <span>{person.name}</span>
              {person.socialMediaHandle && (
                <span className="text-xs text-gray-600">@{person.socialMediaHandle}</span>
              )}
              <button
                type="button"
                onClick={() => removePerson(person.id)}
                className="ml-1 text-red-500 hover:text-red-700 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
        />

        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (inputValue.trim().length >= 2 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-black shadow-neo max-h-48 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => addPerson(person)}
                className="w-full text-left px-3 py-2 hover:bg-primary-100 border-b border-gray-200 last:border-b-0"
              >
                <div className="font-bold">{person.name}</div>
                {person.socialMediaHandle && (
                  <div className="text-xs text-gray-600">
                    @{person.socialMediaHandle} {person.platform && `(${person.platform})`}
                  </div>
                )}
              </button>
            ))
          ) : inputValue.trim().length >= 2 && !isLoading ? (
            <button
              type="button"
              onClick={createNewPerson}
              className="w-full text-left px-3 py-2 hover:bg-primary-100 text-sm"
            >
              <span className="font-bold">+ Créer "{inputValue.trim()}"</span>
              <span className="text-gray-600 ml-2">(nouvelle personne)</span>
            </button>
          ) : null}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Tapez au moins 2 caractères pour voir les suggestions, ou appuyez sur Entrée pour créer une
        nouvelle personne.
      </p>
    </div>
  )
}
