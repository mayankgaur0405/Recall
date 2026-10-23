declare module 'recall-native' {
  export type ShareSessionPayload = {
    accessToken: string
    refreshToken: string
    apiUrl: string
    supabaseUrl: string
    supabaseAnonKey: string
  }

  const RecallNative: {
    setSession(payload: ShareSessionPayload): void
    clearSession(): void
    setPendingUrl(url: string): void
    consumePendingUrl(): string | null
  }

  export default RecallNative
}
