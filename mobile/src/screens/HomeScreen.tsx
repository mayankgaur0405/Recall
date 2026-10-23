import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, spacing } from '../theme'

type Props = {
  onOpenLibrary: () => void
  lastShareMessage: string | null
  pendingUrl?: string | null
  onRetryPending?: () => Promise<void>
  onDismissPending?: () => void
  onTestSave?: (url: string) => Promise<void>
}

export default function HomeScreen({
  onOpenLibrary,
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
    <View style={styles.wrap}>
      <Text style={styles.kicker}>How to save</Text>
      <Text style={styles.title}>Instagram → Share → Post Vault</Text>
      <Text style={styles.body}>
        Open a Reel, tap Share, choose Post Vault. You do not need to copy the link or open this screen.
      </Text>

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

      {lastShareMessage ? <Text style={styles.banner}>{lastShareMessage}</Text> : null}

      <View style={styles.steps}>
        <Text style={styles.step}>1. Watch a Reel in Instagram</Text>
        <Text style={styles.step}>2. Tap Share and select Post Vault</Text>
        <Text style={styles.step}>3. Stay in Instagram — saving happens in the background</Text>
      </View>

      <Pressable
        onPress={onOpenLibrary}
        style={({ pressed }) => [styles.viewSavedButton, pressed && styles.viewSavedButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="View Saved Reels"
      >
        <Text style={styles.viewSavedButtonText}>View Saved Reels</Text>
        <Text style={styles.viewSavedArrow}>→</Text>
      </Pressable>

      {__DEV__ && onTestSave ? (
        <View style={styles.devBox}>
          <Text style={styles.devLabel}>Local test (dev only)</Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  kicker: {
    color: colors.secondary,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  body: {
    color: colors.secondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  pendingCard: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: spacing.lg,
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
  steps: { gap: 10 },
  step: { color: colors.text, fontSize: 16, lineHeight: 24 },
  viewSavedButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.inverseBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  viewSavedButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  viewSavedButtonText: {
    color: colors.inverse,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  viewSavedArrow: {
    color: colors.inverse,
    fontSize: 18,
    fontWeight: '600',
  },
  devBox: {
    marginTop: spacing.xl,
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
