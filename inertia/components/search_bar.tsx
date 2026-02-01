import { useState, useEffect } from 'react'

interface SearchFilters {
  query: string
  region: string
  personId: string
  sortBy: 'newest' | 'oldest' | 'views' | 'likes'
}

interface SearchBarProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onSearch: (filters?: SearchFilters) => void
  regions: Array<{ id: string; name: string }>
}

// Debounce hook with cancel support
function useDebounce<T>(value: T, delay: number): { value: T; isPending: boolean } {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    setIsPending(true)
    const timer = setTimeout(() => {
      setDebouncedValue(value)
      setIsPending(false)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return { value: debouncedValue, isPending }
}

export default function SearchBar({ filters, onChange, onSearch, regions }: SearchBarProps) {
  const [personSuggestions, setPersonSuggestions] = useState<Array<{ id: string; name: string }>>(
    []
  )
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false)
  const [personSearch, setPersonSearch] = useState('')

  // Debounce the query for dynamic search (500ms delay for stability)
  const { value: debouncedQuery, isPending: isTyping } = useDebounce(filters.query, 500)

  // Trigger search when debounced query changes
  useEffect(() => {
    // Only auto-search if query has at least 2 characters or was cleared
    if (debouncedQuery.length === 0 || debouncedQuery.length >= 2) {
      onSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  // Fetch person suggestions
  useEffect(() => {
    if (personSearch.trim().length < 2) {
      setPersonSuggestions([])
      return
    }

    const fetchPersons = async () => {
      const response = await fetch(`/api/v1/persons/search?q=${encodeURIComponent(personSearch)}`)
      const data = await response.json()
      setPersonSuggestions(data.data || [])
    }

    const timeout = setTimeout(fetchPersons, 300)
    return () => clearTimeout(timeout)
  }, [personSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch()
  }

  const clearFilters = () => {
    const resetFilters: SearchFilters = {
      query: '',
      region: '',
      personId: '',
      sortBy: 'newest',
    }
    onChange(resetFilters)
    setPersonSearch('')
    // Trigger search immediately with cleared filters
    onSearch(resetFilters)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-black p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Main search input */}
        <div className="md:col-span-2">
          <label className="block text-sm font-bold uppercase mb-1">Recherche</label>
          <div className="relative">
            <input
              type="text"
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Rechercher par titre, description, transcription..."
              className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500 pr-8"
            />
            {isTyping && (
              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
                ⌨️
              </span>
            )}
          </div>
        </div>

        {/* Region filter */}
        <div>
          <label className="block text-sm font-bold uppercase mb-1">Région</label>
          <select
            value={filters.region}
            onChange={(e) => onChange({ ...filters, region: e.target.value })}
            className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
          >
            <option value="">Toutes les régions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-bold uppercase mb-1">Trier par</label>
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
            className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
          >
            <option value="newest">Plus récent</option>
            <option value="oldest">Plus ancien</option>
            <option value="views">Plus vues</option>
            <option value="likes">Plus aimées</option>
          </select>
        </div>
      </div>

      {/* Person filter */}
      <div className="mt-4 relative">
        <label className="block text-sm font-bold uppercase mb-1">Personne</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={personSearch}
              onChange={(e) => {
                setPersonSearch(e.target.value)
                setShowPersonSuggestions(true)
              }}
              onFocus={() => setShowPersonSuggestions(true)}
              placeholder="Filtrer par personne (ex: Naima)..."
              className="w-full p-2 border-2 border-black focus:outline-none focus:border-primary-500"
            />
            {filters.personId && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...filters, personId: '' })
                  setPersonSearch('')
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-500 font-bold"
              >
                ×
              </button>
            )}
          </div>
          <button type="submit" className="btn-neo-primary px-6 py-2 font-bold">
            🔍 Rechercher
          </button>
          <button type="button" onClick={clearFilters} className="btn-neo-brick px-4 py-2">
            ✕
          </button>
        </div>

        {/* Person suggestions */}
        {showPersonSuggestions && personSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-black shadow-neo max-h-48 overflow-y-auto">
            {personSuggestions.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  onChange({ ...filters, personId: person.id })
                  setPersonSearch(person.name)
                  setShowPersonSuggestions(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-primary-100 border-b border-gray-200 last:border-b-0"
              >
                <span className="font-bold">{person.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active filters display */}
      {(filters.region || filters.personId) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm font-bold text-gray-600">Filtres actifs:</span>
          {filters.region && (
            <span className="px-2 py-1 bg-secondary-100 border border-black text-sm font-bold">
              Région: {regions.find((r) => r.id === filters.region)?.name}
              <button
                type="button"
                onClick={() => onChange({ ...filters, region: '' })}
                className="ml-1 text-red-500"
              >
                ×
              </button>
            </span>
          )}
          {filters.personId && personSearch && (
            <span className="px-2 py-1 bg-primary-100 border border-black text-sm font-bold">
              Personne: {personSearch}
              <button
                type="button"
                onClick={() => {
                  onChange({ ...filters, personId: '' })
                  setPersonSearch('')
                }}
                className="ml-1 text-red-500"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </form>
  )
}
