import { after, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/utils/supabase/api'
import { completeReelProcessing } from '@/lib/processReel'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * POST /api/reels/[id]/retry
 *
 * Re-triggers analysis for a failed or pending Reel owned by the authenticated user.
 * Prevents duplicate processing by checking current status before scheduling.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: reelId } = await params

    if (!reelId) {
      return NextResponse.json({ error: 'Reel ID is required' }, { status: 400 })
    }

    // Fetch the reel and verify ownership (RLS enforces user_id match)
    const { data: reel, error: fetchError } = await supabase
      .from('reels')
      .select('id, source_url, processing_status, user_id')
      .eq('id', reelId)
      .single()

    if (fetchError || !reel) {
      return NextResponse.json(
        { error: 'Reel not found or you do not have access to it.' },
        { status: 404 }
      )
    }

    // Only allow retrying for failed or pending reels
    if (reel.processing_status === 'completed') {
      return NextResponse.json(
        { error: 'This Reel has already been analyzed successfully.' },
        { status: 409 }
      )
    }

    if (reel.processing_status === 'processing') {
      return NextResponse.json(
        { error: 'This Reel is currently being analyzed. Please wait.' },
        { status: 409 }
      )
    }

    // Mark as processing to prevent duplicate retries
    await supabase
      .from('reels')
      .update({
        processing_status: 'processing',
        summary: 'Re-analyzing this Reel…',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId)

    // Schedule background analysis
    after(async () => {
      await completeReelProcessing(supabase, reelId, reel.source_url)
    })

    return NextResponse.json({
      success: true,
      message: 'Analysis has been re-triggered. The Reel will update shortly.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Retry] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
