import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Dimensions, ImageBackground, ScrollView, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

// ── Sargam Notes ─────────────────────────────────────────────────────────────
const SARGAM_NOTES = [
  { swar: 'सा',  name: 'Sa',         western: 'C',  freq: 261.63, color: '#FF6B6B' },
  { swar: 'रे॒',  name: 'Komal Re',   western: 'C#', freq: 277.18, color: '#FF8E53' },
  { swar: 'रे',  name: 'Shuddha Re', western: 'D',  freq: 293.66, color: '#FFA733' },
  { swar: 'ग॒',  name: 'Komal Ga',   western: 'D#', freq: 311.13, color: '#FFD700' },
  { swar: 'ग',   name: 'Shuddha Ga', western: 'E',  freq: 329.63, color: '#C8E6C9' },
  { swar: 'म',   name: 'Shuddha Ma', western: 'F',  freq: 349.23, color: '#80DEEA' },
  { swar: 'म॑',  name: 'Tivra Ma',   western: 'F#', freq: 369.99, color: '#82B1FF' },
  { swar: 'प',   name: 'Pa',         western: 'G',  freq: 392.00, color: '#CE93D8' },
  { swar: 'ध॒',  name: 'Komal Dha',  western: 'G#', freq: 415.30, color: '#F48FB1' },
  { swar: 'ध',   name: 'Shuddha Dha',western: 'A',  freq: 440.00, color: '#D4AF37' },
  { swar: 'नि॒', name: 'Komal Ni',   western: 'A#', freq: 466.16, color: '#BCAAA4' },
  { swar: 'नि',  name: 'Shuddha Ni', western: 'B',  freq: 493.88, color: '#B0BEC5' },
];

const SNAP_TOLERANCE_CENTS = 30;
const BAD_TOLERANCE_CENTS  = 50;
// How many consecutive "off" readings before we pause and play the reference note
const OFF_TRIGGER_COUNT = 2;

function freqToCents(freq: number, refFreq: number) {
  return 1200 * Math.log2(freq / refFreq);
}

function getNearestNote(freq: number): {
  note: typeof SARGAM_NOTES[0];
  centsOff: number;
  quality: 'perfect' | 'close' | 'off';
} | null {
  if (!freq || freq <= 0) return null;

  let f = freq;
  while (f < SARGAM_NOTES[0].freq * 0.94) f *= 2;
  while (f > SARGAM_NOTES[11].freq * 1.06) f /= 2;

  let best = SARGAM_NOTES[0];
  let bestDiff = Math.abs(freqToCents(f, SARGAM_NOTES[0].freq));
  for (const note of SARGAM_NOTES) {
    const diff = Math.abs(freqToCents(f, note.freq));
    if (diff < bestDiff) { bestDiff = diff; best = note; }
  }

  const quality =
    bestDiff <= SNAP_TOLERANCE_CENTS ? 'perfect' :
    bestDiff <= BAD_TOLERANCE_CENTS  ? 'close'   : 'off';

  return { note: best, centsOff: freqToCents(f, best.freq), quality };
}

// ── Gold Divider ──────────────────────────────────────────────────────────────
const GoldDivider = () => (
  <View style={styles.divider}>
    <View style={styles.dividerLine} />
    <MaterialCommunityIcons name="star-four-points" size={12} color="#B8860B" style={{ marginHorizontal: 8 }} />
    <View style={styles.dividerLine} />
  </View>
);

