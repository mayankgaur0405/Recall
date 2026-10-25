import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '../theme'
import { ingestReel } from '../lib/api'
import { supabase } from '../lib/auth'
import { getBrowserPreferences, type BrowserPreferences } from '../lib/preferences'
import type { Session } from '@supabase/supabase-js'

type Props = {
  session: Session | null
  onOpenLibrary: () => void
  onClose: () => void
  initialUrl?: string
}

const INJECTED_JAVASCRIPT = `
(function() {
  function findCurrentItem() {
    try {
      var href = window.location.href || '';
      
      // 1. Direct URL match on page address (/reel/CODE/, /reels/CODE/, /p/CODE/, /share/reel/CODE/)
      var directMatch = href.match(/instagram\\.com\\/(?:[a-zA-Z0-9_.]+\\/)?(reel|reels|p)\\/([A-Za-z0-9_-]+)/);
      if (directMatch && directMatch[2]) {
        var sc = directMatch[2];
        var isP = directMatch[1] === 'p';
        return {
          url: 'https://www.instagram.com/reel/' + sc + '/',
          code: sc,
          itemType: isP ? 'post' : 'reel'
        };
      }
      
      // 2. Canonical and OpenGraph tags in <head>
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        var cm = canonical.href.match(/(?:reel|reels|p)\\/([A-Za-z0-9_-]+)/);
        if (cm && cm[1]) {
          return {
            url: 'https://www.instagram.com/reel/' + cm[1] + '/',
            code: cm[1],
            itemType: 'reel'
          };
        }
      }

      var og = document.querySelector('meta[property="og:url"]');
      if (og && og.content) {
        var ogm = og.content.match(/(?:reel|reels|p)\\/([A-Za-z0-9_-]+)/);
        if (ogm && ogm[1]) {
          return {
            url: 'https://www.instagram.com/reel/' + ogm[1] + '/',
            code: ogm[1],
            itemType: 'reel'
          };
        }
      }

      var windowH = window.innerHeight || document.documentElement.clientHeight || 800;
      var centerY = windowH / 2;

      // 3. Active playing or centered <video> element
      var videos = document.querySelectorAll('video');
      for (var v = 0; v < videos.length; v++) {
        var vRect = videos[v].getBoundingClientRect();
        if (vRect.top < windowH * 0.85 && vRect.bottom > windowH * 0.15) {
          var container = videos[v].closest('section') ||
                          videos[v].closest('article') ||
                          videos[v].closest('div[role="dialog"]') ||
                          videos[v].parentElement?.parentElement?.parentElement?.parentElement ||
                          videos[v].parentElement?.parentElement;
          if (container) {
            var vLink = container.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]');
            if (vLink && vLink.href) {
              var vm = vLink.href.match(/\\/(reel|reels|p)\\/([A-Za-z0-9_-]+)/);
              if (vm && vm[2]) {
                return {
                  url: 'https://www.instagram.com/reel/' + vm[2] + '/',
                  code: vm[2],
                  itemType: vm[1] === 'p' ? 'post' : 'reel'
                };
              }
            }
          }
        }
      }

      // 4. Feed <article> elements
      var articles = document.querySelectorAll('article');
      for (var a = 0; a < articles.length; a++) {
        var artRect = articles[a].getBoundingClientRect();
        if (artRect.top <= centerY && artRect.bottom >= centerY) {
          var artLink = articles[a].querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]');
          if (artLink && artLink.href) {
            var am = artLink.href.match(/\\/(reel|reels|p)\\/([A-Za-z0-9_-]+)/);
            if (am && am[2]) {
              return {
                url: 'https://www.instagram.com/reel/' + am[2] + '/',
                code: am[2],
                itemType: am[1] === 'p' ? 'post' : 'reel'
              };
            }
          }
        }
      }

      // 5. Centered anchors in viewport
      var links = document.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]');
      var bestCandidate = null;
      var minDistance = Infinity;
      for (var i = 0; i < links.length; i++) {
        var rect = links[i].getBoundingClientRect();
        var targetRect = (rect.width > 0 && rect.height > 0) ? rect : (links[i].parentElement?.getBoundingClientRect() || rect);
        if (targetRect.bottom > 20 && targetRect.top < windowH - 20) {
          var elCenter = (targetRect.top + targetRect.bottom) / 2;
          var dist = Math.abs(elCenter - centerY);
          if (dist < minDistance) {
            var lm = (links[i].href || links[i].getAttribute('href') || '').match(/\\/(reel|reels|p)\\/([A-Za-z0-9_-]+)/);
            if (lm && lm[2]) {
              minDistance = dist;
              bestCandidate = {
                url: 'https://www.instagram.com/reel/' + lm[2] + '/',
                code: lm[2],
                itemType: lm[1] === 'p' ? 'post' : 'reel'
              };
            }
          }
        }
      }

      return bestCandidate;
    } catch (e) {
      return null;
    }
  }

  window.__recallDetectItem = findCurrentItem;

  var lastSentUrl = '';
  function runAutoDetection() {
    var found = findCurrentItem();
    if (found && found.url) {
      if (found.url !== lastSentUrl) {
        lastSentUrl = found.url;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ITEM_DETECTED',
          url: found.url,
          code: found.code,
          itemType: found.itemType
        }));
      }
    }
  }

  // Hook into SPA history state changes (pushState, replaceState)
  try {
    var origPush = history.pushState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      setTimeout(runAutoDetection, 150);
    };
    var origReplace = history.replaceState;
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      setTimeout(runAutoDetection, 150);
    };
  } catch (e) {}

  setInterval(runAutoDetection, 350);
  window.addEventListener('popstate', runAutoDetection);
  window.addEventListener('scroll', runAutoDetection, { passive: true });
  runAutoDetection();
})();
true;
`

