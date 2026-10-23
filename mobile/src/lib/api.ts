import { extractInstagramReelUrl } from './urls'
import { apiUrl } from './config'
import { supabase } from './auth'
import type { Session } from '@supabase/supabase-js'

export type SavedReel = {
  id: string
  title: string | null
  summary: string | null
  category: string | null
  sub_category?: string | null
  source_url: string
  thumbnail_url?: string | null
  processing_status: string | null
  created_at: string
  key_points?: string[] | null
  entities?: string[] | null
  search_keywords?: string[] | null
  actions?: string[] | null
  ingredients?: string[] | null
  use_case?: string | null
  why_useful?: string | null
  original_caption?: string | null
  transcript?: string | null
}

export type IngestResponse = {
  success?: boolean
  savedItem?: SavedReel
  duplicate?: boolean
  persisted?: string
  error?: string
}

/**
 * Fire-and-forget: tell the backend to run AI analysis on a reel
 * that was saved directly to Supabase. Non-blocking — failure here
 * does not affect the saved reel.
 */
async function triggerBackendAnalysis(session: Session, reelId: string, sourceUrl: string): Promise<void> {
  if (!apiUrl) return
  try {
    console.log(`[Ingest] Triggering backend analysis for reel ${reelId}`)
    await fetch(`${apiUrl}/api/reels/trigger-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ reelId, sourceUrl }),
    })
  } catch (err) {
    console.warn('[Ingest] Backend analysis trigger failed (reel is saved, can retry later):', err instanceof Error ? err.message : String(err))
  }
}

/**
 * Retry analysis for a failed or pending reel via the backend retry endpoint.
 */
export async function retryReelAnalysis(session: Session, reelId: string): Promise<{ success: boolean; error?: string }> {
  if (!apiUrl) {
    return { success: false, error: 'Backend API URL is not configured.' }
  }

  try {
    const response = await fetch(`${apiUrl}/api/reels/${reelId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return { success: false, error: data.error || `Retry failed (${response.status})` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function ingestReel(session: Session, rawUrl: string): Promise<IngestResponse> {
  const url = extractInstagramReelUrl(rawUrl)
  if (!url) {
    throw new Error('That share did not include a supported Instagram Reel link.')
  }

  // Attempt 1: Ingest via primary Next.js backend API
  if (apiUrl) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    try {
      console.log(`[Ingest] Posting Reel to backend: ${apiUrl}/api/reels/ingest`)
      const res = await fetchIngest(session, url, controller.signal)
      console.log(`[Ingest] Backend save succeeded (duplicate=${res.duplicate})`)
      return res
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      if (code === 'unauthorized' || code === 'client') {
        throw err
      }
      console.warn(`[Ingest] Backend request failed (${err instanceof Error ? err.message : String(err)}). Falling back to direct Supabase save...`)
    } finally {
      clearTimeout(timer)
    }
  }

  // Attempt 2: Resilient direct Supabase database save
  try {
    console.log('[Ingest] Attempting direct Supabase database insert for Reel:', url)
    const { data: existing, error: findErr } = await supabase
      .from('reels')
      .select('id,title,summary,category,source_url,thumbnail_url,processing_status,created_at')
      .eq('user_id', session.user.id)
      .eq('source_url', url)
      .maybeSingle()

    if (findErr) {
      console.warn('[Ingest] Duplicate check error from Supabase:', findErr.message)
    }

    if (existing) {
      console.log('[Ingest] Reel already exists in database for this user.')
      return { success: true, duplicate: true, savedItem: existing as SavedReel, persisted: 'supabase' }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('reels')
      .insert({
        user_id: session.user.id,
        source_url: url,
        source_platform: 'instagram',
        title: 'Saving Reel…',
        summary: 'This Reel is being processed. It will appear with a full summary shortly.',
        processing_status: 'pending',
      })
      .select()
      .single()

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message?.toLowerCase().includes('duplicate') || insertErr.message?.toLowerCase().includes('unique')) {
        console.log('[Ingest] Unique constraint detected: Reel already in library.')
        return { success: true, duplicate: true, persisted: 'supabase' }
      }
      console.error('[Ingest] Direct Supabase save error:', insertErr.message)
      throw new Error(`Database save error: ${insertErr.message}`)
    }

    console.log('[Ingest] Direct Supabase insert succeeded. ID:', inserted.id)

    // Fire-and-forget: trigger backend analysis for the newly saved reel
    triggerBackendAnalysis(session, inserted.id, url)

    return { success: true, duplicate: false, savedItem: inserted as SavedReel, persisted: 'supabase' }
  } catch (dbErr) {
    console.error('[Ingest] Direct Supabase fallback failed:', dbErr instanceof Error ? dbErr.message : String(dbErr))
    throw dbErr instanceof Error ? dbErr : new Error('Could not save Reel over the network.')
  }
}

async function fetchIngest(session: Session, url: string, signal: AbortSignal): Promise<IngestResponse> {
  const response = await fetch(`${apiUrl}/api/reels/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ url }),
    signal,
  })

  const data = (await response.json().catch(() => ({}))) as IngestResponse

  if (response.status === 401) {
    const error = new Error('Session expired. Sign in again to finish saving.')
    ;(error as Error & { code?: string }).code = 'unauthorized'
    throw error
  }

  if (!response.ok) {
    const error = new Error(data.error || `Save failed (${response.status})`) as Error & { code?: string }
    if (response.status < 500) error.code = 'client'
    throw error
  }

  return data
}
