import numpy as np
import scipy.io.wavfile as wavfile
import os
import math
import svarascala

def generate_sweet_pluck(duration, sample_rate, freq, decay=0.6):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    wave = np.zeros_like(t)
    
    # Simulate an acoustic Tanpura using 24 harmonics, Jivari string dispersion, and formant valleys
    for harmonic in range(1, 25):
        h_freq = freq * harmonic
        
        # Formant amplitude shaping
        if harmonic == 1:
            amp = 1.0
        elif harmonic == 2:
            amp = 0.8
        elif harmonic == 3:
            amp = 0.7 
        elif harmonic in [4, 5]:
            amp = 0.4
        else:
            # High-end string buzz (Jivari cascade)
            amp = 0.6 / np.sqrt(harmonic)
            
        # Inharmonicity (Real strings are slightly sharper at higher partials)
        inharmonicity = 1.0 + (0.00005 * (harmonic ** 2))
        h_freq = h_freq * inharmonicity
        
        # Higher frequencies decay faster
        decay_rate = decay * (1.0 + (harmonic * 0.1))
        
        # Jivari bloom/swell - attack is not instant
        attack_time = max(0.02, 0.35 / math.sqrt(harmonic)) 
        attack_env = 1.0 - np.exp(-t / attack_time)
        
        phase = np.random.uniform(0, 2 * np.pi) 
        wave += amp * attack_env * np.sin(2 * np.pi * h_freq * t + phase) * np.exp(-t * decay_rate)

    # Master Jivari slight volume modulation (Beating)
    wobble = 1.0 + 0.15 * np.sin(2 * np.pi * 2.2 * t)
    wave = wave * wobble
    
    return wave

def generate_tanpura_loop(filename, base_freq_hz, tuning='Pa', sample_rate=44100):
    # Instantiate SvaraScala for exact Indian Shruti computations
    im = svarascala.IndianMusic(reference_sa=base_freq_hz)
    
    # A slower, sweeter 8-second cycle (2 seconds per pluck)
    beat_duration = 2.0 
    cycle_duration = beat_duration * 4 
    
    total_samples = int(cycle_duration * sample_rate)
    mix = np.zeros(total_samples + int(sample_rate * 6)) # Extra 6s for tail
    
    sa_root_freq = im.get_swara_frequency("Sa")
    sa_oct_freq = sa_root_freq * 2.0  # Top Sa
    
    # Determine the first string based on the tuning style
    if tuning == 'Pa':
        first_string = im.get_swara_frequency("Pa") # Default Pancham tuning
    elif tuning == 'Ma':
        first_string = im.get_swara_frequency("Ma", "shuddha") # Madhyam tuning (e.g. Malkauns)
    else:
        first_string = im.get_swara_frequency("Ni", "shuddha") # Nishad tuning

    # Traditional 4-string pluck sequence: First String, Upper Sa, Upper Sa, Root Sa
    pluck_seq = [
        (0.0, first_string),
        (2.0, sa_oct_freq),
        (4.0, sa_oct_freq),
        (6.0, sa_root_freq)
    ]
    
    for start_time, freq in pluck_seq:
        start_idx = int(start_time * sample_rate)
        # Ring out 6 seconds with slower decay (0.45) so the body stays naturally louder
        pluck_wave = generate_sweet_pluck(6.0, sample_rate, freq, decay=0.45)
        end_idx = start_idx + len(pluck_wave)
        mix[start_idx:end_idx] += pluck_wave
        
    # Perfect tail wrapping for seamless looping
    loop_audio = mix[:total_samples].copy()
    tail = mix[total_samples:]
    loop_audio[:len(tail)] += tail
    
    # Hard Limiting: Multiplies linear volume heavily and clips only the absolute peak transients
    # This prevents the muddy full-wave distortion that `tanh` caused, keeping the body pure and loud.
    max_val = np.max(np.abs(loop_audio))
    loop_audio = loop_audio / max_val
    loop_audio = np.clip(loop_audio * 2.4, -1.0, 1.0)
    loop_audio = loop_audio * 0.99 
    
    wave_int16 = np.int16(loop_audio * 32767)
    
    out_dir = r'c:\DES\IOT\VoiceStrainDetector\mobile-app\assets\sounds'
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, filename)
    wavfile.write(out_path, sample_rate, wave_int16)
    print(f"Created SvaraScala Authentic Loop {filename} at {base_freq_hz}Hz (Tuning: {tuning})")

if __name__ == '__main__':
    # Generating the full 36-key multi-octave chromatic drone bank (Standard Pa tuning)
    # A4 = 440 => C3 = 130.8128
    base_freq_c3 = 130.8128
    notes = ["C", "C_sharp", "D", "D_sharp", "E", "F", "F_sharp", "G", "G_sharp", "A", "A_sharp", "B"]
    
    octaves = {
        "Low": 0.5,     # Octave 2
        "Middle": 1.0,  # Octave 3
        "High": 2.0     # Octave 4
    }
    
    for octave_name, multiplier in octaves.items():
        for i, note_name in enumerate(notes):
            freq = base_freq_c3 * (2.0 ** (i / 12.0)) * multiplier
            filename = f'tanpura_{note_name}_{octave_name}_pa.wav'
            generate_tanpura_loop(filename, freq, tuning='Pa')
