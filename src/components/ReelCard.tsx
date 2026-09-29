import Link from 'next/link'
import { ExternalLink, Calendar } from 'lucide-react'
import { SavedReel } from '@/lib/types'

export default function ReelCard({ reel }: { reel: SavedReel }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg line-clamp-2 leading-tight">
          {reel.title || "Untitled Reel"}
        </h3>
        <div className="bg-stone-100 text-stone-600 text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap ml-3">
          {reel.category || "Uncategorized"}
        </div>
      </div>
      
      <p className="text-stone-600 text-sm mb-4 line-clamp-3 flex-1">
        {reel.summary || "No summary available."}
      </p>
      
      <div className="flex items-center justify-between text-xs text-stone-500 mt-auto pt-4 border-t border-stone-100">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} />
          <span>{new Date(reel.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        
        <Link 
          href={reel.source_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-stone-900 font-medium hover:underline"
        >
          Open Reel
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  )
}
