import React, { useState, useEffect, useRef } from 'react';
import {
  Text, View, TouchableOpacity, ScrollView, Dimensions,
  ImageBackground, StyleSheet, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// ── Tanpura Assets — all three saptak (octaves) ───────────────────────────
const droneAssets = {
  "Low": {                   // Mandra Saptak — pitched down 1 octave
    'C':  require('../../assets/sounds/tanpura_C_Low_pa.mp3'),
    'C#': require('../../assets/sounds/tanpura_C_sharp_Low_pa.mp3'),
    'D':  require('../../assets/sounds/tanpura_D_Low_pa.mp3'),
    'D#': require('../../assets/sounds/tanpura_D_sharp_Low_pa.mp3'),
    'E':  require('../../assets/sounds/tanpura_E_Low_pa.mp3'),
    'F':  require('../../assets/sounds/tanpura_F_Low_pa.mp3'),
    'F#': require('../../assets/sounds/tanpura_F_sharp_Low_pa.mp3'),
    'G':  require('../../assets/sounds/tanpura_G_Low_pa.mp3'),
    'G#': require('../../assets/sounds/tanpura_G_sharp_Low_pa.mp3'),
    'A':  require('../../assets/sounds/tanpura_A_Low_pa.mp3'),
    'A#': require('../../assets/sounds/tanpura_A_sharp_Low_pa.mp3'),
    'B':  require('../../assets/sounds/tanpura_B_Low_pa.mp3'),
  },
  "Middle": {                // Madhya Saptak — original recordings
    'C':  require('../../assets/sounds/tanpura_C_Middle_pa.mp3'),
    'C#': require('../../assets/sounds/tanpura_C_sharp_Middle_pa.mp3'),
    'D':  require('../../assets/sounds/tanpura_D_Middle_pa.mp3'),
    'D#': require('../../assets/sounds/tanpura_D_sharp_Middle_pa.mp3'),
    'E':  require('../../assets/sounds/tanpura_E_Middle_pa.mp3'),
    'F':  require('../../assets/sounds/tanpura_F_Middle_pa.mp3'),
    'F#': require('../../assets/sounds/tanpura_F_sharp_Middle_pa.mp3'),
    'G':  require('../../assets/sounds/tanpura_G_Middle_pa.mp3'),
    'G#': require('../../assets/sounds/tanpura_G_sharp_Middle_pa.mp3'),
    'A':  require('../../assets/sounds/tanpura_A_Middle_pa.mp3'),
    'A#': require('../../assets/sounds/tanpura_A_sharp_Middle_pa.mp3'),
    'B':  require('../../assets/sounds/tanpura_B_Middle_pa.mp3'),
  },
  "High": {                  // Taar Saptak — pitched up 1 octave
    'C':  require('../../assets/sounds/tanpura_C_High_pa.mp3'),
    'C#': require('../../assets/sounds/tanpura_C_sharp_High_pa.mp3'),
    'D':  require('../../assets/sounds/tanpura_D_High_pa.mp3'),
    'D#': require('../../assets/sounds/tanpura_D_sharp_High_pa.mp3'),
    'E':  require('../../assets/sounds/tanpura_E_High_pa.mp3'),
    'F':  require('../../assets/sounds/tanpura_F_High_pa.mp3'),
    'F#': require('../../assets/sounds/tanpura_F_sharp_High_pa.mp3'),
    'G':  require('../../assets/sounds/tanpura_G_High_pa.mp3'),
    'G#': require('../../assets/sounds/tanpura_G_sharp_High_pa.mp3'),
    'A':  require('../../assets/sounds/tanpura_A_High_pa.mp3'),
    'A#': require('../../assets/sounds/tanpura_A_sharp_High_pa.mp3'),
    'B':  require('../../assets/sounds/tanpura_B_High_pa.mp3'),
  },
};

const RAGA_MAP = {
  'C':  'Yaman',        // Lydian — tivra Ma (Kalyan Thaat)
  'C#': 'Bhairav',      // Double Harmonic — komal Re & Dha (Bhairav Thaat)
  'D':  'Kafi',         // Dorian — komal Ga & Ni (Kafi Thaat)
  'D#': 'Bhairavi',     // Phrygian — all komal except Sa, Ma, Pa (Bhairavi Thaat)
  'E':  'Bilawal',      // Ionian/Major — all shuddha (Bilawal Thaat)
  'F':  'Bhupali',      // Major Pentatonic — S R G P D (Kalyan Thaat)
  'F#': 'Yaman Kalyan', // Lydian/Major blend — both Ma (Kalyan Thaat)
  'G':  'Khamaj',       // Mixolydian — komal Ni (Khamaj Thaat)
  'G#': 'Bageshri',     // Dorian — komal Ga & Ni, Vadi=Ma (Kafi Thaat)
  'A':  'Bilawal',      // Ionian/Major — all shuddha (Bilawal Thaat)
  'A#': 'Todi',         // Lydian b2 b3 b6 — komal Re, Ga, Dha + tivra Ma (Todi Thaat)
  'B':  'Asavari',      // Aeolian/Natural Minor — komal Ga, Dha, Ni (Asavari Thaat)
};

const classicalMappingEn = {
  "C": "Sa", "C#": "Komal Re", "D": "Re", "D#": "Komal Ga",
  "E": "Ga", "F": "Ma", "F#": "Tivra Ma", "G": "Pa",
  "G#": "Komal Dha", "A": "Dha", "A#": "Komal Ni", "B": "Ni",
};
const classicalMappingHi = {
  "C": "सा", "C#": "कोमल रे", "D": "शुद्ध रे", "D#": "कोमल ग",
  "E": "शुद्ध ग", "F": "शुद्ध म", "F#": "तीव्र म", "G": "प",
  "G#": "कोमल ध", "A": "शुद्ध ध", "A#": "कोमल नि", "B": "शुद्ध नि",
};

// ── Main Screen ────────────────────────────────────────────────────────────
export default function RiyaazScreen() {
  const [droneSound, setDroneSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDronePitch, setSelectedDronePitch] = useState("C#");
  const [selectedDroneOctave, setSelectedDroneOctave] = useState("Middle");
  const [language, setLanguage] = useState("EN");
  const router = useRouter();

  // Standard RN Animated values (crash-proof)
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  const keyboardRef = useRef(null);
  const isPlayingRef = useRef(false);
  const droneSoundRef = useRef(null);

  useEffect(() => {
    // Page mount animation
    Animated.timing(mountAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    // Scroll to Middle octave
    setTimeout(() => {
      try { keyboardRef.current?.scrollTo({ x: 308, animated: true }); } catch (_) {}
    }, 500);
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,      // never duck — play at full volume
      playThroughEarpieceAndroid: false, // always use loudspeaker
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      droneSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []); // Run only on strictly full unmount

  // Stop drone automatically when leaving this tab and restore recording-capable audio mode
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          droneSoundRef.current?.stopAsync().catch(() => {});
          setIsPlaying(false);
        } catch (_) {}
      };
    }, []) // Empty dependency array! Only triggers on strictly Blur/unmount!
  );

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  // Keep a ref in sync for use inside async closures
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Pulse animations
  useEffect(() => {
    if (isPlaying) {
      const anim1 = Animated.loop(Animated.sequence([
        Animated.timing(pulse1, { toValue: 1.2, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 1, duration: 2400, useNativeDriver: true }),
      ]));
      const anim2 = Animated.loop(Animated.sequence([
        Animated.timing(pulse2, { toValue: 1.45, duration: 3100, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 3100, useNativeDriver: true }),
      ]));
      const anim3 = Animated.loop(Animated.sequence([
        Animated.timing(pulse3, { toValue: 1.75, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulse3, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ]));
      const glowAnim = Animated.loop(Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.2, duration: 1800, useNativeDriver: true }),
      ]));
      anim1.start(); anim2.start(); anim3.start(); glowAnim.start();
      return () => { anim1.stop(); anim2.stop(); anim3.stop(); glowAnim.stop(); };
    } else {
      Animated.parallel([
        Animated.timing(pulse1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse3, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [isPlaying]);

  // ── Audio Engine ─────────────────────────────────────────────────────────
  const loadAndPlaySound = async (pitch, octave, shouldPlay) => {
    try {
      if (droneSound) {
        try { await droneSound.unloadAsync(); } catch (_) {}
        setDroneSound(null);
      }
      const asset = droneAssets[octave]?.[pitch];
      if (!asset) return;

      // Switch to playback mode at full volume explicitly
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        asset,
        { volume: 1.0, isLooping: true, shouldPlay: shouldPlay }
      );
      await newSound.setVolumeAsync(1.0);
      setDroneSound(newSound);
      droneSoundRef.current = newSound;
      setIsPlaying(shouldPlay);
    } catch (e) {
      console.warn('Audio load error:', e);
      setIsPlaying(false);
    }
  };

  const selectKey = (pitch, oct) => {
    // If this key is already playing — do nothing. Orb is the only way to pause.
    if (isPlayingRef.current && pitch === selectedDronePitch && oct === selectedDroneOctave) {
      return;
    }

    setSelectedDronePitch(pitch);
    setSelectedDroneOctave(oct);

    // Always start playback when tapping a key
    loadAndPlaySound(pitch, oct, true);

    try {
      const offset = oct === 'Low' ? 0 : oct === 'Middle' ? 308 : 616;
      keyboardRef.current?.scrollTo({ x: offset, y: 0, animated: true });
    } catch (_) {}
  };

  const togglePlayback = async () => {
    if (!isPlaying) return; // orb does nothing when not playing
    try {
      if (droneSound) {
         await droneSound.stopAsync();
      }
      setIsPlaying(false);
    } catch (e) {
      console.error('Stop error:', e);
    }
  };

  const currentSargam = language === 'HI' ? classicalMappingHi[selectedDronePitch] : classicalMappingEn[selectedDronePitch];
  const currentRaga = RAGA_MAP[selectedDronePitch];

  return (
    <ImageBackground source={require('../../assets/images/riyaaz_chamber.png')} style={styles.flex} resizeMode="cover">
      <LinearGradient
        colors={['rgba(8,0,0,0.72)', 'rgba(25,5,0,0.78)', 'rgba(8,0,0,0.88)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <Animated.ScrollView
          style={{ opacity: mountAnim }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {language === 'HI' ? 'रियाज़ स्टूडियो' : 'Riyaaz Studio'}
              </Text>
              <Text style={styles.subtitle}>CLASSICAL DRONE PRACTICE</Text>
            </View>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setLanguage(l => l === 'EN' ? 'HI' : 'EN')} style={styles.langBtn}>
                <Ionicons name="language" size={16} color="#D4AF37" />
                <Text style={styles.langBtnText}>{language}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={22} color="#B8860B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Note Info Card ── */}
          <View style={styles.noteCard}>
            <View>
              <Text style={styles.noteLabel}>CURRENT SHRUTI</Text>
              <Text style={styles.noteSargam}>{currentSargam}</Text>
              <Text style={styles.noteRoot}>{selectedDronePitch} — {selectedDroneOctave}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.noteLabel}>RAAG</Text>
              <Text style={styles.ragaName}>{currentRaga}</Text>
              <View style={[styles.statusPill, isPlaying && styles.statusPillActive]}>
                <Text style={[styles.statusPillText, isPlaying && styles.statusPillTextActive]}>
                  {isPlaying ? '● RESONATING' : '○ SILENT'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Tanpura Orb ── */}
          <View style={styles.orbContainer}>
            <Animated.View pointerEvents="none" style={[styles.ring3, { transform: [{ scale: pulse3 }] }]} />
            <Animated.View pointerEvents="none" style={[styles.ring2, { transform: [{ scale: pulse2 }] }]} />
            <Animated.View pointerEvents="none" style={[styles.ring1, { transform: [{ scale: pulse1 }] }]} />
            <Animated.View pointerEvents="none" style={[styles.glowHalo, { opacity: glowOpacity }]} />

            <TouchableOpacity
              onPress={togglePlayback}
              activeOpacity={isPlaying ? 0.85 : 1.0}
              disabled={!isPlaying}
              style={{ zIndex: 10, elevation: 10 }}
            >
              <LinearGradient
                key={isPlaying ? 'on' : 'off'}
                colors={isPlaying ? ['#451A03', '#78350F', '#92400E'] : ['#0D0500', '#1A0900', '#0D0500']}
                style={[styles.orbButton, { borderColor: isPlaying ? '#D4AF37' : 'rgba(184,134,11,0.2)' }]}
              >
                {isPlaying ? (
                  <Ionicons name="pause" size={44} color="#FCD34D" />
                ) : (
                  <MaterialCommunityIcons name="piano" size={38} color="rgba(184,134,11,0.35)" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={[styles.orbStatus, isPlaying && { color: '#FBBF24' }]}>
            {isPlaying
              ? `⏸ Tap orb to pause  ·  ${currentSargam} · ${selectedDroneOctave}`
              : '🎹 TAP A KEY BELOW TO BEGIN'}
          </Text>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <MaterialCommunityIcons name="music-clef-treble" size={14} color="#B8860B" style={{ marginHorizontal: 8 }} />
            <View style={styles.dividerLine} />
          </View>

          {/* ── Piano Keyboard ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="piano" size={18} color="#D4AF37" />
              <Text style={styles.cardTitle}>SWARA SYNTHESIZER</Text>
              <Text style={styles.cardHint}>Swipe octaves →</Text>
            </View>

            <ScrollView
              ref={keyboardRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              snapToInterval={308}
              decelerationRate="fast"
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
            >
              {['Low', 'Middle', 'High'].map((octaveIter) => (
                <View key={octaveIter} style={styles.octaveRow}>
                  {/* White Keys */}
                  {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((pitch) => {
                    const active = selectedDronePitch === pitch && selectedDroneOctave === octaveIter;
                    return (
                      <TouchableOpacity
                        key={`w-${octaveIter}-${pitch}`}
                        onPress={() => selectKey(pitch, octaveIter)}
                        activeOpacity={0.7}
                        style={[styles.whiteKey, active && styles.whiteKeyActive]}
                      >
                        <Text style={[styles.whiteKeyLabel, active && styles.whiteKeyLabelActive]}>{pitch}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Black Keys */}
                  {[
                    { pitch: 'C#', left: 28 }, { pitch: 'D#', left: 72 },
                    { pitch: 'F#', left: 160 }, { pitch: 'G#', left: 204 }, { pitch: 'A#', left: 248 }
                  ].map(({ pitch, left }) => {
                    const active = selectedDronePitch === pitch && selectedDroneOctave === octaveIter;
                    return (
                      <TouchableOpacity
                        key={`b-${octaveIter}-${pitch}`}
                        onPress={() => selectKey(pitch, octaveIter)}
                        activeOpacity={0.7}
                        style={[styles.blackKey, { left }, active && styles.blackKeyActive]}
                      >
                        <Text style={[styles.blackKeyLabel, active && styles.blackKeyLabelActive]}>{pitch}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Octave Selector */}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionLabel}>SAPTAK (OCTAVE)</Text>
              <View style={styles.octaveBtnRow}>
                {[['Low', 'मन्द्र', 'Mandra'], ['Middle', 'मध्य', 'Madhya'], ['High', 'तार', 'Taar']].map(([oct, hindi, eng]) => {
                  const active = selectedDroneOctave === oct;
                  return (
                    <TouchableOpacity
                      key={oct}
                      onPress={() => selectKey(selectedDronePitch, oct)}
                      activeOpacity={0.7}
                      style={[styles.octaveBtn, active && styles.octaveBtnActive]}
                    >
                      <Text style={[
                        active ? styles.octaveBtnLabelActive : styles.octaveBtnLabel,
                        language === 'HI' ? { fontSize: 20 } : { fontSize: 13 }
                      ]}>
                        {language === 'HI' ? hindi : eng}
                      </Text>
                      {active && (
                        <Text style={styles.octaveBtnSub}>{language === 'HI' ? eng : hindi}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── Raga Context ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="music-circle" size={18} color="#D4AF37" />
              <Text style={styles.cardTitle}>RAAG CONTEXT</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.noteLabel}>ACTIVE RAAG</Text>
                <Text style={[styles.noteSargam, { fontSize: 26 }]}>{currentRaga}</Text>
                <Text style={styles.noteRoot}>{selectedDronePitch} · {classicalMappingEn[selectedDronePitch]}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.noteLabel}>SWARA (HINDI)</Text>
                <Text style={[styles.ragaName, { fontSize: 26 }]}>{classicalMappingHi[selectedDronePitch]}</Text>
                <Text style={styles.noteRoot}>{classicalMappingEn[selectedDronePitch]} · Western</Text>
              </View>
            </View>
            <View style={[styles.divider, { marginTop: 16 }]}>
              <View style={styles.dividerLine} />
              <MaterialCommunityIcons name="music-clef-treble" size={12} color="#B8860B" style={{ marginHorizontal: 6 }} />
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.quoteText}>"Riyaaz is the tapasya of the voice. Each Swara is a prayer."</Text>
          </View>

          {/* ── Practice Tips ── */}
          <View style={[styles.card, { marginBottom: 0 }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="lightbulb-on" size={18} color="#B8860B" />
              <Text style={[styles.cardTitle, { color: '#B8860B' }]}>PRACTICE TIPS</Text>
            </View>
            {[
              { icon: 'lungs', tip: 'Begin with Aakar (आकार) on Sa for 5 minutes to open the voice.' },
              { icon: 'metronome', tip: 'Practice Gamak and Meend slowly in Madhya Saptak before moving higher.' },
              { icon: 'water', tip: 'Sip warm water between sets. Avoid cold drinks during Riyaaz.' },
            ].map(({ icon, tip }, i) => (
              <View key={i} style={[styles.tipRow, i < 2 && styles.tipRowBorder]}>
                <MaterialCommunityIcons name={icon} size={16} color="#B8860B" />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

        </Animated.ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const GOLD = '#D4AF37';
const GOLD_DIM = '#B8860B';
const CARD_BG = 'rgba(19,0,0,0.65)';
const CARD_BORDER = 'rgba(184,134,11,0.3)';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: GOLD, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#78716C', fontSize: 10, letterSpacing: 3 },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,18,0,0.6)', borderWidth: 1, borderColor: CARD_BORDER, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  langBtnText: { color: GOLD, fontSize: 12, fontWeight: '900', marginLeft: 6 },
  logoutBtn: { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(184,134,11,0.35)', alignItems: 'center', justifyContent: 'center' },

  noteCard: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(184,134,11,0.4)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteLabel: { color: '#78716C', fontSize: 9, letterSpacing: 4, fontWeight: '900', marginBottom: 4 },
  noteSargam: { color: '#FEF3C7', fontSize: 36, fontWeight: '900' },
  noteRoot: { color: '#A16207', fontSize: 13, fontWeight: '700', marginTop: 2 },
  ragaName: { color: GOLD, fontSize: 16, fontWeight: '900' },
  statusPill: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(19,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(120,113,108,0.3)' },
  statusPillActive: { backgroundColor: 'rgba(120,53,15,0.6)', borderColor: GOLD },
  statusPillText: { color: '#78716C', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  statusPillTextActive: { color: '#FBBF24' },

  orbContainer: { alignItems: 'center', justifyContent: 'center', height: 250, width: 250, alignSelf: 'center', marginBottom: 8 },
  ring3: { position: 'absolute', width: 215, height: 215, borderRadius: 108, borderWidth: 1, borderColor: 'rgba(184,134,11,0.15)' },
  ring2: { position: 'absolute', width: 178, height: 178, borderRadius: 89, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  ring1: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: 'rgba(212,175,55,0.5)' },
  glowHalo: { position: 'absolute', width: 142, height: 142, borderRadius: 71, backgroundColor: 'rgba(212,175,55,0.07)' },
  orbButton: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  orbStatus: { color: '#78716C', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 20 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(184,134,11,0.4)' },

  card: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 24, padding: 20, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 3, marginLeft: 8 },
  cardHint: { color: '#78716C', fontSize: 10, marginLeft: 'auto' },
  sectionLabel: { color: '#78716C', fontSize: 9, letterSpacing: 4, fontWeight: '900', marginBottom: 10 },

  octaveRow: { width: 308, height: 165, flexDirection: 'row', position: 'relative' },
  whiteKey: { width: 44, height: 165, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#334155', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  whiteKeyActive: { backgroundColor: '#D4AF37', borderColor: '#92400E' },
  whiteKeyLabel: { fontSize: 13, fontWeight: '800', color: '#334155' },
  whiteKeyLabelActive: { color: '#1C0A00' },
  blackKey: { position: 'absolute', zIndex: 10, width: 32, height: 108, backgroundColor: '#0F172A', borderBottomLeftRadius: 5, borderBottomRightRadius: 5, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  blackKeyActive: { backgroundColor: '#92400E', borderColor: '#D4AF37' },
  blackKeyLabel: { color: 'white', fontSize: 9, fontWeight: '700' },
  blackKeyLabelActive: { color: '#FCD34D' },

  octaveBtnRow: { flexDirection: 'row', gap: 8 },
  octaveBtn: { flex: 1, minHeight: 60, borderRadius: 16, backgroundColor: 'rgba(28,10,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(184,134,11,0.2)', paddingVertical: 8 },
  octaveBtnActive: { backgroundColor: 'rgba(120,53,15,0.6)', borderColor: GOLD },
  octaveBtnLabel: { fontWeight: '900', textAlign: 'center', color: '#78716C' },
  octaveBtnLabelActive: { fontWeight: '900', textAlign: 'center', color: '#FCD34D' },
  octaveBtnSub: { color: '#A16207', fontSize: 9, marginTop: 2 },

  quoteText: { color: '#78716C', fontSize: 13, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  tipRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(184,134,11,0.15)' },
  tipText: { color: '#D6D3D1', fontSize: 13, fontStyle: 'italic', lineHeight: 20, marginLeft: 12, flex: 1 },
});
