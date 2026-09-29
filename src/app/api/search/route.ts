import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateEmbedding, answerQuestion } from '@/lib/ai'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // 1. Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)
    
    if (!queryEmbedding) {
      throw new Error("Failed to generate embedding for query")
    }

    // 2. Search Supabase using vector similarity
    const { data: searchResults, error: searchError } = await supabase.rpc('match_reels', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // Lower threshold to find somewhat related items
      match_count: 5,
      p_user_id: user.id
    })

    if (searchError) {
      console.error("Vector search error:", searchError)
      return NextResponse.json({ error: 'Database search failed' }, { status: 500 })
    }

    // 3. If no results found, return early
    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find anything relevant in your saved Reels.",
        results: []
      })
    }

    // 4. If we have results, ask the AI to answer the question using the retrieved context
    const aiAnswer = await answerQuestion(query, searchResults)

    return NextResponse.json({
      answer: aiAnswer,
      results: searchResults
    })

  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
