import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme'
import { signOut, supabase } from '../lib/auth'

type Props = {
  email: string | null
  onSignedOut: () => void
}

export default function SettingsScreen({ email, onSignedOut }: Props) {
  async function logout() {
    await signOut()
    onSignedOut()
  }

  async function deleteAll() {
    Alert.alert('Delete all saved Reels?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reels').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        },
      },
    ])
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.section}>Account</Text>
        <Text style={styles.email}>{email || 'Signed in'}</Text>
        <Pressable onPress={logout}>
          <Text style={styles.action}>Log out of Post Vault</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Privacy</Text>
        <Text style={styles.copy}>
          Saved Reels belong to your existing website account. Share-to-save never reports success until the server stores the URL.
        </Text>
        <Pressable onPress={deleteAll}>
          <Text style={styles.danger}>Delete all saved content</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  section: { fontWeight: '600', color: colors.text, marginBottom: 8 },
  email: { color: colors.text, marginBottom: 12 },
  action: { color: colors.secondary, fontWeight: '500' },
  copy: { color: colors.secondary, lineHeight: 20, marginBottom: 12 },
  danger: { color: colors.danger, fontWeight: '500' },
})