// ── Cents Meter ───────────────────────────────────────────────────────────────
const CentsMeter = ({ centsOff, quality }: { centsOff: number; quality: string }) => {
  const pos = Math.max(-50, Math.min(50, centsOff));
  const pct = (pos + 50) / 100;
  const meterColor =
    quality === 'perfect' ? '#D4AF37' :
    quality === 'close'   ? '#FFA500' : '#DC143C';

  return (
    <View style={styles.centsContainer}>
      <View style={styles.centsMeterTrack}>
        <View style={styles.centsMeterCenter} />
        <View style={[
          styles.centsMeterFill,
          {
            left: `${Math.min(pct, 0.5) * 100}%`,
            width: `${Math.abs(pct - 0.5) * 100}%`,
            backgroundColor: meterColor,
          }
        ]} />
        <View style={[styles.centsMeterThumb, { left: `${pct * 100}%`, backgroundColor: meterColor }]} />
      </View>
      <View style={styles.centsLabels}>
        <Text style={styles.centsLabelEdge}>-50¢ Flat</Text>
        <Text style={[styles.centsLabelCenter, { color: meterColor }]}>
          {centsOff > 0 ? '+' : ''}{Math.round(centsOff)}¢
        </Text>
        <Text style={styles.centsLabelEdge}>+50¢ Sharp</Text>
      </View>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SargamScreen() {
  // Listening states
  const [isListening,   setIsListening]   = useState(false);
  const [currentFreq,   setCurrentFreq]   = useState(0);
  const [detectedNote,  setDetectedNote]  = useState<ReturnType<typeof getNearestNote>>(null);

  // Correction state
  const [correctionMode, setCorrectionMode] = useState(false); // paused — playing reference
  const [correctionNote, setCorrectionNote] = useState<typeof SARGAM_NOTES[0] | null>(null);
  const [isPlayingRef,   setIsPlayingRef]   = useState(false);

  // Session stats
  const [sessionScore,    setSessionScore]    = useState({ perfect: 0, close: 0, off: 0, total: 0 });
  const [practiceHistory, setPracticeHistory] = useState<string[]>([]);
  const [showGuide,       setShowGuide]       = useState(false);
  const router = useRouter();

  // Refs
  const recordingRef     = useRef<Audio.Recording | null>(null);
  const analyzeIntervalRef = useRef<any>(null);
  const refSoundRef      = useRef<Audio.Sound | null>(null);
  const offStreakRef     = useRef(0); // consecutive "off" count
  const mountOpacity     = useRef(new Animated.Value(0)).current;
  const orbScale         = useRef(new Animated.Value(1)).current;
  const snapAnim         = useRef(new Animated.Value(1)).current;
  const correctionShake  = useRef(new Animated.Value(0)).current;
  const refPulse         = useRef(new Animated.Value(1)).current;

  // Mount fade-in
  useEffect(() => {
    Animated.timing(mountOpacity, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, []);

  // Stop everything on tab blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAll();
      };
    }, [])
  );

  // Orb pulse while listening
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.09, duration: 750, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1,    duration: 750, useNativeDriver: true }),
      ]));
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(orbScale, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [isListening]);

  // Reference note pulse
  useEffect(() => {
    if (isPlayingRef) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(refPulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(refPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]));
      pulse.start();
      return () => pulse.stop();
    } else {
      refPulse.setValue(1);
    }
  }, [isPlayingRef]);

  // Note snap animation on perfect
  useEffect(() => {
    if (detectedNote?.quality === 'perfect') {
      Animated.sequence([
        Animated.timing(snapAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(snapAnim, { toValue: 1,    duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [detectedNote?.quality, detectedNote?.note?.name]);

  // ── Shake animation on correction trigger ────────────────────────────────
  const shakeCard = () => {
    correctionShake.setValue(0);
    Animated.sequence([
      Animated.timing(correctionShake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(correctionShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(correctionShake, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(correctionShake, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(correctionShake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Stop everything ──────────────────────────────────────────────────────
  const stopAll = async () => {
    clearInterval(analyzeIntervalRef.current);
    analyzeIntervalRef.current = null;
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch (_) {}
    recordingRef.current = null;
    try { await refSoundRef.current?.stopAsync(); refSoundRef.current?.unloadAsync(); } catch (_) {}
    refSoundRef.current = null;
    setIsListening(false);
    setIsPlayingRef(false);
    setCurrentFreq(0);
    setDetectedNote(null);
    offStreakRef.current = 0;
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  // ── Play reference note ──────────────────────────────────────────────────
  const playReferenceNote = async (note: typeof SARGAM_NOTES[0]) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,         // full volume — don't duck
        playThroughEarpieceAndroid: false, // loudspeaker
      });

      const asset = droneAssets["Middle"]?.[note.western];
      if (!asset) return;

      try { await refSoundRef.current?.unloadAsync(); } catch (_) {}

      // Loop the tanpura drone — user sings along until they press Retry
      const { sound } = await Audio.Sound.createAsync(
        asset,
        { volume: 1.0, isLooping: true }
      );
      await sound.setVolumeAsync(1.0); // explicit max volume
      refSoundRef.current = sound;
      setIsPlayingRef(true);
      await sound.playAsync();
    } catch (err) {
      console.error('playReferenceNote error:', err);
      setIsPlayingRef(false);
    }
  };

  // ── Trigger correction mode ──────────────────────────────────────────────
  const triggerCorrection = async (note: typeof SARGAM_NOTES[0]) => {
    // 1. Stop the listening loop
    clearInterval(analyzeIntervalRef.current);
    analyzeIntervalRef.current = null;
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch (_) {}
    recordingRef.current = null;
    setIsListening(false);

    // 2. Enter correction mode
    setCorrectionNote(note);
    setCorrectionMode(true);
    shakeCard();
    offStreakRef.current = 0;

    // 3. Play the correct reference note
    await playReferenceNote(note);
  };

  // ── Start listening ──────────────────────────────────────────────────────
  const startListening = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
        ios:     { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web:     { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });

      recordingRef.current  = recording;
      offStreakRef.current   = 0;
      setCorrectionMode(false);
      setCorrectionNote(null);
      setIsListening(true);

      analyzeIntervalRef.current = setInterval(() => { analyzeChunk(); }, 1500);
    } catch (err) {
      console.error('startListening error:', err);
    }
  };

  // ── Analyze a 1.5s chunk ─────────────────────────────────────────────────
  const analyzeChunk = async () => {
    if (!recordingRef.current) return;
    try {
      const oldRec = recordingRef.current;
      recordingRef.current = null;
      await oldRec.stopAndUnloadAsync();
      const uri = oldRec.getURI();

      if (uri) {
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', { uri, name: 'sargam_chunk.wav', type: 'audio/wav' });
        const res  = await fetch(`${apiBase}/analyze_guru`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
        const data = await res.json();

        if (data.voice_profile?.mean_pitch_hz > 0) {
          const freq    = data.voice_profile.mean_pitch_hz;
          const nearest = getNearestNote(freq);
          setCurrentFreq(freq);
          setDetectedNote(nearest);

          if (nearest) {
            // Update score
            setSessionScore(prev => ({
              perfect: prev.perfect + (nearest.quality === 'perfect' ? 1 : 0),
              close:   prev.close   + (nearest.quality === 'close'   ? 1 : 0),
              off:     prev.off     + (nearest.quality === 'off'     ? 1 : 0),
              total:   prev.total   + 1,
            }));

            if (nearest.quality === 'perfect') {
              offStreakRef.current = 0;
              setPracticeHistory(h => [`✓ ${nearest.note.name} (${nearest.note.western}) — Perfect`, ...h.slice(0, 9)]);
            } else if (nearest.quality === 'off') {
              offStreakRef.current += 1;
              // Trigger correction after OFF_TRIGGER_COUNT consecutive off readings
              if (offStreakRef.current >= OFF_TRIGGER_COUNT) {
                // Must stop interval before async triggerCorrection
                clearInterval(analyzeIntervalRef.current);
                analyzeIntervalRef.current = null;
                triggerCorrection(nearest.note);
                return; // exit so we don't restart recording below
              }
            } else {
              // 'close' — reset streak
              offStreakRef.current = 0;
            }
          }
        }
      }

      // Restart recording chunk if still in listening mode
      if (analyzeIntervalRef.current !== null || isListening) {
        const { recording: newRec } = await Audio.Recording.createAsync({
          android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
          ios:     { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
          web:     { mimeType: 'audio/webm', bitsPerSecond: 128000 },
        });
        recordingRef.current = newRec;
      }
    } catch (_) { /* silently retry */ }
  };

  // ── Retry from correction ─────────────────────────────────────────────────
  const handleRetry = async () => {
    // Stop ref sound if still playing
    try { await refSoundRef.current?.stopAsync(); refSoundRef.current?.unloadAsync(); } catch (_) {}
    refSoundRef.current = null;
    setIsPlayingRef(false);
    setCorrectionMode(false);
    setCorrectionNote(null);
    await startListening();
  };

  // ── Manual stop ──────────────────────────────────────────────────────────
  const handleStop = async () => {
    await stopAll();
    setCorrectionMode(false);
    setCorrectionNote(null);
  };

  // ── Play ref note again manually ─────────────────────────────────────────
  const handlePlayAgain = async () => {
    if (correctionNote && !isPlayingRef) {
      await playReferenceNote(correctionNote);
    }
  };

  const accuracy = sessionScore.total > 0
    ? Math.round((sessionScore.perfect / sessionScore.total) * 100) : 0;

  const noteColor  = detectedNote?.note?.color || '#D4AF37';
  const borderColor =
    correctionMode              ? '#DC143C' :
    detectedNote?.quality === 'perfect' ? '#D4AF37' :
    detectedNote?.quality === 'close'   ? '#FFA500' :
    isListening                 ? 'rgba(220,20,60,0.6)' :
    'rgba(184,134,11,0.4)';

  return (
    <ImageBackground
      source={require('../../assets/images/sargam_bg.png')}
      style={styles.flex} resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(5,0,0,0.82)', 'rgba(18,3,0,0.86)', 'rgba(5,0,0,0.93)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex}>
        <Animated.ScrollView
          style={{ opacity: mountOpacity }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sargam</Text>
              <Text style={styles.subtitle}>VISUAL PITCH SNAPPING</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowGuide(g => !g)} style={styles.iconBtn}>
                <Ionicons name={showGuide ? 'close' : 'information-circle-outline'} size={22} color="#D4AF37" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={22} color="#B8860B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Guide ── */}
          {showGuide && (
            <View style={styles.guide}>
              <Text style={styles.guideTitle}>How to Use</Text>
              <Text style={styles.guideText}>
                {'1. Tap the orb to start listening\n2. Sing any Swar from the Saptak\n3. The Golden Drop snaps to the nearest Swar\n4. If you go "Off" twice in a row, the app stops,\n   plays the correct note, and asks you to retry'}
              </Text>
            </View>
          )}

          {/* ── CORRECTION MODE BANNER ── */}
          {correctionMode && correctionNote && (
            <Animated.View style={[styles.correctionBanner, { transform: [{ translateX: correctionShake }] }]}>
              <LinearGradient colors={['rgba(80,0,0,0.9)', 'rgba(120,0,20,0.95)']} style={styles.correctionGradient}>
                <View style={styles.correctionTop}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#FCA5A5" />
                  <Text style={styles.correctionTitle}>OFF PITCH DETECTED</Text>
                </View>
                <Text style={styles.correctionSubtitle}>
                  Listen to the correct note:
                </Text>

                {/* Reference note playing indicator */}
                <Animated.View style={[styles.refNoteCard, { transform: [{ scale: refPulse }], borderColor: correctionNote.color }]}>
                  <Text style={[styles.refSwar, { color: correctionNote.color }]}>{correctionNote.swar}</Text>
                  <Text style={styles.refName}>{correctionNote.name}</Text>
                  <Text style={styles.refWestern}>{correctionNote.western}</Text>
                  {isPlayingRef && (
                    <View style={styles.playingIndicator}>
                      <MaterialCommunityIcons name="volume-high" size={14} color={correctionNote.color} />
                      <Text style={[styles.playingText, { color: correctionNote.color }]}>PLAYING</Text>
                    </View>
                  )}
                </Animated.View>

                <View style={styles.correctionActions}>
                  <TouchableOpacity
                    onPress={handlePlayAgain}
                    disabled={isPlayingRef}
                    style={[styles.playAgainBtn, isPlayingRef && { opacity: 0.5 }]}
                  >
                    <Ionicons name="play-circle" size={18} color="#FCA5A5" />
                    <Text style={styles.playAgainText}>PLAY AGAIN</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
                    <LinearGradient colors={['#7C2D12', '#B91C1C']} style={styles.retryGradient}>
                      <MaterialCommunityIcons name="microphone" size={18} color="#FEF2F2" />
                      <Text style={styles.retryText}>RETRY NOTE</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          <GoldDivider />

          {/* ── Main Orb ── */}
          {!correctionMode && (
            <View style={styles.orbSection}>
              <TouchableOpacity
                onPress={isListening ? handleStop : startListening}
                activeOpacity={0.85}
              >
                <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                  <LinearGradient
                    colors={isListening ? ['#3B0000', '#7B0017', '#9B0020'] : ['#1C0900', '#3B1800', '#2C1000']}
                    style={[styles.orb, { borderColor }]}
                  >
                    <FontAwesome5
                      name={isListening ? 'stop' : 'microphone-alt'}
                      size={38}
                      color={isListening ? '#FCA5A5' : '#D4AF37'}
                    />
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
              <Text style={[styles.orbLabel, isListening && { color: '#F87171' }]}>
                {isListening ? '● LISTENING — Tap to Stop' : 'TAP TO START LISTENING'}
              </Text>
              {isListening && currentFreq > 0 && (
                <Text style={styles.freqLabel}>{Math.round(currentFreq)} Hz</Text>
              )}
            </View>
          )}

          {/* Reset button when stopped */}
          {correctionMode && (
            <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
              <Ionicons name="stop-circle-outline" size={16} color="#78716C" />
              <Text style={styles.stopBtnText}>STOP SESSION</Text>
            </TouchableOpacity>
          )}

          <GoldDivider />

          {/* ── Live Note Display ── */}
          {!correctionMode && (
            <View style={styles.noteDisplay}>
              <Animated.View style={[
                styles.noteBubble,
                { borderColor, transform: [{ scale: snapAnim }], shadowColor: noteColor, shadowOpacity: detectedNote?.quality === 'perfect' ? 0.8 : 0.2, shadowRadius: 20 }
              ]}>
                {detectedNote ? (
                  <>
                    <Text style={[styles.swarDevanagari, { color: noteColor }]}>{detectedNote.note.swar}</Text>
                    <Text style={styles.noteName}>{detectedNote.note.name}</Text>
                    <Text style={styles.noteWestern}>{detectedNote.note.western}</Text>
                    <View style={[styles.qualityBadge, { backgroundColor: detectedNote.quality === 'perfect' ? 'rgba(212,175,55,0.2)' : detectedNote.quality === 'close' ? 'rgba(255,165,0,0.2)' : 'rgba(220,20,60,0.2)' }]}>
                      <Text style={[styles.qualityText, { color: detectedNote.quality === 'perfect' ? '#D4AF37' : detectedNote.quality === 'close' ? '#FFA500' : '#DC143C' }]}>
                        {detectedNote.quality === 'perfect' ? '✦ PERFECT SNAP' : detectedNote.quality === 'close' ? '~ CLOSE' :
                          `✗ OFF  (${offStreakRef.current}/${OFF_TRIGGER_COUNT})`}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="music-note-plus" size={48} color={isListening ? 'rgba(212,175,55,0.4)' : 'rgba(184,134,11,0.3)'} />
                    <Text style={styles.waitingText}>{isListening ? 'Waiting for voice...' : 'Sing to detect your Swar'}</Text>
                  </>
                )}
              </Animated.View>

              {detectedNote && (
                <CentsMeter centsOff={detectedNote.centsOff} quality={detectedNote.quality} />
              )}
            </View>
          )}

          <GoldDivider />

          {/* ── Saptak Overview ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="music-note-eighth" size={17} color="#D4AF37" />
              <Text style={styles.cardTitle}>SAPTAK — ALL SWARAS</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.saptakRow}>
              {SARGAM_NOTES.map(note => {
                const isActive    = detectedNote?.note?.western === note.western && !correctionMode;
                const isTarget    = correctionNote?.western === note.western && correctionMode;
                const isPerfect   = isActive && detectedNote?.quality === 'perfect';
                return (
                  <View key={note.western} style={[
                    styles.swarChip,
                    isActive  && { borderColor: note.color, backgroundColor: `${note.color}22` },
                    isTarget  && { borderColor: note.color, backgroundColor: `${note.color}33`, borderWidth: 2 },
                    isPerfect && { shadowColor: note.color, shadowOpacity: 0.9, shadowRadius: 8 },
                  ]}>
                    <Text style={[styles.swarChipDevanagari, (isActive || isTarget) && { color: note.color }]}>{note.swar}</Text>
                    <Text style={[styles.swarChipWestern,    (isActive || isTarget) && { color: note.color }]}>{note.western}</Text>
                    {isPerfect && <View style={[styles.swarDot, { backgroundColor: note.color }]} />}
                    {isTarget  && <MaterialCommunityIcons name="volume-high" size={10} color={note.color} style={{ marginTop: 2 }} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Session Stats ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="chart-arc" size={17} color="#D4AF37" />
                <Text style={styles.cardTitle}>SESSION STATS</Text>
              </View>
              <TouchableOpacity onPress={() => { setSessionScore({ perfect: 0, close: 0, off: 0, total: 0 }); setPracticeHistory([]); }} style={styles.resetBtn}>
                <Ionicons name="refresh" size={14} color="#B8860B" />
                <Text style={styles.resetText}>RESET</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#D4AF37' }]}>{sessionScore.perfect}</Text>
                <Text style={styles.statLabel}>✦ PERFECT</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#FFA500' }]}>{sessionScore.close}</Text>
                <Text style={styles.statLabel}>~ CLOSE</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#DC143C' }]}>{sessionScore.off}</Text>
                <Text style={styles.statLabel}>✗ OFF</Text>
              </View>
              <View style={[styles.statBox, styles.accuracyBox]}>
                <Text style={[styles.statNum, { color: '#FEF3C7', fontSize: 24 }]}>{accuracy}%</Text>
                <Text style={styles.statLabel}>ACCURACY</Text>
              </View>
            </View>
            {sessionScore.total > 0 && (
              <View style={styles.accBar}>
                <View style={[styles.accFill, { width: `${accuracy}%` }]} />
              </View>
            )}
          </View>

          {/* ── Recent Perfect Snaps ── */}
          {practiceHistory.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="history" size={17} color="#D4AF37" />
                <Text style={styles.cardTitle}>RECENT PERFECT SNAPS</Text>
              </View>
              {practiceHistory.map((entry, i) => (
                <View key={i} style={styles.histEntry}>
                  <MaterialCommunityIcons name="check-circle" size={14} color="#D4AF37" />
                  <Text style={styles.histText}>{entry}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Swar Reference ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="book-open-variant" size={17} color="#D4AF37" />
              <Text style={styles.cardTitle}>SWAR REFERENCE</Text>
            </View>
            {SARGAM_NOTES.map(note => (
              <View key={note.western} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: note.color }]} />
                <Text style={[styles.legendSwar, { color: note.color }]}>{note.swar}</Text>
                <Text style={styles.legendName}>{note.name}</Text>
                <Text style={styles.legendWestern}>{note.western} · {Math.round(note.freq)} Hz</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 48 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const GOLD      = '#D4AF37';
const GOLD_DIM  = '#B8860B';
const CARD_BG   = 'rgba(19,0,0,0.65)';
const CARD_BORDER = 'rgba(184,134,11,0.3)';

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 80 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:       { color: GOLD, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  subtitle:    { color: '#78716C', fontSize: 10, letterSpacing: 3, marginTop: 2 },
  iconBtn:     { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER },
  logoutBtn:   { backgroundColor: 'rgba(28,18,0,0.6)', padding: 7, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center', justifyContent: 'center' },

  guide:        { backgroundColor: 'rgba(30,10,0,0.75)', borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 16, padding: 16, marginBottom: 18 },
  guideTitle:   { color: GOLD, fontWeight: '900', fontSize: 14, marginBottom: 8, letterSpacing: 1 },
  guideText:    { color: '#A8A29E', fontSize: 13, lineHeight: 22 },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 14, marginHorizontal: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(184,134,11,0.35)' },

  // ── Correction Banner ──
  correctionBanner:   { borderRadius: 24, overflow: 'hidden', marginBottom: 4 },
  correctionGradient: { padding: 20 },
  correctionTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  correctionTitle:    { color: '#FCA5A5', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  correctionSubtitle: { color: '#D6D3D1', fontSize: 13, marginBottom: 14, fontStyle: 'italic' },

  refNoteCard:  { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 2, borderRadius: 20, padding: 20, marginBottom: 18 },
  refSwar:      { fontSize: 56, fontWeight: '900' },
  refName:      { color: '#D6D3D1', fontSize: 14, fontWeight: '700', marginTop: 4 },
  refWestern:   { color: '#78716C', fontSize: 12, letterSpacing: 3 },
  playingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  playingText:  { fontSize: 12, fontWeight: '900', letterSpacing: 2 },

  correctionActions: { flexDirection: 'row', gap: 10 },
  playAgainBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(252,165,165,0.3)', borderRadius: 16, paddingVertical: 12 },
  playAgainText: { color: '#FCA5A5', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  retryBtn:      { flex: 1, borderRadius: 16, overflow: 'hidden' },
  retryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  retryText:     { color: '#FEF2F2', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },

  stopBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginBottom: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(120,113,108,0.3)' },
  stopBtnText: { color: '#78716C', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  // ── Orb ──
  orbSection: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  orb:        { width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, elevation: 10 },
  orbLabel:   { color: '#78716C', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 14, textAlign: 'center' },
  freqLabel:  { color: GOLD_DIM, fontSize: 13, fontWeight: '900', marginTop: 4, letterSpacing: 1 },

  // ── Note Display ──
  noteDisplay:     { alignItems: 'center', marginBottom: 4 },
  noteBubble:      { width: width - 80, backgroundColor: CARD_BG, borderWidth: 2, borderRadius: 28, padding: 24, alignItems: 'center', elevation: 12, marginBottom: 14, minHeight: 160, justifyContent: 'center' },
  swarDevanagari:  { fontSize: 64, fontWeight: '900', lineHeight: 70, textShadowColor: 'rgba(212,175,55,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },
  noteName:        { color: '#D6D3D1', fontSize: 15, fontWeight: '700', marginTop: 4 },
  noteWestern:     { color: '#78716C', fontSize: 12, letterSpacing: 3 },
  qualityBadge:    { marginTop: 12, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 100 },
  qualityText:     { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  waitingText:     { color: 'rgba(184,134,11,0.5)', fontSize: 14, marginTop: 10, fontStyle: 'italic' },

  // ── Cents Meter ──
  centsContainer:  { width: width - 80 },
  centsMeterTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', position: 'relative', marginBottom: 6 },
  centsMeterCenter: { position: 'absolute', left: '50%', top: 0, width: 2, height: '100%', backgroundColor: 'rgba(212,175,55,0.5)' },
  centsMeterFill:  { position: 'absolute', top: 0, height: '100%', borderRadius: 5 },
  centsMeterThumb: { position: 'absolute', top: -3, width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2, borderColor: '#1C0A00' },
  centsLabels:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  centsLabelEdge:  { color: '#78716C', fontSize: 10, fontWeight: '700' },
  centsLabelCenter:{ fontSize: 12, fontWeight: '900' },

  // ── Saptak ──
  card:        { backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 24, padding: 18, marginBottom: 16 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:   { color: GOLD, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  saptakRow:   { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4, gap: 8 },
  swarChip:    { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(20,4,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(184,134,11,0.2)', minWidth: 52 },
  swarChipDevanagari: { color: '#78716C', fontSize: 18, fontWeight: '900' },
  swarChipWestern:    { color: '#57534E', fontSize: 9, letterSpacing: 2, marginTop: 2 },
  swarDot:     { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  // ── Stats ──
  statsRow:    { flexDirection: 'row', gap: 8 },
  statBox:     { flex: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(184,134,11,0.15)' },
  accuracyBox: { flex: 1.4, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(212,175,55,0.06)' },
  statNum:     { fontSize: 22, fontWeight: '900' },
  statLabel:   { color: '#78716C', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  accBar:      { marginTop: 14, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  accFill:     { height: '100%', backgroundColor: GOLD, borderRadius: 4 },
  resetBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(20,6,0,0.6)', borderWidth: 1, borderColor: 'rgba(184,134,11,0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  resetText:   { color: GOLD_DIM, fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // ── History ──
  histEntry:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(184,134,11,0.1)' },
  histText:    { color: '#A8A29E', fontSize: 12, fontWeight: '600' },

  // ── Legend ──
  legendRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  legendDot:    { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  legendSwar:   { fontSize: 16, fontWeight: '900', width: 36 },
  legendName:   { color: '#A8A29E', fontSize: 12, flex: 1 },
  legendWestern:{ color: '#57534E', fontSize: 11, letterSpacing: 1 },
});
