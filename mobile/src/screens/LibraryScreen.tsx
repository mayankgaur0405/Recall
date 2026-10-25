import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { colors, spacing } from '../theme'
import { supabase } from '../lib/auth'
import { retryReelAnalysis } from '../lib/api'
import { Platform } from 'react-native'
import type { SavedReel } from '../lib/api'

function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {}
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function hasExtendedContent(reel: SavedReel): boolean {
  const summaryLength = (reel.summary || '').length
  const keyPoints = safeArray(reel.key_points)
  const actions = safeArray(reel.actions)
  const ingredients = safeArray(reel.ingredients)
  const keywords = safeArray(reel.search_keywords)
  const hasUseCase = Boolean(reel.use_case && reel.use_case.trim().length > 0)
  const hasWhyUseful = Boolean(reel.why_useful && reel.why_useful.trim().length > 0)

  // Show "Read More" if summary is long (>140 chars) or any structured section exists
  return (
    summaryLength > 140 ||
    keyPoints.length > 0 ||
    actions.length > 0 ||
    ingredients.length > 0 ||
    keywords.length > 0 ||
    hasUseCase ||
    hasWhyUseful
  )
}

function statusLabel(status: string | null): { text: string; color: string } | null {
  switch (status) {
    case 'pending':
      return { text: '⏳ Waiting for analysis…', color: '#D97706' }
    case 'processing':
      return { text: '🔄 Analyzing…', color: '#2563EB' }
    case 'failed':
      return { text: '⚠ Analysis failed — tap to retry', color: '#B91C1C' }
    case 'partial':
      return { text: '📝 Partial analysis — tap to retry for full details', color: '#D97706' }
    case 'completed':
    default:
      return null
  }
}

const SELECT_FIELDS =
  'id,title,summary,category,sub_category,source_url,thumbnail_url,processing_status,created_at,key_points,entities,search_keywords,actions,ingredients,use_case,why_useful,original_caption,transcript'

