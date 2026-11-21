import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ImageBackground, Dimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useHardware } from '../../src/context/HardwareContext';
import { useAuth } from '../../src/context/AuthContext';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing, FadeIn, FadeInDown,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const manifestHost = Constants.expoConfig?.hostUri || 'localhost';
const apiBase = `http://${manifestHost.split(':')[0]}:8000`;

const GOLD = '#D4AF37';
const GOLD_DIM = '#B8860B';
const CARD_BG = 'rgba(19,0,0,0.65)';
const CARD_BORDER = 'rgba(184,134,11,0.3)';
const GREEN = '#1DB954';
const RED = '#ef4444';

// ── Music Theory ──────────────────────────────────────────────────────────────
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SWARA_LABELS = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni', 'Ṡa'];
const HINDI_LABELS  = ['सा', 'रे', 'ग', 'म', 'प', 'ध', 'नि', 'सा'];
const MAJOR_INT = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR_INT = [0, 2, 3, 5, 7, 8, 10, 12];
const C4 = 261.63; // Hz

function buildSwaras(rootNote: string, isMinor: boolean) {
  const rootIdx = ALL_NOTES.indexOf(rootNote) >= 0 ? ALL_NOTES.indexOf(rootNote) : 0;
  const intervals = isMinor ? MINOR_INT : MAJOR_INT;
  return intervals.map((sem, i) => {
    const noteIdx = (rootIdx + sem) % 12;
    // Use octave transposition so freq is in singable range (~200-600 Hz)
    let targetFreq = C4 * Math.pow(2, (rootIdx + sem) / 12);
    while (targetFreq < 200) targetFreq *= 2;
    while (targetFreq > 600) targetFreq /= 2;
    return { swara: SWARA_LABELS[i], hindi: HINDI_LABELS[i], note: ALL_NOTES[noteIdx], freq: targetFreq };
  });
}

// ── Tanpura Assets (static require map for RN bundler) ──────────────────────
const TANPURA: Record<string, any> = {
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
};

