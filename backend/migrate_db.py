import sqlite3
import os

DB_FILE = "voice_strain.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database {DB_FILE} not found.")
        return
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE records ADD COLUMN sargam TEXT;")
        conn.commit()
        print("Migration successful: Added 'sargam' column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Migration skipped: 'sargam' column already exists.")
        else:
            print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
