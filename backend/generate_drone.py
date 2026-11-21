import numpy as np
import scipy.io.wavfile as wavfile
import os

def generate_drone(duration=4.0, sample_rate=44100, base_freq=138.59): # 138.59 Hz = C#3
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Generate harmonics for rich "twangy" drone sound
    # Root, octave, fifth, double octave, major third of double octave
    freqs = [base_freq, base_freq * 1.5, base_freq * 2, base_freq * 2.5, base_freq * 3, base_freq * 4]
    amplitudes = [1.0, 0.6, 0.4, 0.2, 0.1, 0.05]
    
    wave = np.zeros_like(t)
    for f, a in zip(freqs, amplitudes):
        # Slightly detuned oscillators for chorus effect
        wave += a * np.sin(2 * np.pi * f * t)
        wave += a * 0.5 * np.sin(2 * np.pi * (f + 0.5) * t)
        
    # Envelope to make it loop smoothly
    fade_len = int(sample_rate * 0.1) # 100ms fade
    envelope = np.ones_like(wave)
    envelope[:fade_len] = np.linspace(0, 1, fade_len)
    envelope[-fade_len:] = np.linspace(1, 0, fade_len)
    
    wave = wave * envelope
    
    # Normalize to 16-bit PCM
    wave = np.int16(wave / np.max(np.abs(wave)) * 32767)
    
    # Create directory if it doesn't exist
    os.makedirs(r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds', exist_ok=True)
    out_path = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds\tanpura_drone.wav'
    wavfile.write(out_path, sample_rate, wave)
    print(f"Generated synthetic drone at {out_path}")

if __name__ == '__main__':
    generate_drone()
