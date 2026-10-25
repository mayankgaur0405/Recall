import * as SecureStore from 'expo-secure-store'
import { supabase } from './auth'

export interface UserProfile {
  username: string
  email: string
  phoneNumber: string
  avatarUrl: string
}

export const PRESET_AVATARS = [
  '👨‍💻', '🚀', '⚡', '🦁', '👑', '🕶️', '🦊', '🎨', '🔥', '💎', '💡', '🎯',
]

const PROFILE_KEY = 'recall-user-profile-data'

export async function getUserProfile(fallbackEmail: string | null): Promise<UserProfile> {
  const defaultProfile: UserProfile = {
    username: fallbackEmail ? fallbackEmail.split('@')[0] : 'Member',
    email: fallbackEmail || '',
    phoneNumber: '',
    avatarUrl: '⚡',
  }

  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        username: parsed.username || defaultProfile.username,
        email: parsed.email || defaultProfile.email,
        phoneNumber: parsed.phoneNumber || '',
        avatarUrl: parsed.avatarUrl || '⚡',
      }
    }
  } catch {}

  // Check Supabase user metadata
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const meta = user.user_metadata || {}
      const fromMeta: UserProfile = {
        username: meta.username || (user.email ? user.email.split('@')[0] : defaultProfile.username),
        email: user.email || defaultProfile.email,
        phoneNumber: meta.phone_number || '',
        avatarUrl: meta.avatar_url || '⚡',
      }
      await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(fromMeta)).catch(() => {})
      return fromMeta
    }
  } catch {}

  return defaultProfile
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.warn('[Profile] Failed to save profile to storage:', e)
  }
}

export async function updateSupabaseProfile(updates: {
  username?: string
  email?: string
  phoneNumber?: string
  avatarUrl?: string
  newPassword?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authUpdatePayload: {
      email?: string
      password?: string
      data?: Record<string, unknown>
    } = {
      data: {},
    }

    if (updates.email && updates.email.trim()) {
      authUpdatePayload.email = updates.email.trim()
    }
    if (updates.newPassword && updates.newPassword.trim()) {
      authUpdatePayload.password = updates.newPassword.trim()
    }
    if (updates.username !== undefined) {
      authUpdatePayload.data!.username = updates.username.trim()
    }
    if (updates.phoneNumber !== undefined) {
      authUpdatePayload.data!.phone_number = updates.phoneNumber.trim()
    }
    if (updates.avatarUrl !== undefined) {
      authUpdatePayload.data!.avatar_url = updates.avatarUrl
    }

    const { data, error } = await supabase.auth.updateUser(authUpdatePayload)
    if (error) {
      return { success: false, error: error.message }
    }

    // Update local store as well
    const current = await getUserProfile(updates.email || null)
    const updated: UserProfile = {
      username: updates.username !== undefined ? updates.username : current.username,
      email: updates.email !== undefined ? updates.email : current.email,
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber : current.phoneNumber,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
    }
    await saveUserProfile(updated)

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile',
    }
  }
}
