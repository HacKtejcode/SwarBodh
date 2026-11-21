from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List, Dict
import jwt
import datetime
import traceback
import json

from analyzer import analyze_audio
import database as db
import os
from dotenv import load_dotenv

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Explicitly load from backend directory
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

SECRET_KEY = "supersecretkey_for_testing"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

app = FastAPI(title="Voice Strain Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- WebSocket & IoT Connection Manager ---
class ConnectionManager:
    def __init__(self):
        # Maps user_id strings to active WebSocket connections
        self.active_connections: Dict[str, WebSocket] = {}
        # Stores ongoing hardware buffers for scale detection
        self.hardware_scale_buffers: Dict[str, bytes] = {}
        self.hardware_scale_active: Dict[str, bool] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"📡 Device Connected to Bridge: {user_id}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.hardware_scale_buffers:
            del self.hardware_scale_buffers[user_id]
        if user_id in self.hardware_scale_active:
            del self.hardware_scale_active[user_id]
        print(f"🚫 Device Disconnected from Bridge: {user_id}")

    async def broadcast_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                print(f"⚠️ Error broadcasting to {user_id}: {e}")
                self.disconnect(user_id)

manager = ConnectionManager()

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class RecordData(BaseModel):
    avg_db: str
    peak_db: str
    instability: str
    pitch_hz: str
    note: str
    is_strained: bool
    indicators: list
    recommendation: str
    sargam: Optional[str] = None

class DeleteBatch(BaseModel):
    ids: List[int]

class OTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class UserRegister(BaseModel):
    username: str
    password: str
    email: str

OTP_STORE = {}
import random

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.get("/")
def read_root():
    return {"message": "Voice Strain Detector API is running"}

@app.get("/suggest_songs")
def suggest_songs(note: str):
    from analyzer import get_song_suggestions
    return {"suggestions": get_song_suggestions(note)}

@app.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    user_id = db.create_user(user.username, user.password)
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already registered")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/send_otp")
async def send_otp(req: OTPRequest):
    # Check if user already exists
    user = db.get_user_by_username(req.email.lower())
    if user:
        return {"message": "Email already registered", "is_registered": True}

    code = f"{random.randint(100000, 999999)}"
    OTP_STORE[req.email.lower()] = code
    
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    email_sent = False
    if sender_email and sender_password and sender_email != "your-gmail@gmail.com":
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = "Swar Bodh: Your Verification Code"
            message["From"] = f"Swar Bodh <{sender_email}>"
            message["To"] = req.email

            html = f"""
            <html>
              <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #080000; color: #FEF3C7; padding: 40px;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #1a0505; border: 2px solid #D4AF37; border-radius: 20px; padding: 30px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  <h1 style="color: #D4AF37; margin-bottom: 5px; font-size: 28px; letter-spacing: 2px;">SWAR BODH</h1>
                  <p style="color: #B8860B; font-size: 10px; letter-spacing: 5px; margin-top: 0; font-weight: bold; text-transform: uppercase;">The Vocal Mastery Suite</p>
                  
                  <div style="margin: 30px 0; border-top: 1px solid rgba(212, 175, 55, 0.3); border-bottom: 1px solid rgba(212, 175, 55, 0.3); padding: 20px 0;">
                    <p style="font-size: 16px; color: #A8A29E; margin-bottom: 10px;">Your mystical verification sequence:</p>
                    <h2 style="font-size: 42px; color: #FCD34D; letter-spacing: 12px; margin: 10px 0; font-weight: 900;">{code}</h2>
                  </div>
                  
                  <p style="font-size: 14px; color: #78716C; line-height: 1.6;">Invoke this sequence in the application to unlock your sanctuary and continue your vocal journey.</p>
                  <p style="font-size: 12px; color: #57534E; margin-top: 25px;">If you did not summon this code, please ignore this acoustic resonance.</p>
                </div>
              </body>
            </html>
            """
            message.attach(MIMEText(html, "html"))

            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(message)
            email_sent = True
        except Exception as e:
            print(f"SMTP Error: {e}")

    if not email_sent:
        print(f"==================================================")
        print(f"🔒 MOCK EMAIL SERVICE (Credentials Issues) 🔒")
        print(f"Verification Code for {req.email}: >>> {code} <<<")
        print(f"==================================================")

    return {"message": "OTP sent successfully", "is_registered": False}

