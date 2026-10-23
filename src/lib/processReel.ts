import type { SupabaseClient, User } from '@supabase/supabase-js'
import { analyzeContent, analyzeVideo, generateEmbedding } from '@/lib/ai'
import { extractInstagramContent, cleanupTempVideo } from '@/lib/instagram'
import { extractInstagramReelUrl } from '@/lib/reelUrl'

type ProcessResult =
  | { ok: true; savedItem: Record<string, unknown>; duplicate: boolean }
  | { ok: false; status: number; error: string; needsFallback?: boolean }

function searchTextFromExtracted(extractedData: Record<string, unknown>): string {
  const keyPoints = Array.isArray(extractedData.key_points) ? extractedData.key_points.join(', ') : ''
  const entities = Array.isArray(extractedData.entities) ? extractedData.entities.join(', ') : ''
  const products = Array.isArray(extractedData.products) ? extractedData.products.join(', ') : ''
  const places = Array.isArray(extractedData.places) ? extractedData.places.join(', ') : ''
  const people = Array.isArray(extractedData.people) ? extractedData.people.join(', ') : ''
  const brands = Array.isArray(extractedData.brands) ? extractedData.brands.join(', ') : ''
  const keywords = Array.isArray(extractedData.search_keywords) ? extractedData.search_keywords.join(', ') : ''

  return [
    `Title: ${extractedData.title || ''}`,
    `Summary: ${extractedData.summary || ''}`,
    `Category: ${extractedData.category || ''} ${extractedData.sub_category || ''}`,
    `Key Points: ${keyPoints}`,
    `Entities: ${entities}`,
    `Products: ${products}`,
    `Places: ${places}`,
    `People: ${people}`,
    `Brands: ${brands}`,
    `Keywords: ${keywords}`,
  ].join('\n')
}

async function analyzeFromUrl(url: string, manualContent?: string) {
  let extractedData: Record<string, unknown> | null = null
  let caption: string | null = null
  let thumbnailUrl: string | null = null
  let videoPath: string | null = null
  let extractionError: string | null = null

  if (manualContent) {
    extractedData = await analyzeContent(manualContent) as Record<string, unknown>
    caption = manualContent
    return { extractedData, caption, thumbnailUrl, videoPath, extractionError }
  }

  // ── Step 1: Try to extract Instagram content via API ──
  let igContent: Awaited<ReturnType<typeof extractInstagramContent>> | null = null
  try {
    igContent = await extractInstagramContent(url)
    caption = igContent.caption
    thumbnailUrl = igContent.thumbnailUrl
    videoPath = igContent.videoPath
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    extractionError = message
    console.warn('[Process] Instagram extraction failed, will attempt URL-only fallback:', message)
  }

  // ── Step 2: Analyze via video → caption → URL-only fallback ──
  try {
    if (igContent?.videoPath) {
      try {
        extractedData = await analyzeVideo(igContent.videoPath, igContent.caption) as Record<string, unknown>
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Process] Video analysis failed, falling back to caption:', message)
        if (igContent.caption && igContent.caption.length > 10) {
          extractedData = await analyzeContent(igContent.caption) as Record<string, unknown>
        }
      }
    } else if (igContent?.caption && igContent.caption.length > 10) {
      extractedData = await analyzeContent(igContent.caption) as Record<string, unknown>
    }

    // URL-only fallback: give the AI the URL and ask it to produce a minimal analysis.
    // The AI cannot actually access the URL, but it can produce a placeholder title/category
    // based on the URL structure itself (e.g. "Instagram Reel by @user").
    if (!extractedData && url) {
      console.log('[Process] Attempting URL-only analysis as a last resort...')
      try {
        const urlOnlyPrompt = `The user saved an Instagram Reel with the following URL: ${url}
Unfortunately, we could not download the video or its caption from Instagram.
Based ONLY on the URL structure, generate a minimal entry.
Set the title to something like "Saved Instagram Reel" and category to "Saved".
In the summary, note that the Reel content could not be analyzed automatically.
Do NOT fabricate any specific content, people, products, or descriptions.
Include the URL itself as a search keyword.`
        extractedData = await analyzeContent(urlOnlyPrompt) as Record<string, unknown>
        // Mark it so the caller knows this is a minimal/placeholder analysis
        if (extractedData) {
          extractedData._url_only_fallback = true
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Process] URL-only fallback analysis also failed:', message)
        // extractedData remains null — the reel will be marked as failed
      }
    }
  } finally {
    cleanupTempVideo(videoPath)
  }

  return { extractedData, caption, thumbnailUrl, videoPath, extractionError }
}

export async function findExistingReel(
  supabase: SupabaseClient,
  userId: string,
  sourceUrl: string
) {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('user_id', userId)
    .eq('source_url', sourceUrl)
    .maybeSingle()

  if (error) {
    console.error('[Process] Duplicate lookup failed:', error.message)
  }

  return data
}

