import numpy as np
import scipy.io.wavfile as wavfile
import os

def generate_drone_loud(duration=4.0, sample_rate=44100, base_freq=138.59):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Increase the amplitudes of lower harmonics slightly to make it louder and thicker
    freqs = [base_freq, base_freq * 1.5, base_freq * 2, base_freq * 2.5, base_freq * 3, base_freq * 4]
    amplitudes = [1.0, 0.8, 0.5, 0.3, 0.2, 0.1]
    
    wave = np.zeros_like(t)
    for f, a in zip(freqs, amplitudes):
        wave += a * np.sin(2 * np.pi * f * t)
        wave += a * 0.7 * np.sin(2 * np.pi * (f + 0.5) * t)
        
    fade_len = int(sample_rate * 0.05)
    envelope = np.ones_like(wave)
    if fade_len > 0:
        envelope[:fade_len] = np.linspace(0, 1, fade_len)
        envelope[-fade_len:] = np.linspace(1, 0, fade_len)
    
    wave = wave * envelope
    
    # Normalize aggressively to 0dBFS (Max possible volume for 16-bit PCM)
    wave = wave / np.max(np.abs(wave))
    # Add mild soft-clipping/compression to increase perceived loudness
    wave = np.tanh(wave * 1.5) 
    wave = wave / np.max(np.abs(wave)) # re-normalize
    
    wave_int16 = np.int16(wave * 32767)
    
    out_path = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds\tanpura_drone.wav'
    wavfile.write(out_path, sample_rate, wave_int16)
    print("Created louder drone at:", out_path)

if __name__ == '__main__':
    generate_drone_loud()
