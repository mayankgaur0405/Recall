import { createClient, type Session } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './config'
import { persistShareSession, readSecureSession } from './sessionBridge'

export const supabase = createClient(
  supabaseUrl || 'https://xkxhtqylxbczvkviifpv.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreGh0cXlseGJjenZrdmlpZnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTkzOTAsImV4cCI6MjEwNjIzNTM5MH0.ExXPXMIttDVEajPca8TK2FhrYUWDrA60UM1f65ZGFKo',
  {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export async function restoreSession(): Promise<Session | null> {
  const stored = await readSecureSession()
  if (!stored?.refresh_token) return null

  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  })

  if (error || !data.session) {
    await persistShareSession(null)
    return null
  }

  await persistShareSession(data.session)
  return data.session
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session) throw new Error('Sign in did not return a session.')
  await persistShareSession(data.session)
  return data.session
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  if (data.user && !data.session) {
    throw new Error('Check your email to confirm the account, then sign in.')
  }
  if (!data.session) throw new Error('Sign up did not return a session.')
  await persistShareSession(data.session)
  return data.session
}

export async function signOut() {
  await supabase.auth.signOut()
  await persistShareSession(null)
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    if (session) void persistShareSession(session)
  }
  if (event === 'SIGNED_OUT') {
    void persistShareSession(null)
  }
})
