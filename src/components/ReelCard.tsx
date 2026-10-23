'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Calendar, X, Sparkles, CheckCircle2, ListOrdered, Tag } from 'lucide-react'
import { SavedReel } from '@/lib/types'

function safeList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {}
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export default function ReelCard({ reel }: { reel: SavedReel }) {
  const [isOpen, setIsOpen] = useState(false)

  const summary = reel.summary || 'No summary available.'
  const keyPoints = safeList(reel.key_points)
  const actions = safeList(reel.actions)
  const ingredients = safeList(reel.ingredients)
  const keywords = safeList(reel.search_keywords)
  const entities = safeList(reel.entities)

  const hasLongContent =
    summary.length > 140 ||
    keyPoints.length > 0 ||
    actions.length > 0 ||
    ingredients.length > 0 ||
    keywords.length > 0 ||
    Boolean(reel.use_case) ||
    Boolean(reel.why_useful)

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg line-clamp-2 leading-tight text-stone-900">
            {reel.title || 'Untitled Reel'}
          </h3>
          <div className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap ml-3 uppercase tracking-wider">
            {reel.category || 'Saved'}
          </div>
        </div>

        <p className="text-stone-600 text-sm mb-3 line-clamp-3 leading-relaxed">
          {summary}
        </p>

        {hasLongContent && (
          <button
            onClick={() => setIsOpen(true)}
            className="text-stone-900 text-xs font-semibold hover:underline flex items-center gap-1 self-start mb-3"
          >
            Read More →
          </button>
        )}

        <div className="flex items-center justify-between text-xs text-stone-500 mt-auto pt-4 border-t border-stone-100">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>
              {new Date(reel.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
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

      {/* Detail Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                <span className="text-xs font-bold tracking-wider text-stone-500 uppercase">
                  Post Vault Analysis
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {reel.thumbnail_url && (
                <div className="w-full h-48 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                  <img
                    src={reel.thumbnail_url}
                    alt={reel.title || 'Reel thumbnail'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-stone-100 text-stone-700 text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    {reel.category || 'Saved'}
                  </span>
                  {reel.sub_category && (
                    <span className="text-xs text-stone-500">• {reel.sub_category}</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-stone-900 leading-snug">
                  {reel.title || 'Untitled Reel'}
                </h2>
              </div>

              <div>
                <Link
                  href={reel.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors shadow-sm"
                >
                  View on Instagram
                  <ExternalLink size={14} />
                </Link>
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-stone-900 tracking-tight">Summary</h4>
                <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">
                  {summary}
                </p>
              </div>

              {/* Key Takeaways */}
              {keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-stone-900 tracking-tight">Key Takeaways</h4>
                  <ul className="space-y-1.5">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                        <span className="text-stone-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              {actions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-stone-900 tracking-tight">Action Steps</h4>
                  <ol className="space-y-1.5">
                    {actions.map((act, i) => (
                      <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                        <span className="font-semibold text-stone-500 text-xs mt-0.5">{i + 1}.</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-stone-900 tracking-tight">Ingredients / Tools</h4>
                  <ul className="space-y-1.5">
                    {ingredients.map((ing, i) => (
                      <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 mt-1 shrink-0" />
                        <span>{ing}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Why Useful */}
              {(reel.why_useful || reel.use_case) && (
                <div className="space-y-1.5 bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Why It&apos;s Useful
                  </h4>
                  {reel.why_useful && <p className="text-sm text-stone-700">{reel.why_useful}</p>}
                  {reel.use_case && (
                    <p className="text-xs italic text-stone-600">Best for: {reel.use_case}</p>
                  )}
                </div>
              )}

              {/* Tags / Keywords */}
              {(keywords.length > 0 || entities.length > 0) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
                    <Tag size={14} className="text-stone-500" />
                    Keywords &amp; Topics
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...keywords, ...entities])).map((tag, i) => (
                      <span
                        key={i}
                        className="bg-stone-100 text-stone-700 text-xs px-2.5 py-1 rounded-md font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-stone-100 bg-stone-50/50 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
