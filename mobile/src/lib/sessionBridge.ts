import * as SecureStore from 'expo-secure-store'
import { Session } from '@supabase/supabase-js'
import RecallNative from 'recall-native'
import { apiUrl, supabaseAnonKey, supabaseUrl } from './config'

const SECURE_SESSION_KEY = 'recall-session'

export async function persistShareSession(session: Session | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(SECURE_SESSION_KEY).catch(() => undefined)
    RecallNative.clearSession()
    return
  }

  await SecureStore.setItemAsync(SECURE_SESSION_KEY, JSON.stringify(session))
  RecallNative.setSession({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
  })
}

export async function readSecureSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SECURE_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function consumePendingShareUrl(): string | null {
  return RecallNative.consumePendingUrl()
}

export function stashPendingShareUrl(url: string) {
  RecallNative.setPendingUrl(url)
}
