import numpy as np
import scipy.io.wavfile as wavfile
import os

def generate_sweet_pluck(duration, sample_rate, freq, decay=0.8):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    wave = np.zeros_like(t)
    
    # Soft fundamental and prominent 5th (3rd harmonic) for the mystic Tanpura sound
    wave += 1.0 * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay * 0.8)
    wave += 0.5 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * decay * 1.5)
    wave += 0.6 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * decay * 1.1)
    wave += 0.2 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * decay * 2.0)
    wave += 0.15 * np.sin(2 * np.pi * freq * 5 * t) * np.exp(-t * decay * 2.5)
    
    # Subtle Jivari Modulation to give the buzz/wobble effect
    lfo = 1.0 + 0.25 * np.sin(2 * np.pi * 2.5 * t)
    wave = wave * lfo
    
    return wave

def generate_tanpura_loop(filename, base_freq_hz, sample_rate=44100):
    beat_duration = 1.5  # Fixed rhythmic tempo across ALL scales!
    cycle_duration = beat_duration * 4 
    total_samples = int(cycle_duration * sample_rate)
    mix = np.zeros(total_samples + int(sample_rate * 5))
    
    # Just intonation tuning for authentic classical Indian sound
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
        # Gentle acoustic pluck simulation
        pluck_wave = generate_sweet_pluck(5.0, sample_rate, freq, decay=0.85)
        mix[start_idx:start_idx+len(pluck_wave)] += pluck_wave
        
    loop_audio = mix[:total_samples].copy()
    tail = mix[total_samples:]
    loop_audio[:len(tail)] += tail
    
    max_val = np.max(np.abs(loop_audio))
    if max_val > 0:
        loop_audio = (loop_audio / max_val) * 0.90 # Sweet and loud, zero clipping
    
    wave_int16 = np.int16(loop_audio * 32767)
    
    out_dir = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds'
    os.makedirs(out_dir, exist_ok=True)
    wavfile.write(os.path.join(out_dir, filename), sample_rate, wave_int16)

# 136.07 Hz is C#3 tuned to A=432Hz
c_sharp_432 = 136.07

out_dir = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds'
os.makedirs(out_dir, exist_ok=True)

# Generate React Native Asset map
js_lines = ["export const TanpuraAssets = {"]

print("Generating 36 pre-rendered precision acoustic scales...")
for octave_idx, oct_mult in [(-1, 0.5), (0, 1.0), (1, 2.0)]:
    for scale_offset in range(-1, 11): # C(-1) to B(10)
        # Even temperament calculation but anchored at A=432Hz C#
        freq = (c_sharp_432 * oct_mult) * (2.0 ** (scale_offset / 12.0))
        filename = f'tanpura_{scale_offset}_{octave_idx}.wav'
        generate_tanpura_loop(filename, freq)
        
        # Add to JS map
        js_lines.append(f"  '{scale_offset}_{octave_idx}': require('../../assets/sounds/{filename}'),")

js_lines.append("};")

js_path = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\src\utils\TanpuraAssets.js'
os.makedirs(os.path.dirname(js_path), exist_ok=True)
with open(js_path, 'w') as f:
    f.write('\n'.join(js_lines))

print(f"Done! 36 files generated and {js_path} written.")
