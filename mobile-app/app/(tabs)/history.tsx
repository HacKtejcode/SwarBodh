import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Alert, TouchableOpacity, ImageBackground, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';

const manifestHost = Constants.expoConfig?.hostUri || 'localhost';
const apiBase = `http://${manifestHost.split(':')[0]}:8000`;

// ── Helpers ───────────────────────────────────────────────────────────────
const formatDate = (raw: string) => {
  try {
    const d = new Date(raw.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return raw; }
};

// ── Record Card ──────────────────────────────────────────────────────────
const RecordCard = ({
  item, isSelectionMode, selectedIds, onToggleSelect, onDelete
}: any) => {
  const isStrained = item.is_strained;
  const isCalibration = item.recommendation === '🎯 Vocal Profile Calibration';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, damping: 15, stiffness: 300 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 250 }).start();

  const borderColor = isCalibration ? '#D4AF37' : isStrained ? 'rgba(220,38,38,0.45)' : 'rgba(184,134,11,0.3)';
  const bgColor = isCalibration ? 'rgba(28,18,0,0.85)' : isStrained ? 'rgba(40,5,5,0.85)' : 'rgba(19,0,0,0.82)';

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => onToggleSelect(item.id)}
      >
        <View style={[styles.card, { borderColor, backgroundColor: bgColor }]}>
          {/* Card Header */}
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              {isSelectionMode && (
                <TouchableOpacity onPress={() => onToggleSelect(item.id)} style={{ marginRight: 10 }}>
                  <MaterialCommunityIcons
                    name={selectedIds.has(item.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selectedIds.has(item.id) ? '#D4AF37' : '#78716C'}
                  />
                </TouchableOpacity>
              )}

              {isCalibration ? (
                <View style={styles.calibrationBadge}>
                  <Text style={styles.calibrationBadgeText}>🎯 Profile Calibration</Text>
                </View>
              ) : (
                <View style={[styles.statusDot, { backgroundColor: isStrained ? '#DC2626' : '#B8860B' }]} />
              )}

              <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
            </View>

            {!isSelectionMode && (
              <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#78716C" />
              </TouchableOpacity>
            )}
          </View>

          {/* Status row */}
          {!isCalibration && (
            <View style={[styles.statusBanner, isStrained ? styles.strainedBanner : styles.healthyBanner]}>
              <MaterialCommunityIcons
                name={isStrained ? 'alert-circle-outline' : 'check-circle-outline'}
                size={14}
                color={isStrained ? '#FCA5A5' : '#FDE68A'}
              />
              <Text style={[styles.statusBannerText, { color: isStrained ? '#FCA5A5' : '#FDE68A' }]}>
                {isStrained ? 'Vocal Strain Detected' : 'Vocal Health Confirmed'}
              </Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SWARA</Text>
              <Text style={styles.statValue}>
                {item.sargam && item.sargam !== 'N/A' ? item.sargam : item.note || '—'}
              </Text>
              {item.note && item.sargam && item.sargam !== 'N/A' && (
                <Text style={styles.statSub}>{item.note}</Text>
              )}
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>PITCH</Text>
              <Text style={styles.statValue}>
                {item.pitch_hz !== 'Unknown' ? `${item.pitch_hz}` : '—'}
              </Text>
              {item.pitch_hz !== 'Unknown' && <Text style={styles.statSub}>Hz</Text>}
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>AVG VOL</Text>
              <Text style={styles.statValue}>{item.avg_db}</Text>
              <Text style={styles.statSub}>dB</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>INSTAB.</Text>
              <Text style={[styles.statValue, { color: parseFloat(item.instability) > 8 ? '#F87171' : '#D4AF37' }]}>
                {item.instability}
              </Text>
            </View>
          </View>

          {/* Recommendation */}
          {item.recommendation && !isCalibration && (
            <View style={styles.recBox}>
              <MaterialCommunityIcons name="compass-rose" size={12} color="#B8860B" />
              <Text style={styles.recText} numberOfLines={2}>{item.recommendation}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) { router.replace('/auth'); return; }
      const res = await fetch(`${apiBase}/records`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { await AsyncStorage.removeItem('userToken'); router.replace('/auth'); return; }
      const data = await res.json();
      setRecords(data);
      Animated.timing(mountOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  useFocusEffect(useCallback(() => { fetchRecords(); }, []));

  const handleToggleSelect = (id: number) => {
    if (!isSelectionMode) setIsSelectionMode(true);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === records.length ? new Set() : new Set(records.map((r) => r.id)));
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Selected',
      `Remove ${selectedIds.size} recording log(s) from the archive?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              const res = await fetch(`${apiBase}/records/batch_delete`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
              });
              if (res.ok) {
                setRecords(prev => prev.filter((r) => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              } else { Alert.alert('Error', 'Failed to delete records.'); }
            } catch (err) { console.error(err); }
          }
        }
      ]
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Log',
      'Remove this recording from the archive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              const res = await fetch(`${apiBase}/records/${id}`, {
                method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) { setRecords(prev => prev.filter((r) => r.id !== id)); }
              else { Alert.alert('Error', 'Failed to delete record.'); }
            } catch (err) { console.error(err); }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <RecordCard
      item={item}
      isSelectionMode={isSelectionMode}
      selectedIds={selectedIds}
      onToggleSelect={handleToggleSelect}
      onDelete={handleDelete}
    />
  );

  return (
    <ImageBackground source={require('../../assets/images/history_archive.png')} style={styles.flex} resizeMode="cover">
      <LinearGradient
        colors={['rgba(8,0,0,0.80)', 'rgba(20,5,0,0.82)', 'rgba(8,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Vocal Archive</Text>
            <Text style={styles.subtitle}>RECORDING HISTORY</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#B8860B" />
            </TouchableOpacity>
            {records.length > 0 && (
              <TouchableOpacity
                onPress={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                style={[styles.selectBtn, isSelectionMode && styles.selectBtnActive]}
              >
                <MaterialCommunityIcons
                  name={isSelectionMode ? 'close' : 'checkbox-multiple-outline'}
                  size={16}
                  color={isSelectionMode ? '#FEF3C7' : '#B8860B'}
                />
                <Text style={[styles.selectBtnText, isSelectionMode && { color: '#FEF3C7' }]}>
                  {isSelectionMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Batch Actions ── */}
        {isSelectionMode && records.length > 0 && (
          <View style={styles.batchBar}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.batchChip}>
              <Text style={styles.batchChipText}>
                {selectedIds.size === records.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchDelete}
              style={[styles.batchChip, styles.batchChipDelete, selectedIds.size === 0 && { opacity: 0.4 }]}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
              <Text style={[styles.batchChipText, { color: '#FCA5A5' }]}>
                Delete ({selectedIds.size})
              </Text>
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
            <Text style={styles.loadingText}>Reading the Archive...</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="microphone-off" size={52} color="#44403C" />
            <Text style={styles.emptyTitle}>The Archive is Silent</Text>
            <Text style={styles.emptyText}>Record a session in Vocalytics or Vocal Guru to begin your journey.</Text>
          </View>
        ) : (
          <Animated.View style={[styles.flex, { opacity: mountOpacity }]}>
            <FlatList
              data={records}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.countText}>{records.length} session{records.length !== 1 ? 's' : ''} archived</Text>
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, marginBottom: 6,
  },
  title: { color: GOLD, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#78716C', fontSize: 10, letterSpacing: 3, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: 'rgba(28,18,0,0.6)', borderWidth: 1, borderColor: CARD_BORDER,
  },
  selectBtnActive: { backgroundColor: 'rgba(120,53,15,0.5)', borderColor: GOLD },
  selectBtnText: { color: GOLD_DIM, fontWeight: '800', fontSize: 12 },
  logoutBtn: { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', justifyContent: 'center' },

  batchBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 4, gap: 10,
  },
  batchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center',
    paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(19,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.3)',
  },
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

  // Card
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 20, borderWidth: 1, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  cardDate: { color: '#78716C', fontSize: 12, fontWeight: '600', flex: 1 },
  deleteBtn: {
    padding: 6, borderRadius: 8,
    backgroundColor: 'rgba(127,29,29,0.2)', borderWidth: 1, borderColor: 'rgba(127,29,29,0.3)',
  },

  calibrationBadge: {
    backgroundColor: 'rgba(120,53,15,0.4)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', marginRight: 10,
  },
  calibrationBadgeText: { color: GOLD, fontSize: 11, fontWeight: '800' },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 12,
  },
  strainedBanner: { backgroundColor: 'rgba(127,29,29,0.35)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  healthyBanner: { backgroundColor: 'rgba(28,18,0,0.5)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.3)' },
  statusBannerText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  statBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(184,134,11,0.15)',
  },
  statLabel: { color: '#78716C', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  statValue: { color: '#FEF3C7', fontSize: 15, fontWeight: '900' },
  statSub: { color: '#78716C', fontSize: 9, marginTop: 1 },

  recBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(28,18,0,0.5)', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: 'rgba(184,134,11,0.2)',
  },
  recText: { color: '#A8A29E', fontSize: 12, fontStyle: 'italic', lineHeight: 18, flex: 1 },
});
