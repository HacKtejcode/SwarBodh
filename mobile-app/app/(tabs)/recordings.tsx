import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ImageBackground, Alert, Animated, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadRecordingsIndex, deleteRecording, deleteRecordingsBatch,
  RecordingMeta
} from '../../src/utils/recordingStore';

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function formatDuration(ms?: number) {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Recording Card ────────────────────────────────────────────────────────
const RecordingCard = ({
  item, isPlaying, onPlay, onStop, isSelecting, selected, onToggleSelect, onDelete
}: any) => {
  const pressScale = useRef(new Animated.Value(1)).current;
  const playProgress = useRef(new Animated.Value(0)).current;

  const onPressIn = () => Animated.spring(pressScale, { toValue: 0.972, useNativeDriver: true, damping: 15, stiffness: 300 }).start();
  const onPressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 250 }).start();

  React.useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(playProgress, { toValue: 1, duration: 1800, useNativeDriver: false }),
          Animated.timing(playProgress, { toValue: 0.3, duration: 1800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      playProgress.stopAnimation();
      Animated.timing(playProgress, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  }, [isPlaying]);

  const typeLabel = item.type === 'guru' ? 'Vocal Guru' : 'Vocalytics';
  const typeColor = item.type === 'guru' ? '#D4AF37' : '#A5B4FC';
  const typeBg = item.type === 'guru' ? 'rgba(120,53,15,0.4)' : 'rgba(67,56,202,0.3)';

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale: pressScale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => isSelecting ? onToggleSelect(item.id) : (isPlaying ? onStop() : onPlay(item))}
        onLongPress={() => onToggleSelect(item.id)}
      >
        <View style={[styles.card, isPlaying && styles.cardPlaying]}>
          {/* Playing bar */}
          {isPlaying && (
            <Animated.View style={[styles.playingBar, {
              opacity: playProgress,
              backgroundColor: item.type === 'guru' ? '#D4AF37' : '#818CF8'
            }]} />
          )}

          <View style={styles.cardTop}>
            {/* Left: icon + metadata */}
            <View style={styles.cardLeft}>
              {isSelecting ? (
                <TouchableOpacity onPress={() => onToggleSelect(item.id)} style={{ marginRight: 10 }}>
                  <MaterialCommunityIcons
                    name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selected ? '#D4AF37' : '#78716C'}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => isPlaying ? onStop() : onPlay(item)}
                  style={[styles.playBtn, { backgroundColor: isPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(212,175,55,0.12)', borderColor: isPlaying ? '#EF4444' : '#B8860B' }]}
                >
                  <Ionicons
                    name={isPlaying ? 'stop' : 'play'}
                    size={18}
                    color={isPlaying ? '#F87171' : '#D4AF37'}
                    style={{ marginLeft: isPlaying ? 0 : 2 }}
                  />
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }}>
                <View style={styles.tagRow}>
                  <View style={[styles.typeTag, { backgroundColor: typeBg }]}>
                    <Text style={[styles.typeTagText, { color: typeColor }]}>{typeLabel}</Text>
                  </View>
                  {isPlaying && (
                    <View style={styles.nowPlayingTag}>
                      <Text style={styles.nowPlayingText}>● NOW PLAYING</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
                {item.note && (
                  <Text style={styles.cardNote}>
                    {item.type === 'guru' ? `Register: ${item.note}` : `Note: ${item.note}${item.sargam ? ` · ${item.sargam}` : ''}`}
                  </Text>
                )}
              </View>
            </View>

            {/* Right: delete */}
            {!isSelecting && (
              <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={17} color="#78716C" />
              </TouchableOpacity>
            )}
          </View>

          {/* Waveform bars (decorative) */}
          <View style={styles.waveRow}>
            {Array.from({ length: 28 }).map((_, i) => {
              const h = 4 + Math.sin(i * 0.8 + item.id.length * 0.3) * 8 + Math.cos(i * 0.4) * 5;
              return (
                <View
                  key={i}
                  style={[
                    styles.wavebar,
                    {
                      height: Math.abs(h) + 3,
                      backgroundColor: isPlaying
                        ? (item.type === 'guru' ? '#D4AF37' : '#818CF8')
                        : 'rgba(184,134,11,0.3)',
                      opacity: isPlaying ? 0.6 + (i % 3) * 0.15 : 0.4,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────
export default function RecordingsScreen() {
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    const data = await loadRecordingsIndex();
    setRecordings(data);
    Animated.timing(mountOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    loadData();
    return () => { stopCurrentSound(); };
  }, []));

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  const stopCurrentSound = async () => {
    try {
      await sound?.stopAsync();
      await sound?.unloadAsync();
    } catch (_) {}
    setSound(null);
    setPlayingId(null);
  };

  const handlePlay = async (item: RecordingMeta) => {
    await stopCurrentSound();
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,        // ← switch out of recording mode so iOS uses the loudspeaker
        playsInSilentModeIOS: true,       // play even when mute switch is on
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // ← route through speaker, not earpiece
      });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true, volume: 1.0 }
      );
      setSound(s);
      setPlayingId(item.id);
      s.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingId(null);
          setSound(null);
          s.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.error('Playback error:', e);
      Alert.alert('Playback Error', 'Could not play this recording.');
    }
  };

  const handleToggleSelect = (id: string) => {
    if (!isSelecting) setIsSelecting(true);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Recording', 'Remove this recording from the vault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (playingId === id) await stopCurrentSound();
          await deleteRecording(id);
          setRecordings(prev => prev.filter(r => r.id !== id));
        }
      }
    ]);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert('Delete Selected', `Remove ${selectedIds.size} recording(s) from the vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (playingId && selectedIds.has(playingId)) await stopCurrentSound();
          await deleteRecordingsBatch(Array.from(selectedIds));
          setRecordings(prev => prev.filter(r => !selectedIds.has(r.id)));
          setSelectedIds(new Set());
          setIsSelecting(false);
        }
      }
    ]);
  };

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === recordings.length
      ? new Set()
      : new Set(recordings.map(r => r.id))
    );
  };

  const renderItem = ({ item }: { item: RecordingMeta }) => (
    <RecordingCard
      item={item}
      isPlaying={playingId === item.id}
      onPlay={handlePlay}
      onStop={stopCurrentSound}
      isSelecting={isSelecting}
      selected={selectedIds.has(item.id)}
      onToggleSelect={handleToggleSelect}
      onDelete={handleDelete}
    />
  );

  return (
    <ImageBackground source={require('../../assets/images/recordings_vault.png')} style={styles.flex} resizeMode="cover">
      <LinearGradient
        colors={['rgba(8,0,0,0.80)', 'rgba(22,5,0,0.82)', 'rgba(8,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Vocal Vault</Text>
            <Text style={styles.subtitle}>RECORDED SESSIONS</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#B8860B" />
            </TouchableOpacity>
            {recordings.length > 0 && (
              <TouchableOpacity
                onPress={() => { setIsSelecting(!isSelecting); setSelectedIds(new Set()); }}
                style={[styles.selectBtn, isSelecting && styles.selectBtnActive]}
              >
                <MaterialCommunityIcons
                  name={isSelecting ? 'close' : 'checkbox-multiple-outline'}
                  size={16}
                  color={isSelecting ? '#FEF3C7' : '#B8860B'}
                />
                <Text style={[styles.selectBtnText, isSelecting && { color: '#FEF3C7' }]}>
                  {isSelecting ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Batch Actions ── */}
        {isSelecting && recordings.length > 0 && (
          <View style={styles.batchBar}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.batchChip}>
              <Text style={styles.batchChipText}>
                {selectedIds.size === recordings.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchDelete}
              style={[styles.batchChip, styles.batchChipDelete, selectedIds.size === 0 && { opacity: 0.4 }]}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
              <Text style={[styles.batchChipText, { color: '#FCA5A5' }]}>Delete ({selectedIds.size})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Gold Divider ── */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <MaterialCommunityIcons name="music-clef-treble" size={13} color="#B8860B" style={{ marginHorizontal: 8 }} />
          <View style={styles.dividerLine} />
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Opening the Vault...</Text>
          </View>
        ) : recordings.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="waveform" size={52} color="#44403C" />
            <Text style={styles.emptyTitle}>The Vault is Empty</Text>
            <Text style={styles.emptyText}>
              Record a session in Vocalytics or Vocal Guru — your audio will be preserved here automatically.
            </Text>
          </View>
        ) : (
          <Animated.View style={[styles.flex, { opacity: mountOpacity }]}>
            <FlatList
              data={recordings}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.countText}>
                  {recordings.length} session{recordings.length !== 1 ? 's' : ''} preserved
                </Text>
              }
            />
          </Animated.View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const GOLD_DIM = '#B8860B';
const CARD_BG = 'rgba(19,0,0,0.65)';
const CARD_BORDER = 'rgba(184,134,11,0.3)';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, marginBottom: 6 },
  title: { color: GOLD, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#78716C', fontSize: 10, letterSpacing: 3, marginTop: 2 },

  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(28,18,0,0.6)', borderWidth: 1, borderColor: CARD_BORDER },
  selectBtnActive: { backgroundColor: 'rgba(120,53,15,0.5)', borderColor: GOLD },
  selectBtnText: { color: GOLD_DIM, fontWeight: '800', fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutBtn: { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', justifyContent: 'center' },

  batchBar: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 4, gap: 10 },
  batchChip: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER },
  batchChipDelete: { borderColor: 'rgba(220,38,38,0.4)', backgroundColor: 'rgba(127,29,29,0.35)' },
  batchChipText: { color: GOLD_DIM, fontWeight: '800', fontSize: 12 },

  divider: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(184,134,11,0.35)' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  countText: { color: '#44403C', fontSize: 10, letterSpacing: 3, fontWeight: '700', marginBottom: 12, textAlign: 'center' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingText: { color: GOLD_DIM, marginTop: 12, fontSize: 13, letterSpacing: 1, fontWeight: '600' },
  emptyTitle: { color: '#78716C', fontSize: 20, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#44403C', fontSize: 13, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  // Cards
  cardWrap: { marginBottom: 14 },
  card: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 20, overflow: 'hidden' },
  cardPlaying: { borderColor: '#D4AF37' },
  playingBar: { height: 3, width: '100%', position: 'absolute', top: 0 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginRight: 12 },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  nowPlayingTag: { backgroundColor: 'rgba(184,134,11,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  nowPlayingText: { color: '#D4AF37', fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  cardDate: { color: '#78716C', fontSize: 12, fontWeight: '600' },
  cardNote: { color: '#A16207', fontSize: 11, marginTop: 2 },

  deleteBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(127,29,29,0.2)', borderWidth: 1, borderColor: 'rgba(127,29,29,0.25)' },

  waveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 2.5 },
  wavebar: { width: 3, borderRadius: 2 },
});
