import { createClient as createJwtClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createCookieClient } from '@/utils/supabase/server'

/**
 * Cookie session (website) or Authorization: Bearer <access_token> (mobile / share extension).
 */
export async function createClientFromRequest(req: Request): Promise<SupabaseClient> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    return createJwtClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_anon_key',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )
  }

  return createCookieClient()
}
