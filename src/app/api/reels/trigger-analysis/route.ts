import { after, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/utils/supabase/api'
import { completeReelProcessing } from '@/lib/processReel'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * POST /api/reels/trigger-analysis
 *
 * Called by the mobile app after a direct Supabase insert to trigger
 * server-side analysis. The mobile client cannot run the full AI pipeline
 * itself, so it fires this endpoint once it has network access.
 *
 * Body: { reelId: string, sourceUrl: string }
 *
 * Security: Authenticates the user, verifies reel ownership via Supabase RLS,
 * and only triggers analysis for pending or failed reels.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClientFromRequest(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reelId, sourceUrl } = await req.json()

    if (!reelId || !sourceUrl) {
      return NextResponse.json(
        { error: 'reelId and sourceUrl are required' },
        { status: 400 }
      )
    }

    // Verify the reel exists and belongs to this user (RLS enforces ownership)
    const { data: reel, error: fetchError } = await supabase
      .from('reels')
      .select('id, processing_status')
      .eq('id', reelId)
      .single()

    if (fetchError || !reel) {
      return NextResponse.json(
        { error: 'Reel not found or access denied.' },
        { status: 404 }
      )
    }

    // Skip if already completed or currently processing
    if (reel.processing_status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Reel already analyzed.',
        skipped: true,
      })
    }

    if (reel.processing_status === 'processing') {
      return NextResponse.json({
        success: true,
        message: 'Analysis already in progress.',
        skipped: true,
      })
    }

    // Mark as processing
    await supabase
      .from('reels')
      .update({
        processing_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId)

    // Trigger background analysis
    after(async () => {
      await completeReelProcessing(supabase, reelId, sourceUrl)
    })

    return NextResponse.json({
      success: true,
      message: 'Analysis triggered.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[TriggerAnalysis] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
