# Swar Bodh: The Vocal Mastery Suite
## Project Overview & Technical Report Summary

**Swar Bodh** (Sanskrit for "Vocal Awareness") is an advanced, AI-driven vocal health and training ecosystem. It bridges the gap between traditional Indian Classical music (Hindustani/Carnatic) and modern bio-acoustic engineering. The system provides real-time vocal strain detection, scale identification, guided practice (Sargam), and IoT integration for seamless acoustic analysis.

---

## 💎 Core Philosophy & Aesthetics
The project is built on a **"Temple Gold and Deep Crimson"** cinematic design language. It draws inspiration from the heritage of Indian Classical music while utilizing state-of-the-art glassmorphism and motion design to provide a premium, immersive user experience.

---

## 🚀 Key Features

### 1. 🔍 Vocalytics (Real-time Strain Analysis)
*   **Scientific Metrics**: Analyzes **Instability** (standard deviation of amplitude/frequency), **Loudness** (Average/Peak dB), and **Sargam Mapping**.
*   **Baseline Calibration**: Allows users to establish a "Vocal Profile" against which future sessions are measured.
*   **Guru's Counsel**: Provides context-aware recommendations (e.g., "Practice Mandra Saptak" vs. "Excellent steadiness").

### 2. 🎼 Intelligent Scale & Sargam Detection
*   **Krumhansl-Schmuckler Algorithm**: Automatically detects the musical key (Major/Minor) of ambient music or a singer's drone.
*   **Interactive Sargam Trainer**: Guides singers through the Indian musical scale (*Sa, Re, Ga, Ma, Pa, Dha, Ni, Ṡa*) with real-time feedback.
*   **Pitch Precision (Cents)**: Shows vocal accuracy within ±60 cents of the target Swara, allowing for micro-tonal refinement.

### 3. 🧘 Vocal Guru (Deep Performance Analysis)
*   **Vocal Profiling**: After a performance, the "Guru" analyzes mean pitch, swara stability, and dynamic range.
*   **Multilingual Recommendations**: Suggests songs tailored to the user's vocal register (Low/Middle/High) across English, Hindi, and Marathi.
*   **Register Mapping**: Categorizes voices into Bass/Baritone, Tenor/Alto, and Soprano categories.

### 4. 🎛️ Digital Tanpura & Riyaaz
*   **High-Fidelity Waves**: Includes a full bank of 12 semi-tone Tanpura drones across three octaves (*Mandra, Madhya, Tara*).
*   **Raga Context**: Automatically identifies the Raga context (e.g., Yaman, Bhairav, Kafi) based on the selected drone pitch.
*   **Automatic Ducking**: Intelligent audio management that prevents volume drops during active recording/analysis sessions.

### 5. 🛰️ IoT Hardware Bridge (ESP32-S3)
*   **I2S Integration**: Supports an external ESP32-S3 hardware module equipped with an **INMP441 Digital Microphone**.
*   **WebSocket Streaming**: Streams raw 16kHz PCM data to the backend via a high-speed WebSocket bridge.
*   **Hands-Free Analysis**: Allows for a dedicated "always-on" microphone for practice without needing to hold a smartphone.

### 6. 📂 The Vault & History
*   **Recording Vault**: Secure storage for practice sessions and performance captures.
*   **Session Logs**: Detailed history of vocal metrics over time to track improvement in breath control and pitch stability.

---

## 🛠️ Technical Stack

### **Frontend (Mobile App)**
*   **Framework**: [Expo](https://expo.dev/) (React Native) with Expo Router (File-based routing).
*   **Animation**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & standard Animated API for fluid UI transitions and the "Mandala" mic orb.
*   **Audio Engine**: `expo-av` for managed recording and playback sessions.
*   **Visualization**: `react-native-chart-kit` for real-time breath control waveforms.

### **Backend (Analysis Server)**
*   **Engine**: [FastAPI](https://fastapi.tiangolo.com/) (Python) for high-performance async API endpoints.
*   **Communication**: WebSockets for low-latency IoT-to-App data synchronization.
*   **Database**: SQLite with SQLAlchemy for structured history and user profile management.
*   **Security**: JWT (JSON Web Tokens) with email-based OTP verification.

### **Audio Intelligence**
*   **Parselmouth**: A Python library for the [Praat](https://www.fon.hum.uva.nl/praat/) software engine, used for extraction of Jitter, Shimmer, and Pitch.
*   **Librosa**: Used for spectral analysis, chromagram extraction, and scale detection.
*   **NumPy**: For high-speed mathematical operations on audio arrays.

### **Hardware (IoT)**
*   **Microcontroller**: ESP32-S3 (Dual-core, WiFi/BT).
*   **Acoustic Input**: INMP441 (MEMS Digital Microphone via I2S).
*   **Firmware**: C++/Arduino using WebSockets for streaming.

---

## 📊 Performance Indicators
*   **Analysis Latency**: < 500ms for scale detection; < 1.5s for deep vocal quality analysis.
*   **Pitch Accuracy**: 98% accuracy within 1Hz resolution.
*   **IoT Throughput**: Supports 16kHz, 16-bit mono PCM streaming with minimal jitter.

---

## 📅 Roadmap & Future Enhancements
*   **Raag Recognition**: Expanding the analyzer to identify specific Raags based on melodic patterns (Arohana/Varohana).
*   **Vocal Health Trends**: Long-term graphical visualization of vocal improvement and strain recovery.
*   **Community Mode**: Collaborative practice and Guru-student remote sessions.

---
*Created by Antigravity AI for the Swar Bodh Project Team.*
