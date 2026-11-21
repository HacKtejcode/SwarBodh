import numpy as np
import scipy.io.wavfile as wavfile
import os

def generate_pluck(duration, sample_rate, freq, decay=0.8):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Additive synthesis for string with "Jivari" (rich buzzing overtones)
    harmonics = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    amplitudes = [1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01]
    
    wave = np.zeros_like(t)
    for h, a in zip(harmonics, amplitudes):
        # Slightly detune harmonics for the characteristic rich swar
        detune = 1.0 + (np.random.rand() * 0.002 - 0.001)
        # Apply exponential decay that is faster for higher harmonics
        env = np.exp(-t * decay * (1.0 + h * 0.1))
        # Formant shaping - give it a "wooden" resonance body feel
        body_resonance = 1.0 if h <= 4 else 0.5
        wave += a * env * body_resonance * np.sin(2 * np.pi * freq * h * detune * t)
        
    return wave

def generate_tanpura_loop(filename, base_freq_hz, sample_rate=44100):
    # A Tanpura cycle is typically 4 beats. 
    # Strings: Pa (5th), Sa' (Octave), Sa' (Octave), Sa (Root)
    beat_duration = 1.5 # seconds per pluck
    cycle_duration = beat_duration * 4 # 6.0 seconds total loop
    
    total_samples = int(cycle_duration * sample_rate)
    mix = np.zeros(total_samples + int(sample_rate * 5)) # Extra space for ring out
    
    # True Just Intonation for Tanpura (Pa is exactly 1.5x)
    pa_freq = base_freq_hz * 1.5
    sa_oct_freq = base_freq_hz * 2.0
    sa_root_freq = base_freq_hz
    
    pluck_seq = [
        (0.0, pa_freq),
        (1.5, sa_oct_freq),
        (3.0, sa_oct_freq),
        (4.5, sa_root_freq)
    ]
    
    for start_time, freq in pluck_seq:
        start_idx = int(start_time * sample_rate)
        # Each string rings out for ~5 seconds
        pluck_wave = generate_pluck(5.0, sample_rate, freq, decay=0.7)
        end_idx = start_idx + len(pluck_wave)
        mix[start_idx:end_idx] += pluck_wave
        
    # Make it a PERFECT loop by wrapping the "tail" back to the beginning
    loop_audio = mix[:total_samples].copy()
    tail = mix[total_samples:]
    loop_audio[:len(tail)] += tail
    
    # Normalize gently to 85% to keep it loud but very sweet/unclipped
    max_val = np.max(np.abs(loop_audio))
    loop_audio = loop_audio * (0.85 / max_val) 
    
    wave_int16 = np.int16(loop_audio * 32767)
    
    out_dir = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds'
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, filename)
    wavfile.write(out_path, sample_rate, wave_int16)
    print(f"Created Acoustic Loop {filename} at {base_freq_hz}Hz")

if __name__ == '__main__':
    generate_tanpura_loop('tanpura_c_sharp_2.wav', 69.30)  
    generate_tanpura_loop('tanpura_c_sharp_3.wav', 138.59) 
    generate_tanpura_loop('tanpura_c_sharp_4.wav', 277.18)