@app.post("/verify_otp")
async def verify_otp(req: VerifyOTPRequest):
    email = req.email.lower()
    valid_code = OTP_STORE.get(email)
    if not valid_code or valid_code != req.otp:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP code")
    
    # Check if user exists
    user = db.get_user_by_username(email)
    is_new = user is None
    
    # Clean up OTP
    del OTP_STORE[email]
    
    if not is_new:
        # Existing user: Return token immediately
        access_token = create_access_token(data={"sub": email})
        return {"access_token": access_token, "token_type": "bearer", "is_new_user": False}
    else:
        # New user: Tell frontend to show signup form
        return {"is_new_user": True, "message": "Email verified. Please complete your profile."}

@app.post("/register")
async def register(user: UserRegister):
    # Register the user
    user_id = db.create_user(user.email.lower(), user.password)
    if not user_id:
        raise HTTPException(status_code=400, detail="Registration failed. Email might already be taken.")
    
    return {"status": "success", "message": "Account created. Please log in."}

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user_by_username(form_data.username)
    if not user or not db.verify_password(form_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user['username']})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/analyze")
async def analyze_voice(file: UploadFile = File(...)):
    filename = file.filename or "recording.m4a"
    try:
        contents = await file.read()
        results = analyze_audio(contents, filename)
        return results
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-scale")
async def analyze_scale_endpoint(file: UploadFile = File(...)):
    from analyzer import detect_scale_from_audio
    filename = file.filename or "ambient_recording.wav"
    try:
        contents = await file.read()
        results = detect_scale_from_audio(contents, filename)
        return results
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/records")
async def save_record(record: RecordData, current_user: dict = Depends(get_current_user)):
    record_id = db.create_record(
        current_user['id'],
        record.avg_db,
        record.peak_db,
        record.instability,
        record.pitch_hz,
        record.note,
        record.is_strained,
        record.indicators,
        record.recommendation,
        record.sargam
    )
    return {"status": "success", "record_id": record_id}

@app.get("/records")
async def get_records(current_user: dict = Depends(get_current_user)):
    records = db.get_user_records(current_user['id'])
    for r in records:
        if r.get('indicators'):
            try:
                r['indicators'] = json.loads(r['indicators'])
            except:
                pass
    return records

@app.delete("/records/{record_id}")
async def delete_record_endpoint(record_id: int, current_user: dict = Depends(get_current_user)):
    success = db.delete_record(record_id, current_user['id'])
    if not success:
        raise HTTPException(status_code=404, detail="Record not found or not authorized")
    return {"status": "success"}

@app.post("/records/batch_delete")
async def batch_delete_records_endpoint(batch: DeleteBatch, current_user: dict = Depends(get_current_user)):
    deleted_count = db.delete_records(batch.ids, current_user['id'])
    return {"status": "success", "deleted_count": deleted_count}

@app.post("/analyze_guru")
async def analyze_vocal_guru_endpoint(file: UploadFile = File(...)):
    from analyzer import analyze_vocal_guru
    filename = file.filename or "guru_recording.m4a"
    try:
        contents = await file.read()
        results = analyze_vocal_guru(contents, filename)
        return results
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}

