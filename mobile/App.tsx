import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import AuthScreen from './src/screens/AuthScreen'
import HomeScreen from './src/screens/HomeScreen'
import LibraryScreen from './src/screens/LibraryScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import ReelsBrowserScreen from './src/screens/ReelsBrowserScreen'
import { restoreSession, supabase } from './src/lib/auth'
import { ingestReel } from './src/lib/api'
import { consumePendingShareUrl, stashPendingShareUrl } from './src/lib/sessionBridge'
import { colors } from './src/theme'
import { extractInstagramReelUrl } from './src/lib/urls'
import type { Session } from '@supabase/supabase-js'

const Stack = createNativeStackNavigator()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.text,
  },
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [lastShareMessage, setLastShareMessage] = useState<string | null>(null)

  const flushPending = useCallback(async (active: Session, urlOverride?: string | null) => {
    const stored = urlOverride || consumePendingShareUrl()
    const url = extractInstagramReelUrl(stored)
    if (!url) return
    try {
      const result = await ingestReel(active, url)
      setLastShareMessage(
        result.duplicate ? 'Already in Post Vault ✓' : 'Reel saved to Post Vault ✓'
      )
      setPendingUrl(null)
    } catch (err) {
      stashPendingShareUrl(url)
      setPendingUrl(url)
      setLastShareMessage(err instanceof Error ? err.message : 'Could not save Reel')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const restored = await restoreSession()
      if (cancelled) return
      setSession(restored)
      const pending = consumePendingShareUrl()
      if (pending) setPendingUrl(pending)
      if (restored && pending) {
        await flushPending(restored, pending)
      }
      setReady(true)
      Notifications.requestPermissionsAsync().catch(() => undefined)
    })()
    return () => {
      cancelled = true
    }
    // Restore once on launch. Pending shares are consumed here, then retried after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only restore
  }, [])

  useEffect(() => {
    if (!ready) return

    const checkAndFlush = () => {
      const pending = consumePendingShareUrl()
      if (!pending) return
      setPendingUrl(pending)
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) void flushPending(data.session, pending)
      })
    }

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAndFlush()
      }
    })

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('recall://')) return
      checkAndFlush()
    })

    return () => {
      appStateSub.remove()
      linkingSub.remove()
    }
  }, [ready, flushPending])

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.text} />
      </View>
    )
  }

  if (!session) {
    return (
      <View style={styles.boot}>
        <StatusBar style="dark" />
        <AuthScreen
          pendingUrl={pendingUrl}
          onAuthenticated={async () => {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
              setSession(data.session)
              await flushPending(data.session)
            }
          }}
        />
      </View>
    )
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: '600', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Home"
          options={({ navigation }) => ({
            title: 'Post Vault',
            headerRight: () => (
              <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
                <Text style={styles.headerLink}>Account</Text>
              </Pressable>
            ),
          })}
        >
          {({ navigation }) => (
            <HomeScreen
              lastShareMessage={lastShareMessage}
              pendingUrl={pendingUrl}
              onOpenLibrary={() => navigation.navigate('Library')}
              onOpenReelsBrowser={() => navigation.navigate('ReelsBrowser')}
              onRetryPending={async () => {
                if (session && pendingUrl) {
                  await flushPending(session, pendingUrl)
                }
              }}
              onDismissPending={() => setPendingUrl(null)}
              onTestSave={async (url) => {
                await flushPending(session, url)
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Library"
          options={({ navigation }) => ({
            title: 'Saved Reels',
            headerRight: () => (
              <Pressable
                onPress={() => navigation.navigate('ReelsBrowser')}
                hitSlop={10}
                style={{ paddingVertical: 4, paddingHorizontal: 4 }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                  Browse 
                </Text>
              </Pressable>
            ),
          })}
          component={LibraryScreen}
        />
        <Stack.Screen
          name="ReelsBrowser"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        >
          {({ navigation, route }) => (
            <ReelsBrowserScreen
              session={session}
              onOpenLibrary={() => navigation.navigate('Library')}
              onClose={() => navigation.goBack()}
              initialUrl={(route.params as { initialUrl?: string } | undefined)?.initialUrl}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
          {() => (
            <SettingsScreen
              email={session.user.email ?? null}
              onSignedOut={() => setSession(null)}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  headerLink: { color: colors.secondary, fontWeight: '500' },
})
