import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Dimensions, 
  Modal, ImageBackground 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, FadeOut, SlideInRight, SlideOutLeft 
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const GOLD = '#D4AF37';

const TOUR_STEPS = [
  {
    title: 'Vocalytics',
    desc: 'The Heart of Analysis.\nTrack your pitch stability, volume intensity, and vocal strain in real-time with cinematic data visualization.',
    icon: <FontAwesome5 name="wave-square" size={42} color={GOLD} />,
    bg: require('../assets/images/auth_bg.png'),
  },
  {
    title: 'Sargam',
    desc: 'The Foundation.\nAccess a comprehensive library of Ragas and Swara references to ground your musical journey in tradition.',
    icon: <MaterialCommunityIcons name="music-clef-treble" size={48} color={GOLD} />,
    bg: require('../assets/images/auth_bg.png'),
  },
  {
    title: 'Riyaaz',
    desc: 'Your Infinite Chamber.\nPractice with a studio-grade Tanpura drone. Pure resonant frequencies across all scales and octaves.',
    icon: <MaterialCommunityIcons name="hands-pray" size={48} color={GOLD} />,
    bg: require('../assets/images/auth_bg.png'),
  },
  {
    title: 'Guru',
    desc: 'Advanced Guided Mastery.\nAI-driven exercises tailored to your voice, pushing the boundaries of your range and accuracy.',
    icon: <MaterialCommunityIcons name="meditation" size={48} color={GOLD} />,
    bg: require('../assets/images/auth_bg.png'),
  }
];

export default function AppTour({ onFinish }: { onFinish: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const handleNext = async () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await AsyncStorage.setItem('hasSeenTour', 'true');
      setVisible(false);
      onFinish();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('hasSeenTour', 'true');
    setVisible(false);
    onFinish();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View 
          key={currentStep} 
          entering={SlideInRight.duration(500)} 
          exiting={SlideOutLeft.duration(500)}
          style={styles.container}
        >
          <ImageBackground source={TOUR_STEPS[currentStep].bg} style={styles.bg} blurRadius={10}>
            <LinearGradient 
              colors={['rgba(20,5,5,0.7)', 'rgba(80,10,10,0.85)', 'rgba(10,0,0,0.95)']} 
              style={styles.gradient}
            >
              <View style={styles.content}>
                <View style={styles.iconContainer}>
                  {TOUR_STEPS[currentStep].icon}
                </View>
                
                <Text style={styles.title}>{TOUR_STEPS[currentStep].title}</Text>
                
                <View style={styles.divider} />
                
                <Text style={styles.desc}>{TOUR_STEPS[currentStep].desc}</Text>

                <View style={styles.progressContainer}>
                  {TOUR_STEPS.map((_, i) => (
                    <View 
                      key={i} 
                      style={[styles.dot, i === currentStep && styles.activeDot]} 
                    />
                  ))}
                </View>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                  <Text style={styles.skipTxt}>Skip Sanctuary Tour</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
                  <LinearGradient
                    colors={['#78350F', '#92400E', '#451A03']}
                    style={styles.nextGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.nextTxt}>
                      {currentStep === TOUR_STEPS.length - 1 ? "Enter Practice" : "Explore Next Tab"}
                    </Text>
                    <FontAwesome5 name="long-arrow-alt-right" size={16} color="#FEF3C7" style={{marginLeft: 10}} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </ImageBackground>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  container: { flex: 1, overflow: 'hidden' },
  bg: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', padding: 30 },
  content: { alignItems: 'center', backgroundColor: 'rgba(30,10,10,0.4)', borderRadius: 40, padding: 30, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  iconContainer: { marginBottom: 30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(212,175,55,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: GOLD },
  title: { fontSize: 32, fontWeight: '900', color: '#FEF3C7', letterSpacing: 2 },
  divider: { width: 60, height: 3, backgroundColor: GOLD, marginVertical: 20, borderRadius: 1.5 },
  desc: { fontSize: 16, color: '#D6D3D1', textAlign: 'center', lineHeight: 26, fontWeight: '500' },
  progressContainer: { flexDirection: 'row', marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(212,175,55,0.2)', marginHorizontal: 6 },
  activeDot: { backgroundColor: GOLD, width: 20 },
  footer: { position: 'absolute', bottom: 50, left: 30, right: 30, alignItems: 'center' },
  skipBtn: { marginBottom: 20 },
  skipTxt: { color: '#78716C', fontSize: 13, textDecorationLine: 'underline' },
  nextBtn: { width: '100%', borderRadius: 20, overflow: 'hidden', elevation: 10, shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 10 },
  nextGradient: { paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  nextTxt: { color: '#FEF3C7', fontSize: 17, fontWeight: '900', letterSpacing: 1 }
});