// ── WAV recording options (same as explore.tsx) ─────────────────────────────
const WAV_OPTS = {
  android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
  ios:     { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web:     { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

const CENTS_TOLERANCE = 60; // ±60 cents to advance
const HITS_TO_ADVANCE = 2;  // consecutive matches required

// ═══════════════════════════════════════════════════════════════════════════════
// SwaraPractice – guided Sa Re Ga Ma Pa Dha Ni Sa session
// ═══════════════════════════════════════════════════════════════════════════════
const SwaraPractice = ({
  scale, note, onDone,
}: { scale: string; note: string; onDone: () => void }) => {
  const isMinor = scale.toLowerCase().includes('minor');
  const swaras  = buildSwaras(note, isMinor);

  const [idx,       setIdx]       = useState(0);
  const [phase,     setPhase]     = useState<'reference'|'singing'|'checking'|'pass'|'fail'>('reference');
  const [detHz,     setDetHz]     = useState<number | null>(null);
  const [centsOff,  setCentsOff]  = useState<number | null>(null);
  const [hitCount,  setHitCount]  = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isPaused,  setIsPaused]  = useState(false);
  const { isHardwareMode, setHardwareMode, lastResult, isConnected } = useHardware();

  const refSoundRef        = useRef<Audio.Sound | null>(null);
  const recordingRef       = useRef<Audio.Recording | null>(null);
  const analyzeIntervalRef = useRef<any>(null);
  const hitRef             = useRef(0);
  const mountedRef         = useRef(true);
  const currIdxRef         = useRef(0);
  const pausedRef          = useRef(false);
  const refTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ring = useSharedValue(1);

  useEffect(() => {
    ring.value = withRepeat(
      withSequence(withTiming(1.18, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ring.value }] }));

  // cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refTimerRef.current) clearTimeout(refTimerRef.current);
      clearInterval(analyzeIntervalRef.current);
      refSoundRef.current?.stopAsync().catch(() => {});
      refSoundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // When idx changes → play reference then start listening
  useEffect(() => {
    currIdxRef.current = idx;
    hitRef.current = 0;
    setHitCount(0);
    if (!completed) playRef(swaras[idx].note);
  }, [idx, completed]);

  const playRef = async (swara_note: string) => {
    if (!mountedRef.current || pausedRef.current) return;
    setPhase('reference');
    setDetHz(null); setCentsOff(null);

    // Cleanup previous sound & cancel any pending timer
    if (refTimerRef.current) clearTimeout(refTimerRef.current);
    try { await refSoundRef.current?.stopAsync(); await refSoundRef.current?.unloadAsync(); } catch (_) {}
    refSoundRef.current = null;

    // IMPORTANT: explicitly reset to playback mode so iOS doesn't duck volume
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: false });

    const asset = TANPURA[swara_note];
    if (asset) {
      try {
        const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true, volume: 1.0 });
        refSoundRef.current = sound;
      } catch (_) {}
    }

    // Let reference play for 3 seconds then switch to singing
    refTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current || pausedRef.current) return;
      try { await refSoundRef.current?.stopAsync(); await refSoundRef.current?.unloadAsync(); } catch (_) {}
      refSoundRef.current = null;
      
      if (isHardwareMode) {
        setPhase('singing');
      } else {
        startSinging();
      }
    }, 3000);
  };

  const startSinging = async () => {
    if (!mountedRef.current || pausedRef.current) return;
    setPhase('singing');

    if (isHardwareMode) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true, playsInSilentModeIOS: true,
      shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
    });

    try {
      const { recording } = await Audio.Recording.createAsync(WAV_OPTS);
      recordingRef.current = recording;
    } catch (e) { return; }

    // Analyze every 1.5s
    analyzeIntervalRef.current = setInterval(analyzeChunk, 1500);
  };

  // ── Hardware Logic ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isHardwareMode && lastResult && phase === 'singing' && !pausedRef.current) {
      processPitchData(lastResult.pitch_hz);
    }
  }, [lastResult, isHardwareMode, phase]);

  const processPitchData = (hz: number | null) => {
    if (!hz || hz < 50 || !mountedRef.current) return;
    const thisIdx = currIdxRef.current;
    const target = swaras[thisIdx].freq;

    let adjusted = hz;
    while (adjusted < target * 0.7) adjusted *= 2;
    while (adjusted > target * 1.5) adjusted /= 2;

    const cents = Math.round(1200 * Math.log2(adjusted / target));
    setDetHz(Math.round(hz));
    setCentsOff(cents);

    if (Math.abs(cents) <= CENTS_TOLERANCE) {
      setPhase('pass');
      hitRef.current += 1;
      setHitCount(hitRef.current);
      if (hitRef.current >= HITS_TO_ADVANCE) {
        if (thisIdx < swaras.length - 1) {
          setTimeout(() => { if (mountedRef.current) setIdx(i => i + 1); }, 900);
        } else {
          setTimeout(() => { if (mountedRef.current) setCompleted(true); }, 900);
        }
      }
    } else {
      setPhase('fail');
      hitRef.current = 0;
      setHitCount(0);
    }
  };

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const handlePauseResume = async () => {
    if (!mountedRef.current) return;
    if (!pausedRef.current) {
      // → PAUSE
      pausedRef.current = true;
      setIsPaused(true);
      if (refTimerRef.current) clearTimeout(refTimerRef.current);
      clearInterval(analyzeIntervalRef.current);
      analyzeIntervalRef.current = null;
      try { await refSoundRef.current?.stopAsync(); } catch (_) {}
      try { await recordingRef.current?.stopAndUnloadAsync(); } catch (_) {}
      recordingRef.current = null;
      // Reset to playback mode so audio isn't stuck in recording session
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: false });
    } else {
      // → RESUME — replay reference for current swara
      pausedRef.current = false;
      setIsPaused(false);
      playRef(swaras[currIdxRef.current].note);
    }
  };

  const analyzeChunk = async () => {
    if (isHardwareMode || !recordingRef.current || !mountedRef.current || pausedRef.current) return;
    const thisIdx = currIdxRef.current;

    try {
      const oldRec = recordingRef.current;
      recordingRef.current = null;
      await oldRec.stopAndUnloadAsync();
      const uri = oldRec.getURI();

      if (uri && mountedRef.current) {
        setPhase('checking');
        const fd = new FormData();
        // @ts-ignore
        fd.append('file', { uri, name: 'swara.wav', type: 'audio/wav' });
        const res  = await fetch(`${apiBase}/analyze_guru`, { method: 'POST', body: fd, headers: { 'Content-Type': 'multipart/form-data' } });
        const data = await res.json();

        processPitchData(data.voice_profile?.mean_pitch_hz);
      }

      // Restart recording
      if (analyzeIntervalRef.current !== null && mountedRef.current) {
        const { recording: newRec } = await Audio.Recording.createAsync(WAV_OPTS);
        recordingRef.current = newRec;
      }
    } catch (_) {
      // silently restart
      if (analyzeIntervalRef.current !== null && mountedRef.current) {
        try {
          const { recording: newRec } = await Audio.Recording.createAsync(WAV_OPTS);
          recordingRef.current = newRec;
        } catch (_2) {}
      }
    }
  };

  const tryAgain = () => {
    pausedRef.current = false;
    setIsPaused(false);
    clearInterval(analyzeIntervalRef.current);
    analyzeIntervalRef.current = null;
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    setCompleted(false);
    setIdx(0);
  };

  const phaseColor = phase === 'pass' ? GREEN : phase === 'fail' ? RED : GOLD;
  const phaseIcon  = phase === 'reference' ? 'volume-high' : phase === 'singing' ? 'microphone' : phase === 'checking' ? 'progress-clock' : phase === 'pass' ? 'check-circle' : 'close-circle';

  if (completed) {
    return (
      <Animated.View entering={FadeInDown.duration(700)} style={{ alignItems: 'center', width: '100%' }}>
        <View style={ps.completedCard}>
          <Text style={ps.completedEmoji}>🎉</Text>
          <Text style={ps.completedTitle}>Sargam Complete!</Text>
          <Text style={ps.completedScale}>{scale}</Text>
          <Text style={ps.completedSub}>You sang all 7 swaras perfectly!</Text>
        </View>
        <TouchableOpacity style={ps.practiceAgainBtn} onPress={tryAgain} activeOpacity={0.8}>
          <LinearGradient colors={[GOLD, '#926a06']} style={ps.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <MaterialCommunityIcons name="restart" size={20} color="#1c1200" />
            <Text style={ps.btnText}>PRACTICE AGAIN</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={ps.doneBtn} onPress={onDone}>
          <Text style={ps.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', width: '100%' }}>
      {/* Progress dots — tap any completed dot to go back to that swara */}
      <View style={ps.progressRow}>
        {swaras.map((s, i) => {
          const isDone    = i < idx;
          const isActive  = i === idx;
          const tappable  = isDone; // only already-practiced swaras
          return (
            <TouchableOpacity
              key={i}
              disabled={!tappable}
              activeOpacity={0.6}
              onPress={async () => {
                if (!tappable) return;
                // Clean up current state fully
                if (refTimerRef.current) clearTimeout(refTimerRef.current);
                clearInterval(analyzeIntervalRef.current);
                analyzeIntervalRef.current = null;
                try { await refSoundRef.current?.stopAsync(); await refSoundRef.current?.unloadAsync(); } catch (_) {}
                refSoundRef.current = null;
                try { await recordingRef.current?.stopAndUnloadAsync(); } catch (_) {}
                recordingRef.current = null;
                // Reset audio to playback mode before reference tone
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: false });
                pausedRef.current = false;
                setIsPaused(false);
                hitRef.current = 0;
                setHitCount(0);
                currIdxRef.current = i;
                setIdx(i);
              }}
            >
              <View style={[
                ps.progressDot,
                isDone   && ps.progressDotDone,
                isActive && ps.progressDotActive,
                tappable && { transform: [{ scale: 1.1 }] },
              ]} />
              {tappable && (
                <Text style={ps.progressDotLabel}>{s.swara}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swara display — tap to pause/resume */}
      <TouchableOpacity onPress={handlePauseResume} activeOpacity={0.8}>
        <Animated.View style={[ps.swaraRingWrap, isPaused ? {} : ringStyle]}>
          <View style={[ps.swaraRing, { borderColor: isPaused ? '#78716C' : phaseColor + '88' }]}>
            <View style={[ps.swaraOrb, { backgroundColor: isPaused ? 'rgba(120,113,108,0.15)' : phaseColor + '22' }]}>
              {isPaused ? (
                <>
                  <MaterialCommunityIcons name="play" size={38} color="#78716C" />
                  <Text style={[ps.swaraLatin, { color: '#78716C', fontSize: 12, marginTop: 4 }]}>PAUSED</Text>
                </>
              ) : (
                <>
                  <Text style={[ps.swaraHindi, { color: phaseColor }]}>{swaras[idx].hindi}</Text>
                  <Text style={[ps.swaraLatin, { color: phaseColor }]}>{swaras[idx].swara}</Text>
                  <Text style={ps.swaraNote}>{swaras[idx].note}</Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Target freq */}
      <Text style={ps.targetHz}>{Math.round(swaras[idx].freq)} Hz</Text>

      {/* Phase indicator */}
      <View style={[ps.phaseRow, { borderColor: phaseColor + '55' }]}>
        <MaterialCommunityIcons name={phaseIcon as any} size={16} color={phaseColor} />
        <Text style={[ps.phaseText, { color: phaseColor }]}>
          {phase === 'reference' ? '🔊 Listen to the reference tone...' :
           phase === 'singing'   ? '🎤 Now sing! Hold the note steady.' :
           phase === 'checking'  ? '⚡ Analyzing your pitch...' :
           phase === 'pass'      ? `✓ Great! Hold it... (${hitRef.current}/${HITS_TO_ADVANCE})` :
                                   '✗ Not quite — keep trying!'}
        </Text>
      </View>

      {/* Pitch feedback */}
      {detHz !== null && (
        <View style={ps.pitchFeedback}>
          {isHardwareMode && (
            <View style={{ backgroundColor: '#10B98122', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10, borderColor: '#10B981', borderWidth: 1, alignSelf: 'center' }}>
              <Text style={{ color: '#10B981', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 }}>🛰️ HARDWARE SOURCE</Text>
            </View>
          )}
          <Text style={ps.detectedHz}>Detected: {detHz} Hz</Text>
          {centsOff !== null && (
            <Text style={[ps.centsOff, { color: Math.abs(centsOff) <= CENTS_TOLERANCE ? GREEN : RED }]}>
              {centsOff > 0 ? `+${centsOff}¢ Sharp` : centsOff < 0 ? `${centsOff}¢ Flat` : '✓ Spot on!'}
            </Text>
          )}
          {/* Visual cents bar */}
          <View style={ps.centsBarTrack}>
            <View style={ps.centsBarCenter} />
            {centsOff !== null && (
              <View style={[
                ps.centsBarFill,
                {
                  left: centsOff < 0 ? `${50 + Math.max(-50, centsOff / 2)}%` : '50%',
                  width: `${Math.min(50, Math.abs(centsOff) / 2)}%`,
                  backgroundColor: Math.abs(centsOff) <= CENTS_TOLERANCE ? GREEN : RED,
                }
              ]} />
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <Text style={ps.centsLabel}>-100¢</Text>
            <Text style={[ps.centsLabel, { color: GOLD }]}>Target</Text>
            <Text style={ps.centsLabel}>+100¢</Text>
          </View>
        </View>
      )}

      {/* Hit counter dots */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {Array.from({ length: HITS_TO_ADVANCE }).map((_, i) => (
          <View key={i} style={[ps.hitDot, i < hitCount && ps.hitDotFilled]} />
        ))}
      </View>
      <Text style={ps.hitLabel}>Hold {HITS_TO_ADVANCE} consecutive matches to advance</Text>

      {/* Skip button (if stuck) */}
      <TouchableOpacity style={ps.skipBtn} onPress={async () => {
        // Properly stop everything and reset audio mode BEFORE advancing
        if (refTimerRef.current) clearTimeout(refTimerRef.current);
        clearInterval(analyzeIntervalRef.current);
        analyzeIntervalRef.current = null;
        try { await refSoundRef.current?.stopAsync(); await refSoundRef.current?.unloadAsync(); } catch (_) {}
        refSoundRef.current = null;
        try { await recordingRef.current?.stopAndUnloadAsync(); } catch (_) {}
        recordingRef.current = null;
        // Reset to playback mode BEFORE the next note's reference plays — fixes volume drop
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: false });
        pausedRef.current = false;
        setIsPaused(false);
        if (idx < swaras.length - 1) setIdx(i => i + 1); else setCompleted(true);
      }}>
        <Text style={ps.skipBtnText}>SKIP →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Analyzer Tab
// ═══════════════════════════════════════════════════════════════════════════════
type Screen = 'idle' | 'recording' | 'analyzing' | 'result' | 'practice';

export default function ScaleAnalyzerTab() {
  const [screen,     setScreen]     = useState<Screen>('idle');
  const [result,     setResult]     = useState<{ scale: string; note: string; confidence: number } | null>(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const { isHardwareMode, setHardwareMode, isConnected, lastResult, startIotScale } = useHardware();

  const recordingRef = useRef<Audio.Recording | null>(null);
  const stoppedRef   = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulse = useSharedValue(1);

  useEffect(() => {
    // Listener for IoT scale results
    if (isHardwareMode && lastResult?.type === 'scale_result') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setResult(lastResult as any);
      setScreen('result');
    }
  }, [lastResult, isHardwareMode]);

  useEffect(() => {
    if (screen === 'recording') {
      pulse.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })),
        -1
      );
    } else {
      pulse.value = withTiming(1);
    }
  }, [screen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recordingRef.current && !stoppedRef.current) {
        stoppedRef.current = true;
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: screen === 'recording' ? 0.8 : 0.2,
  }));

  const startListening = async () => {
    try {
      setErrorMsg('');
      setResult(null);
      stoppedRef.current = false;

      if (isHardwareMode) {
        if (!isConnected) {
          setErrorMsg('IoT Hardware not connected. Check Bridge.');
          return;
        }
        startIotScale();
        setScreen('recording');
        // Let it run for ~12 seconds if backend doesn't respond earlier
        timerRef.current = setTimeout(() => {
          if (screen === 'recording') {
            setErrorMsg('IoT Scale detection timed out.');
            setScreen('idle');
          }
        }, 15000);
        return;
      }

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setScreen('recording');

      timerRef.current = setTimeout(() => stopListening(), 10000);
    } catch (err) {
      setErrorMsg('Microphone permission denied or recording failed.');
    }
  };

  const stopListening = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isHardwareMode) {
      setScreen('analyzing');
      return; 
    }

    if (!recordingRef.current) return;
    const currentRec = recordingRef.current;
    recordingRef.current = null;
    setScreen('analyzing');

    try {
      await currentRec.stopAndUnloadAsync();
      const uri = currentRec.getURI();
      if (!uri) throw new Error('No URI');

      const formData = new FormData();
      formData.append('file', { uri, name: 'ambient.wav', type: 'audio/wav' } as any);
      const response = await fetch(`${apiBase}/analyze-scale`, {
        method: 'POST', body: formData, headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`Server ${response.status}`);

      const data = await response.json();
      setResult(data);
      setScreen('result');
    } catch (err) {
      setErrorMsg('Failed to analyze. Make sure the backend is running.');
      setScreen('idle');
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/riyaaz_chamber.png')}
      style={{ flex: 1 }} resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(5,0,0,0.85)', 'rgba(28,5,0,0.92)', 'rgba(5,0,0,0.96)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={ss.header}>
          <View>
            <Text style={ss.title}>{screen === 'practice' ? 'Sargam Practice' : 'Analyzer'}</Text>
            <Text style={ss.subtitle}>{screen === 'practice' ? `${result?.scale?.toUpperCase()}` : 'SONG SCALE DETECTION'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[ss.hwToggle, { backgroundColor: isHardwareMode ? (isConnected ? '#10B981' : '#F59E0B') : 'transparent' }]}
              onPress={() => setHardwareMode(!isHardwareMode)}
            >
              <MaterialCommunityIcons name={isHardwareMode ? "chip" : "microphone"} size={16} color={isHardwareMode ? "#000" : GOLD} />
              <Text style={[ss.hwText, { color: isHardwareMode ? "#000" : GOLD }]}>{isHardwareMode ? (isConnected ? "IoT ON" : "IoT...") : "PHONE"}</Text>
            </TouchableOpacity>
            {screen === 'practice' && (
              <TouchableOpacity onPress={() => setScreen('result')} style={{ padding: 8 }}>
                <Ionicons name="close" size={22} color={GOLD_DIM} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── IDLE / RECORDING ─────────────────── */}
          {(screen === 'idle' || screen === 'recording') && (
            <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center' }}>
              <View style={ss.sensorRingContainer}>
                <Animated.View style={[ss.sensorRing, pulseStyle]} />
                <TouchableOpacity
                  onPress={screen === 'recording' ? () => stopListening() : startListening}
                  style={ss.micButton} activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={screen === 'recording' ? ['#ef4444', '#991b1b'] : [GOLD, '#926a06']}
                    style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <Ionicons name={screen === 'recording' ? 'stop' : 'mic'} size={52} color="#1c1200" />
                </TouchableOpacity>
              </View>
              <Text style={ss.statusTitle}>{screen === 'recording' ? 'Listening...' : 'Detect the Scale'}</Text>
              <Text style={ss.statusSub}>
                {screen === 'recording'
                  ? 'Capturing ambient music. Auto-stops in 10 seconds.'
                  : 'Play any song on speakers. Tap the mic button to detect its scale.'}
              </Text>
              {errorMsg !== '' && <Text style={ss.errorText}>{errorMsg}</Text>}
            </Animated.View>
          )}

          {/* ── ANALYZING ─────────────────────────── */}
          {screen === 'analyzing' && (
            <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center' }}>
              <ActivityIndicator size="large" color={GOLD} style={{ marginBottom: 20 }} />
              <Text style={ss.statusTitle}>Extracting Chromagram...</Text>
              <Text style={ss.statusSub}>Running Krumhansl-Schmuckler algorithm to identify the musical key.</Text>
            </Animated.View>
          )}

          {/* ── RESULT ───────────────────────────── */}
          {screen === 'result' && result && (
            <Animated.View entering={FadeInDown.duration(800)} style={{ alignItems: 'center', width: '100%' }}>
              <View style={ss.resultCard}>
                <Text style={ss.resultLabel}>DETECTED SCALE</Text>
                <Text style={ss.resultScale}>{result.scale}</Text>
                <Text style={ss.resultConfidence}>{(result.confidence || 0).toFixed(1)}% Match Confidence</Text>
              </View>

              {/* MAIN CTA: Practice Swaras */}
              <TouchableOpacity style={ss.actionBtn} onPress={() => setScreen('practice')} activeOpacity={0.8}>
                <LinearGradient colors={[GOLD, '#926a06']} style={ss.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <MaterialCommunityIcons name="music-clef-treble" size={22} color="#1c1200" />
                  <View>
                    <Text style={ss.actionBtnText}>PRACTICE SARGAM</Text>
                    <Text style={ss.actionBtnSub}>Sa Re Ga Ma Pa Dha Ni Ṡa</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={ss.secondaryBtn} onPress={() => { setScreen('idle'); setResult(null); }}>
                <Text style={ss.secondaryBtnText}>ANALYZE ANOTHER SONG</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── PRACTICE ─────────────────────────── */}
          {screen === 'practice' && result && (
            <SwaraPractice
              scale={result.scale}
              note={result.note}
              onDone={() => setScreen('result')}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ── Main screen styles ────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  header:   { paddingHorizontal: 20, paddingTop: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:    { color: GOLD, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#78716C', fontSize: 10, letterSpacing: 3, marginTop: 2 },
  hwToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: GOLD, marginRight: 10 },
  hwText:   { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },

  sensorRingContainer: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  sensorRing: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: GOLD },
  micButton:  { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 },

  statusTitle: { color: '#FEF3C7', fontSize: 22, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginBottom: 10 },
  statusSub:   { color: '#A8A29E', fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  errorText:   { color: RED, textAlign: 'center', marginTop: 16 },

  resultCard:       { width: '100%', backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 22 },
  resultLabel:      { color: GOLD_DIM, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  resultScale:      { color: GOLD, fontSize: 40, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  resultConfidence: { color: '#A8A29E', fontSize: 13, fontWeight: '600' },

  actionBtn:    { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  actionBtnGrad:{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 },
  actionBtnText:{ color: '#1c1200', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  actionBtnSub: { color: 'rgba(28,18,0,0.6)', fontSize: 10, marginTop: 2 },

  secondaryBtn:     { paddingVertical: 12 },
  secondaryBtnText: { color: GOLD_DIM, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
});

// ── SwaraPractice styles ──────────────────────────────────────────────────────
const ps = StyleSheet.create({
  progressRow:       { flexDirection: 'row', gap: 10, marginBottom: 20, alignItems: 'flex-start' },
  progressDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(184,134,11,0.2)', borderWidth: 1, borderColor: CARD_BORDER },
  progressDotDone:   { backgroundColor: GREEN },
  progressDotActive: { backgroundColor: GOLD, transform: [{ scale: 1.3 }] },
  progressDotLabel:  { color: GREEN, fontSize: 8, fontWeight: '900', textAlign: 'center', marginTop: 3, letterSpacing: 0.5 },

  swaraRingWrap:  { marginBottom: 6 },
  swaraRing:      { width: 170, height: 170, borderRadius: 85, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swaraOrb:       { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  swaraHindi:     { fontSize: 42, fontWeight: '900', marginBottom: 2 },
  swaraLatin:     { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  swaraNote:      { color: '#78716C', fontSize: 13, marginTop: 4 },

  targetHz: { color: '#44403C', fontSize: 13, marginBottom: 14 },

  phaseRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16, width: '100%' },
  phaseText: { fontSize: 13, fontWeight: '700', flex: 1 },

  pitchFeedback: { width: '100%', backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 8 },
  detectedHz:    { color: '#D6D3D1', fontSize: 13, marginBottom: 4 },
  centsOff:      { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  centsBarTrack: { width: '100%', height: 8, backgroundColor: 'rgba(184,134,11,0.15)', borderRadius: 4, overflow: 'hidden', position: 'relative', marginBottom: 4 },
  centsBarCenter:{ position: 'absolute', left: '49%', width: 2, height: '100%', backgroundColor: GOLD },
  centsBarFill:  { position: 'absolute', height: '100%', borderRadius: 4 },
  centsLabel:    { color: '#57534E', fontSize: 9 },

  hitDot:         { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: GREEN },
  hitDotFilled:   { backgroundColor: GREEN },
  hitLabel:       { color: '#57534E', fontSize: 10, marginTop: 6 },

  skipBtn:     { marginTop: 20, paddingVertical: 8, paddingHorizontal: 20 },
  skipBtnText: { color: '#44403C', fontSize: 11, letterSpacing: 2, fontWeight: '800' },

  completedCard:  { width: '100%', backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)', borderRadius: 20, padding: 30, alignItems: 'center', marginBottom: 24 },
  completedEmoji: { fontSize: 54, marginBottom: 12 },
  completedTitle: { color: '#FEF3C7', fontSize: 26, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  completedScale: { color: GOLD, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  completedSub:   { color: '#A8A29E', fontSize: 14, textAlign: 'center' },

  practiceAgainBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  btnText: { color: '#1c1200', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },

  doneBtn:     { paddingVertical: 12 },
  doneBtnText: { color: GOLD_DIM, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
});
