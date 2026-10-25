import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, spacing } from '../theme'

type Props = {
  onOpenLibrary: () => void
  onOpenReelsBrowser: () => void
  lastShareMessage: string | null
  pendingUrl?: string | null
  onRetryPending?: () => Promise<void>
  onDismissPending?: () => void
  onTestSave?: (url: string) => Promise<void>
}

export default function HomeScreen({
  onOpenLibrary,
  onOpenReelsBrowser,
  lastShareMessage,
  pendingUrl,
  onRetryPending,
  onDismissPending,
  onTestSave,
}: Props) {
  const [testUrl, setTestUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function runTestSave() {
    if (!onTestSave || !testUrl.trim()) return
    setBusy(true)
    try {
      await onTestSave(testUrl.trim())
      setTestUrl('')
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry() {
    if (!onRetryPending) return
    setRetrying(true)
    try {
      await onRetryPending()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>TWO WAYS TO SAVE</Text>
      <Text style={styles.title}>Never lose a useful Reel again.</Text>

      {/* ── Pending Link Sync Banner ── */}
      {pendingUrl ? (
        <View style={styles.pendingCard}>
          <View style={styles.pendingHeader}>
            <Text style={styles.pendingBadge}>LINK WAITING TO SYNC</Text>
            {onDismissPending ? (
              <Pressable onPress={onDismissPending} hitSlop={8}>
                <Text style={styles.dismissText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.pendingUrl} numberOfLines={1}>
            {pendingUrl}
          </Text>
          <Pressable
            onPress={handleRetry}
            disabled={retrying}
            style={styles.retryButton}
          >
            {retrying ? (
              <ActivityIndicator color={colors.inverse} size="small" />
            ) : (
              <Text style={styles.retryButtonText}>Retry Save Now</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* ── Status Toast ── */}
      {lastShareMessage ? <Text style={styles.banner}>{lastShareMessage}</Text> : null}

      {/* ── METHOD 1: In-App Instagram Browser (1-Tap Save) ── */}
      <View style={styles.methodCardPrimary}>
        <View style={styles.badgeRow}>
          <View style={styles.methodBadgePrimary}>
            <Text style={styles.methodBadgeTextPrimary}>METHOD 1 • IN-APP BROWSER</Text>
          </View>
          <Text style={styles.popularTag}>Instant</Text>
        </View>
        <Text style={styles.cardTitlePrimary}>Browse &amp; Save Inside Post Vault</Text>
        <Text style={styles.cardDescPrimary}>
          Browse your Instagram feed, Explore, and Reels directly in Post Vault. When you find anything valuable, tap the floating button to save it instantly.
        </Text>

        <Pressable
          onPress={onOpenReelsBrowser}
          style={({ pressed }) => [
            styles.primaryCtaButton,
            pressed && styles.primaryCtaButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Browse Instagram in app"
        >
          <Text style={styles.primaryCtaText}>Browse Instagram </Text>
          <Text style={styles.primaryCtaArrow}>→</Text>
        </Pressable>
      </View>

      {/* ── METHOD 2: Share from Instagram App (Share Sheet) ── */}
      <View style={styles.methodCardSecondary}>
        <View style={styles.badgeRow}>
          <View style={styles.methodBadgeSecondary}>
            <Text style={styles.methodBadgeTextSecondary}>METHOD 2 • INSTAGRAM APP</Text>
          </View>
          <Text style={styles.methodTag}>Background Sync</Text>
        </View>
        <Text style={styles.cardTitleSecondary}>Share Sheet from Instagram</Text>
        <Text style={styles.cardDescSecondary}>
          Browsing inside the Instagram app? No need to leave your feed:
        </Text>

        <View style={styles.stepList}>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1.</Text>
            <Text style={styles.stepText}>Tap the <Text style={{ fontWeight: '600' }}>Share</Text> button on any Reel in Instagram.</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2.</Text>
            <Text style={styles.stepText}>Select <Text style={{ fontWeight: '600' }}>Post Vault</Text> in the share sheet.</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3.</Text>
            <Text style={styles.stepText}>Stay in Instagram — AI analysis runs in the background!</Text>
          </View>
        </View>
      </View>

      {/* ── Jump to Saved Vault Library ── */}
      <Pressable
        onPress={onOpenLibrary}
        style={({ pressed }) => [
          styles.viewSavedButton,
          pressed && styles.viewSavedButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="View Saved Reels"
      >
        <View>
          <Text style={styles.viewSavedKicker}>YOUR PERSONAL LIBRARY</Text>
          <Text style={styles.viewSavedButtonText}>Open Saved Vault</Text>
        </View>
        <Text style={styles.viewSavedArrow}>→</Text>
      </Pressable>

      {/* ── Dev Test URL Box (Dev only) ── */}
      {__DEV__ && onTestSave ? (
        <View style={styles.devBox}>
          <Text style={styles.devLabel}>Local Test / Debug (Dev Only)</Text>
          <TextInput
            value={testUrl}
            onChangeText={setTestUrl}
            placeholder="Paste an Instagram Reel URL"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.devInput}
          />
          <Pressable onPress={runTestSave} disabled={busy} style={styles.devButton}>
            <Text style={styles.devButtonText}>{busy ? 'Saving…' : 'Save test URL'}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 16,
    paddingBottom: 48,
  },
  kicker: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  banner: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    color: '#065F46',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  pendingCard: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    gap: 8,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingBadge: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dismissText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  pendingUrl: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: colors.inverseBg,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  retryButtonText: {
    color: colors.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  methodCardPrimary: {
    backgroundColor: '#1C1917',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  methodBadgePrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  methodBadgeTextPrimary: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  popularTag: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitlePrimary: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 8,
  },
  cardDescPrimary: {
    color: '#D6D3D1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  primaryCtaButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryCtaButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  primaryCtaText: {
    color: '#1C1917',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryCtaArrow: {
    color: '#1C1917',
    fontSize: 16,
    fontWeight: '700',
  },
  methodCardSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  methodBadgeSecondary: {
    backgroundColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  methodBadgeTextSecondary: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  methodTag: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  cardTitleSecondary: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 6,
  },
  cardDescSecondary: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  stepList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    width: 16,
  },
  stepText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  viewSavedButton: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewSavedButtonPressed: {
    backgroundColor: colors.border,
  },
  viewSavedKicker: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  viewSavedButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  viewSavedArrow: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  devBox: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  devLabel: { color: colors.secondary, fontSize: 13, fontWeight: '500' },
  devInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  devButton: {
    backgroundColor: colors.inverseBg,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devButtonText: { color: colors.inverse, fontWeight: '600' },
})