export default function ReelsBrowserScreen({
  session,
  onOpenLibrary,
  onClose,
  initialUrl = 'https://www.instagram.com/',
}: Props) {
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const webViewRef = useRef<WebView<any>>(null)

  const [loading, setLoading] = useState(true)
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [activeItemType, setActiveItemType] = useState<'reel' | 'post'>('reel')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'already_saved' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set())
  const [canGoBack, setCanGoBack] = useState(false)
  const [prefs, setPrefs] = useState<BrowserPreferences>({
    buttonStyle: 'circle',
    isDraggable: true,
  })

  const prefsRef = useRef(prefs)
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  // Pulse animation for the save button
  const scaleAnim = useRef(new Animated.Value(1)).current

  // Drag position for the floating save button
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current

  // Reload preferences whenever the screen comes into focus
  useEffect(() => {
    if (isFocused) {
      getBrowserPreferences().then((p) => {
        setPrefs(p)
        prefsRef.current = p
        if (!p.isDraggable) {
          pan.setValue({ x: 0, y: 0 })
        }
      })
    }
  }, [isFocused, pan])

  // Load existing saved URLs for instant duplicate detection
  useEffect(() => {
    async function loadSavedList() {
      if (!session) return
      try {
        const { data } = await supabase
          .from('reels')
          .select('source_url')
          .eq('user_id', session.user.id)
        if (data) {
          const set = new Set<string>()
          for (const item of data) {
            if (item.source_url) {
              set.add(item.source_url.toLowerCase())
              const m = item.source_url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i)
              if (m && m[1]) {
                set.add(m[1].toLowerCase())
              }
            }
          }
          setSavedUrls(set)
        }
      } catch (e) {
        console.warn('[ReelsBrowser] Failed to load user saved set:', e)
      }
    }
    loadSavedList()
  }, [session])

  // Android hardware back button integration
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => sub.remove()
  }, [canGoBack])

  const triggerHaptic = useCallback(async (type: 'success' | 'impact' | 'error') => {
    try {
      if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else if (type === 'error') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }
    } catch {
      // Haptics not supported on web/simulator
    }
  }, [])

  const executeSaveUrl = useCallback(
    async (targetUrl: string) => {
      if (!session) {
        setSaveStatus('error')
        setStatusMessage('Please sign in to save')
        await triggerHaptic('error')
        return
      }

      setSaveStatus('saving')
      setStatusMessage('Saving to Vault…')
      await triggerHaptic('impact')

      try {
        const res = await ingestReel(session, targetUrl)

        // Update local saved list
        setSavedUrls((prev) => {
          const next = new Set(prev)
          next.add(targetUrl.toLowerCase())
          const m = targetUrl.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i)
          if (m && m[1]) next.add(m[1].toLowerCase())
          return next
        })

        if (res.duplicate) {
          setSaveStatus('already_saved')
          setStatusMessage('Already in Post Vault ✓')
          await triggerHaptic('success')
        } else {
          setSaveStatus('saved')
          setStatusMessage('Saved to Post Vault ✓')
          await triggerHaptic('success')
        }

        setTimeout(() => {
          setSaveStatus('already_saved')
          setStatusMessage('In Post Vault ✓')
        }, 3500)
      } catch (err) {
        setSaveStatus('error')
        setStatusMessage(err instanceof Error ? err.message : 'Could not save')
        await triggerHaptic('error')
        setTimeout(() => {
          setSaveStatus('idle')
          setStatusMessage('')
        }, 4000)
      }
    },
    [session, triggerHaptic]
  )

  const handleSaveCurrentItem = useCallback(async () => {
    // 1. Instant visual and tactile response
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.86, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3.5, useNativeDriver: true }),
    ]).start()

    if (saveStatus === 'saving') return

    // 2. If activeUrl is already known, save it immediately!
    if (activeUrl) {
      await executeSaveUrl(activeUrl)
      return
    }

    // 3. If activeUrl not yet captured, query the WebView on demand!
    if (webViewRef.current) {
      setSaveStatus('saving')
      setStatusMessage('Finding Reel…')
      await triggerHaptic('impact')

      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof window.__recallDetectItem === 'function') {
              var item = window.__recallDetectItem();
              if (item && item.url) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'TRIGGER_SAVE',
                  url: item.url,
                  code: item.code,
                  itemType: item.itemType
                }));
                return;
              }
            }
            var href = window.location.href || '';
            var m = href.match(/instagram\\.com\\/(?:[a-zA-Z0-9_.]+\\/)?(reel|reels|p)\\/([A-Za-z0-9_-]+)/);
            if (m && m[2]) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TRIGGER_SAVE',
                url: 'https://www.instagram.com/reel/' + m[2] + '/',
                code: m[2],
                itemType: m[1] === 'p' ? 'post' : 'reel'
              }));
              return;
            }
          } catch(e) {}
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NO_ITEM_FOUND'
          }));
        })();
        true;
      `)
      return
    }

    // 4. Fallback if no webview
    setSaveStatus('error')
    setStatusMessage('No Reel detected on screen')
    await triggerHaptic('error')
    setTimeout(() => {
      setSaveStatus('idle')
      setStatusMessage('')
    }, 3000)
  }, [activeUrl, executeSaveUrl, saveStatus, scaleAnim, triggerHaptic])

  // Handle messages posted from injected JS in WebView
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)

        if (data.type === 'TRIGGER_SAVE' && data.url) {
          setActiveUrl(data.url)
          setActiveItemType(data.itemType || 'reel')
          executeSaveUrl(data.url)
          return
        }

        if (data.type === 'NO_ITEM_FOUND') {
          setSaveStatus('error')
          setStatusMessage('Scroll to a Reel or Post to save')
          triggerHaptic('error')
          setTimeout(() => {
            setSaveStatus('idle')
            setStatusMessage('')
          }, 3500)
          return
        }

        if ((data.type === 'ITEM_DETECTED' || data.type === 'REEL_DETECTED') && data.url) {
          const normalized = data.url
          setActiveUrl(normalized)
          setActiveItemType(data.itemType || 'reel')

          const isSaved =
            savedUrls.has(normalized.toLowerCase()) ||
            (data.code && savedUrls.has(String(data.code).toLowerCase()))

          if (isSaved) {
            setSaveStatus('already_saved')
            setStatusMessage('In Post Vault ✓')
          } else if (saveStatus !== 'saving') {
            setSaveStatus('idle')
            setStatusMessage('')
          }
        }
      } catch {
        // Ignore non-json messages
      }
    },
    [executeSaveUrl, saveStatus, savedUrls, triggerHaptic]
  )

  // PanResponder to handle smooth dragging without blocking taps
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!prefsRef.current.isDraggable) return false
          return Math.hypot(gestureState.dx, gestureState.dy) > 10
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!prefsRef.current.isDraggable) return false
          return Math.hypot(gestureState.dx, gestureState.dy) > 10
        },
        onPanResponderGrant: () => {
          pan.setOffset({
            x: (pan.x as any)._value || 0,
            y: (pan.y as any)._value || 0,
          })
          pan.setValue({ x: 0, y: 0 })
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => {
          pan.flattenOffset()
        },
        onPanResponderTerminate: () => {
          pan.flattenOffset()
        },
      }),
    [pan]
  )

  return (
    <View style={styles.container}>
      {/* ── Single Clean Top Header Navigation Bar ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close and return to Home"
          >
            <Text style={styles.headerButtonText}>✕ Close</Text>
          </Pressable>

          {canGoBack ? (
            <Pressable
              onPress={() => webViewRef.current?.goBack()}
              hitSlop={10}
              style={styles.headerBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.headerBackText}>‹ Back</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Browse Instagram</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {activeItemType === 'reel'
              ? '🎬 Reel Detected'
              : activeItemType === 'post'
              ? '📸 Post Detected'
              : 'Browsing Instagram'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => webViewRef.current?.reload()}
            hitSlop={10}
            style={styles.headerReloadBtn}
            accessibilityRole="button"
            accessibilityLabel="Reload page"
          >
            <Text style={styles.headerReloadText}>↻</Text>
          </Pressable>

          <Pressable
            onPress={onOpenLibrary}
            hitSlop={10}
            style={styles.vaultPillButton}
            accessibilityRole="button"
            accessibilityLabel="Open Library"
          >
            <Text style={styles.vaultPillText}>My Vault →</Text>
          </Pressable>
        </View>
      </View>

      {/* ── WebView: Instagram Mobile Web Experience ── */}
      <View style={styles.webWrapper}>
        <WebView<any>
          ref={webViewRef}
          source={{ uri: initialUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={INJECTED_JAVASCRIPT}
          onMessage={handleMessage}
          onNavigationStateChange={(navState: WebViewNavigation) => {
            setCanGoBack(navState.canGoBack)
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
              : undefined
          }
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.loadingText}>Opening Instagram…</Text>
          </View>
        ) : null}
      </View>

      {/* ── Floating 1-Tap Save Button (Circle FAB or Pill) ── */}
      {prefs.buttonStyle === 'circle' ? (
        /* ──── CIRCULAR FAB MODE ──── */
        <Animated.View
          {...(prefs.isDraggable ? panResponder.panHandlers : {})}
          style={[
            styles.fabContainer,
            {
              bottom: Math.max(insets.bottom, 12) + 60,
              transform: [
                { translateX: prefs.isDraggable ? pan.x : 0 },
                { translateY: prefs.isDraggable ? pan.y : 0 },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Pressable
            onPress={handleSaveCurrentItem}
            style={({ pressed }) => [
              styles.circleFab,
              saveStatus === 'saved' || saveStatus === 'already_saved'
                ? styles.circleFabSaved
                : activeUrl
                ? styles.circleFabActive
                : styles.circleFabIdle,
              pressed && styles.circleFabPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save to Post Vault"
          >
            {saveStatus === 'saving' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : saveStatus === 'saved' || saveStatus === 'already_saved' ? (
              <Text style={styles.circleFabCheck}>✓</Text>
            ) : (
              <Text style={styles.circleFabIcon}>⚡</Text>
            )}

            {/* Glowing indicator dot when content is detected and ready to save */}
            {activeUrl && saveStatus !== 'saved' && saveStatus !== 'already_saved' && saveStatus !== 'saving' ? (
              <View style={styles.activeDot} />
            ) : null}
          </Pressable>
        </Animated.View>
      ) : (
        /* ──── EXPANDED PILL MODE ──── */
        <View
          pointerEvents="box-none"
          style={[
            styles.pillDockWrapper,
            {
              bottom: Math.max(insets.bottom, 12) + 56,
            },
          ]}
        >
          <Animated.View
            {...(prefs.isDraggable ? panResponder.panHandlers : {})}
            style={{
              transform: [
                { translateX: prefs.isDraggable ? pan.x : 0 },
                { translateY: prefs.isDraggable ? pan.y : 0 },
                { scale: scaleAnim },
              ],
            }}
          >
            <Pressable
              onPress={handleSaveCurrentItem}
              style={({ pressed }) => [
                styles.pillButton,
                saveStatus === 'saved' || saveStatus === 'already_saved'
                  ? styles.pillSaved
                  : !activeUrl
                  ? styles.pillDisabled
                  : styles.pillActive,
                pressed && styles.pillPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save to Post Vault"
            >
              {saveStatus === 'saving' ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.pillText}>{statusMessage || 'Saving to Vault…'}</Text>
                </>
              ) : saveStatus === 'saved' || saveStatus === 'already_saved' ? (
                <>
                  <Text style={styles.pillIconCheck}>✓</Text>
                  <Text style={styles.pillText}>{statusMessage || 'Saved in Post Vault'}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.pillIcon}>⚡</Text>
                  <Text style={styles.pillText}>
                    {activeUrl
                      ? activeItemType === 'post'
                        ? 'Save Post to Vault'
                        : 'Save Reel to Vault'
                      : 'Scroll to Post or Reel'}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    color: '#E5E5E5',
    fontSize: 14,
    fontWeight: '600',
  },
  headerBackBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  headerBackText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#A3A3A3',
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerReloadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerReloadText: {
    color: '#A1A1AA',
    fontSize: 18,
    fontWeight: '700',
  },
  vaultPillButton: {
    backgroundColor: '#262626',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#404040',
  },
  vaultPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  webWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  /* ──── CIRCULAR FAB STYLES ──── */
  fabContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
  },
  circleFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },
  circleFabIdle: {
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderWidth: 2,
    borderColor: '#3F3F46',
  },
  circleFabActive: {
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    borderWidth: 2.5,
    borderColor: '#10B981',
  },
  circleFabSaved: {
    backgroundColor: 'rgba(6, 95, 70, 0.98)',
    borderWidth: 2,
    borderColor: '#34D399',
  },
  circleFabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  circleFabIcon: {
    fontSize: 25,
  },
  circleFabCheck: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  activeDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#18181B',
  },

  /* ──── EXPANDED PILL STYLES ──── */
  pillDockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 26,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  pillActive: {
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderColor: '#44403C',
  },
  pillDisabled: {
    backgroundColor: 'rgba(38, 38, 38, 0.9)',
    borderColor: '#404040',
    opacity: 0.7,
  },
  pillSaved: {
    backgroundColor: 'rgba(6, 95, 70, 0.95)',
    borderColor: '#34D399',
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  pillIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  pillIconCheck: {
    color: '#A7F3D0',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
