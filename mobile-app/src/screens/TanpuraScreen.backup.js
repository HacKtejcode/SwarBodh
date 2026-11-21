import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView, Dimensions, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const droneAssets = {
  "Low": {
    "C": require('../../assets/sounds/tanpura_C_Low_pa.wav'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_Low_pa.wav'),
    "D": require('../../assets/sounds/tanpura_D_Low_pa.wav'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_Low_pa.wav'),
    "E": require('../../assets/sounds/tanpura_E_Low_pa.wav'),
    "F": require('../../assets/sounds/tanpura_F_Low_pa.wav'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_Low_pa.wav'),
    "G": require('../../assets/sounds/tanpura_G_Low_pa.wav'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_Low_pa.wav'),
    "A": require('../../assets/sounds/tanpura_A_Low_pa.wav'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_Low_pa.wav'),
    "B": require('../../assets/sounds/tanpura_B_Low_pa.wav'),
  },
  "Middle": {
    "C": require('../../assets/sounds/tanpura_C_Middle_pa.wav'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_Middle_pa.wav'),
    "D": require('../../assets/sounds/tanpura_D_Middle_pa.wav'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_Middle_pa.wav'),
    "E": require('../../assets/sounds/tanpura_E_Middle_pa.wav'),
    "F": require('../../assets/sounds/tanpura_F_Middle_pa.wav'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_Middle_pa.wav'),
    "G": require('../../assets/sounds/tanpura_G_Middle_pa.wav'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_Middle_pa.wav'),
    "A": require('../../assets/sounds/tanpura_A_Middle_pa.wav'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_Middle_pa.wav'),
    "B": require('../../assets/sounds/tanpura_B_Middle_pa.wav'),
  },
  "High": {
    "C": require('../../assets/sounds/tanpura_C_High_pa.wav'),
    "C#": require('../../assets/sounds/tanpura_C_sharp_High_pa.wav'),
    "D": require('../../assets/sounds/tanpura_D_High_pa.wav'),
    "D#": require('../../assets/sounds/tanpura_D_sharp_High_pa.wav'),
    "E": require('../../assets/sounds/tanpura_E_High_pa.wav'),
    "F": require('../../assets/sounds/tanpura_F_High_pa.wav'),
    "F#": require('../../assets/sounds/tanpura_F_sharp_High_pa.wav'),
    "G": require('../../assets/sounds/tanpura_G_High_pa.wav'),
    "G#": require('../../assets/sounds/tanpura_G_sharp_High_pa.wav'),
    "A": require('../../assets/sounds/tanpura_A_High_pa.wav'),
    "A#": require('../../assets/sounds/tanpura_A_sharp_High_pa.wav'),
    "B": require('../../assets/sounds/tanpura_B_High_pa.wav'),
  }
};

const pitchList = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const classicalMappingEn = {
    "C": "Sa (Do)", "C#": "Komal Re", "D": "Shuddh Re", "D#": "Komal Ga", "E": "Shuddh Ga", "F": "Shuddh Ma", "F#": "Tivra Ma", "G": "Pa", "G#": "Komal Dha", "A": "Shuddh Dha", "A#": "Komal Ni", "B": "Shuddh Ni",
};
const classicalMappingHi = {
    "C": "सा", "C#": "कोमल रे", "D": "शुद्ध रे", "D#": "कोमल ग", "E": "शुद्ध ग", "F": "शुद्ध म", "F#": "तीव्र म", "G": "प", "G#": "कोमल ध", "A": "शुद्ध ध", "A#": "कोमल नि", "B": "शुद्ध नि",
};

const AnimatedScaleButton = ({ onPress, style, activeStyle, isActive, children }) => {
   const scaleAnim = useRef(new Animated.Value(1)).current;
   const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();
   const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();

   const isArrayStyle = Array.isArray(style);
   const combinedStyle = isArrayStyle ? Object.assign({}, ...style) : (style || {});
   
   const wrapperStyle = {
      position: combinedStyle.position,
      left: combinedStyle.left,
      zIndex: combinedStyle.zIndex,
   };

   return (
       <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          style={wrapperStyle}
       >
          <Animated.View style={[style, {position: 'relative', left: 0, zIndex: 0}, isActive && activeStyle, { transform: [{ scale: scaleAnim }] }]}>
              {children}
          </Animated.View>
       </TouchableOpacity>
   );
};

export default function RiyaazScreen() {
  const [droneSound, setDroneSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [selectedDronePitch, setSelectedDronePitch] = useState("C#");
  const [selectedDroneOctave, setSelectedDroneOctave] = useState("Middle");
  const [language, setLanguage] = useState("EN");

  // GSAP-style Animation Values
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;
  const keyboardRef = useRef(null);

  // Staggered Mount Animation
  useEffect(() => {
    Animated.spring(mountAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true,
    }).start();
    
    // Auto-center keyboard to Middle octave on load
    setTimeout(() => {
       if (keyboardRef.current && typeof keyboardRef.current.scrollTo === 'function') {
           keyboardRef.current.scrollTo({ x: 308, animated: true });
       }
    }, 400);
  }, []);

  // Separate explicit audio mode config with empty deps so it doesn't re-trigger on drone change
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Isolate droneSound cleanup to prevent lifecycle crashes due to unhandled promise rejections
  useEffect(() => {
    return () => {
      if (droneSound) {
        try { droneSound.unloadAsync().catch(()=>{}); } catch(e) {}
      }
    };
  }, [droneSound]);

  // Buttery-smooth GSAP pulsing effect
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim1, { toValue: 1.15, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulseAnim1, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(pulseAnim2, { toValue: 1.35, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulseAnim2, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(pulseAnim3, { toValue: 1.6, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulseAnim3, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
          ])
        ])
      ).start();
    } else {
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
      pulseAnim3.setValue(1);
      pulseAnim1.stopAnimation();
    }
  }, [isPlaying]);

  const loadAndPlaySound = async (pitch, octave, shouldPlayOverride = null) => {
    try {
      const willPlay = shouldPlayOverride !== null ? shouldPlayOverride : isPlaying;
      if (droneSound) {
         try { await droneSound.unloadAsync(); } catch(e) {}
      }
      
      const asset = droneAssets[octave][pitch];
      if (!asset) {
          setDroneSound(null);
          setIsPlaying(false);
          return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        asset,
        { volume: 1.0, isLooping: true }
      );
      
      setDroneSound(newSound);
      if (willPlay) {
         await newSound.playAsync();
         setIsPlaying(true);
      } else {
         setIsPlaying(false);
      }
    } catch(e) { console.warn("Load hot swap error", e); }
  };

  const selectKey = (pitch, oct) => {
     if (pitch !== selectedDronePitch) setSelectedDronePitch(pitch);
     if (oct !== selectedDroneOctave) setSelectedDroneOctave(oct);
     
     if (pitch !== selectedDronePitch || oct !== selectedDroneOctave) {
         loadAndPlaySound(pitch, oct, null);
     }

     if (keyboardRef.current && typeof keyboardRef.current.scrollTo === 'function') {
         const offset = oct === 'Low' ? 0 : oct === 'Middle' ? 308 : 616;
         keyboardRef.current.scrollTo({ x: offset, y: 0, animated: true });
     }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      droneSound?.pauseAsync();
      setIsPlaying(false);
    } else {
      if (!droneSound) {
        try {
          const asset = droneAssets[selectedDroneOctave][selectedDronePitch];
          const { sound: newSound } = await Audio.Sound.createAsync(
            asset,
            { volume: 1.0, isLooping: true }
          );
          setDroneSound(newSound);
          await newSound.playAsync();
          setIsPlaying(true);
        } catch (err) { console.error("Tanpura load error", err); }
      } else {
        await droneSound.playAsync();
        setIsPlaying(true);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#0F2027', '#203A43', '#2C5364']} style={StyleSheet.absoluteFill} />
      
      <Animated.ScrollView 
         contentContainerStyle={styles.container}
         style={{ opacity: mountAnim, transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }}
      >
        <View style={styles.header}>
           <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
               <Text style={styles.title}>Riyaaz Studio</Text>
               <TouchableOpacity 
                   style={styles.langToggle} 
                   onPress={() => setLanguage(lang => lang === "EN" ? "HI" : "EN")}
                   activeOpacity={0.7}
               >
                   <Ionicons name="language" size={16} color="#00E5FF" />
                   <Text style={styles.langText}>{language}</Text>
               </TouchableOpacity>
           </View>
           <Text style={styles.subtitle}>Premium Jivari Acoustic Environment</Text>
        </View>

        {/* The Pulsing Orb Interface */}
        <View style={styles.orbWrapper}>
           <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim3 }], opacity: isPlaying ? 0.1 : 0 }]} />
           <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim2 }], opacity: isPlaying ? 0.2 : 0 }]} />
           <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim1 }], opacity: isPlaying ? 0.4 : 0, borderColor: 'rgba(0, 229, 255, 0.4)', borderWidth: 2 }]} />
           
           <TouchableOpacity 
             style={styles.playButton} 
             onPress={togglePlayback}
             activeOpacity={0.8}
           >
              <View style={[styles.playButtonInner, { backgroundColor: isPlaying ? '#1E293B' : '#1A2235' }]}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={48} color={isPlaying ? "white" : "#00E5FF"} style={{marginLeft: isPlaying ? 0 : 6}} />
              </View>
           </TouchableOpacity>
        </View>
        <Text style={styles.orbText}>{isPlaying ? `Resonating: ${selectedDronePitch} ${selectedDroneOctave}` : "Tap to Intiate Resonance"}</Text>

        {/* Dynamic Display Box */}
        <View style={styles.displayBox}>
           <Text style={[styles.displayClassical, language === "HI" && {fontSize: 34, fontWeight: 'bold'}]}>
               {language === "EN" ? classicalMappingEn[selectedDronePitch] : classicalMappingHi[selectedDronePitch]}
           </Text>
           <Text style={styles.displayWestern}>Root Note: {selectedDronePitch}</Text>
        </View>

        {/* 36-File UI Hub: Dual Notation Selectors */}
        <View style={styles.glassPanel}>
            <View style={styles.panelHeader}>
                <MaterialCommunityIcons name="music-clef-treble" size={24} color="#00E5FF" />
                <Text style={styles.panelTitle}>Pitch Synthesizer</Text>
            </View>

            <ScrollView 
               ref={keyboardRef}
               horizontal 
               showsHorizontalScrollIndicator={false}
               bounces={false}
               snapToInterval={308}
               decelerationRate="fast"
               contentContainerStyle={styles.pianoScrollBase}
            >
               {['Low', 'Middle', 'High'].map((octaveIter, octIdx) => (
                   <View key={octaveIter} style={styles.octaveBlock}>
                       {/* White Keys */}
                       {["C", "D", "E", "F", "G", "A", "B"].map((pitch) => {
                          const isActive = selectedDronePitch === pitch && selectedDroneOctave === octaveIter;
                          return (
                              <AnimatedScaleButton 
                                  key={`${octaveIter}-${pitch}`} 
                                  style={styles.whiteKey}
                                  activeStyle={styles.whiteKeyActive}
                                  isActive={isActive}
                                  onPress={() => selectKey(pitch, octaveIter)}
                              >
                                 <Text style={[styles.whiteKeyText, isActive && {color: '#FFF'}]}>{pitch}</Text>
                              </AnimatedScaleButton>
                          );
                       })}
                       
                       {/* Black Keys */}
                       {[
                          { pitch: "C#", left: 28 }, 
                          { pitch: "D#", left: 72 }, 
                          { pitch: "F#", left: 160 }, 
                          { pitch: "G#", left: 204 }, 
                          { pitch: "A#", left: 248 }
                       ].map((keyParams) => {
                          const isActive = selectedDronePitch === keyParams.pitch && selectedDroneOctave === octaveIter;
                          return (
                              <AnimatedScaleButton 
                                  key={`${octaveIter}-${keyParams.pitch}`} 
                                  style={[styles.blackKey, { left: keyParams.left }]}
                                  activeStyle={styles.blackKeyActive}
                                  isActive={isActive}
                                  onPress={() => selectKey(keyParams.pitch, octaveIter)}
                              >
                                 <Text style={styles.blackKeyText}>{keyParams.pitch}</Text>
                              </AnimatedScaleButton>
                          );
                       })}
                   </View>
               ))}
            </ScrollView>

            <View style={styles.octaveRow}>
                {['Low', 'Middle', 'High'].map(octave => {
                const isActive = selectedDroneOctave === octave;
                
                let label = '';
                if (language === 'HI') {
                    label = octave === 'Low' ? 'मन्द्र\n(Low)' : octave === 'Middle' ? 'मध्य\n(Mid)' : 'तार\n(High)';
                } else {
                    label = octave === 'Low' ? 'Mandra\n(Low)' : octave === 'Middle' ? 'Madhya\n(Mid)' : 'Taar\n(High)';
                }

                return (
                    <AnimatedScaleButton 
                        key={octave} 
                        style={styles.octaveBtn}
                        activeStyle={styles.octaveBtnActive}
                        isActive={isActive}
                        onPress={() => selectKey(selectedDronePitch, octave)}
                    >
                    <Text style={[styles.octaveText, isActive && styles.octaveTextActive]}>
                        {label}
                    </Text>
                    </AnimatedScaleButton>
                );
                })}
            </View>
        </View>

        <View style={{height: 100}} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20, width: '100%' },
  langToggle: { marginLeft: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#00E5FF' },
  langText: { color: '#00E5FF', fontSize: 12, fontWeight: '800', marginLeft: 4 },
  title: { fontSize: 36, fontWeight: '900', color: '#00E5FF', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 5, letterSpacing: 0.5 },
  
  orbWrapper: {
    height: 240, width: 240,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: '#00E5FF',
  },
  playButton: {
    width: 140, height: 140,
    borderRadius: 70,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20,
    elevation: 15,
  },
  playButtonInner: {
    width: '100%', height: '100%',
    borderRadius: 70,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#00E5FF',
  },
  orbText: {
    color: '#94A3B8', fontSize: 16, fontWeight: '600', marginBottom: 40, letterSpacing: 0.5
  },

  displayBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1, borderColor: '#00E5FF',
    borderRadius: 16,
    paddingVertical: 15, paddingHorizontal: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 25,
    shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {height: 0, width: 0}
  },
  displayClassical: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  displayWestern: { color: '#00E5FF', fontSize: 14, fontWeight: '700', marginTop: 4 },

  glassPanel: {
    width: width - 40,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  panelTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginLeft: 10, letterSpacing: 0.5 },
  
  pianoScrollBase: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
  },
  octaveBlock: {
    width: 308, height: 160,
    flexDirection: 'row',
    position: 'relative',
  },
  whiteKey: {
    width: 44, height: 160,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#334155',
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 15,
  },
  whiteKeyActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF', shadowColor: '#00E5FF', shadowOpacity: 0.8, shadowRadius: 10, zIndex: 0 },
  whiteKeyText: { color: '#334155', fontSize: 16, fontWeight: '800' },
  
  blackKey: {
    position: 'absolute',
    width: 32, height: 105,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: '#1E293B',
    zIndex: 10,
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 6,
  },
  blackKeyActive: { backgroundColor: '#FF3366', borderColor: '#FF3366', shadowColor: '#FF3366', shadowOpacity: 0.8, shadowRadius: 10 },
  blackKeyText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  octaveRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  octaveBtn: {
    flex: 1, marginHorizontal: 6,
    paddingVertical: 18, borderRadius: 16,
    minHeight: 75,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  octaveBtnActive: { backgroundColor: 'rgba(228, 143, 69, 0.2)', borderColor: '#E48F45' },
  octaveText: { color: '#94A3B8', fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  octaveTextActive: { color: '#E48F45' }
});
