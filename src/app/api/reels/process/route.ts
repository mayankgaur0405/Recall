import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { analyzeContent, analyzeVideo, generateEmbedding } from '@/lib/ai'
import { extractInstagramContent, cleanupTempVideo } from '@/lib/instagram'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, manualContent } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let extractedData: any = null
    let caption: string | null = null
    let thumbnailUrl: string | null = null
    let videoPath: string | null = null

    if (manualContent) {
      // ── User provided manual content (fallback) ──
      console.log('[Process] Using manual content for analysis...')
      extractedData = await analyzeContent(manualContent)
      caption = manualContent

    } else {
      // ── Try to automatically extract content from Instagram ──
      console.log('[Process] Extracting Instagram content from URL...')

      const igContent = await extractInstagramContent(url)
      caption = igContent.caption
      thumbnailUrl = igContent.thumbnailUrl
      videoPath = igContent.videoPath

      if (igContent.videoPath) {
        // ✅ We got the video! Use multimodal AI (audio + visual analysis)
        console.log('[Process] Video downloaded! Running multimodal AI analysis...')
        try {
          extractedData = await analyzeVideo(igContent.videoPath, igContent.caption)
        } catch (err: any) {
          console.error('[Process] Video analysis failed, falling back to caption:', err.message)
          // If video analysis fails, fall back to caption
          if (igContent.caption && igContent.caption.length > 10) {
            extractedData = await analyzeContent(igContent.caption)
          }
        }
      } else if (igContent.caption && igContent.caption.length > 10) {
        // We only got the caption, analyze that
        console.log('[Process] No video available, analyzing caption text...')
        extractedData = await analyzeContent(igContent.caption)
      }

      // Clean up temp video file
      cleanupTempVideo(videoPath)

      // If we couldn't extract anything at all, ask user for manual input
      if (!extractedData) {
        return NextResponse.json({
          error: "We couldn't access the Reel content directly. Instagram may be blocking access.",
          needsFallback: true,
        }, { status: 422 })
      }
    }

    // ── Create searchable text for embedding ──
    const searchText = [
      `Title: ${extractedData.title || ''}`,
      `Summary: ${extractedData.summary || ''}`,
      `Category: ${extractedData.category || ''} ${extractedData.sub_category || ''}`,
      `Key Points: ${(extractedData.key_points || []).join(', ')}`,
      `Entities: ${(extractedData.entities || []).join(', ')}`,
      `Products: ${(extractedData.products || []).join(', ')}`,
      `Places: ${(extractedData.places || []).join(', ')}`,
      `People: ${(extractedData.people || []).join(', ')}`,
      `Brands: ${(extractedData.brands || []).join(', ')}`,
      `Keywords: ${(extractedData.search_keywords || []).join(', ')}`,
    ].join('\n');

    const embedding = await generateEmbedding(searchText)

    // ── Strip fields that don't exist in the DB schema ──
    const { price_mentions, ...dbData } = extractedData;

    // ── Save to database ──
    const { data: savedReel, error: dbError } = await supabase
      .from('reels')
      .insert({
        user_id: user.id,
        source_url: url,
        ...dbData,
        original_caption: caption,
        thumbnail_url: thumbnailUrl,
        embedding: embedding,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB Error:', JSON.stringify(dbError, null, 2))
      return NextResponse.json({ error: `Database error: ${dbError.message || dbError.code || 'Unknown'}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, savedItem: savedReel })

  } catch (error: any) {
    console.error('[Process] Error:', error.message || error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
