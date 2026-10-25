import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '../theme'
import { signOut, supabase } from '../lib/auth'
import {
  getBrowserPreferences,
  setBrowserPreferences,
  type BrowserPreferences,
  type SaveButtonStyle,
} from '../lib/preferences'
import {
  getSavedLanguage,
  setSavedLanguage,
  translations,
  type LanguageCode,
  type TranslationKey,
} from '../lib/i18n'
import {
  getUserProfile,
  saveUserProfile,
  updateSupabaseProfile,
  PRESET_AVATARS,
  type UserProfile,
} from '../lib/userProfile'

type Props = {
  email: string | null
  onSignedOut: () => void
}

type ModalType =
  | 'editProfile'
  | 'avatarPicker'
  | 'about'
  | 'plus'
  | 'language'
  | 'payments'
  | 'refer'
  | 'support'
  | 'terms'
  | 'privacy'
  | null

const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: 'en', name: 'English (US)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
]

export default function SettingsScreen({ email, onSignedOut }: Props) {
  const [lang, setLang] = useState<LanguageCode>('en')
  const [profile, setProfile] = useState<UserProfile>({
    username: email ? email.split('@')[0] : 'Member',
    email: email || '',
    phoneNumber: '',
    avatarUrl: '⚡',
  })

  // Edit profile form state
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editAvatar, setEditAvatar] = useState('⚡')
  const [customAvatarUrlInput, setCustomAvatarUrlInput] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  const [prefs, setPrefs] = useState<BrowserPreferences>({
    buttonStyle: 'circle',
    isDraggable: true,
  })
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[lang] || translations.en
      return dict[key] || translations.en[key] || key
    },
    [lang]
  )

  useEffect(() => {
    async function loadAll() {
      const [savedPrefs, savedLang, userProf] = await Promise.all([
        getBrowserPreferences(),
        getSavedLanguage(),
        getUserProfile(email),
      ])
      setPrefs(savedPrefs)
      setLang(savedLang)
      setProfile(userProf)
      setEditUsername(userProf.username)
      setEditEmail(userProf.email)
      setEditPhone(userProf.phoneNumber)
      setEditAvatar(userProf.avatarUrl)
    }
    loadAll()
  }, [email])

  async function triggerHaptic(type: 'success' | 'impact') {
    try {
      if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    } catch { }
  }

  async function handleStyleChange(style: SaveButtonStyle) {
    const next = { ...prefs, buttonStyle: style }
    setPrefs(next)
    await setBrowserPreferences(next)
    await triggerHaptic('impact')
  }

  async function handleDraggableToggle(val: boolean) {
    const next = { ...prefs, isDraggable: val }
    setPrefs(next)
    await setBrowserPreferences(next)
    await triggerHaptic('impact')
  }

  async function handleSelectLanguage(code: LanguageCode) {
    setLang(code)
    await setSavedLanguage(code)
    await triggerHaptic('impact')
    setActiveModal(null)
  }

  function openEditProfile() {
    setEditUsername(profile.username)
    setEditEmail(profile.email)
    setEditPhone(profile.phoneNumber)
    setEditAvatar(profile.avatarUrl)
    setEditPassword('')
    setActiveModal('editProfile')
  }

  async function handleSaveProfile() {
    if (!editEmail.trim()) {
      Alert.alert('Required', 'Email cannot be empty.')
      return
    }

    setIsUpdatingProfile(true)
    const res = await updateSupabaseProfile({
      username: editUsername.trim() || undefined,
      email: editEmail.trim(),
      phoneNumber: editPhone.trim(),
      avatarUrl: editAvatar,
      newPassword: editPassword.trim() || undefined,
    })
    setIsUpdatingProfile(false)

    if (res.success) {
      const updated: UserProfile = {
        username: editUsername.trim() || profile.username,
        email: editEmail.trim(),
        phoneNumber: editPhone.trim(),
        avatarUrl: editAvatar,
      }
      setProfile(updated)
      await triggerHaptic('success')
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.')
      setActiveModal(null)
    } else {
      Alert.alert('Update Failed', res.error || 'Could not update profile.')
    }
  }

  async function handleShareReferral() {
    try {
      await Share.share({
        message: 'Join me on Post Vault! Save and analyze any Instagram Reel or Post with AI. Use code VAULT99 for 1 month free: https://postvault.app',
      })
    } catch { }
  }

  async function handleSubscribePlus() {
    setIsSubscribed(true)
    await triggerHaptic('success')
    Alert.alert(
      '🎉 Welcome to Post Vault Plus!',
      'You now have unlimited AI multimodal analysis, priority vector search, and cloud sync for ₹99/month.',
      [{ text: 'Awesome', onPress: () => setActiveModal(null) }]
    )
  }

  async function logout() {
    Alert.alert('Log out', 'Are you sure you want to log out of Post Vault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          onSignedOut()
        },
      },
    ])
  }

  async function deleteAll() {
    Alert.alert('Delete all saved content?', 'This cannot be undone. All your analyzed Reels and Posts will be permanently erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reels').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          Alert.alert('Cleared', 'All your saved content has been deleted.')
        },
      },
    ])
  }

  const isAvatarUrl = profile.avatarUrl.startsWith('http://') || profile.avatarUrl.startsWith('https://')

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      {/* ── 1. User Profile Card ── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <Pressable onPress={openEditProfile} style={styles.avatarContainer}>
            {isAvatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{profile.avatarUrl || '⚡'}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>✏️</Text>
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={styles.planBadgeRow}>
              <Text style={styles.userNameText}>{profile.username || 'Member'}</Text>
              <View style={isSubscribed ? styles.proBadge : styles.freeBadge}>
                <Text style={isSubscribed ? styles.proBadgeText : styles.freeBadgeText}>
                  {isSubscribed ? t('proMember') : t('freeMember')}
                </Text>
              </View>
            </View>
            <Text style={styles.userEmailText} numberOfLines={1}>{profile.email || 'No email'}</Text>
            {profile.phoneNumber ? (
              <Text style={styles.userPhoneText}>{profile.phoneNumber}</Text>
            ) : null}
          </View>
        </View>

        <Pressable onPress={openEditProfile} style={styles.editProfilePillBtn}>
          <Text style={styles.editProfilePillText}> {t('editProfile')}</Text>
        </Pressable>
      </View>

      {/* ── 2. Post Vault Plus Card (₹99 / month) ── */}
      <View style={styles.plusCard}>
        <View style={styles.plusHeaderRow}>
          <View>
            <View style={styles.plusTag}>
              <Text style={styles.plusTagText}>{t('unlimitedAccess')}</Text>
            </View>
            <Text style={styles.plusTitle}>{t('postVaultPlus')}</Text>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.priceAmount}>₹99</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
        </View>

        <Text style={styles.plusDesc}>{t('plusDesc')}</Text>

        <View style={styles.plusPerksList}>
          <Text style={styles.plusPerkItem}>✓ Unlimited AI Video &amp; Speech Transcripts</Text>
          <Text style={styles.plusPerkItem}>✓ Deep Semantic Natural Language Search</Text>
          <Text style={styles.plusPerkItem}>✓ Instant In-App Reel Auto-Detection</Text>
          <Text style={styles.plusPerkItem}>✓ Cloud Backup &amp; Device Sync</Text>
        </View>

        <Pressable
          onPress={() => setActiveModal('plus')}
          style={({ pressed }) => [
            styles.plusCtaBtn,
            pressed && styles.plusCtaBtnPressed,
          ]}
        >
          <Text style={styles.plusCtaText}>
            {isSubscribed ? 'Manage Subscription' : t('upgradeToPlus')}
          </Text>
        </Pressable>
      </View>

      {/* ── 3. In-App Browser Save Button Preferences ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('browserSaveBtn')}</Text>
        <Text style={styles.cardDesc}>{t('browserSaveDesc')}</Text>

        <Text style={styles.subSectionTitle}>{t('btnStyle')}</Text>
        <View style={styles.segmentedRow}>
          <Pressable
            onPress={() => handleStyleChange('circle')}
            style={[
              styles.segmentBtn,
              prefs.buttonStyle === 'circle' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                prefs.buttonStyle === 'circle' && styles.segmentBtnTextActive,
              ]}
            >
              {t('circleFab')}
            </Text>
            <Text
              style={[
                styles.segmentBtnSub,
                prefs.buttonStyle === 'circle' && styles.segmentBtnSubActive,
              ]}
            >
              {t('circleFabDesc')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleStyleChange('pill')}
            style={[
              styles.segmentBtn,
              prefs.buttonStyle === 'pill' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                prefs.buttonStyle === 'pill' && styles.segmentBtnTextActive,
              ]}
            >
              {t('expandedPill')}
            </Text>
            <Text
              style={[
                styles.segmentBtnSub,
                prefs.buttonStyle === 'pill' && styles.segmentBtnSubActive,
              ]}
            >
              {t('expandedPillDesc')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.switchLabel}>{t('draggableAnywhere')}</Text>
            <Text style={styles.switchDesc}>{t('draggableDesc')}</Text>
          </View>
          <Switch
            value={prefs.isDraggable}
            onValueChange={handleDraggableToggle}
            trackColor={{ false: colors.border, true: '#10B981' }}
            thumbColor={colors.surface}
          />
        </View>
      </View>

      {/* ── 4. Features & Tools Section ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('toolsAndAccount')}</Text>

        <Pressable onPress={() => setActiveModal('language')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🌐</Text>
            <Text style={styles.menuText}>{t('changeLanguage')}</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValueText}>
              {LANGUAGES.find((l) => l.code === lang)?.name || 'English'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable onPress={() => setActiveModal('payments')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>💳</Text>
            <Text style={styles.menuText}>{t('paymentHistory')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable onPress={() => setActiveModal('refer')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🎁</Text>
            <Text style={styles.menuText}>{t('referAndEarn')}</Text>
          </View>
          <View style={styles.menuRight}>
            <View style={styles.freeMonthTag}>
              <Text style={styles.freeMonthText}>FREE MONTH</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable onPress={() => setActiveModal('support')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>💬</Text>
            <Text style={styles.menuText}>{t('helpAndSupport')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        {/* 🏢 About Post Vault & Team */}
        <Pressable onPress={() => setActiveModal('about')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🏢</Text>
            <Text style={styles.menuText}>{t('aboutUsAndTeam')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {/* ── 5. Legal & Privacy ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('legalAndPrivacy')}</Text>

        <Pressable onPress={() => setActiveModal('terms')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>📄</Text>
            <Text style={styles.menuText}>{t('termsAndConditions')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable onPress={() => setActiveModal('privacy')} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🛡️</Text>
            <Text style={styles.menuText}>{t('privacyPolicy')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable onPress={deleteAll} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🗑️</Text>
            <Text style={[styles.menuText, { color: colors.danger }]}>{t('deleteContent')}</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.danger }]}>›</Text>
        </Pressable>
      </View>

      {/* ── 6. Logout & App Info ── */}
      <Pressable onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>{t('logOut')}</Text>
      </Pressable>

      <Text style={styles.versionFooter}>Post Vault v1.2.0 • AI Video Assistant</Text>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── MODALS ── */}
      {/* ══════════════════════════════════════════════════ */}

      {/* 1. EDIT PROFILE MODAL */}
      <Modal visible={activeModal === 'editProfile'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* DP Avatar Picker Row */}
              <View style={styles.avatarEditSection}>
                <Pressable
                  onPress={() => setActiveModal('avatarPicker')}
                  style={styles.avatarEditPreview}
                >
                  {editAvatar.startsWith('http') ? (
                    <Image source={{ uri: editAvatar }} style={styles.avatarLargeImage} />
                  ) : (
                    <Text style={styles.avatarLargeEmoji}>{editAvatar || '⚡'}</Text>
                  )}
                  <View style={styles.changeDpPill}>
                    <Text style={styles.changeDpText}>Change DP</Text>
                  </View>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Enter username"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Enter email"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>New Password (leave empty to keep current)</Text>
              <TextInput
                value={editPassword}
                onChangeText={setEditPassword}
                placeholder="Enter new password (min 6 chars)"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                secureTextEntry={true}
              />

              <Pressable
                onPress={handleSaveProfile}
                disabled={isUpdatingProfile}
                style={[styles.modalCtaBtn, { marginTop: 16 }]}
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalCtaText}>Save Profile Changes</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2. AVATAR / DP PICKER MODAL */}
      <Modal visible={activeModal === 'avatarPicker'} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar / DP</Text>
              <Pressable onPress={() => setActiveModal('editProfile')} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.subSectionTitle}>PRESET AVATARS</Text>
            <View style={styles.presetGrid}>
              {PRESET_AVATARS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    setEditAvatar(emoji)
                    setActiveModal('editProfile')
                  }}
                  style={[
                    styles.presetAvatarBtn,
                    editAvatar === emoji && styles.presetAvatarBtnActive,
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.subSectionTitle}>OR PASTE IMAGE URL</Text>
            <TextInput
              value={customAvatarUrlInput}
              onChangeText={setCustomAvatarUrlInput}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => {
                if (customAvatarUrlInput.trim().startsWith('http')) {
                  setEditAvatar(customAvatarUrlInput.trim())
                  setActiveModal('editProfile')
                } else {
                  Alert.alert('Invalid URL', 'Please enter a valid image URL starting with http:// or https://')
                }
              }}
              style={[styles.modalSecondaryBtn, { marginTop: 10 }]}
            >
              <Text style={styles.modalSecondaryText}>Set Image URL as DP</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 3. ABOUT POST VAULT & TEAM MODAL */}
      <Modal visible={activeModal === 'about'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About Post Vault</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* What is Post Vault Section */}
              <View style={styles.aboutHeroBox}>
                <Text style={styles.aboutHeroTitle}>What is Post Vault?</Text>
                <Text style={styles.aboutHeroText}>
                  Post Vault is an intelligent AI-powered personal library that captures, transcribes, and organizes Instagram Reels, videos, and social posts.
                </Text>
                <View style={styles.aboutFeatureList}>
                  <Text style={styles.aboutFeatureItem}> <Text style={{ fontWeight: '700' }}>1-Tap In-App Save:</Text> Effortlessly save any Reel directly while browsing Instagram.</Text>
                  <Text style={styles.aboutFeatureItem}> <Text style={{ fontWeight: '700' }}>Multimodal AI Intelligence:</Text> Google Gemini watches video frames and transcribes speech.</Text>
                  <Text style={styles.aboutFeatureItem}> <Text style={{ fontWeight: '700' }}>Natural Language Search:</Text> Find any post by description even months later (e.g., "pasta recipe with garlic").</Text>
                  <Text style={styles.aboutFeatureItem}> <Text style={{ fontWeight: '700' }}>Smart Categorization:</Text> Automatically extracts recipes, specs, places, and takeaways.</Text>
                </View>
              </View>

              {/* Leadership & Engineering Team */}
              <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 8 }]}>The Leadership &amp; Engineering Team</Text>

              {/* Aman Istwal */}
              <View style={styles.teamMemberCard}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>AI</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.teamHeaderRow}>
                    <Text style={styles.teamName}>Aman Istwal</Text>
                    <View style={styles.founderTag}>
                      <Text style={styles.founderTagText}>FOUNDER</Text>
                    </View>
                  </View>
                  <Text style={styles.teamRole}>Founder &amp; Concept Creator</Text>
                  <Text style={styles.teamBio}>
                    Conceived and founded the Post Vault vision to transform how people save, organize, and search video content with AI.
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Mayank Gaur */}
              <View style={styles.teamMemberCard}>
                <View style={[styles.teamAvatar, { backgroundColor: '#1E1B4B' }]}>
                  <Text style={[styles.teamAvatarText, { color: '#818CF8' }]}>MG</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.teamHeaderRow}>
                    <Text style={styles.teamName}>Mayank Gaur</Text>
                    <View style={[styles.founderTag, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.founderTagText, { color: '#4338CA' }]}>LEAD TECH</Text>
                    </View>
                  </View>
                  <Text style={styles.teamRole}>Lead Architect &amp; Full-Stack Engineer</Text>
                  <Text style={styles.teamBio}>
                    Architected and built the codebase, mobile app, and AI multimodal pipeline, turning the idea into a high-performance reality.
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Varun Jain */}
              <View style={styles.teamMemberCard}>
                <View style={[styles.teamAvatar, { backgroundColor: '#064E3B' }]}>
                  <Text style={[styles.teamAvatarText, { color: '#34D399' }]}>VJ</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.teamHeaderRow}>
                    <Text style={styles.teamName}>Varun Jain</Text>
                    <View style={[styles.founderTag, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.founderTagText, { color: '#047857' }]}>CORE TECH</Text>
                    </View>
                  </View>
                  <Text style={styles.teamRole}>Core Technical &amp; Product Strategist</Text>
                  <Text style={styles.teamBio}>
                    Drives technical development, system reliability, and key product ideation for enhanced user experience.
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => setActiveModal(null)} style={[styles.modalSecondaryBtn, { marginTop: 20 }]}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. LANGUAGE MODAL (FUNCTIONAL) */}
      <Modal visible={activeModal === 'language'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('changeLanguage')}</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => handleSelectLanguage(l.code)}
                style={[
                  styles.languageRow,
                  lang === l.code && styles.languageRowSelected,
                ]}
              >
                <Text style={styles.languageText}>{l.name}</Text>
                {lang === l.code ? <Text style={styles.languageCheck}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* 5. POST VAULT PLUS MODAL */}
      <Modal visible={activeModal === 'plus'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Vault Plus</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.modalPlanHero}>
              <Text style={styles.modalPlanPrice}>₹99</Text>
              <Text style={styles.modalPlanPeriod}>/ per month • Cancel anytime</Text>
            </View>

            <View style={styles.modalPerksBox}>
              <Text style={styles.modalPerkLine}>⚡ Unlimited AI Video &amp; Voice Analysis</Text>
              <Text style={styles.modalPerkLine}>🔍 Instant Semantic Vector Search</Text>
              <Text style={styles.modalPerkLine}>☁️ Unlimited Secure Cloud Storage</Text>
              <Text style={styles.modalPerkLine}>🚀 High Priority Background Processing</Text>
            </View>

            <Pressable onPress={handleSubscribePlus} style={styles.modalCtaBtn}>
              <Text style={styles.modalCtaText}>
                {isSubscribed ? 'Active Subscription' : 'Activate Plus for ₹99/month'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 6. PAYMENT HISTORY MODAL */}
      <Modal visible={activeModal === 'payments'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('paymentHistory')}</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {isSubscribed ? (
              <View style={styles.paymentReceipt}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptTitle}>Post Vault Plus (Monthly)</Text>
                  <Text style={styles.receiptDate}>Billed on Oct 24, 2026</Text>
                </View>
                <Text style={styles.receiptAmount}>₹99.00</Text>
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.secondary, fontSize: 14 }}>
                  No payment history found. You are currently on the Free tier.
                </Text>
              </View>
            )}

            <Pressable onPress={() => setActiveModal(null)} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 7. REFER & EARN MODAL */}
      <Modal visible={activeModal === 'refer'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('referAndEarn')}</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              Share Post Vault with fellow creators and friends. For every friend who signs up, you both receive 1 month of Post Vault Plus completely free!
            </Text>

            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCodeLabel}>YOUR REFERRAL CODE</Text>
              <Text style={styles.referralCode}>VAULT-VIP99</Text>
            </View>

            <Pressable onPress={handleShareReferral} style={styles.modalCtaBtn}>
              <Text style={styles.modalCtaText}>Share Invite Link 🎁</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 8. HELP & SUPPORT MODAL */}
      <Modal visible={activeModal === 'support'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('helpAndSupport')}</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
              Contact Team Post Vault
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18, marginBottom: 16 }}>
              Have questions, issues, or suggestions? Reach out directly to our engineering team at:
            </Text>

            <View style={styles.supportContactCard}>
              <Text style={styles.supportEmail}>support@postvault.app</Text>
              <Text style={styles.supportSub}>Response time within 24 hours</Text>
            </View>

            <Pressable onPress={() => setActiveModal(null)} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 9. TERMS & CONDITIONS / PRIVACY POLICY MODAL */}
      <Modal visible={activeModal === 'terms' || activeModal === 'privacy'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'terms' ? t('termsAndConditions') : t('privacyPolicy')}
              </Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 19 }}>
                {activeModal === 'terms'
                  ? 'By using Post Vault, you agree to comply with all applicable copyright and intellectual property laws. Content saved is for personal research and archiving. Post Vault does not claim ownership over any third-party social media content.'
                  : 'Post Vault respects your privacy. Your saved Reels and Posts belong strictly to your personal account. We do not sell your personal data or browsing activity to any third parties.'}
              </Text>
            </ScrollView>

            <Pressable onPress={() => setActiveModal(null)} style={[styles.modalSecondaryBtn, { marginTop: 16 }]}>
              <Text style={styles.modalSecondaryText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
    gap: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },

  /* ──── PROFILE HEADER CARD ──── */
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.border,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarEditIcon: {
    fontSize: 10,
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  userEmailText: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
  },
  userPhoneText: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 1,
  },
  editProfilePillBtn: {
    marginTop: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfilePillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  proBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  proBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  freeBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ──── POST VAULT PLUS CARD ──── */
  plusCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  plusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  plusTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  plusTagText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  plusTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  pricePeriod: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  plusDesc: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  plusPerksList: {
    gap: 6,
    marginBottom: 16,
  },
  plusPerkItem: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  plusCtaBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCtaBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  plusCtaText: {
    color: '#18181B',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ──── BUTTON STYLE PREFERENCES ──── */
  sectionTitle: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
    marginBottom: 4,
  },
  cardDesc: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  subSectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  segmentedRow: {
    gap: 8,
  },
  segmentBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
  },
  segmentBtnActive: {
    borderColor: '#1C1917',
    backgroundColor: '#1C1917',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  segmentBtnSub: {
    fontSize: 11,
    color: colors.secondary,
    lineHeight: 15,
  },
  segmentBtnSubActive: {
    color: '#D6D3D1',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 12,
    color: colors.secondary,
    lineHeight: 16,
  },

  /* ──── MENU ROWS ──── */
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIcon: {
    fontSize: 16,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuValueText: {
    fontSize: 13,
    color: colors.secondary,
  },
  chevron: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  freeMonthTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeMonthText: {
    color: '#065F46',
    fontSize: 9,
    fontWeight: '800',
  },

  /* ──── LOGOUT & FOOTER ──── */
  logoutButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  versionFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 4,
  },

  /* ──── MODAL STYLES ──── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
    padding: 4,
  },
  modalPlanHero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPlanPrice: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
  },
  modalPlanPeriod: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
  },
  modalPerksBox: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  modalPerkLine: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  modalCtaBtn: {
    backgroundColor: '#18181B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageRowSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  languageText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  languageCheck: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  receiptDate: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },
  referralCodeBox: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  referralCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  referralCode: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.5,
  },
  supportContactCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  supportEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  supportSub: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
  },

  /* ──── EDIT PROFILE FORM ──── */
  avatarEditSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarEditPreview: {
    alignItems: 'center',
  },
  avatarLargeImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.border,
  },
  avatarLargeEmoji: {
    fontSize: 54,
  },
  changeDpPill: {
    marginTop: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  changeDpText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 14,
  },
  presetAvatarBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetAvatarBtnActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },

  /* ──── ABOUT POST VAULT HERO & TEAM ──── */
  aboutHeroBox: {
    backgroundColor: '#1C1917',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  aboutHeroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  aboutHeroText: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  aboutFeatureList: {
    gap: 8,
  },
  aboutFeatureItem: {
    color: '#E4E4E7',
    fontSize: 12,
    lineHeight: 17,
  },
  teamMemberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  teamAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '800',
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  founderTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  founderTagText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  teamRole: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  teamBio: {
    fontSize: 12,
    color: colors.secondary,
    lineHeight: 17,
  },
})
