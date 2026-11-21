import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator,
  ScrollView, Dimensions, ImageBackground, Modal, Animated, Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { saveRecording } from '../../src/utils/recordingStore';
import * as Linking from 'expo-linking';

const { width } = Dimensions.get('window');
const manifestHost = Constants.expoConfig?.hostUri || 'localhost';
const apiBase = `http://${manifestHost.split(':')[0]}:8000`;

// ── Tanpura Assets — all three saptak (octaves) ───────────────────────────
const droneAssets: Record<string, Record<string, any>> = {
  "Low": {
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
  "Middle": {
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
  "High": {
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

const RAGA_MAP: Record<string, string> = {
  'C':  'Yaman',        // Lydian — tivra Ma, Sa=C (Kalyan Thaat)
  'C#': 'Bhairav',      // Double Harmonic — komal Re & Dha (Bhairav Thaat)
  'D':  'Kafi',         // Dorian — komal Ga & Ni (Kafi Thaat)
  'D#': 'Bhairavi',     // Phrygian — all komal except Sa, Ma, Pa (Bhairavi Thaat)
  'E':  'Bilawal',      // Ionian/Major — all shuddha swaras (Bilawal Thaat)
  'F':  'Bhupali',      // Major Pentatonic — S R G P D, Vadi=Ga (Kalyan Thaat)
  'F#': 'Yaman Kalyan', // Lydian/Major blend — both Ma shuddha & tivra (Kalyan Thaat)
  'G':  'Khamaj',       // Mixolydian — komal Ni (Khamaj Thaat)
  'G#': 'Bageshri',     // Dorian — komal Ga & Ni, Vadi=Ma (Kafi Thaat)
  'A':  'Bilawal',      // Ionian/Major — all shuddha (Bilawal Thaat)
  'A#': 'Todi',         // Lydian b2 b3 b6 — komal Re, Ga, Dha + tivra Ma (Todi Thaat)
  'B':  'Asavari',      // Aeolian/Natural Minor — komal Ga, Dha, Ni (Asavari Thaat)
};

const pitchList = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SONG_LANGUAGES = ["Hindi", "Marathi", "English"];

// ── Divider ───────────────────────────────────────────────────────────────
const GoldDivider = () => (
  <View style={styles.divider}>
    <View style={styles.dividerLine} />
    <MaterialCommunityIcons name="star-four-points" size={12} color="#B8860B" style={{ marginHorizontal: 8 }} />
    <View style={styles.dividerLine} />
  </View>
);

// ── Track Card ────────────────────────────────────────────────────────────
const TrackCard = ({ track }: { track: any }) => (
  <View style={styles.trackCard}>
    <View style={styles.trackHeader}>
      <MaterialCommunityIcons name="music-note" size={15} color="#D4AF37" />
      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
    </View>
    <Text style={styles.trackArtist}>{track.artist}</Text>
    <Text style={styles.trackReason} numberOfLines={2}>{track.reason}</Text>
  </View>
);


// ── Main Screen ───────────────────────────────────────────────────────────
export default function VocalGuruScreen() {
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isGuruRecording, setIsGuruRecording] = useState(false);
  const [guruResults, setIsGuruResults] = useState<any>(null);
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);


  const [droneSound, setDroneSound] = useState<Audio.Sound | null>(null);
  const [isPlayingDrone, setIsPlayingDrone] = useState(false);
  const [selectedDronePitch, setSelectedDronePitch] = useState("C#");
  const [selectedDroneOctave, setSelectedDroneOctave] = useState("Middle");

  const [timer, setTimer] = useState(0);
  const timerInterval = useRef<any>(null);
  const droneSoundRef = useRef<Audio.Sound | null>(null);

  // Animations — standard RN (crash-proof)
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  useEffect(() => {
    Animated.timing(mountOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Audio.requestPermissionsAsync().catch(() => { });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true, playsInSilentModeIOS: true,
      staysActiveInBackground: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
    }).catch(() => { });
  }, []);

  // Stop drone on tab blur
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          droneSoundRef.current?.stopAsync().catch(() => { });
          setIsPlayingDrone(false);
        } catch (_) { }
      };
    }, []) // empty dep array — only fires on real tab blur
  );

  // Pulse rings while recording
  useEffect(() => {
    if (isRecording) {
      const a1 = Animated.loop(Animated.sequence([
        Animated.timing(pulse1, { toValue: 1.22, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]));
      const a2 = Animated.loop(Animated.sequence([
        Animated.timing(pulse2, { toValue: 1.5, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 1300, useNativeDriver: true }),
      ]));
      const a3 = Animated.loop(Animated.sequence([
        Animated.timing(pulse3, { toValue: 1.78, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse3, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]));
      const glow = Animated.loop(Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]));
      Animated.timing(progressAnim, { toValue: 1, duration: 60000, useNativeDriver: false }).start();
      timerInterval.current = setInterval(() => setTimer(t => t + 1), 1000);
      a1.start(); a2.start(); a3.start(); glow.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); glow.stop(); };
    } else {
      Animated.parallel([
        Animated.timing(pulse1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse3, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      clearInterval(timerInterval.current);
      if (!isAnalyzing) { setTimer(0); progressAnim.setValue(0); }
    }
  }, [isRecording]);

  // ── Audio ──────────────────────────────────────────────────────────────
  const stopDrone = async () => {
    try {
      if (isPlayingDrone && droneSoundRef.current) {
        await droneSoundRef.current.stopAsync();
        setIsPlayingDrone(false);
      }
    } catch (_) { }
  };

  const toggleDrone = async () => {
    try {
      if (isPlayingDrone) {
        await droneSoundRef.current?.stopAsync();
        setIsPlayingDrone(false);
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        const asset = droneAssets[selectedDroneOctave]?.[selectedDronePitch];
        if (!asset) return;
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 1.0, isLooping: true });
        await sound.setVolumeAsync(1.0);
        setDroneSound(sound);
        droneSoundRef.current = sound;
        await sound.playAsync();
        setIsPlayingDrone(true);
      }
    } catch (e) { console.error('Drone error', e); }
  };

  const startRecording = async () => {
    try {
      // Always re-enable recording mode — overrides any mode set by other tabs (e.g. Riyaaz drone)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording: rec } = await Audio.Recording.createAsync({
        android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
        ios: { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });
      setRecording(rec);
      setIsRecording(true);
      setResults(null);
    } catch (err) { console.error('Recording error', err); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    try { await recording.stopAndUnloadAsync(); } catch (_) { }
    const uri = recording.getURI();
    setRecording(null);
    if (uri) uploadAndAnalyze(uri);
  };

  const uploadAndAnalyze = async (uri: string) => {
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri, name: 'guru_vocal.wav', type: 'audio/wav' });
      const res = await fetch(`${apiBase}/analyze_guru`, {
        method: 'POST', body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        // Stop Tanpura drone before showing results
        try { await stopDrone(); } catch (_) {}
        // Save original audio to recordings vault
        saveRecording(uri, 'guru', {
          note: data.voice_profile?.category,
        }).catch(() => {});
        setResults(data);
        setShowResults(true);
      }
    } catch (e) { console.error(e); }
    finally { setIsAnalyzing(false); }
  };


  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <ImageBackground source={require('../../assets/images/guru_chamber.png')} style={styles.flex} resizeMode="cover">
      <LinearGradient
        colors={['rgba(8,0,0,0.76)', 'rgba(25,4,0,0.80)', 'rgba(8,0,0,0.90)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <Animated.ScrollView
          style={{ opacity: mountOpacity }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Vocal Guru</Text>
              <Text style={styles.subtitle}>SANSKRIT-POWERED GUIDANCE</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#B8860B" />
            </TouchableOpacity>
          </View>

          {/* ── Instruction Card ── */}
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#D4AF37" />
            <Text style={styles.infoText}>
              Set your Tanpura drone, then sing freely for{' '}
              <Text style={{ color: '#FEF3C7', fontWeight: '800' }}>10–60 seconds</Text>.
              {' '}The Guru will analyze your Swaras and Dynamics.
            </Text>
          </View>

          {/* ── Mic Orb ── */}
          <View style={styles.orbSection}>
            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.progressLabel}>
              {isRecording ? `${timer}s recorded  ·  ${60 - timer}s remaining` : 'Sing for 10–60s for best results'}
            </Text>

            <View style={styles.orbWrapper}>
              <Animated.View style={[styles.ring3, { transform: [{ scale: pulse3 }] }]} />
              <Animated.View style={[styles.ring2, { transform: [{ scale: pulse2 }] }]} />
              <Animated.View style={[styles.ring1, { transform: [{ scale: pulse1 }] }]} />
              <Animated.View style={[styles.glowHalo, { opacity: glowOpacity }]} />

              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isAnalyzing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isRecording ? ['#4C0519', '#9F1239', '#BE123C'] : ['#2C1810', '#451A03', '#3B0F04']}
                  style={[styles.orbButton, { borderColor: isRecording ? '#F43F5E' : '#D4AF37' }]}
                >
                  <FontAwesome5
                    name={isRecording ? 'stop' : 'microphone-alt'}
                    size={42}
                    color={isRecording ? '#FCA5A5' : '#D4AF37'}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={[styles.orbStatus, isRecording && { color: '#F87171' }]}>
              {isRecording ? `● Capturing Voice — Tap to Stop` : 'TAP TO BEGIN VOCAL SESSION'}
            </Text>
          </View>

          <GoldDivider />

          {/* ── Tanpura Section ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="music-note-bluetooth" size={18} color="#D4AF37" />
              <Text style={styles.cardTitle}>TANPURA DRONE</Text>
            </View>

            {/* Raga hint */}
            {isPlayingDrone && (
              <View style={styles.ragaHint}>
                <MaterialCommunityIcons name="music-clef-alto" size={14} color="#B8860B" />
                <Text style={styles.ragaHintText}>
                  Raag {RAGA_MAP[selectedDronePitch]} · {selectedDronePitch} {selectedDroneOctave}
                </Text>
              </View>
            )}

            {/* Drone Toggle */}
            <TouchableOpacity
              onPress={toggleDrone}
              style={[styles.droneToggle, isPlayingDrone && styles.droneToggleActive]}
            >
              <MaterialCommunityIcons
                name={isPlayingDrone ? 'pause-circle' : 'play-circle'}
                size={22}
                color={isPlayingDrone ? '#FBBF24' : '#B8860B'}
              />
              <Text style={[styles.droneToggleText, isPlayingDrone && { color: '#FBBF24' }]}>
                {isPlayingDrone ? `Resonating: ${selectedDronePitch} · ${selectedDroneOctave}` : 'Awaken the Tanpura'}
              </Text>
            </TouchableOpacity>

            {/* Pitch Selector */}
            <Text style={styles.sectionLabel}>SELECT SHRUTI</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}
            >
              {pitchList.map((p) => {
                const active = selectedDronePitch === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={async () => { await stopDrone(); setSelectedDronePitch(p); }}
                    style={[styles.pitchChip, active && styles.pitchChipActive]}
                  >
                    <Text style={[styles.pitchChipText, active && styles.pitchChipTextActive]}>{p}</Text>
                    {active && RAGA_MAP[p] && (
                      <Text style={styles.pitchRaga}>{RAGA_MAP[p]}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Octave Selector */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>SAPTAK (OCTAVE)</Text>
            <View style={styles.octaveRow}>
              {[['Low', 'मन्द्र'], ['Middle', 'मध्य'], ['High', 'तार']].map(([oct, hindi]) => {
                const active = selectedDroneOctave === oct;
                return (
                  <TouchableOpacity
                    key={oct}
                    onPress={async () => { await stopDrone(); setSelectedDroneOctave(oct); }}
                    style={[styles.octaveBtn, active && styles.octaveBtnActive]}
                  >
                    <Text style={[styles.octaveBtnLabel, active && styles.octaveBtnLabelActive]}>{oct}</Text>
                    <Text style={[styles.octaveBtnHindi, active && { color: '#A16207' }]}>{hindi}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Analyzing Indicator ── */}
          {isAnalyzing && (
            <View style={styles.analyzingBox}>
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text style={styles.analyzingText}>Guru is decoding your Swaras & Dynamics...</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </SafeAreaView>

      {/* ── Results Modal ── */}
      <Modal visible={showResults} animationType="slide" transparent={false} statusBarTranslucent={false}>
        <ImageBackground source={require('../../assets/images/guru_chamber.png')} style={styles.flex} resizeMode="cover">
          <LinearGradient
            colors={['rgba(5,0,0,0.92)', 'rgba(20,5,0,0.94)', 'rgba(5,0,0,0.96)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.flex}>
            {/* Modal Header — padded by real safe area top inset */}
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
              <View>
                <Text style={styles.modalTitle}>GURU REPORT</Text>
                <Text style={styles.modalSubtitle}>Your AI Vocal Analysis</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResults(false)}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close-circle" size={36} color="#D4AF37" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <MaterialCommunityIcons name="star-four-points" size={12} color="#B8860B" style={{ marginHorizontal: 8 }} />
              <View style={styles.dividerLine} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
              {results && (
                <>
                  {/* Profile Card */}
                  <View style={styles.profileCard}>
                    <View style={styles.profileCardTop}>
                      <View>
                        <Text style={styles.profileLabel}>NATURAL REGISTER</Text>
                        <Text style={styles.profileCategory}>{results.voice_profile?.category}</Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <MaterialCommunityIcons name="check-decagram" size={13} color="#1C0A00" />
                        <Text style={styles.verifiedText}>AI VERIFIED</Text>
                      </View>
                    </View>

                    <View style={styles.metricsRow}>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricLabel}>SWARA STABILITY</Text>
                        <Text style={styles.metricValue}>{results.voice_profile?.swara_stability}%</Text>
                      </View>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricLabel}>DYNAMICS SCORE</Text>
                        <Text style={[styles.metricValue, { color: '#FEF3C7' }]}>
                          {results.voice_profile?.dynamics_score}/100
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reportBox}>
                      <MaterialCommunityIcons name="compass-rose" size={14} color="#D4AF37" style={{ marginBottom: 6 }} />
                      <Text style={styles.reportText}>"{results.analysis_report}"</Text>
                    </View>
                  </View>

                  <GoldDivider />


                  {/* Recommendations */}
                  <Text style={styles.playlistTitle}>✦ Deep Cuts</Text>
                  {SONG_LANGUAGES.map(lang => (
                    <View key={lang} style={{ marginBottom: 20 }}>
                      <View style={styles.langHeader}>
                        <MaterialCommunityIcons name="music-note" size={14} color="#D4AF37" />
                        <Text style={styles.langHeaderText}>{lang} Deep Cuts</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                        {(results.recommendations?.[lang] || []).map((track: any, i: number) => (
                          <TrackCard key={i} track={track} />
                        ))}
                      </ScrollView>
                    </View>
                  ))}

                  {/* Back Button */}
                  <TouchableOpacity onPress={() => setShowResults(false)} style={styles.backBtn}>
                    <LinearGradient colors={['#451A03', '#78350F', '#451A03']} style={styles.backBtnGradient}>
                      <MaterialCommunityIcons name="arrow-left" size={18} color="#FCD34D" />
                      <Text style={styles.backBtnText}>RETURN TO THE CHAMBER</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </ImageBackground>
      </Modal>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 80 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  logoutBtn:   { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', justifyContent: 'center' },
  title: { color: GOLD, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#78716C', fontSize: 10, letterSpacing: 3, marginTop: 2 },

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 24, gap: 10 },
  infoText: { color: '#A8A29E', fontSize: 13, lineHeight: 20, flex: 1 },

  // Orb
  orbSection: { alignItems: 'center', marginBottom: 8 },
  progressTrack: { width: width - 80, height: 4, backgroundColor: 'rgba(184,134,11,0.2)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 4 },
  progressLabel: { color: '#78716C', fontSize: 11, letterSpacing: 1, marginBottom: 20 },
  orbWrapper: { alignItems: 'center', justifyContent: 'center', height: 240, width: 240 },
  ring3: { position: 'absolute', width: 215, height: 215, borderRadius: 108, borderWidth: 1, borderColor: 'rgba(184,134,11,0.14)' },
  ring2: { position: 'absolute', width: 178, height: 178, borderRadius: 89, borderWidth: 1, borderColor: 'rgba(212,175,55,0.28)' },
  ring1: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.48)' },
  glowHalo: { position: 'absolute', width: 142, height: 142, borderRadius: 71, backgroundColor: 'rgba(212,175,55,0.07)' },
  orbButton: { width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  orbStatus: { color: '#78716C', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginTop: 14 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, marginHorizontal: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(184,134,11,0.35)' },

  // Cards
  card: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 24, padding: 20, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: GOLD, fontSize: 13, fontWeight: '900', letterSpacing: 3, marginLeft: 8 },
  sectionLabel: { color: '#78716C', fontSize: 9, letterSpacing: 4, fontWeight: '900', marginBottom: 10 },

  ragaHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(120,53,15,0.25)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.3)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  ragaHintText: { color: '#A16207', fontSize: 12, fontWeight: '700' },

  droneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,18,0,0.5)', borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 16, paddingVertical: 12, marginBottom: 18, gap: 10 },
  droneToggleActive: { backgroundColor: 'rgba(120,53,15,0.45)', borderColor: GOLD },
  droneToggleText: { color: GOLD_DIM, fontWeight: '800', fontSize: 14 },

  pitchChip: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, borderRadius: 12, backgroundColor: 'rgba(19,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.2)', alignItems: 'center', minWidth: 42 },
  pitchChipActive: { backgroundColor: 'rgba(120,53,15,0.5)', borderColor: GOLD },
  pitchChipText: { color: '#78716C', fontWeight: '800', fontSize: 12 },
  pitchChipTextActive: { color: '#FCD34D' },
  pitchRaga: { color: '#A16207', fontSize: 8, marginTop: 2 },

  octaveRow: { flexDirection: 'row', gap: 8 },
  octaveBtn: { flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(19,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.2)', alignItems: 'center' },
  octaveBtnActive: { backgroundColor: 'rgba(120,53,15,0.5)', borderColor: GOLD },
  octaveBtnLabel: { color: '#78716C', fontWeight: '900', fontSize: 12 },
  octaveBtnLabelActive: { color: '#FCD34D' },
  octaveBtnHindi: { color: '#44403C', fontSize: 10, marginTop: 2 },

  analyzingBox: { alignItems: 'center', paddingVertical: 28 },
  analyzingText: { color: GOLD_DIM, fontWeight: '700', marginTop: 12, letterSpacing: 0.5, textAlign: 'center', fontStyle: 'italic' },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: 'rgba(8,0,0,0.97)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(184,134,11,0.4)',
  },
  modalTitle: { color: GOLD, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  modalSubtitle: { color: '#A8A29E', fontSize: 12, letterSpacing: 1, marginTop: 3 },
  closeBtn: { padding: 4 },

  profileCard: { marginHorizontal: 20, marginTop: 4, marginBottom: 8, backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(184,134,11,0.45)', borderRadius: 24, padding: 22 },
  profileCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  profileLabel: { color: '#78716C', fontSize: 9, letterSpacing: 4, fontWeight: '900', marginBottom: 4 },
  profileCategory: { color: '#FEF3C7', fontSize: 30, fontWeight: '900' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, gap: 4 },
  verifiedText: { color: '#1C0A00', fontSize: 9, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', padding: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(184,134,11,0.2)' },
  metricLabel: { color: '#78716C', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  metricValue: { color: GOLD, fontSize: 22, fontWeight: '900' },
  reportBox: { backgroundColor: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 16, borderLeftWidth: 3, borderLeftColor: GOLD },
  reportText: { color: '#D6D3D1', fontSize: 13, fontStyle: 'italic', lineHeight: 22 },

  playlistTitle: { color: '#FEF3C7', fontSize: 20, fontWeight: '900', paddingHorizontal: 20, marginBottom: 16 },
  langHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  langHeaderText: { color: GOLD_DIM, fontSize: 15, fontWeight: '800' },

  trackCard: { width: 210, backgroundColor: CARD_BG, padding: 15, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: CARD_BORDER },
  trackHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 7 },
  trackTitle: { color: '#FEF3C7', fontWeight: '900', fontSize: 13, flex: 1 },
  trackArtist: { color: GOLD_DIM, fontSize: 11, fontWeight: '700', marginBottom: 5 },
  trackReason: { color: '#78716C', fontSize: 11, fontStyle: 'italic', lineHeight: 16 },


  backBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden' },
  backBtnGradient: { paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  backBtnText: { color: '#FCD34D', fontWeight: '900', fontSize: 15, letterSpacing: 2 },
});