export default function LibraryScreen() {
  const [reels, setReels] = useState<SavedReel[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReel, setSelectedReel] = useState<SavedReel | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      // Only set initialLoading on true cold start with no reels
      setInitialLoading((prev) => (reels.length === 0 ? true : prev))
    }
    try {
      const { data, error } = await supabase
        .from('reels')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setReels(data as SavedReel[])
      }
    } catch (err) {
      console.warn('[Library] Failed to load reels:', err)
    } finally {
      setInitialLoading(false)
      setRefreshing(false)
    }
  }, [reels.length])

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      load(reels.length > 0)
    }, [load, reels.length])
  )

  // Realtime subscription: updates or inserts immediately
  useEffect(() => {
    const channel = supabase
      .channel('public:reels:library')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reels' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReel = payload.new as SavedReel
            setReels((prev) => {
              if (prev.some((r) => r.id === newReel.id)) {
                return prev.map((r) => (r.id === newReel.id ? { ...r, ...newReel } : r))
              }
              return [newReel, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as SavedReel
            setReels((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
            )
            // If the updated reel is currently opened in the modal, update it too
            setSelectedReel((curr) => (curr && curr.id === updated.id ? { ...curr, ...updated } : curr))
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            if (oldId) {
              setReels((prev) => prev.filter((r) => r.id !== oldId))
              setSelectedReel((curr) => (curr && curr.id === oldId ? null : curr))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Adaptive polling: silent refresh every 3s while any reel is in pending or processing state
  useEffect(() => {
    const hasActiveTasks =
      Boolean(retryingId) ||
      reels.some((r) => r.processing_status === 'pending' || r.processing_status === 'processing')

    if (!hasActiveTasks) return

    const pollTimer = setInterval(() => {
      load(true)
    }, 3000)

    return () => clearInterval(pollTimer)
  }, [reels, retryingId, load])

  async function handleRetryAnalysis(reelId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      Alert.alert('Session expired', 'Please sign in again.')
      return
    }

    setRetryingId(reelId)

    // Optimistically update the UI to processing
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId
          ? { ...r, processing_status: 'processing', summary: 'Re-analyzing this Reel…' }
          : r
      )
    )

    try {
      const result = await retryReelAnalysis(session, reelId)
      if (!result.success) {
        Alert.alert('Retry failed', result.error || 'Something went wrong.')
        // Revert optimistic update
        setReels((prev) =>
          prev.map((r) => (r.id === reelId ? { ...r, processing_status: 'failed' } : r))
        )
      } else {
        // Silent reload
        load(true)
      }
    } catch (e) {
      Alert.alert('Retry error', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRetryingId(null)
    }
  }

  async function handleDeleteReel(reelId: string, reelTitle: string | null) {
    const doDelete = async () => {
      try {
        const { error } = await supabase.from('reels').delete().eq('id', reelId)
        if (error) {
          Alert.alert('Error', 'Could not remove this Reel. Please try again.')
          return
        }
        setReels((prev) => prev.filter((r) => r.id !== reelId))
        // Close modal if this reel was open
        setSelectedReel((curr) => (curr && curr.id === reelId ? null : curr))
      } catch {
        Alert.alert('Error', 'Something went wrong. Please try again.')
      }
    }

    Alert.alert(
      'Remove from Vault',
      `Are you sure you want to remove "${reelTitle || 'this Reel'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]
    )
  }

  function showCardActions(reel: SavedReel) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'View Details', 'Open in Instagram', 'Remove from Vault'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
          title: reel.title || 'Reel Options',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setSelectedReel(reel)
          else if (buttonIndex === 2) Linking.openURL(reel.source_url)
          else if (buttonIndex === 3) handleDeleteReel(reel.id, reel.title)
        }
      )
    } else {
      // Android fallback using Alert
      Alert.alert(
        reel.title || 'Reel Options',
        undefined,
        [
          { text: 'View Details', onPress: () => setSelectedReel(reel) },
          { text: 'Open in Instagram', onPress: () => Linking.openURL(reel.source_url) },
          { text: 'Remove from Vault', style: 'destructive', onPress: () => handleDeleteReel(reel.id, reel.title) },
          { text: 'Cancel', style: 'cancel' },
        ]
      )
    }
  }

  // Filtered reels based on search query
  const filteredReels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return reels

    const terms = q.split(/\s+/).filter(Boolean)
    if (terms.length === 0) return reels

    return reels.filter((reel) => {
      const keyPointsStr = safeArray(reel.key_points).join(' ')
      const keywordsStr = safeArray(reel.search_keywords).join(' ')
      const entitiesStr = safeArray(reel.entities).join(' ')
      const actionsStr = safeArray(reel.actions).join(' ')
      const ingredientsStr = safeArray(reel.ingredients).join(' ')

      const blob = [
        reel.title,
        reel.summary,
        reel.category,
        reel.sub_category,
        reel.use_case,
        reel.why_useful,
        reel.original_caption,
        reel.transcript,
        keyPointsStr,
        keywordsStr,
        entitiesStr,
        actionsStr,
        ingredientsStr,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      // Reel matches if every search term appears somewhere in its searchable content
      return terms.every((term) => blob.includes(term))
    })
  }, [reels, searchQuery])

  if (initialLoading && reels.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Loading your library…</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your saved Reels..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search saved Reels"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={10}
              style={styles.clearSearchButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        {searchQuery.trim().length > 0 ? (
          <View style={styles.searchMetaRow}>
            <Text style={styles.searchMetaText}>
              {filteredReels.length === 1
                ? '1 Reel found'
                : `${filteredReels.length} Reels found`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Empty States ── */}
      {reels.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load(true)
              }}
              tintColor={colors.text}
            />
          }
        >
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.empty}>Share a Reel from Instagram to Post Vault.</Text>
        </ScrollView>
      ) : filteredReels.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No Reels found</Text>
          <Text style={styles.empty}>
            No saved Reels matched &ldquo;{searchQuery.trim()}&rdquo;. Try another search.
          </Text>
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.clearFilterButton}
            accessibilityRole="button"
            accessibilityLabel="Show all saved Reels"
          >
            <Text style={styles.clearFilterButtonText}>Show all saved Reels</Text>
          </Pressable>
        </View>
      ) : (
        /* ── Reels List ── */
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.content}
          data={filteredReels}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load(true)
              }}
              tintColor={colors.text}
            />
          }
          renderItem={({ item }) => {
            const status = statusLabel(item.processing_status)
            const isRetrying = retryingId === item.id
            const canRetry =
              item.processing_status === 'failed' ||
              item.processing_status === 'partial' ||
              item.processing_status === 'pending'
            const showReadMore = hasExtendedContent(item)

            return (
              <Pressable
                style={styles.card}
                onLongPress={() => showCardActions(item)}
                delayLongPress={400}
              >
                <View style={styles.cardMain}>
                  {/* Thumbnail Preview */}
                  {item.thumbnail_url ? (
                    <Image
                      source={{ uri: item.thumbnail_url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder}>
                      <Text style={styles.thumbnailPlaceholderText}>🎬</Text>
                    </View>
                  )}

                  {/* Text Details */}
                  <View style={styles.cardBody}>
                    <View style={styles.categoryRow}>
                      <Text style={styles.category}>
                        {(item.category || 'Saved').toUpperCase()}
                      </Text>
                      {item.sub_category ? (
                        <Text style={styles.subCategory}>• {item.sub_category}</Text>
                      ) : null}
                    </View>

                    <Text style={styles.title} numberOfLines={2}>
                      {item.title || 'Untitled Reel'}
                    </Text>

                    <Text style={styles.summary} numberOfLines={3}>
                      {item.summary || 'No summary available.'}
                    </Text>
                  </View>

                  {/* More Options Button */}
                  <Pressable
                    onPress={() => showCardActions(item)}
                    hitSlop={12}
                    style={styles.moreButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${item.title || 'Reel'}`}
                  >
                    <Text style={styles.moreButtonText}>⋮</Text>
                  </Pressable>
                </View>

                {/* Status Row (Pending, Processing, Failed, Partial) */}
                {status ? (
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                    {canRetry && !isRetrying ? (
                      <Pressable
                        onPress={() => handleRetryAnalysis(item.id)}
                        style={styles.retryChip}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Retry Reel analysis"
                      >
                        <Text style={styles.retryChipText}>Retry</Text>
                      </Pressable>
                    ) : null}
                    {isRetrying ? (
                      <ActivityIndicator size="small" color={colors.text} style={{ marginLeft: 8 }} />
                    ) : null}
                  </View>
                ) : null}

                {/* Read More Action */}
                {showReadMore ? (
                  <View style={styles.cardFooter}>
                    <Pressable
                      onPress={() => setSelectedReel(item)}
                      style={({ pressed }) => [
                        styles.readMoreButton,
                        pressed && styles.readMoreButtonPressed,
                      ]}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Read full analysis for ${item.title || 'Reel'}`}
                    >
                      <Text style={styles.readMoreText}>Read More →</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            )
          }}
        />
      )}

      {/* ── Full Analysis Modal ("Read More") ── */}
      <Modal
        visible={!!selectedReel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedReel(null)}
      >
        {selectedReel ? (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>POST VAULT ANALYSIS</Text>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {selectedReel.title || 'Reel Details'}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedReel(null)}
                style={styles.modalCloseButton}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close analysis modal"
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Modal Content */}
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* Thumbnail Banner */}
              {selectedReel.thumbnail_url ? (
                <Image
                  source={{ uri: selectedReel.thumbnail_url }}
                  style={styles.modalThumbnail}
                  resizeMode="cover"
                />
              ) : null}

              {/* Badges & Meta */}
              <View style={styles.modalMetaRow}>
                <View style={styles.modalCategoryChip}>
                  <Text style={styles.modalCategoryChipText}>
                    {(selectedReel.category || 'General').toUpperCase()}
                  </Text>
                </View>
                {selectedReel.sub_category ? (
                  <View style={styles.modalSubCategoryChip}>
                    <Text style={styles.modalSubCategoryChipText}>
                      {selectedReel.sub_category}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Title */}
              <Text style={styles.modalTitle}>{selectedReel.title || 'Untitled Reel'}</Text>

              {/* Action Buttons Row */}
              <View style={styles.modalActionsRow}>
                <Pressable
                  onPress={() => Linking.openURL(selectedReel.source_url)}
                  style={({ pressed }) => [
                    styles.openInstagramButton,
                    pressed && styles.openInstagramButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Reel on Instagram"
                >
                  <Text style={styles.openInstagramButtonText}>View on Instagram ↗</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleDeleteReel(selectedReel.id, selectedReel.title)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.removeButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Remove Reel from Vault"
                >
                  <Text style={styles.removeButtonText}>Remove from Vault</Text>
                </Pressable>
              </View>

              {/* Section: Summary */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Summary</Text>
                <Text style={styles.modalSectionBody}>
                  {selectedReel.summary || 'No summary available.'}
                </Text>
              </View>

              {/* Section: Key Takeaways */}
              {safeArray(selectedReel.key_points).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Key Takeaways</Text>
                  {safeArray(selectedReel.key_points).map((point, index) => (
                    <View key={index} style={styles.bulletRow}>
                      <Text style={styles.bulletMarker}>•</Text>
                      <Text style={styles.bulletText}>{point}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Section: Action Steps */}
              {safeArray(selectedReel.actions).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Action Steps</Text>
                  {safeArray(selectedReel.actions).map((step, index) => (
                    <View key={index} style={styles.bulletRow}>
                      <Text style={styles.actionNumber}>{index + 1}.</Text>
                      <Text style={styles.bulletText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Section: Ingredients */}
              {safeArray(selectedReel.ingredients).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Ingredients / Requirements</Text>
                  {safeArray(selectedReel.ingredients).map((ing, index) => (
                    <View key={index} style={styles.bulletRow}>
                      <Text style={styles.bulletMarker}>✔</Text>
                      <Text style={styles.bulletText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Section: Use Case & Why Useful */}
              {selectedReel.use_case || selectedReel.why_useful ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Why It&apos;s Useful</Text>
                  {selectedReel.why_useful ? (
                    <Text style={styles.modalSectionBody}>{selectedReel.why_useful}</Text>
                  ) : null}
                  {selectedReel.use_case ? (
                    <Text style={[styles.modalSectionBody, { marginTop: 6, fontStyle: 'italic' }]}>
                      Best for: {selectedReel.use_case}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Section: Search Keywords & Topics */}
              {safeArray(selectedReel.search_keywords).length > 0 ||
              safeArray(selectedReel.entities).length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Keywords &amp; Topics</Text>
                  <View style={styles.tagsContainer}>
                    {[
                      ...safeArray(selectedReel.search_keywords),
                      ...safeArray(selectedReel.entities),
                    ]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map((tag, index) => (
                        <View key={index} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{tag}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : null}

              {/* Section: Original Caption (if available) */}
              {selectedReel.original_caption ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Original Caption</Text>
                  <Text style={styles.captionText}>{selectedReel.original_caption}</Text>
                </View>
              ) : null}

              {/* Section: Transcript (if available) */}
              {selectedReel.transcript ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Audio Transcript</Text>
                  <Text style={styles.captionText}>{selectedReel.transcript}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 2,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 6,
  },
  clearSearchText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  searchMetaRow: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  searchMetaText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: 14,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondary,
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  empty: {
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  clearFilterButton: {
    marginTop: 16,
    backgroundColor: colors.inverseBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  clearFilterButtonText: {
    color: colors.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardMain: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnail: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 28,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  category: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subCategory: {
    color: colors.secondary,
    fontSize: 11,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    lineHeight: 21,
  },
  summary: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  retryChip: {
    backgroundColor: colors.inverseBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  retryChipText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  readMoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  readMoreButtonPressed: {
    opacity: 0.7,
  },
  readMoreText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 260,
  },
  modalCloseButton: {
    backgroundColor: colors.border,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalScrollContent: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  modalThumbnail: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: colors.border,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalCategoryChip: {
    backgroundColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalCategoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  modalSubCategoryChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalSubCategoryChipText: {
    fontSize: 11,
    color: colors.secondary,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
    marginBottom: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  openInstagramButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openInstagramButtonPressed: {
    backgroundColor: colors.border,
  },
  openInstagramButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  modalSectionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 12,
  },
  bulletMarker: {
    fontSize: 16,
    color: colors.secondary,
    marginRight: 8,
    lineHeight: 22,
  },
  actionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500',
  },
  captionText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondary,
    fontFamily: 'monospace',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    minWidth: 24,
  },
  moreButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.secondary,
    lineHeight: 20,
  },
  removeButton: {
    flex: 1,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    backgroundColor: '#FEE2E2',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
})
