# Implementation Plan: IoT Voice Strain Monitor

This document serves as the master blueprint for integrating the **7Semi ESP32-S3** and **INMP441 Microphone** into the Voice Strain Detector ecosystem.

## Hardware Components
*   **Microcontroller:** 7Semi ESP32-S3-Dev-BoardC-1-N4
*   **Microphone:** INMP441 (I2S Digital Microphone)
*   **Visual Feedback:** Built-in RGB LED (GPIO 38)
*   **Connectivity:** Wi-Fi (2.4GHz)

---

## 1. Hardware Wiring (ESP32-S3 to INMP441)

| INMP441 Pin | ESP32-S3 Pin | Description |
| :--- | :--- | :--- |
| **VDD** | **3.3V** | Power (Do NOT use 5V) |
| **GND** | **GND** | Ground |
| **L/R** | **GND** | Selects Left Channel |
| **SCK** | **GPIO 12** | I2S Serial Clock |
| **WS** | **GPIO 13** | I2S Word Select (LRCLK) |
| **SD** | **GPIO 11** | I2S Serial Data Out |

---

## 2. Firmware Logic (ESP32 C++)

### Stage A: Audio Capture
*   Configure I2S to sample at **16,000 Hz**, **16-bit depth**, **Mono**.
*   Buffer audio in chunks of ~2 seconds (32,000 samples).

### Stage B: WAV Header Creation
*   Attach a 44-byte WAV header to the captured PCM data.
*   This ensures the Python backend recognizes the file format immediately.

### Stage C: Transmission
*   Use `HTTPClient` to send a **POST** request to `http://<server-ip>:8000/analyze`.
*   Content-Type: `multipart/form-data`.

### Stage D: Feedback Control
*   Parse the JSON response: `{"is_strained": true/false}`.
*   **Green LED (GPIO 38):** Healthy voice detected.
*   **Red LED (GPIO 38):** Strain detected.

---

## 3. UI/UX Integration (Mobile App)

Since you are working on the UI now, consider adding these elements to the mobile app:

### A. Device Status Dashboard
*   **Connection Status:** Show if the IoT device is "Online" or "Offline".
*   **Live Feedback Mimic:** A small indicator in the app that mirrors the LED color on the physical device.

### B. Remote Configuration
*   **Sensitivity Toggle:** A slider to adjust the "Strain Sensitivity" threshold on the backend.
*   **Sync History:** A button to fetch the latest recordings captured by the IoT device.

### C. Aesthetic Sync
*   Ensure the IoT status indicators match the **"Temple Gold and Deep Crimson"** theme of the app for a premium feel.

---

## 4. Backend Updates

To support the IoT device effectively, we will:
1.  **Dedicated Endpoint:** (Optional) Create `/analyze/iot` with stripped-down JSON responses for faster processing.
2.  **WebSockets:** Enable real-time "Push" notifications from the server to the Mobile App whenever the IoT device detects strain.

---

## Open Questions for Future Execution
1.  **Battery vs. USB:** Will this device be plugged in continuously, or do we need to implement "Deep Sleep" to save battery?
2.  **Offline Mode:** Should the device store data locally if Wi-Fi is lost, or just skip analysis?

## Verification Plan
1.  **Hardware Test:** Use a logic analyzer or Serial Plotter to verify clean I2S signals.
2.  **API Test:** Use Postman/Curl to send a sample WAV to the server and verify the `is_strained` logic.
3.  **End-to-End:** Speak into the INMP441 and watch the S3 LED change color within < 1 second.