# --- IoT / Hardware Specialized Endpoints ---

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    Main WebSocket hub for the Mobile App. 
    Listens for updates from your hardware.
    """
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "START_IOT_SCALE":
                    manager.hardware_scale_active[user_id] = True
                    manager.hardware_scale_buffers[user_id] = b""
                    print(f"🎤 [IOT SCALE] Buffering started for {user_id}...")
            except:
                pass 
    except WebSocketDisconnect:
        manager.disconnect(user_id)

@app.post("/analyze/hardware")
async def analyze_hardware_endpoint(request: Request, user_id: str = "default_user"):
    """
    Endpoint used by the ESP32-S3 IoT device.
    Analyzes audio and IMMEDIATELY pushes results to the user's phone via WebSocket.
    """
    from analyzer import analyze_vocal_guru, detect_scale_from_audio, add_wav_header
    import numpy as np
    
    try:
        contents = await request.body()
        data_size = len(contents)
        
        # --- 🎤 IOT SCALE BUFFERING ---
        if manager.hardware_scale_active.get(user_id):
            print(f"   ∟ [BUFF] Adding {data_size} bytes to scale buffer...")
            current_buf = manager.hardware_scale_buffers.get(user_id, b"")
            new_buf = current_buf + contents
            manager.hardware_scale_buffers[user_id] = new_buf
            
            # 16kHz, 16bit, Mono: 32000 bytes/sec.
            # 10.5 seconds is ~336,000 bytes.
            # Chunks are 1.5s (~48,000 bytes). 7 chunks is ~336,000.
            if len(new_buf) >= 240000:  # ~5 chunks of 1.5s = ~7.5 seconds
                print(f"   ∟ [DONE] Buffer full ({len(new_buf)} bytes). Analyzing scale...")
                manager.hardware_scale_active[user_id] = False
                
                try:
                    # IoT sends raw 16kHz 16-bit PCM. We MUST add a WAV header for librosa.
                    wav_data = add_wav_header(new_buf, 16000)
                    
                    # --- 🛠️ DIAGNOSTIC: Save the audio so the user can listen to it! ---
                    with open("iot_debug_capture.wav", "wb") as f:
                        f.write(wav_data)
                    
                    # Quick RMS loudness check
                    import numpy as np
                    samples = np.frombuffer(new_buf, dtype=np.int16)
                    rms = np.sqrt(np.mean(samples.astype(float)**2))
                    print(f"   ∟ [💾] Saved capture. RMS={rms:.1f} {'🔈 TOO QUIET! Sing LOUDER into the mic!' if rms < 100 else '🎵 Sound detected!'}")
                    
                    scale_results = detect_scale_from_audio(wav_data, "hardware_scale.wav")
                    scale_payload = {
                        "source": "hardware",
                        "type": "scale_result",
                        "scale": scale_results.get("scale"),
                        "note": scale_results.get("note"),
                        "confidence": scale_results.get("confidence")
                    }
                    await manager.broadcast_to_user(user_id, scale_payload)
                except Exception as ex:
                    import traceback
                    print(f"❌ Hardware Scale Analysis Error: {ex}")
                    print(traceback.format_exc())
                
                # Clear buffer
                manager.hardware_scale_buffers[user_id] = b""

        # --- 🎤 IOT DEBUG LOGS (Quiet Mode) ---
        # During scale buffering, return IMMEDIATELY to avoid Arduino HTTP timeout.
        # The scale analysis runs asynchronously after buffer is full.
        # -------------------------
        if manager.hardware_scale_active.get(user_id):
            # Already buffering — return quick so Arduino doesn't timeout
            return {"status": "buffering"}

        # Normal streaming mode: lightweight pitch push (skip slow Parselmouth)
        try:
            import numpy as np
            samples = np.frombuffer(contents, dtype=np.int16)
            if len(samples) > 0:
                # Simple zero-crossing based pitch estimate (fast, no Parselmouth)
                rms = float(np.sqrt(np.mean(samples.astype(float)**2)))
                payload = {
                    "source": "hardware",
                    "type": "note_update",
                    "pitch_hz": None,
                    "note": None,
                    "is_strained": rms > 5000,
                    "timestamp": datetime.datetime.now().isoformat()
                }
                await manager.broadcast_to_user(user_id, payload)
        except Exception:
            pass

        return {"status": "ok"}

    except Exception as e:
        print(f"❌ IoT Analysis Error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
