import Constants from 'expo-constants'

const rawApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string) ||
  ''
const rawSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL as string) ||
  ''
const rawSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ||
  ''

export const apiUrl = rawApiUrl.replace(/\/$/, '')
export const supabaseUrl = rawSupabaseUrl.replace(/\/$/, '')
export const supabaseAnonKey = rawSupabaseAnonKey

