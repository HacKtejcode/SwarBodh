import parselmouth
from parselmouth.praat import call
import numpy as np
import tempfile
import os
import re
import librosa
import struct

def add_wav_header(raw_data, sample_rate=16000):
    """
    Wraps raw 16-bit PCM data in a standard 44-byte WAV header.
    """
    n_channels = 1
    sample_width = 2 # 16-bit
    data_size = len(raw_data)
    
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,
        1, # PCM
        n_channels,
        sample_rate,
        sample_rate * n_channels * sample_width,
        n_channels * sample_width,
        sample_width * 8,
        b'data',
        data_size
    )
    return header + raw_data


def get_song_suggestions(note: str):
    match = re.search(r'([A-G]#?)(\d)', note)
    if not match:
        return ["Someone Like You - Adele", "Hallelujah - Leonard Cohen"]
    note_letter, octave = match.groups()
    octave = int(octave)
    
    if octave < 3: # Bass/Baritone
        return [
            "Your Man - Josh Turner",
            "Ring of Fire - Johnny Cash",
            "Fly Me to the Moon - Frank Sinatra"
        ]
    elif octave == 3: # Tenor/Alto
        return [
            "Take Me to Church - Hozier",
            "Someone Like You - Adele",
            "Ain't No Sunshine - Bill Withers"
        ]
    elif octave == 4: # Mezzo/Soprano
        return [
            "Rolling in the Deep - Adele",
            "Valerie - Amy Winehouse",
            "Bohemian Rhapsody - Queen"
        ]
    else: # High Soprano
        return [
            "Emotions - Mariah Carey",
            "Chandelier - Sia",
            "Defying Gravity - Idina Menzel"
        ]

# Categorized multi-language recommendations
SONG_DATABASE = {
    "Low": { # Bass/Baritone / Alto
        "English": [
            {"title": "Your Man", "artist": "Josh Turner", "reason": "Deep resonance matches your low range."},
            {"title": "Ring of Fire", "artist": "Johnny Cash", "reason": "Steady low-frequency focus."},
            {"title": "Fly Me to the Moon", "artist": "Frank Sinatra", "reason": "Smooth baritone velvet textures."}
        ],
        "Hindi": [
            {"title": "Gulabi Aankhen", "artist": "Kishore Kumar", "reason": "Classic baritone energy."},
            {"title": "Pee Loon", "artist": "Mohit Chauhan", "reason": "Vocal depth and texture matches."},
            {"title": "Tum Se Hi", "artist": "Mohit Chauhan", "reason": "Airy but deep vocal warmth."}
        ],
        "Marathi": [
            {"title": "Dehachi Tijori", "artist": "Sudhir Phadke", "reason": "Devotional baritone focus."},
            {"title": "Dhundi Kalyana", "artist": "Sudhir Phadke", "reason": "Classic Marathi vocal texture."},
            {"title": "Rubaru", "artist": "Ajay-Atul", "reason": "Soulful depth in the lower register."}
        ]
    },
    "Middle": { # Tenor / Mezzo
        "English": [
            {"title": "Perfect", "artist": "Ed Sheeran", "reason": "Stable mid-range tenor melismas."},
            {"title": "Someone Like You", "artist": "Adele", "reason": "Dynamics control in the mid-high range."},
            {"title": "Ain't No Sunshine", "artist": "Bill Withers", "reason": "Mid-range soul and grit."}
        ],
        "Hindi": [
            {"title": "Tum Hi Ho", "artist": "Arijit Singh", "reason": "Modern tenor emotional mapping."},
            {"title": "Kesariya", "artist": "Arijit Singh", "reason": "High-mid register brightness."},
            {"title": "Lag Jaa Gale", "artist": "Lata Mangeshkar", "reason": "Timeless mid-range melody."}
        ],
        "Marathi": [
            {"title": "Mauli Mauli", "artist": "Ajay Gogavale", "reason": "Vibrant mid-range power singing."},
            {"title": "Khel Mandala", "artist": "Ajay Atul", "reason": "Dynamic range in the middle octave."},
            {"title": "Sairat Zaala Ji", "artist": "Ajay-Atul", "reason": "Romantic mid-range stability."}
        ]
    },
    "High": { # Soprano / Countertenor
        "English": [
            {"title": "Rolling in the Deep", "artist": "Adele", "reason": "Powerful belt and high-range control."},
            {"title": "Chandelier", "artist": "Sia", "reason": "High-octave belts and agility."},
            {"title": "Bohemian Rhapsody", "artist": "Queen", "reason": "Operatic high-range versatility."}
        ],
        "Hindi": [
            {"title": "Zaalima", "artist": "Arijit Singh", "reason": "High-range softness and falsetto."},
            {"title": "Mohe Rang Do Laal", "artist": "Shreya Ghoshal", "reason": "Classical high-range agility."},
            {"title": "Sun Saathiya", "artist": "Priya Saraiya", "reason": "Bright and airy high registers."}
        ],
        "Marathi": [
            {"title": "Apsara Aali", "artist": "Bela Shende", "reason": "High-range classical grace."},
            {"title": "Wajle Ki Bara", "artist": "Bela Shende", "reason": "High agility and rhythmic control."},
            {"title": "Mala Ved Lagale", "artist": "Adarsh Shinde", "reason": "High-energy power vocals."}
        ]
    }
}

