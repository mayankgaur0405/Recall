'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import ReelCard from '@/components/ReelCard'
import { SavedReel } from '@/lib/types'
import { Loader2, Library as LibraryIcon, Trash2, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'

function safeList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch { }
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export default function LibraryPage() {
  const [reels, setReels] = useState<SavedReel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  const fetchReels = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false })

      if (data && !error) {
        setReels(data as SavedReel[])
      }
    } catch (e) {
      console.warn('Failed to load reels:', e)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchReels(false)

    // Supabase Realtime subscription
    const channel = supabase
      .channel('reels-web-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reels' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReel = payload.new as SavedReel
            setReels((prev) => {
              if (prev.some((r) => r.id === newReel.id)) {
                return prev.map((r) => (r.id === newReel.id ? { ...r, ...newReel } : r))
              }
              return [newReel, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as SavedReel
            setReels((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
            )
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            if (oldId) {
              setReels((prev) => prev.filter((r) => r.id !== oldId))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchReels, supabase])

  // Adaptive background polling while any reel is being processed
  useEffect(() => {
    const hasActive = reels.some(
      (r) => r.processing_status === 'pending' || r.processing_status === 'processing'
    )
    if (!hasActive) return

    const interval = setInterval(() => {
      fetchReels(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [reels, fetchReels])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved Reel?')) return

    try {
      const { error } = await supabase.from('reels').delete().eq('id', id)
      if (error) throw error
      toast.success('Reel deleted')
      setReels((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Filtered reels based on search query across all metadata fields
  const filteredReels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return reels

    const terms = q.split(/\s+/).filter(Boolean)
    if (terms.length === 0) return reels

    return reels.filter((reel) => {
      const blob = [
        reel.title,
        reel.summary,
        reel.category,
        reel.sub_category,
        reel.use_case,
        reel.why_useful,
        reel.original_caption,
        reel.transcript,
        safeList(reel.key_points).join(' '),
        safeList(reel.search_keywords).join(' '),
        safeList(reel.entities).join(' '),
        safeList(reel.actions).join(' '),
        safeList(reel.ingredients).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return terms.every((term) => blob.includes(term))
    })
  }, [reels, searchQuery])

  return (
    <div className="w-full pt-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded-lg">
            <LibraryIcon size={24} className="text-stone-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Saved Reels</h1>
            <p className="text-stone-500 text-sm">
              Your personal library in Post Vault.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {reels.length > 0 && (
        <div className="relative mb-8">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your saved Reels..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 text-stone-400 hover:text-stone-600 rounded-full"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <div className="text-xs text-stone-500 mt-2 px-1 font-medium">
              {filteredReels.length === 1
                ? '1 Reel found'
                : `${filteredReels.length} Reels found`}
            </div>
          )}
        </div>
      )}

      {isLoading && reels.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-stone-300" />
        </div>
      ) : reels.length === 0 ? (
        <div className="text-center py-32 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-stone-100 shadow-sm mb-4">
            <LibraryIcon size={24} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-1">Nothing saved yet</h3>
          <p className="text-stone-500">Share a Reel from Instagram to Post Vault.</p>
        </div>
      ) : filteredReels.length === 0 ? (
        <div className="text-center py-20 bg-stone-50 rounded-2xl border border-stone-200">
          <h3 className="text-lg font-semibold text-stone-900 mb-1">No Reels found</h3>
          <p className="text-stone-500 text-sm mb-4">
            No saved Reels matched &ldquo;{searchQuery.trim()}&rdquo;. Try another search.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors shadow-sm"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReels.map((reel) => (
            <div key={reel.id} className="relative group">
              <ReelCard reel={reel} />
              <button
                onClick={() => handleDelete(reel.id)}
                className="absolute top-3 right-3 p-2 bg-white/90 text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 border border-stone-100"
                title="Delete Reel"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
