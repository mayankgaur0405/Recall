'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search as SearchIcon, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import ReelCard from '@/components/ReelCard'
import { SavedReel } from '@/lib/types'
import Link from 'next/link'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''
  
  const [query, setQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SavedReel[]>([])
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery)
    }
  }, [initialQuery])

  const performSearch = async (searchStr: string) => {
    if (!searchStr.trim()) return

    setIsSearching(true)
    setHasSearched(true)
    setAiAnswer(null)
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchStr })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data.results || [])
      setAiAnswer(data.answer)
      
      // Update URL without reloading
      router.replace(`/search?q=${encodeURIComponent(searchStr)}`)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(query)
  }

  return (
    <div className="w-full pt-8 pb-20">
      <div className="max-w-2xl mx-auto mb-10">
        <form onSubmit={handleSubmit} className="relative w-full shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon size={20} className="text-stone-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your saved reels..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all text-lg"
          />
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-4 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>
      </div>

      {isSearching && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-500">
          <Loader2 size={32} className="animate-spin mb-4 text-stone-300" />
          <p>Searching your memory...</p>
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-100 mb-4">
            <SearchIcon size={24} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-1">No results found</h3>
          <p className="text-stone-500">We couldn't find anything matching your question.</p>
        </div>
      )}

      {!isSearching && aiAnswer && (
        <div className="w-full mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-indigo-600 font-medium">
              <Sparkles size={18} />
              <h3>AI Answer</h3>
            </div>
            <div className="prose prose-stone max-w-none text-stone-700 whitespace-pre-wrap">
              {aiAnswer}
            </div>
          </div>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">
            Sources ({results.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((reel) => (
              <ReelCard key={reel.id} reel={reel} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-stone-300" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
