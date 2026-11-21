import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions, ImageBackground 
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Animated, { 
  useSharedValue, useAnimatedStyle, withTiming, 
  withRepeat, withSequence, Easing, FadeIn, SlideInRight
} from 'react-native-reanimated';

// EXPO HOST FIX
import Constants from 'expo-constants';
const manifestHost = Constants.expoConfig?.hostUri || 'localhost';
const isAndroidEmulator = Platform.OS === 'android' && manifestHost.includes('localhost');
const host = isAndroidEmulator ? '10.0.2.2' : manifestHost.split(':')[0];
const apiBase = `http://${host}:8000`;

const { width, height } = Dimensions.get('window');

// ── Cinematic Colors ──────────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const CARD_BG = 'rgba(20, 5, 10, 0.75)';
const CARD_BORDER = 'rgba(212, 175, 55, 0.4)';

export default function AuthScreen() {
  const router = useRouter();

  // State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'SIGNUP' | 'LOGIN'>('EMAIL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [pluckSound, setPluckSound] = useState<Audio.Sound | null>(null);

  // Animations
  const glowOpacity = useSharedValue(0.4);
  const micScale = useSharedValue(1);
  const floatOffsetY1 = useSharedValue(0);
  const floatOffsetY2 = useSharedValue(0);
  const floatOffsetY3 = useSharedValue(0);

  useEffect(() => {
    // 1. Setup Audio
    async function initAudio() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/guitar_pluck.wav')
        );
        setPluckSound(sound);
      } catch (e) {
        console.log("Could not load strum audio", e);
      }
    }
    initAudio();

    // 2. Start Background Animations
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
    micScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );

    // Subtle floating swaras
    floatOffsetY1.value = withRepeat(withSequence(withTiming(-20, { duration: 4000 }), withTiming(0, { duration: 4000 })), -1, true);
    floatOffsetY2.value = withRepeat(withSequence(withTiming(-25, { duration: 5500 }), withTiming(0, { duration: 5500 })), -1, true);
    floatOffsetY3.value = withRepeat(withSequence(withTiming(-15, { duration: 3500 }), withTiming(0, { duration: 3500 })), -1, true);

    return () => {
      if (pluckSound) pluckSound.unloadAsync();
    };
  }, []);

  const handleKeyPress = async () => {
    try {
      if (pluckSound) {
        await pluckSound.stopAsync();
        await pluckSound.setPositionAsync(0);
        // Play with slight volume randomness for organic feel
        await pluckSound.setVolumeAsync(0.6 + Math.random() * 0.4);
        await pluckSound.playAsync();
      }
    } catch (_) {}
  };

  const handleEmailChange = (t: string) => { handleKeyPress(); setEmail(t); setError(''); setSuccessMsg(''); };
  const handleOtpChange = (t: string) => { handleKeyPress(); setOtp(t); setError(''); };
  const handleNameChange = (t: string) => { handleKeyPress(); setUsername(t); setError(''); };
  const handlePasswordChange = (t: string) => { handleKeyPress(); setPassword(t); setError(''); };
  const handleConfirmChange = (t: string) => { handleKeyPress(); setConfirmPassword(t); setError(''); };

  const requestOTP = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid resonant email address.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/send_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });
      const data = await response.json();
      
      if (!response.ok) {
        let msg = 'Could not send OTP';
        if (typeof data.detail === 'string') msg = data.detail;
        else if (data.detail) msg = JSON.stringify(data.detail);
        throw new Error(msg);
      }
      
      setIsRegistered(!!data.is_registered);
      if (data.is_registered) {
        setSuccessMsg('This sanctuary is already registered. Please login with your password below.');
        setStep('EMAIL');
      } else {
        setStep('OTP');
      }
    } catch (err: any) {
      setError(err.message || 'Network dissonance detected. Cannot reach servers.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length < 5) {
      setError('Incomplete sequence. Enter the code.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/verify_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), otp: otp.trim() })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'The Shruti did not match. Invalid code.');

      if (data.is_new_user) {
        setStep('SIGNUP');
      } else {
        await AsyncStorage.setItem('userToken', data.access_token);
        await AsyncStorage.setItem('justLoggedIn', 'true');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password || !confirmPassword) {
      setError('Please fill all vibrations.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not harmonize.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username, 
          password: password, 
          email: email.toLowerCase() 
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Registration failed.');

      // Success: Reset and redirect to Login step
      setStep('EMAIL');
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setSuccessMsg('Account created! Please log in with your new password.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please provide your credentials.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Use standard OAuth2 form encoding for the /login endpoint
      const formData = new URLSearchParams();
      formData.append('username', email.toLowerCase());
      formData.append('password', password);

      const response = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'The credentials do not resonate.');

      await AsyncStorage.setItem('userToken', data.access_token);
      await AsyncStorage.setItem('justLoggedIn', 'true');
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Animated Styles
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: micScale.value }]
  }));
  const swara1 = useAnimatedStyle(() => ({ transform: [{ translateY: floatOffsetY1.value }] }));
  const swara2 = useAnimatedStyle(() => ({ transform: [{ translateY: floatOffsetY2.value }] }));
  const swara3 = useAnimatedStyle(() => ({ transform: [{ translateY: floatOffsetY3.value }] }));

  return (
    <View style={styles.container}>
      <ImageBackground source={require('../assets/images/auth_bg.png')} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient colors={['rgba(20,0,5,0.6)', 'rgba(40,5,5,0.7)', 'rgba(10,0,0,0.95)']} style={StyleSheet.absoluteFill} />

        {/* Floating Sargam Notes */}
        <Animated.Text style={[styles.floatingSwara, { left: width*0.15, top: height*0.18 }, swara1]}>सा</Animated.Text>
        <Animated.Text style={[styles.floatingSwara, { right: width*0.2, top: height*0.4 }, swara2]}>रे</Animated.Text>
        <Animated.Text style={[styles.floatingSwara, { left: width*0.25, bottom: height*0.2 }, swara3]}>ग</Animated.Text>

        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Glowing Microphone Header */}
          <View style={styles.headerArea}>
            <Animated.View style={[styles.micGlow, glowStyle]} />
            <LinearGradient colors={['#78350F', '#451A03']} style={styles.micCircle}>
              <FontAwesome5 name="microphone-alt" size={32} color={GOLD} />
            </LinearGradient>
            <Text style={styles.appTitle}>Swar Bodh</Text>
            <Text style={styles.appSubtitle}>THE VOCAL MASTERY SUITE</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.cardWrapper}>
            {step === 'EMAIL' ? (
              <Animated.View entering={FadeIn} key="email_step" style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="account-music" size={24} color={GOLD} />
                  <Text style={styles.cardTitle}>Enter your Sanctuary</Text>
                </View>
                
                <Text style={styles.instructions}>Enter your registered email. A pure shruti (OTP) will be sent to summon you.</Text>
                
                {successMsg ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>✓ {successMsg}</Text>
                  </View>
                ) : null}

                {isRegistered && (
                  <View style={styles.registeredWarning}>
                    <MaterialCommunityIcons name="information-outline" size={16} color={GOLD} />
                    <Text style={styles.registeredWarningText}>
                      Email already registered. 
                      <Text 
                        onPress={() => { setStep('LOGIN'); setError(''); setSuccessMsg(''); setIsRegistered(false); }} 
                        style={{ color: '#FCD34D', textDecorationLine: 'underline', fontWeight: 'bold' }}
                      > Click here to login with password</Text>
                    </Text>
                  </View>
                )}
                
                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="Email ID"
                  placeholderTextColor="#78716C"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  selectionColor={GOLD}
                />

                <TouchableOpacity style={styles.goldButton} onPress={requestOTP} disabled={loading}>
                  <LinearGradient
                    colors={['#78350F', '#92400E', '#451A03']}
                    style={styles.goldButtonGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    {loading ? <ActivityIndicator size="small" color="#FCD34D" /> : <Text style={styles.goldButtonText}>Invoke Verification</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => { setStep('LOGIN'); setError(''); setSuccessMsg(''); }} 
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Already have an account? Login with password</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : step === 'OTP' ? (
              <Animated.View entering={SlideInRight.springify()} key="otp_step" style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="key-wireless" size={24} color={GOLD} />
                  <Text style={styles.cardTitle}>Verify the Shruti</Text>
                </View>
                
                <Text style={styles.instructions}>
                  Acoustic sequence sent to: {'\n'}
                  <Text style={{ color: '#D4AF37', fontWeight: 'bold' }}>{email}</Text>
                </Text>

                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="6-Digit OTP Code"
                  placeholderTextColor="#78716C"
                  value={otp}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectionColor={GOLD}
                />

                <TouchableOpacity style={styles.goldButton} onPress={verifyOTP} disabled={loading}>
                  <LinearGradient
                    colors={['#78350F', '#92400E', '#451A03']}
                    style={styles.goldButtonGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    {loading ? <ActivityIndicator size="small" color="#FCD34D" /> : <Text style={styles.goldButtonText}>Verify & Proceed</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStep('EMAIL'); setOtp(''); setError(''); }} style={styles.backButton}>
                  <Text style={styles.backButtonText}>Wrong email? Go back</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : step === 'SIGNUP' ? (
              <Animated.View entering={SlideInRight.springify()} key="signup_step" style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="leaf" size={24} color={GOLD} />
                  <Text style={styles.cardTitle}>Create Sanctuary</Text>
                </View>
                
                <Text style={styles.instructions}>Verified: <Text style={{color: GOLD}}>{email}</Text>{"\n"}Set your master credentials.</Text>
                
                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="Full Name / Display Name"
                  placeholderTextColor="#78716C"
                  value={username}
                  onChangeText={handleNameChange}
                  selectionColor={GOLD}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Secure Password"
                  placeholderTextColor="#78716C"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  selectionColor={GOLD}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#78716C"
                  value={confirmPassword}
                  onChangeText={handleConfirmChange}
                  secureTextEntry
                  selectionColor={GOLD}
                />

                <TouchableOpacity style={styles.goldButton} onPress={handleRegister} disabled={loading}>
                  <LinearGradient
                    colors={['#78350F', '#92400E', '#451A03']}
                    style={styles.goldButtonGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    {loading ? <ActivityIndicator size="small" color="#FCD34D" /> : <Text style={styles.goldButtonText}>Finalize Account</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View entering={SlideInRight.springify()} key="login_step" style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="login" size={24} color={GOLD} />
                  <Text style={styles.cardTitle}>Return to Sanctuary</Text>
                </View>
                
                <Text style={styles.instructions}>Enter your credentials to continue your vocal mastery journey.</Text>
                
                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="Email ID"
                  placeholderTextColor="#78716C"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  selectionColor={GOLD}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#78716C"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  selectionColor={GOLD}
                />

                <TouchableOpacity style={styles.goldButton} onPress={handleLogin} disabled={loading}>
                  <LinearGradient
                    colors={['#78350F', '#92400E', '#451A03']}
                    style={styles.goldButtonGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    {loading ? <ActivityIndicator size="small" color="#FCD34D" /> : <Text style={styles.goldButtonText}>Enter Suite</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => { setStep('EMAIL'); setError(''); setSuccessMsg(''); }} 
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>Use OTP instead</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  keyboardView: { flex: 1, justifyContent: 'center' },
  
  floatingSwara: { position: 'absolute', fontSize: 42, fontWeight: '200', color: 'rgba(212,175,55,0.15)', fontStyle: 'italic' },
  
  headerArea: { alignItems: 'center', marginBottom: 40 },
  micCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD, elevation: 15 },
  micGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(212,175,55,0.15)', top: -30 },
  appTitle: { fontSize: 36, fontWeight: '900', color: '#FEF3C7', marginTop: 16, letterSpacing: 1 },
  appSubtitle: { fontSize: 11, fontWeight: '900', color: '#B8860B', letterSpacing: 6, marginTop: 4 },

  cardWrapper: { paddingHorizontal: 24 },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: CARD_BORDER,
    borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#FEF3C7', marginLeft: 10 },
  instructions: { color: '#A8A29E', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  
  input: {
    width: '100%', backgroundColor: 'rgba(10,0,5,0.6)', color: '#FEF3C7',
    borderRadius: 16, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(184,134,11,0.3)',
    fontSize: 16, fontWeight: '600', letterSpacing: 1
  },
  
  goldButton: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: GOLD, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, marginBottom: 12 },
  goldButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  goldButtonText: { color: '#FEF3C7', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  backButton: { padding: 10, alignItems: 'center', marginTop: 4 },
  backButtonText: { color: '#A8A29E', fontSize: 12, textDecorationLine: 'underline' },
  
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: 'bold', marginBottom: 12, backgroundColor: 'rgba(153,27,27,0.3)', padding: 10, borderRadius: 8, overflow: 'hidden' },

  successBox: { backgroundColor: 'rgba(20, 83, 45, 0.4)', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#22C55E' },
  successText: { color: '#86EFAC', fontSize: 13, fontWeight: '700', textAlign: 'center' },

  secondaryButton: { padding: 12, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: GOLD, fontSize: 13, fontWeight: '600' },

  registeredWarning: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(184, 134, 11, 0.15)', 
    padding: 12, borderRadius: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: GOLD 
  },
  registeredWarningText: { color: GOLD, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 }
});
