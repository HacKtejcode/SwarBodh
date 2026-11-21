import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator,
  ScrollView, Image, Dimensions, ImageBackground, Pressable, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { toByteArray } from 'base64-js';
import { useRouter, useFocusEffect } from 'expo-router';
import { saveRecording } from '../utils/recordingStore';
import { LineChart } from 'react-native-chart-kit';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withRepeat, withSequence, Easing, interpolate, Extrapolate,
  FadeIn, FadeOut, SlideInDown, ZoomIn, runOnJS
} from 'react-native-reanimated';

const manifestHost = Constants.expoConfig?.hostUri || 'localhost';
const apiBase = `http://${manifestHost.split(':')[0]}:8000`;
const { width } = Dimensions.get('window');

// ── Ragas mapped to pitches (for classical flavour) ────────────────────────
const RAGA_MAP = {
  'C': 'Yaman', 'C#': 'Bhairav', 'D': 'Kafi', 'D#': 'Bhairavi',
  'E': 'Desh', 'F': 'Puriya', 'F#': 'Yaman Kalyan', 'G': 'Khamaj',
  'G#': 'Bageshri', 'A': 'Bilawal', 'A#': 'Todi', 'B': 'Charukeshi'
};

const droneAssets = {
  "Low": {
    "C": require('../../assets/sounds/tanpura_C_Low_pa.mp3'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_Low_pa.mp3'),
    "D": require('../../assets/sounds/tanpura_D_Low_pa.mp3'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_Low_pa.mp3'),
    "E": require('../../assets/sounds/tanpura_E_Low_pa.mp3'),
    "F": require('../../assets/sounds/tanpura_F_Low_pa.mp3'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_Low_pa.mp3'),
    "G": require('../../assets/sounds/tanpura_G_Low_pa.mp3'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_Low_pa.mp3'),
    "A": require('../../assets/sounds/tanpura_A_Low_pa.mp3'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_Low_pa.mp3'),
    "B": require('../../assets/sounds/tanpura_B_Low_pa.mp3'),
  },
  "Middle": {
    "C": require('../../assets/sounds/tanpura_C_Middle_pa.mp3'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_Middle_pa.mp3'),
    "D": require('../../assets/sounds/tanpura_D_Middle_pa.mp3'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_Middle_pa.mp3'),
    "E": require('../../assets/sounds/tanpura_E_Middle_pa.mp3'),
    "F": require('../../assets/sounds/tanpura_F_Middle_pa.mp3'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_Middle_pa.mp3'),
    "G": require('../../assets/sounds/tanpura_G_Middle_pa.mp3'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_Middle_pa.mp3'),
    "A": require('../../assets/sounds/tanpura_A_Middle_pa.mp3'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_Middle_pa.mp3'),
    "B": require('../../assets/sounds/tanpura_B_Middle_pa.mp3'),
  },
  "High": {
    "C": require('../../assets/sounds/tanpura_C_High_pa.mp3'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_High_pa.mp3'),
    "D": require('../../assets/sounds/tanpura_D_High_pa.mp3'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_High_pa.mp3'),
    "E": require('../../assets/sounds/tanpura_E_High_pa.mp3'),
    "F": require('../../assets/sounds/tanpura_F_High_pa.mp3'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_High_pa.mp3'),
    "G": require('../../assets/sounds/tanpura_G_High_pa.mp3'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_High_pa.mp3'),
    "A": require('../../assets/sounds/tanpura_A_High_pa.mp3'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_High_pa.mp3'),
    "B": require('../../assets/sounds/tanpura_B_High_pa.mp3'),
  }
};

// ── Sargam helpers ─────────────────────────────────────────────────────────
function hzToNote(hz) {
  if (!hz || hz < 20 || hz > 5000) return 'N/A';
  const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notesFromA4 = Math.round(12 * Math.log2(hz / 440));
  const rawIdx = (notesFromA4 + 9) % 12;
  const idx = rawIdx < 0 ? rawIdx + 12 : rawIdx;
  const oct = Math.floor((notesFromA4 + 9) / 12) + 4;
  return `${noteStrings[idx]}${oct}`;
}

function hzToSargam(hz, baseHz) {
  if (!hz || hz < 20 || hz > 5000) return 'N/A';
  const sa = baseHz || 136.07;
  const names = ['Sa', 'Komal Re', 'Shuddh Re', 'Komal Ga', 'Shuddh Ga',
    'Shuddh Ma', 'Tivra Ma', 'Pa', 'Komal Dha', 'Shuddh Dha', 'Komal Ni', 'Shuddh Ni'];
  let s = Math.round(12 * Math.log2(hz / sa)) % 12;
  if (s < 0) s += 12;
  return names[s];
}

const MOTIVATIONAL_QUOTES = [
  "The sanctuary of sound awaits. Your journey to vocal perfection continues.",
  "Breathe in the silence, breathe out the melody. Welcome back, Master.",
  "Every swara is a step closer to the soul. Let's begin today's riyaaz.",
  "The tanpura is tuned, the audience is waiting. Your mastery is inevitable.",
  "Welcome back! Today's practice is a gift to your future self.",
  "A single note, held with truth, is worth a thousand acrobatics.",
  "In the deep crimson glow, your voice finds its home. Let's practice.",
  "Patience is the root of perfection. Sing with the heart of a Guru.",
  "Your Shruti is the connection between earth and sky. Honor it today.",
  "The mandala of mastery begins with a single perfect Sa."
];

let hasSeenWelcomeThisSession = false;

// ── Sub-components ─────────────────────────────────────────────────────────
const GoldDivider = () => (
  <View className="flex-row items-center my-4 px-4">
    <View className="flex-1 h-px bg-[#B8860B66]" />
    <MaterialCommunityIcons name="music-clef-treble" size={14} color="#B8860B" style={{ marginHorizontal: 8 }} />
    <View className="flex-1 h-px bg-[#B8860B66]" />
  </View>
);

const MetricCard = ({ label, value, sub, highlight }) => (
  <View className={`flex-1 mx-1.5 rounded-2xl p-3 items-center border ${highlight ? 'bg-[#7F1D1D55] border-[#DC2626]' : 'bg-[#13001099] border-[#B8860B44]'}`}>
    <Text className="text-[#B8860B] text-[9px] font-black tracking-widest mb-1">{label}</Text>
    <Text className={`text-lg font-black ${highlight ? 'text-[#F87171]' : 'text-[#FEF3C7]'}`}>{value}</Text>
    {sub ? <Text className="text-[#78716C] text-[10px] mt-0.5 text-center">{sub}</Text> : null}
  </View>
);

// ── Musical Staff Notation Orb (Welcome Screen) ─────────────────────────────
const MusicalStaffOrb = () => {
  const clefY  = useSharedValue(0);
  const n1Y    = useSharedValue(0);
  const n2Y    = useSharedValue(0);
  const n3Y    = useSharedValue(0);
  const n1Op   = useSharedValue(0.8);
  const n2Op   = useSharedValue(0.5);
  const n3Op   = useSharedValue(1.0);

  useEffect(() => {
    // Treble clef: slow gentle bob
    clefY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,  { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ), -1, false);
    // Note 1 (♩) — drift upward slowly
    n1Y.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(2,  { duration: 1900, easing: Easing.inOut(Easing.ease) })
      ), -1, false);
    n1Op.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0.45, { duration: 900 })),
      -1, true);
    // Note 2 (♪) — float sideways-ish at different speed
    n2Y.value = withRepeat(
      withSequence(
        withTiming(6,  { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(-6, { duration: 2600, easing: Easing.inOut(Easing.ease) })
      ), -1, true);
    n2Op.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 1300 }), withTiming(0.3, { duration: 1300 })),
      -1, true);
    // Note 3 (♫) — fast subtle flicker
    n3Y.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(7,  { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ), -1, false);
    n3Op.value = withRepeat(
      withSequence(withTiming(0.65, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1, true);
  }, []);

  const clefStyle = useAnimatedStyle(() => ({ transform: [{ translateY: clefY.value }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: n1Y.value }], opacity: n1Op.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: n2Y.value }], opacity: n2Op.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: n3Y.value }], opacity: n3Op.value }));

  const STAFF_TOP = 22;   // y-origin of top staff line
  const STAFF_GAP = 9;    // gap between lines
  const GOLD      = '#D4AF37';
  const GLOW      = '#FBBF24';

  return (
    <View style={{ width: 84, height: 84, position: 'relative', overflow: 'visible' }}>
      {/* 5 Staff lines */}
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{
          position: 'absolute',
          left: 18, right: 3,
          height: 1.2,
          backgroundColor: 'rgba(212,175,55,0.55)',
          top: STAFF_TOP + i * STAFF_GAP,
        }} />
      ))}

      {/* Treble Clef 𝄞 */}
      <Animated.Text style={[clefStyle, {
        position: 'absolute',
        left: 0, top: 2,
        fontSize: 58, lineHeight: 82,
        color: GOLD,
        textShadowColor: GLOW,
        textShadowRadius: 14,
        textShadowOffset: { width: 0, height: 0 },
      }]}>{'\u{1D11E}'}</Animated.Text>

      {/* ♩ Quarter note — upper staff */}
      <Animated.Text style={[s1, {
        position: 'absolute', right: 22, top: 6,
        fontSize: 24,
        color: '#FEF3C7',
        textShadowColor: GOLD,
        textShadowRadius: 12,
        textShadowOffset: { width: 0, height: 0 },
      }]}>{'\u2669'}</Animated.Text>

      {/* ♪ Eighth note — middle */}
      <Animated.Text style={[s2, {
        position: 'absolute', right: 4, top: 22,
        fontSize: 22,
        color: GOLD,
        textShadowColor: GLOW,
        textShadowRadius: 16,
        textShadowOffset: { width: 0, height: 0 },
      }]}>{'\u266A'}</Animated.Text>

      {/* ♫ Beamed notes — lower staff */}
      <Animated.Text style={[s3, {
        position: 'absolute', right: 12, top: 44,
        fontSize: 20,
        color: '#FEF3C7',
        textShadowColor: GOLD,
        textShadowRadius: 10,
        textShadowOffset: { width: 0, height: 0 },
      }]}>{'\u266B'}</Animated.Text>
    </View>
  );
};


