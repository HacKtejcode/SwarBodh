import requests
import json
import numpy as np
from scipy.io import wavfile
import os

print("Generating test tone...")
sample_rate = 44100
duration = 1.0 # seconds
t = np.linspace(0, duration, int(sample_rate * duration), False)
# Generate a clean 440Hz sine wave (A4) - should have near 0 jitter/shimmer
note = np.sin(440 * 2 * np.pi * t)
# Normalize to 16-bit integer
audio = note * (2**15 - 1) / np.max(np.abs(note))
audio = audio.astype(np.int16)

wavfile.write('test_tone.wav', sample_rate, audio)

print("Testing API...")
url = "http://127.0.0.1:8000/analyze"

try:
    with open("test_tone.wav", "rb") as f:
        files = {"file": ("test_tone.wav", f, "audio/wav")}
        response = requests.post(url, files=files)
        
    print(f"Status Code: {response.status_code}")
    print("Response:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error connecting to server: {e}")
    print("Make sure the uvicorn server is running!")
finally:
    if os.path.exists('test_tone.wav'):
        os.remove('test_tone.wav')
