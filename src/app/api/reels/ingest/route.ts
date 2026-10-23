import { after, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/utils/supabase/api'
import { completeReelProcessing, ingestReelUrl } from '@/lib/processReel'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Fast path for mobile share targets / share extensions.
 * Confirms the Reel URL is stored for the authenticated user, then analyzes in the background.
 * Success here means the URL was saved to the account — not that video download finished.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClientFromRequest(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const result = await ingestReelUrl(supabase, user, url)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (!result.duplicate) {
      const reelId = String(result.savedItem.id)
      const sourceUrl = String(result.savedItem.source_url)
      after(async () => {
        await completeReelProcessing(supabase, reelId, sourceUrl)
      })
    }

    return NextResponse.json({
      success: true,
      savedItem: result.savedItem,
      duplicate: result.duplicate,
      persisted: 'url',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Ingest] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
