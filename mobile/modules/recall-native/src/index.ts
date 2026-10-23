import { requireOptionalNativeModule } from 'expo'

export type ShareSessionPayload = {
  accessToken: string
  refreshToken: string
  apiUrl: string
  supabaseUrl: string
  supabaseAnonKey: string
}

type RecallNativeModule = {
  setSession(payload: ShareSessionPayload): void
  clearSession(): void
  setPendingUrl(url: string): void
  consumePendingUrl(): string | null
}

const RecallNative = requireOptionalNativeModule<RecallNativeModule>('RecallNative')

let inMemoryPendingUrl: string | null = null

const fallback: RecallNativeModule = {
  setSession() {},
  clearSession() {},
  setPendingUrl(url: string) {
    inMemoryPendingUrl = url
  },
  consumePendingUrl() {
    const val = inMemoryPendingUrl
    inMemoryPendingUrl = null
    return val
  },
}

export default RecallNative ?? fallback
