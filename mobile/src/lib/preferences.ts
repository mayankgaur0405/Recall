import * as SecureStore from 'expo-secure-store'

export type SaveButtonStyle = 'circle' | 'pill'

export interface BrowserPreferences {
  buttonStyle: SaveButtonStyle
  isDraggable: boolean
}

export const DEFAULT_BROWSER_PREFERENCES: BrowserPreferences = {
  buttonStyle: 'circle',
  isDraggable: true,
}

const PREF_KEY = 'recall-browser-preferences'

export async function getBrowserPreferences(): Promise<BrowserPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(PREF_KEY)
    if (!raw) return DEFAULT_BROWSER_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      buttonStyle: parsed.buttonStyle === 'pill' ? 'pill' : 'circle',
      isDraggable: typeof parsed.isDraggable === 'boolean' ? parsed.isDraggable : true,
    }
  } catch {
    return DEFAULT_BROWSER_PREFERENCES
  }
}

export async function setBrowserPreferences(prefs: BrowserPreferences): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREF_KEY, JSON.stringify(prefs))
  } catch (e) {
    console.warn('[Preferences] Failed to persist browser preferences:', e)
  }
}
