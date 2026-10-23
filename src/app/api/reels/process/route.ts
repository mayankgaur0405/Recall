import { NextResponse } from 'next/server'
import { createClientFromRequest } from '@/utils/supabase/api'
import { processReelSync } from '@/lib/processReel'

export async function POST(req: Request) {
  try {
    const supabase = await createClientFromRequest(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, manualContent } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const result = await processReelSync(supabase, user, url, manualContent)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, needsFallback: result.needsFallback },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      savedItem: result.savedItem,
      duplicate: result.duplicate,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Process] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