def analyze_vocal_guru(file_bytes: bytes, filename: str):
    """
    Detailed AI Guru analysis for full-song recordings.
    Focuses on 'Swaras' (Pitch) and 'Dynamics' (Volume).
    """
    ext = os.path.splitext(filename)[1] or ".wav"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    
    try:
        # If it's a raw IoT chunk, it won't have a header. Wrap it!
        if filename == "iot_chunk.wav":
            processed_bytes = add_wav_header(file_bytes)
        else:
            processed_bytes = file_bytes
            
        temp_file.write(processed_bytes)
        temp_file.close()
        
        snd = parselmouth.Sound(temp_file.name)
        pitch = snd.to_pitch()
        intensity = snd.to_intensity()
        
        # Pitch (Swara) Analysis
        pitch_values = pitch.selected_array['frequency']
        voiced_pitches = pitch_values[pitch_values > 0]
        
        # Dynamics (Volume) Analysis
        intensity_values = intensity.values[0]
        
        if len(voiced_pitches) < 50:
            return {"error": "Recording too short for analysis. Please sing for at least 5-10 seconds."}

        mean_pitch = np.mean(voiced_pitches)
        pitch_stability = 100 - (np.std(voiced_pitches) / mean_pitch * 100) # Stability score
        
        # Categorize Voice Category
        voice_cat = "Middle"
        if mean_pitch < 165: voice_cat = "Low"
        elif mean_pitch > 260: voice_cat = "High"
        
        # Dynamics Stability (Volume control)
        # We calculate the standard deviation of intensity. High SD = Low stability.
        dynamics_stability = 100 - (np.std(intensity_values))
        
        # Extract Jitter/Shimmer for basic quality
        pointProcess = call(snd, "To PointProcess (periodic, cc)", 75, 500)
        jitter = call(pointProcess, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer = call([snd, pointProcess], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        
        recommendations = SONG_DATABASE.get(voice_cat, SONG_DATABASE["Middle"])
        
        return {
            "voice_profile": {
                "category": voice_cat,
                "mean_pitch_hz": round(mean_pitch, 2),
                "swara_stability": round(max(0, min(100, pitch_stability)), 1),
                "dynamics_score": round(max(0, min(100, dynamics_stability)), 1),
                "jitter": round(jitter, 2),
                "shimmer": round(shimmer, 2)
            },
            "recommendations": recommendations,
            "analysis_report": (
                f"You have a natural {voice_cat} vocal register. "
                f"Your Swaras (pitch) are {round(pitch_stability, 1)}% stable. "
                f"Your Dynamics (volume control) scored {round(dynamics_stability, 1)}/100."
            )
        }
        
    finally:
        os.unlink(temp_file.name)

def analyze_audio(file_bytes: bytes, filename: str):
    # Old function kept for backward compatibility (Strain Detection)
    # ... same logic as before ...
    ext = os.path.splitext(filename)[1] or ".wav"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        temp_file.write(file_bytes)
        temp_file.close()
        snd = parselmouth.Sound(temp_file.name)
        pitch = snd.to_pitch()
        pointProcess = call(snd, "To PointProcess (periodic, cc)", 75, 500)
        jitter = call(pointProcess, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer = call([snd, pointProcess], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = call(harmonicity, "Get mean", 0, 0)
        voiced_pitches = pitch.selected_array['frequency'][pitch.selected_array['frequency'] > 0]
        mean_pitch = np.mean(voiced_pitches) if len(voiced_pitches) > 0 else 0
        is_strained = jitter > 1.04 or shimmer > 3.81
        return {
            "is_strained": is_strained,
            "metrics": {"jitter_percent": round(jitter, 2), "shimmer_percent": round(shimmer, 2), "hnr_db": round(hnr, 2)},
            "recommendation": "Rest your voice." if is_strained else "Vocal health looks good!"
        }
    finally:
        os.unlink(temp_file.name)

def detect_scale_from_audio(file_bytes: bytes, filename: str):
    ext = os.path.splitext(filename)[1] or ".wav"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        temp_file.write(file_bytes)
        temp_file.close()

        # Load audio with librosa
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            y, sr = librosa.load(temp_file.name, sr=22050)

        # Compute chromagram and sum energy across time
        chromagram = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_vals = np.sum(chromagram, axis=1)

        # Krumhansl-Schmuckler profiles
        maj_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        min_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

        best_corr = -1
        best_key = ""
        best_note = ""

        # Test correlation against all 12 shifts
        for i in range(12):
            shifted_maj = np.roll(maj_profile, i)
            shifted_min = np.roll(min_profile, i)

            corr_maj = np.corrcoef(chroma_vals, shifted_maj)[0, 1]
            corr_min = np.corrcoef(chroma_vals, shifted_min)[0, 1]

            if corr_maj > best_corr:
                best_corr = corr_maj
                best_key = f"{keys[i]} Major"
                best_note = keys[i]

            if corr_min > best_corr:
                best_corr = corr_min
                best_key = f"{keys[i]} Minor"
                best_note = keys[i]

        return {
            "scale": best_key,
            "note": best_note,
            "confidence": round(float(best_corr) * 100, 2)
        }
    finally:
        os.unlink(temp_file.name)