export async function ingestReelUrl(
  supabase: SupabaseClient,
  user: User,
  rawUrl: string
): Promise<ProcessResult> {
  const sourceUrl = extractInstagramReelUrl(rawUrl)
  if (!sourceUrl) {
    return { ok: false, status: 400, error: 'Please share a valid Instagram Reel URL' }
  }

  const existing = await findExistingReel(supabase, user.id, sourceUrl)
  if (existing) {
    return { ok: true, savedItem: existing, duplicate: true }
  }

  const { data: savedReel, error: dbError } = await supabase
    .from('reels')
    .insert({
      user_id: user.id,
      source_url: sourceUrl,
      source_platform: 'instagram',
      title: 'Saving Reel…',
      summary: 'This Reel is being processed. It will appear with a full summary shortly.',
      processing_status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    const raced = await findExistingReel(supabase, user.id, sourceUrl)
    if (raced) {
      return { ok: true, savedItem: raced, duplicate: true }
    }
    return { ok: false, status: 500, error: `Database error: ${dbError.message || dbError.code || 'Unknown'}` }
  }

  return { ok: true, savedItem: savedReel, duplicate: false }
}

export async function completeReelProcessing(
  supabase: SupabaseClient,
  reelId: string,
  sourceUrl: string
): Promise<void> {
  try {
    const { extractedData, caption, thumbnailUrl, extractionError } = await analyzeFromUrl(sourceUrl)

    if (!extractedData) {
      const reason = extractionError
        ? `Instagram content could not be extracted: ${extractionError}`
        : 'Instagram content could not be analyzed automatically.'
      await supabase
        .from('reels')
        .update({
          processing_status: 'failed',
          summary: `The Reel URL was saved, but ${reason.toLowerCase().includes('gemini') ? 'AI analysis failed' : reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reelId)
      return
    }

    const { price_mentions: _price, _url_only_fallback, ...dbData } = extractedData as {
      price_mentions?: unknown
      _url_only_fallback?: boolean
    }
    const searchText = searchTextFromExtracted(extractedData)
    let embedding: number[] | undefined

    try {
      embedding = await generateEmbedding(searchText)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Process] Embedding generation failed (continuing without embedding):', message)
    }

    const updatePayload: Record<string, unknown> = {
      ...dbData,
      original_caption: caption,
      thumbnail_url: thumbnailUrl,
      processing_status: _url_only_fallback ? 'partial' : 'completed',
      updated_at: new Date().toISOString(),
    }
    if (embedding) {
      updatePayload.embedding = embedding
    }

    const { error } = await supabase
      .from('reels')
      .update(updatePayload)
      .eq('id', reelId)

    if (error) {
      console.error('[Process] Failed to update processed reel:', error.message)
      await supabase
        .from('reels')
        .update({ processing_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', reelId)
    } else {
      console.log(`[Process] ✅ Reel ${reelId} processed successfully (status: ${_url_only_fallback ? 'partial' : 'completed'})`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Process] Background processing failed:', message)

    // Provide a specific, actionable error message
    let userMessage = 'The Reel URL was saved, but automatic analysis failed.'
    if (message.toLowerCase().includes('gemini api key')) {
      userMessage = 'The Reel URL was saved, but AI analysis failed: Gemini API key is not configured.'
    } else if (message.toLowerCase().includes('quota')) {
      userMessage = 'The Reel URL was saved, but AI analysis failed: API quota exceeded. Try again later.'
    } else if (message.toLowerCase().includes('rapidapi')) {
      userMessage = 'The Reel URL was saved, but Instagram content extraction failed. Check your RapidAPI configuration.'
    }

    await supabase
      .from('reels')
      .update({
        processing_status: 'failed',
        summary: userMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId)
  }
}

export async function processReelSync(
  supabase: SupabaseClient,
  user: User,
  rawUrl: string,
  manualContent?: string
): Promise<ProcessResult> {
  const sourceUrl = extractInstagramReelUrl(rawUrl)
  if (!sourceUrl && !manualContent) {
    return { ok: false, status: 400, error: 'Please enter a valid Instagram Reel URL' }
  }

  const url = sourceUrl || rawUrl

  if (sourceUrl) {
    const existing = await findExistingReel(supabase, user.id, sourceUrl)
    if (existing) {
      return { ok: true, savedItem: existing, duplicate: true }
    }
  }

  let extractedData: Record<string, unknown> | null = null
  let caption: string | null = null
  let thumbnailUrl: string | null = null

  try {
    const analyzed = await analyzeFromUrl(url, manualContent)
    extractedData = analyzed.extractedData
    caption = analyzed.caption
    thumbnailUrl = analyzed.thumbnailUrl
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 500, error: message }
  }

  if (!extractedData) {
    return {
      ok: false,
      status: 422,
      error: "We couldn't access the Reel content directly. Instagram may be blocking access.",
      needsFallback: true,
    }
  }

  const { price_mentions: _price, _url_only_fallback, ...dbData } = extractedData as {
    price_mentions?: unknown
    _url_only_fallback?: boolean
  }

  let embedding: number[] | undefined
  try {
    embedding = await generateEmbedding(searchTextFromExtracted(extractedData))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Process] Embedding generation failed (continuing without):', message)
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    source_url: url,
    ...dbData,
    original_caption: caption,
    thumbnail_url: thumbnailUrl,
    processing_status: _url_only_fallback ? 'partial' : 'completed',
  }
  if (embedding) {
    insertPayload.embedding = embedding
  }

  const { data: savedReel, error: dbError } = await supabase
    .from('reels')
    .insert(insertPayload)
    .select()
    .single()

  if (dbError) {
    const raced = sourceUrl ? await findExistingReel(supabase, user.id, sourceUrl) : null
    if (raced) {
      return { ok: true, savedItem: raced, duplicate: true }
    }
    return { ok: false, status: 500, error: `Database error: ${dbError.message || dbError.code || 'Unknown'}` }
  }

  return { ok: true, savedItem: savedReel, duplicate: false }
}
