import sqlite3
import os
import json
import bcrypt

DB_FILE = "voice_strain.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            avg_db TEXT,
            peak_db TEXT,
            instability TEXT,
            pitch_hz TEXT,
            note TEXT,
            is_strained BOOLEAN,
            indicators TEXT,
            recommendation TEXT,
            sargam TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_user_by_username(username):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None

def create_user(username, password):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, get_password_hash(password)))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return False
    user_id = c.lastrowid
    conn.close()
    return user_id

def create_record(user_id, avg_db, peak_db, instability, pitch_hz, note, is_strained, indicators, recommendation, sargam=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    indicators_json = json.dumps(indicators) if isinstance(indicators, list) else indicators
    c.execute("""
        INSERT INTO records (user_id, avg_db, peak_db, instability, pitch_hz, note, is_strained, indicators, recommendation, sargam)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, str(avg_db), str(peak_db), str(instability), str(pitch_hz), str(note), bool(is_strained), indicators_json, recommendation, sargam))
    conn.commit()
    record_id = c.lastrowid
    conn.close()
    return record_id

def get_user_records(user_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
    records = c.fetchall()
    conn.close()
    return [dict(r) for r in records]

def delete_record(record_id, user_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM records WHERE id = ? AND user_id = ?", (record_id, user_id))
    rows_deleted = c.rowcount
    conn.commit()
    conn.close()
    return rows_deleted > 0

def delete_records(record_ids, user_id):
    if not record_ids:
        return 0
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    placeholders = ','.join('?' for _ in record_ids)
    c.execute(f"DELETE FROM records WHERE id IN ({placeholders}) AND user_id = ?", (*record_ids, user_id))
    rows_deleted = c.rowcount
    conn.commit()
    conn.close()
    return rows_deleted

init_db()
