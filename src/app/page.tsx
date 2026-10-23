'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, AlertCircle, Check, Library } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import ReelCard from '@/components/ReelCard'
import { SavedReel } from '@/lib/types'

const PROCESSING_STEPS = [
  'URL received',
  'Extracting content from Instagram',
  'Downloading video',
  'Analyzing audio & visuals with AI',
  'Generating summary & extracting info',
  'Creating searchable embeddings',
  'Saving to Post Vault',
]

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [needsFallback, setNeedsFallback] = useState(false)
  const [manualContent, setManualContent] = useState('')
  const [recentReels, setRecentReels] = useState<SavedReel[]>([])
  const [isLoadingReels, setIsLoadingReels] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchRecentReels()
  }, [])

  const fetchRecentReels = async () => {
    setIsLoadingReels(true)
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
    
    if (data && !error) {
      setRecentReels(data as SavedReel[])
    }
    setIsLoadingReels(false)
  }

  const simulateSteps = () => {
    setCurrentStep(0)
    const timings = [0, 800, 1500, 2500, 4000, 6000, 8000]
    timings.forEach((delay, i) => {
      setTimeout(() => setCurrentStep(i), delay)
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const isManualMode = needsFallback
    if (!isManualMode && !url.includes('instagram.com/') && !url.includes('instagr.am/')) {
      toast.error('Please enter a valid Instagram Reel URL')
      return
    }
    if (isManualMode && !manualContent.trim()) {
      toast.error('Please provide a description or transcript')
      return
    }

    setIsProcessing(true)
    simulateSteps()

    try {
      const response = await fetch('/api/reels/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          manualContent: isManualMode ? manualContent : undefined,
        }),
      })

      const data = await response.json()

      if (response.status === 422 && data.needsFallback) {
        setNeedsFallback(true)
        setIsProcessing(false)
        setCurrentStep(0)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process reel')
      }

      setCurrentStep(PROCESSING_STEPS.length - 1)
      toast.success(data.duplicate ? 'Already in your library' : 'Reel saved to your library!')
      setUrl('')
      setManualContent('')
      setNeedsFallback(false)
      fetchRecentReels()
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while saving')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full pt-12 pb-20">

      {/* ── Hero ── */}
      <div className="text-center mb-10 w-full">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Post Vault</h1>
        <p className="text-stone-500">Your memory for the internet.</p>
      </div>

      {/* ── Save Reel ── */}
      <div className="w-full mb-10">
        <form onSubmit={handleSave} className="flex flex-col gap-4 w-full">
          {!needsFallback ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste an Instagram Reel link..."
                disabled={isProcessing}
                required
                className="flex-1 px-4 py-3.5 bg-white border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isProcessing || !url}
                className="bg-stone-900 text-white px-6 py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 whitespace-nowrap shadow-sm"
              >
                {isProcessing ? (
                  <><Loader2 size={18} className="animate-spin" /> Processing...</>
                ) : (
                  <><Plus size={18} /> Save Reel</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm text-left">
              <div className="flex items-start gap-3 mb-4 text-amber-800">
                <AlertCircle size={20} className="mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-amber-900 mb-1">We couldn't access the Reel content directly</h3>
                  <p className="text-sm">Paste the caption, transcript, or describe what the video is about.</p>
                </div>
              </div>
              <div className="text-xs text-stone-500 bg-stone-100 p-2 rounded truncate border border-stone-200 mb-3">
                URL: {url}
              </div>
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="e.g. This reel talks about a Lenovo LOQ laptop for programming..."
                rows={4}
                required
                className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all mb-3"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNeedsFallback(false); setUrl('') }}
                  className="px-4 py-2 text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isProcessing ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : 'Analyze & Save'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Processing steps */}
        {isProcessing && (
          <div className="mt-6 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Understanding your Reel...</h3>
            <div className="flex flex-col gap-2">
              {PROCESSING_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300 ${i <= currentStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < currentStep ? (
                    <Check size={16} className="text-green-600 shrink-0" />
                  ) : i === currentStep ? (
                    <Loader2 size={16} className="animate-spin text-stone-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-stone-300 shrink-0" />
                  )}
                  <span className={i <= currentStep ? 'text-stone-800' : 'text-stone-400'}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-stone-200 my-4"></div>

      {/* ── View Saved Reels Action Button ── */}
      <div className="w-full my-4">
        <button
          onClick={() => router.push('/library')}
          className="w-full py-4 px-6 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-semibold flex items-center justify-between shadow-sm transition-all hover:scale-[1.005] active:scale-[0.995]"
        >
          <span className="flex items-center gap-2.5">
            <Library size={20} />
            View Saved Reels
          </span>
          <span className="text-stone-300 font-bold">→</span>
        </button>
      </div>

      {/* ── Search ── */}
      <div className="w-full my-10">
        <h2 className="text-xl font-semibold mb-4 text-center">What are you looking for?</h2>
        <form onSubmit={handleSearch} className="relative w-full max-w-xl mx-auto mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-stone-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Which laptop did I save?"
            className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all"
          />
        </form>
        <div className="flex flex-wrap justify-center gap-2">
          {['Which laptop did I save?', 'Show me recipes', 'What travel places did I save?', 'Find my productivity reels'].map((ex) => (
            <button
              key={ex}
              onClick={() => { setSearchQuery(ex); router.push(`/search?q=${encodeURIComponent(ex)}`) }}
              className="text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-full transition-colors"
            >
              &ldquo;{ex}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* ── Recently Saved ── */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recently Saved</h2>
          <button onClick={() => router.push('/library')} className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
            View all
          </button>
        </div>
        {isLoadingReels ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-stone-300" /></div>
        ) : recentReels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentReels.map((reel) => <ReelCard key={reel.id} reel={reel} />)}
          </div>
        ) : (
          <div className="text-center py-12 bg-stone-100 rounded-xl border border-stone-200 border-dashed">
            <p className="text-stone-500 mb-2">You haven&apos;t saved any Reels yet.</p>
            <p className="text-sm text-stone-400">Paste a link above to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
