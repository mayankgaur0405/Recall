import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, spacing } from '../theme'
import { signIn, signUp } from '../lib/auth'

type Props = {
  onAuthenticated: () => void
  pendingUrl: string | null
}

export default function AuthScreen({ onAuthenticated, pendingUrl }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(mode: 'in' | 'up') {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'in') await signIn(email.trim(), password)
      else await signUp(email.trim(), password)
      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authenticate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>Post Vault</Text>
        <Text style={styles.tagline}>Your memory for the internet.</Text>
        {pendingUrl ? (
          <Text style={styles.notice}>
            Sign in to finish saving the Reel that was just shared.
          </Text>
        ) : (
          <Text style={styles.notice}>
            Sign in once. After that, Instagram Share → Post Vault saves automatically.
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.primary} onPress={() => submit('in')} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Please wait…' : 'Log in'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => submit('up')} disabled={busy}>
          <Text style={styles.secondaryText}>Sign up</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
  },
  logo: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 6,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  notice: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  primary: {
    backgroundColor: colors.inverseBg,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: colors.inverse, fontWeight: '600' },
  secondary: {
    backgroundColor: '#F5F5F4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
})