export default function RecordScreen() {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [droneSound, setDroneSound] = useState(null);
  const [isPlayingDrone, setIsPlayingDrone] = useState(false);
  const [selectedDronePitch, setSelectedDronePitch] = useState('C#');
  const [selectedDroneOctave, setSelectedDroneOctave] = useState('Middle');
  const [baseline, setBaseline] = useState(null);
  const [isCalibratingMode, setIsCalibratingMode] = useState(false);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  const router = useRouter();
  const meteringData = useRef([]);
  const recordingTimer = useRef(null);
  const droneSoundRef = useRef(null);

  // Reanimated shared values — Orb / mic
  const outerRingScale = useSharedValue(1);
  const middleRingScale = useSharedValue(1);
  const innerRingOpacity = useSharedValue(0.4);
  const micScale = useSharedValue(1);
  const resultsOpacity = useSharedValue(0);
  const droneGlow = useSharedValue(0);
  // Welcome modal animations
  const welcomeScale   = useSharedValue(1.1);
  const welcomeOpacity = useSharedValue(0);
  const welcomeRing1   = useSharedValue(1);
  const welcomeRing2   = useSharedValue(1);
  const welcomeRing3   = useSharedValue(1);
  const shimmerX       = useSharedValue(-200);
  const iconFloat      = useSharedValue(0);
  const welcomeSoundRef = useRef(null);

  useEffect(() => { loadBaseline(); }, []);

  useEffect(() => {
    async function checkWelcome() {
      try {
        const justIn = await AsyncStorage.getItem('justLoggedIn');
        if (justIn === 'true') {
          const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
          setQuoteIdx(idx);
          setIsWelcomeVisible(true);
          // Fade + scale the background
          welcomeScale.value   = withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) });
          welcomeOpacity.value = withTiming(1, { duration: 900 });
          // Pulsing concentric rings
          welcomeRing1.value = withRepeat(
            withSequence(withTiming(1.35, { duration: 1600, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 1600, easing: Easing.in(Easing.ease) })), -1, false);
          welcomeRing2.value = withRepeat(
            withSequence(withTiming(1.6,  { duration: 2200, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 2200, easing: Easing.in(Easing.ease) })), -1, false);
          welcomeRing3.value = withRepeat(
            withSequence(withTiming(1.9,  { duration: 3000, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 3000, easing: Easing.in(Easing.ease) })), -1, false);
          // Icon floating
          iconFloat.value = withRepeat(
            withSequence(withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })), -1, false);
          // Shimmer sweep along the gold line
          shimmerX.value = withRepeat(
            withSequence(withTiming(-200, { duration: 0 }), withTiming(300, { duration: 2000, easing: Easing.out(Easing.ease) })), -1, false);
          // ── Grand Piano Chord with Simulated Concert-Hall Reverb ─────────
          // Technique: Layer the same chord 3× at 1000ms intervals,
          // each time at 1/3rd the volume — mimics early reflections + reverb tail.
          // A sub-quiet tanpura drone gives the "room tone" ambience.
          const scheduleNote = (asset, vol, delayMs) => {
            setTimeout(async () => {
              try {
                const { sound } = await Audio.Sound.createAsync(
                  asset, { shouldPlay: true, volume: Math.max(0, vol) }
                );
                sound.setOnPlaybackStatusUpdate((st) => {
                  if (st.didJustFinish) sound.unloadAsync().catch(() => {});
                });
              } catch (_) {}
            }, delayMs);
          };

          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              shouldDuckAndroid: false,
              playThroughEarpieceAndroid: false,
            });

            // 🎹 Room tone — tanpura C drone at whisper volume (~concert hall ambience)
            const { sound: roomTone } = await Audio.Sound.createAsync(
              require('../../assets/sounds/tanpura_C_High_pa.mp3'),
              { shouldPlay: true, volume: 0.08, isLooping: false }
            );
            welcomeSoundRef.current = roomTone;

            // Smooth fade-out: step down vol from 0.08 → 0 over 1500ms at t=3000ms
            setTimeout(() => {
              let vol = 0.08;
              const steps = 20;
              const stepVol = vol / steps;
              const stepMs = 1500 / steps;
              const fadeInterval = setInterval(() => {
                vol = Math.max(0, vol - stepVol);
                roomTone.setVolumeAsync(vol).catch(() => {});
                if (vol <= 0) {
                  clearInterval(fadeInterval);
                  roomTone.stopAsync().catch(() => {});
                  roomTone.unloadAsync().catch(() => {});
                }
              }, stepMs);
            }, 3000);

            // Fade screen to black at t=3500ms then auto-dismiss
            setTimeout(() => {
              welcomeOpacity.value = withTiming(0, { duration: 1200, easing: Easing.in(Easing.ease) });
            }, 3500);
            setTimeout(() => {
              setIsWelcomeVisible(false);
              // Restore opacity for any future welcome (e.g. re-login)
              welcomeOpacity.value = 0;
            }, 4800);

            // 🎹 FIRST CHORD STRIKE — Full velocity (humanized slight delay between notes)
            scheduleNote(require('../../assets/sounds/piano_C4.mp3'), 0.90,   0);
            scheduleNote(require('../../assets/sounds/piano_E4.mp3'), 0.85,  35);
            scheduleNote(require('../../assets/sounds/piano_G4.mp3'), 0.80,  70);

            // 🎹 REVERB FIRST REFLECTION — 30% volume at ~1000ms (early echo)
            scheduleNote(require('../../assets/sounds/piano_C4.mp3'), 0.28, 1050);
            scheduleNote(require('../../assets/sounds/piano_E4.mp3'), 0.25, 1080);
            scheduleNote(require('../../assets/sounds/piano_G4.mp3'), 0.22, 1110);

            // 🎹 REVERB TAIL — 10% volume at ~2000ms (distant room reverb)
            scheduleNote(require('../../assets/sounds/piano_C4.mp3'), 0.10, 2100);
            scheduleNote(require('../../assets/sounds/piano_E4.mp3'), 0.09, 2130);
            scheduleNote(require('../../assets/sounds/piano_G4.mp3'), 0.08, 2160);

          } catch (_) {}
          await AsyncStorage.removeItem('justLoggedIn');
        }
      } catch (_) {}
    }
    checkWelcome();
  }, []);

  // Cleanup welcome sound on unmount
  useEffect(() => {
    return () => { welcomeSoundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
    };
  }, [recording]);

  useEffect(() => {
    // Unload old drone sound when ref changes (on unmount only)
    return () => { droneSoundRef.current?.unloadAsync(); };
  }, []);

  // Stop drone automatically when leaving this tab
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          droneSoundRef.current?.stopAsync().catch(() => {});
          setIsPlayingDrone(false);
        } catch (_) {}
      };
    }, []) // empty deps — only fires on real blur
  );

  useEffect(() => {
    if (isRecording) {
      // Outer ring ripple
      outerRingScale.value = withRepeat(
        withSequence(
          withTiming(1.45, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 1200, easing: Easing.in(Easing.ease) })
        ), -1, false
      );
      // Middle ring
      middleRingScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ), -1, true
      );
      innerRingOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.5, { duration: 600 })), -1, true
      );
      micScale.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true
      );
    } else {
      outerRingScale.value = withSpring(1);
      middleRingScale.value = withSpring(1);
      innerRingOpacity.value = withTiming(0.4);
      micScale.value = withSpring(1);
    }
  }, [isRecording]);

  useEffect(() => {
    if (isPlayingDrone) {
      droneGlow.value = withRepeat(
        withSequence(withTiming(1, { duration: 1500 }), withTiming(0.3, { duration: 1500 })), -1, true
      );
    } else {
      droneGlow.value = withTiming(0);
    }
  }, [isPlayingDrone]);

  useEffect(() => {
    resultsOpacity.value = results ? withTiming(1, { duration: 700 }) : withTiming(0, { duration: 200 });
  }, [results]);

  const loadBaseline = async () => {
    try {
      const b = await AsyncStorage.getItem('vocal_baseline');
      if (b) setBaseline(JSON.parse(b));
    } catch (_) {}
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/auth');
    } catch (_) {}
  };

  async function toggleDrone() {
    try {
      if (isPlayingDrone) {
        await droneSound?.stopAsync();
        setIsPlayingDrone(false);
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          droneAssets[selectedDroneOctave][selectedDronePitch],
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        await sound.setVolumeAsync(1.0);
        setDroneSound(sound);
        droneSoundRef.current = sound;
        setIsPlayingDrone(true);
      }
    } catch (e) { console.error('Drone error', e); }
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      meteringData.current = [];

      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync({
        isMeteringEnabled: true,
        android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
        ios: { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });
      newRec.setProgressUpdateInterval(50);
      newRec.setOnRecordingStatusUpdate((s) => { if (s.metering !== undefined) meteringData.current.push(s.metering); });
      await newRec.startAsync();
      setRecording(newRec);
      setIsRecording(true);
      setError(null);
      setResults(null);
      recordingTimer.current = setTimeout(() => stopRecording(newRec), 5000);
    } catch (err) {
      setError('Microphone permission required.');
    }
  }

  async function stopRecording(activeRec = recording) {
    if (!activeRec) return;
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    setIsRecording(false);
    setIsAnalyzing(true);
    try { await activeRec.stopAndUnloadAsync(); } catch (_) {}
    const uri = activeRec.getURI();
    setRecording(null);
    analyzeLocalAudio(uri);
  }

  async function analyzeLocalAudio(uri) {
    const data = meteringData.current;
    if (!data.length) { setError('No audio captured.'); setIsAnalyzing(false); return; }

    const avgDb = data.reduce((s, v) => s + v, 0) / data.length;
    const peakDb = Math.max(...data);
    const variance = data.reduce((s, v) => s + Math.pow(v - avgDb, 2), 0) / data.length;
    const instability = Math.sqrt(variance);

    let hz = 0, westernNote = 'N/A', sargamNote = 'N/A';
    try {
      if (uri) {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const bytes = toByteArray(b64);
        const samples = Math.floor((bytes.length - 44) / 2);
        if (samples > 2000) {
          const pcm = new Int16Array(bytes.buffer, bytes.byteOffset + 44, samples);
          const mid = Math.floor(pcm.length / 2);
          let minDiff = Infinity, best = -1;
          const minP = Math.floor(44100 / 1000), maxP = Math.floor(44100 / 80);
          for (let p = minP; p <= maxP; p++) {
            let d = 0;
            for (let i = 0; i < 2000; i++) { const i2 = mid + i + p; if (i2 < pcm.length) d += Math.abs(pcm[mid + i] - pcm[i2]); }
            if (d < minDiff) { minDiff = d; best = p; }
          }
          if (best > 0) { hz = Math.round(44100 / best); westernNote = hzToNote(hz); sargamNote = hzToSargam(hz, baseline?.pitch_hz); }
        }
      }
    } catch (_) {}

    let isStrained = false, indicators = [];
    let recommendation = `Beautifully held ${sargamNote} (${westernNote}). Your Aakar is steady — the hallmark of a disciplined vocalist.`;
    const maxInst = baseline?.instability ? Math.max(baseline.instability * 1.5, 5.0) : 8.0;
    const minDbl = baseline?.avg_db ? baseline.avg_db - 15 : -45;

    if (instability > maxInst) {
      isStrained = true;
      indicators.push(`Gat instability detected on ${sargamNote} (score: ${instability.toFixed(1)})`);
      recommendation = `Your ${sargamNote} wavers like a flame in the wind. Practice "Sa-Re-Sa" in Mandra Saptak with slow diaphragmatic breath to build steadiness.`;
    }
    if (peakDb > -3.0) {
      isStrained = true;
      indicators.push('Vocal clipping — extreme loudness detected');
      recommendation = `${sargamNote} is being forced beyond its natural boundary. In Raga ${RAGA_MAP[selectedDronePitch] || 'practice'}, surrender your voice rather than push it.`;
    }
    if (avgDb < minDbl) {
      indicators.push('Sangeet is too subdued — below your established baseline');
      recommendation = `Your ${sargamNote} fades into silence. Strengthen your Aakar with the "Ma-Pa-Ma" exercise in Madhya Saptak.`;
    }

    let songSuggestions = [];
    try {
      const res = await fetch(`${apiBase}/suggest_songs?note=${encodeURIComponent(westernNote)}`);
      if (res.ok) { const d = await res.json(); songSuggestions = d.suggestions || []; }
    } catch (_) {}

    if (isCalibratingMode) {
      recommendation = '🎯 Vocal Profile Calibration';
      isStrained = false;
      indicators = ['Base profile established'];
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        await fetch(`${apiBase}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            avg_db: avgDb.toFixed(1), peak_db: peakDb.toFixed(1),
            instability: instability.toFixed(2),
            pitch_hz: hz > 0 ? String(hz) : 'Unknown',
            note: westernNote, sargam: sargamNote,
            is_strained: isStrained, indicators, recommendation
          }),
        });
      }
    } catch (_) {}

    const sampled = data.filter((_, i) => i % Math.ceil(data.length / 30) === 0);
    const chartData = { labels: [], datasets: [{ data: sampled.length > 0 ? sampled : [0] }] };

    if (isCalibratingMode) {
      const baseline = { pitch_hz: hz || 'Unknown', note: westernNote, sargam: sargamNote, avg_db: avgDb, instability };
      await AsyncStorage.setItem('vocal_baseline', JSON.stringify(baseline));
      setBaseline(baseline);
      setIsCalibratingMode(false);
      setResults({ is_calibration: true, metrics: baseline, chartData });
      setIsAnalyzing(false);
      return;
    }

    // Save audio file to recordings vault
    if (uri && !isCalibratingMode) {
      saveRecording(uri, 'vocalytics', { note: westernNote, sargam: sargamNote }).catch(() => {});
    }

    setResults({ is_strained: isStrained, metrics: { avg_db: avgDb.toFixed(1), peak_db: peakDb.toFixed(1), instability: instability.toFixed(2), pitch_hz: hz || 'Unknown', note: westernNote, sargam: sargamNote }, strain_indicators: indicators, recommendation, chartData });
    setIsAnalyzing(false);
  }

  const outerRingStyle  = useAnimatedStyle(() => ({ transform: [{ scale: outerRingScale.value }] }));
  const middleRingStyle = useAnimatedStyle(() => ({ transform: [{ scale: middleRingScale.value }] }));
  const innerRingStyle  = useAnimatedStyle(() => ({ opacity: innerRingOpacity.value }));
  const micStyle        = useAnimatedStyle(() => ({ transform: [{ scale: micScale.value }] }));
  const resultsStyle    = useAnimatedStyle(() => ({ opacity: resultsOpacity.value, transform: [{ translateY: interpolate(resultsOpacity.value, [0, 1], [24, 0], Extrapolate.CLAMP) }] }));
  const droneGlowStyle  = useAnimatedStyle(() => ({
    shadowRadius: interpolate(droneGlow.value, [0, 1], [4, 18], Extrapolate.CLAMP),
  }));
  const welcomeBgStyle  = useAnimatedStyle(() => ({ opacity: welcomeOpacity.value, transform: [{ scale: welcomeScale.value }] }));
  const wRing1Style     = useAnimatedStyle(() => ({ transform: [{ scale: welcomeRing1.value }], opacity: interpolate(welcomeRing1.value, [1, 1.35], [0.5, 0], Extrapolate.CLAMP) }));
  const wRing2Style     = useAnimatedStyle(() => ({ transform: [{ scale: welcomeRing2.value }], opacity: interpolate(welcomeRing2.value, [1, 1.6],  [0.35, 0], Extrapolate.CLAMP) }));
  const wRing3Style     = useAnimatedStyle(() => ({ transform: [{ scale: welcomeRing3.value }], opacity: interpolate(welcomeRing3.value, [1, 1.9],  [0.2, 0], Extrapolate.CLAMP) }));
  const shimmerStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: shimmerX.value }] }));
  const iconFloatStyle  = useAnimatedStyle(() => ({ transform: [{ translateY: iconFloat.value }] }));

  // ── Result Dashboard ─────────────────────────────────────────────────────
  const renderDashboard = () => {
    if (!results) return null;

    if (results.is_calibration) {
      return (
        <Animated.View style={resultsStyle} className="mx-2 mt-2 bg-[#13001099] border border-[#B8860B55] rounded-3xl p-5">
          <View className="flex-row items-center justify-center mb-3">
            <MaterialCommunityIcons name="check-decagram" size={26} color="#D4AF37" />
            <Text className="text-[#D4AF37] text-lg font-black ml-2">Shruti Profile Saved!</Text>
          </View>
          <Text className="text-[#D6D3D1] text-sm text-center leading-6 mb-4">
            Your natural Shruti is rooted at{' '}
            <Text className="text-[#F59E0B] font-black">{results.metrics.note}</Text>
            {results.metrics.sargam !== 'N/A' && ` (${results.metrics.sargam})`}.{' '}
            Future sessions will be measured against your unique vocal fingerprint.
          </Text>
          <GoldDivider />
          <Text className="text-[#B8860B] text-xs font-black text-center mb-3 tracking-widest">YOUR NATURAL STEADINESS</Text>
          <LineChart
            data={results.chartData} width={width - 80} height={140}
            chartConfig={{ backgroundColor: 'transparent', backgroundGradientFrom: '#1C0505', backgroundGradientTo: '#130000', decimalPlaces: 1, color: (o = 1) => `rgba(212,175,55,${o})`, labelColor: (o = 1) => `rgba(168,162,158,${o})` }}
            bezier style={{ borderRadius: 16, marginTop: 4 }} withDots={false} withInnerLines={false}
          />
        </Animated.View>
      );
    }

    const isStrained = results.is_strained;
    const accentColor = isStrained ? '#EF4444' : '#D4AF37';

    return (
      <Animated.View style={resultsStyle} className="mx-2 mt-2">
        {/* Status Header */}
        <View className={`flex-row items-center justify-center py-3 px-5 rounded-2xl mb-4 border ${isStrained ? 'bg-[#7F1D1D44] border-[#DC262666]' : 'bg-[#1C1200CC] border-[#B8860B55]'}`}>
          <MaterialCommunityIcons name={isStrained ? 'alert-circle' : 'check-circle'} size={22} color={accentColor} />
          <Text className={`font-black text-base ml-2 ${isStrained ? 'text-[#FCA5A5]' : 'text-[#D4AF37]'}`}>
            {isStrained ? 'Strain Detected — Rest & Recover' : 'Vocal Health Confirmed ✓'}
          </Text>
        </View>

        {/* Metric Cards */}
        <View className="flex-row mb-3">
          <MetricCard label="SWARA (SARGAM)" value={results.metrics.sargam} sub={`${results.metrics.note} · ${results.metrics.pitch_hz} Hz`} />
          <MetricCard label="INSTABILITY" value={results.metrics.instability} sub="< 8.0 is healthy" highlight={parseFloat(results.metrics.instability) > 8} />
        </View>
        <View className="flex-row mb-3">
          <MetricCard label="AVG LOUDNESS" value={`${results.metrics.avg_db} dB`} highlight={parseFloat(results.metrics.avg_db) > -5} />
          <MetricCard label="PEAK LOUDNESS" value={`${results.metrics.peak_db} dB`} highlight={parseFloat(results.metrics.peak_db) > -3} />
        </View>

        {/* Raga Context */}
        <View className="bg-[#13001099] rounded-2xl px-4 py-3 mb-3 border border-[#B8860B33] flex-row items-center">
          <MaterialCommunityIcons name="music-clef-alto" size={20} color="#B8860B" />
          <Text className="text-[#D6D3D1] text-sm ml-3 flex-1">
            <Text className="text-[#D4AF37] font-bold">Raga Context: </Text>
            {RAGA_MAP[selectedDronePitch] || 'Undefined'} — Drone: {selectedDronePitch} {selectedDroneOctave}
          </Text>
        </View>

        {/* Indicators */}
        {results.strain_indicators?.length > 0 && (
          <View className="bg-[#7F1D1D33] rounded-2xl px-4 py-3 mb-3 border border-[#DC262644]">
            <Text className="text-[#FCA5A5] text-xs font-black tracking-widest mb-2">DETECTED ISSUES</Text>
            {results.strain_indicators.map((ind, i) => (
              <View key={i} className="flex-row items-start mb-1">
                <Text className="text-[#EF4444] mr-2 mt-0.5">•</Text>
                <Text className="text-[#FCA5A5] text-sm flex-1">{ind}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendation */}
        <View className="bg-[#1C120099] rounded-2xl px-4 py-4 mb-3 border border-[#B8860B55]">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="compass-rose" size={16} color="#D4AF37" />
            <Text className="text-[#D4AF37] text-xs font-black tracking-widest ml-2">GURU'S COUNSEL</Text>
          </View>
          <Text className="text-[#E7E5E4] text-sm leading-6 italic">"{results.recommendation}"</Text>
        </View>


        {/* Waveform Chart */}
        <View className="bg-[#13001099] rounded-2xl p-4 border border-[#B8860B33]">
          <Text className="text-[#B8860B] text-xs font-black tracking-widest mb-3">BREATH CONTROL WAVEFORM</Text>
          <LineChart
            data={results.chartData} width={width - 80} height={130}
            chartConfig={{
              backgroundColor: 'transparent', backgroundGradientFrom: '#1C0505', backgroundGradientTo: '#130000',
              decimalPlaces: 1,
              color: (o = 1) => isStrained ? `rgba(239,68,68,${o})` : `rgba(212,175,55,${o})`,
              labelColor: (o = 1) => `rgba(168,162,158,${o})`
            }}
            bezier style={{ borderRadius: 16 }} withDots={false} withInnerLines={false}
          />
          <Text className="text-[#78716C] text-[10px] text-center mt-2">Flat line = Excellent breath support</Text>
        </View>
      </Animated.View>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={require('../../assets/images/vocalytics_bg.png')} className="flex-1" resizeMode="cover">
      <LinearGradient colors={['rgba(10,0,0,0.75)', 'rgba(30,5,5,0.80)', 'rgba(10,0,0,0.90)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-[#D4AF37] text-[28px] font-black tracking-wider">Vocalytics</Text>
              <Text className="text-[#78716C] text-xs tracking-widest">VOCAL STRAIN ANALYSIS</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} className="bg-[#1C120099] border border-[#B8860B4D] p-[7px] rounded-xl">
              <Ionicons name="log-out-outline" size={22} color="#B8860B" />
            </TouchableOpacity>
          </View>

          {/* Baseline Badge */}
          {baseline && (
            <Animated.View entering={FadeIn.duration(600)} className="flex-row items-center bg-[#1C1200BB] border border-[#B8860B44] rounded-2xl px-4 py-2.5 mb-6">
              <MaterialCommunityIcons name="account-music" size={18} color="#D4AF37" />
              <Text className="text-[#A16207] text-sm ml-2 flex-1">
                Profile: <Text className="text-[#D4AF37] font-bold">{baseline.note}</Text>
                {baseline.sargam ? ` (${baseline.sargam})` : ''} – Baseline active
              </Text>
            </Animated.View>
          )}

          {/* Mic Orb */}
          <View className="items-center mb-6">
            <Text className="text-[#78716C] text-xs tracking-widest mb-5 text-center">
              {isRecording ? '🎙 LISTENING — SING "AAHHH" STEADILY' : 'TAP THE MANDALA TO BEGIN'}
            </Text>

            <View className="items-center justify-center" style={{ height: 230, width: 230 }}>
              {/* Outer decorative ring */}
              <Animated.View style={outerRingStyle} className="absolute w-[210px] h-[210px] rounded-full border border-[#B8860B33]" />
              {/* Middle ripple */}
              <Animated.View style={middleRingStyle} className="absolute w-[170px] h-[170px] rounded-full border-2 border-[#D4AF3766]" />
              {/* Inner glow */}
              <Animated.View style={innerRingStyle} className="absolute w-[130px] h-[130px] rounded-full bg-[#B8860B22] border border-[#D4AF37]" />

              {/* Mic Button */}
              <Animated.View style={micStyle}>
                <TouchableOpacity
                  onPress={isRecording ? () => stopRecording(recording) : startRecording}
                  disabled={isAnalyzing}
                  activeOpacity={0.85}
                  style={{ elevation: 20 }}
                >
                  <LinearGradient
                    colors={isRecording ? ['#7F1D1D', '#DC2626', '#B91C1C'] : ['#2C1810', '#451A03', '#3B0F04']}
                    className="w-[118px] h-[118px] rounded-full items-center justify-center border-2"
                    style={{ borderColor: isRecording ? '#EF4444' : '#D4AF37' }}
                  >
                    <FontAwesome5 name={isRecording ? 'stop' : 'microphone'} size={38} color={isRecording ? '#FCA5A5' : '#D4AF37'} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Status text */}
            <Text className={`text-sm font-bold mt-3 tracking-wide ${isRecording ? 'text-[#F87171]' : 'text-[#A16207]'}`}>
              {isRecording ? '● Recording — 5s auto-stop' : isAnalyzing ? 'Analyzing your Swara...' : 'Ready to analyze'}
            </Text>
          </View>

          <GoldDivider />

          {/* Tanpura Drone Section */}
          <View className="bg-[#13001099] border border-[#B8860B44] rounded-3xl p-5 mb-5">
            <View className="flex-row items-center mb-4">
              <MaterialCommunityIcons name="music-note-bluetooth" size={18} color="#D4AF37" />
              <Text className="text-[#D4AF37] text-sm font-black tracking-widest ml-2">TANPURA DRONE</Text>
            </View>

            {/* Drone toggle */}
            <Animated.View style={droneGlowStyle}>
              <TouchableOpacity
                onPress={toggleDrone}
                className={`flex-row items-center justify-center py-3 rounded-2xl mb-4 border ${isPlayingDrone ? 'bg-[#78350F99] border-[#D4AF37]' : 'bg-[#1C120066] border-[#B8860B55]'}`}
                style={{ shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 } }}
              >
                <MaterialCommunityIcons name={isPlayingDrone ? 'pause-circle' : 'play-circle'} size={24} color={isPlayingDrone ? '#FBBF24' : '#B8860B'} />
                <Text className={`font-black ml-2 ${isPlayingDrone ? 'text-[#FBBF24]' : 'text-[#B8860B]'}`}>
                  {isPlayingDrone ? `Resonating: ${selectedDronePitch} ${selectedDroneOctave}` : 'Awaken the Tanpura'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Pitch selector */}
            <Text className="text-[#78716C] text-[10px] tracking-widest mb-2">SELECT SHRUTI (ROOT NOTE)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ alignItems: 'center' }}>
              {Object.keys(droneAssets['Middle']).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={async () => { if (isPlayingDrone) { await droneSound?.stopAsync(); setIsPlayingDrone(false); } setSelectedDronePitch(p); }}
                  className={`px-3 py-2 mx-1 rounded-xl border ${selectedDronePitch === p ? 'bg-[#78350F99] border-[#D4AF37]' : 'bg-[#13000066] border-[#B8860B33]'}`}
                >
                  <Text className={`text-xs font-black ${selectedDronePitch === p ? 'text-[#FBBF24]' : 'text-[#78716C]'}`}>{p}</Text>
                  {selectedDronePitch === p && RAGA_MAP[p] && (
                    <Text className="text-[#A16207] text-[8px] text-center">{RAGA_MAP[p]}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Octave selector */}
            <Text className="text-[#78716C] text-[10px] tracking-widest mb-2">SAPTAK (OCTAVE)</Text>
            <View className="flex-row bg-[#13000066] rounded-2xl overflow-hidden border border-[#B8860B33]">
              {[['Low', 'मन्द्र'], ['Middle', 'मध्य'], ['High', 'तार']].map(([oct, hindi]) => (
                <TouchableOpacity
                  key={oct}
                  onPress={async () => { if (isPlayingDrone) { await droneSound?.stopAsync(); setIsPlayingDrone(false); } setSelectedDroneOctave(oct); }}
                  className={`flex-1 py-2.5 items-center ${selectedDroneOctave === oct ? 'bg-[#78350F]' : 'bg-transparent'}`}
                >
                  <Text className={`text-xs font-black ${selectedDroneOctave === oct ? 'text-[#FBBF24]' : 'text-[#78716C]'}`}>{oct}</Text>
                  <Text className={`text-[10px] ${selectedDroneOctave === oct ? 'text-[#A16207]' : 'text-[#44403C]'}`}>{hindi}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calibration Mode */}
          {!isRecording && !isAnalyzing && (
            <TouchableOpacity
              onPress={() => setIsCalibratingMode(!isCalibratingMode)}
              className={`flex-row items-center justify-center py-3.5 rounded-2xl mb-5 border ${isCalibratingMode ? 'bg-[#1C120099] border-[#D4AF37]' : 'bg-[#13000066] border-[#B8860B33]'}`}
            >
              <MaterialCommunityIcons name={isCalibratingMode ? 'target-account' : 'account-music-outline'} size={20} color={isCalibratingMode ? '#D4AF37' : '#78716C'} />
              <Text className={`font-bold ml-2 ${isCalibratingMode ? 'text-[#D4AF37]' : 'text-[#78716C]'}`}>
                {isCalibratingMode ? '🎯 Profile Calibration Mode ON' : 'Personalize Vocal Profile'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Loading */}
          {isAnalyzing && (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text className="text-[#A16207] font-bold mt-3 tracking-widest text-xs">READING YOUR SWARAS...</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View className="flex-row items-center bg-[#7F1D1D44] border border-[#DC262655] rounded-2xl px-4 py-3 mb-4">
              <MaterialCommunityIcons name="alert" size={18} color="#EF4444" />
              <Text className="text-[#FCA5A5] text-sm ml-2 flex-1">{error}</Text>
            </View>
          )}

          {/* Results Dashboard */}
          {renderDashboard()}

        </ScrollView>
      </SafeAreaView>

      {/* Welcome Back Overlay Modal */}
      <Modal visible={isWelcomeVisible} transparent animationType="none">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Animated.View style={[{ flex: 1 }, welcomeBgStyle]}>
            <ImageBackground source={require('../../assets/images/welcome_bg.png')} style={{ flex: 1 }} resizeMode="cover">
              <LinearGradient colors={['rgba(20,0,5,0.35)', 'rgba(40,5,5,0.65)', 'rgba(5,0,0,0.95)']} style={StyleSheet.absoluteFill} />

              {/* ── Cinematic centre content ── */}
              <View className="flex-1 justify-center items-center px-10">

                {/* Concentric pulse rings behind the icon */}
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                  {/* ring 3 — outermost */}
                  <Animated.View style={[{
                    position: 'absolute',
                    width: 180, height: 180, borderRadius: 90,
                    borderWidth: 1, borderColor: '#D4AF37',
                  }, wRing3Style]} />
                  {/* ring 2 */}
                  <Animated.View style={[{
                    position: 'absolute',
                    width: 145, height: 145, borderRadius: 73,
                    borderWidth: 1.5, borderColor: '#D4AF37',
                  }, wRing2Style]} />
                  {/* ring 1 — innermost */}
                  <Animated.View style={[{
                    position: 'absolute',
                    width: 110, height: 110, borderRadius: 55,
                    borderWidth: 2, borderColor: '#D4AF37',
                  }, wRing1Style]} />

                  {/* Floating musical staff notation */}
                  <Animated.View entering={ZoomIn.delay(200).duration(700)} style={[iconFloatStyle]}>
                    <View style={{
                      width: 90, height: 90, borderRadius: 45,
                      borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(184,134,11,0.10)',
                      overflow: 'visible',
                    }}>
                      <MusicalStaffOrb />
                    </View>
                  </Animated.View>
                </View>

                {/* Title */}
                <Animated.View entering={FadeIn.delay(350).duration(900)} className="items-center">
                  <Text className="text-[#FEF3C7] text-4xl font-black tracking-widest text-center">{"Welcome\nBack"}</Text>

                  {/* Shimmer gold line */}
                  <View style={{ marginTop: 14, width: 80, height: 2, backgroundColor: 'rgba(184,134,11,0.35)', overflow: 'hidden', borderRadius: 1 }}>
                    <Animated.View style={[{
                      position: 'absolute', top: 0, bottom: 0, width: 50,
                      backgroundColor: '#D4AF37', borderRadius: 1,
                    }, shimmerStyle]} />
                  </View>
                </Animated.View>

                {/* Quote */}
                <Animated.Text
                  entering={FadeIn.delay(900).duration(1100)}
                  className="text-[#D6D3D1] text-base text-center leading-8 italic font-medium mt-8"
                >
                  &ldquo;{MOTIVATIONAL_QUOTES[quoteIdx]}&rdquo;
                </Animated.Text>
              </View>

              {/* Tap to skip — replaces big CTA button */}
              <Animated.View
                entering={FadeIn.delay(1400).duration(600)}
                style={{ position: 'absolute', bottom: 52, alignSelf: 'center' }}
              >
                <TouchableOpacity
                  onPress={() => {
                    // Immediate skip: fade screen and stop sounds
                    welcomeOpacity.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) });
                    welcomeSoundRef.current?.stopAsync().catch(() => {});
                    setTimeout(() => setIsWelcomeVisible(false), 650);
                  }}
                  hitSlop={{ top: 16, bottom: 16, left: 32, right: 32 }}
                >
                  <Text style={{ color: 'rgba(184,134,11,0.55)', fontSize: 12, letterSpacing: 3, fontWeight: '700' }}>
                    TAP ANYWHERE TO SKIP
                  </Text>
                </TouchableOpacity>
              </Animated.View>

            </ImageBackground>
          </Animated.View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({});
