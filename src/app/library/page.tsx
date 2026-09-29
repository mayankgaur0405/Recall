'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import ReelCard from '@/components/ReelCard'
import { SavedReel } from '@/lib/types'
import { Loader2, Library as LibraryIcon, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LibraryPage() {
  const [reels, setReels] = useState<SavedReel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchReels()
  }, [])

  const fetchReels = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data && !error) {
      setReels(data as SavedReel[])
    }
    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this saved Reel?")) return;

    try {
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Reel deleted')
      setReels(reels.filter(r => r.id !== id))
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="w-full pt-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded-lg">
            <LibraryIcon size={24} className="text-stone-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
            <p className="text-stone-500 text-sm">Everything you've saved.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-stone-300" />
        </div>
      ) : reels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reels.map((reel) => (
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
      ) : (
        <div className="text-center py-32 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-stone-100 shadow-sm mb-4">
            <LibraryIcon size={24} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-1">Your library is empty</h3>
          <p className="text-stone-500">You haven't saved any Reels yet.</p>
        </div>
      )}
    </div>
  )
}
