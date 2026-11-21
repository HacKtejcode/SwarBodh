import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    # 1. Signup
    print("Testing Signup...")
    res = requests.post(f"{BASE_URL}/signup", json={"username": "testuser", "password": "password123"})
    if res.status_code == 200:
        print("Signup Successful:", res.json())
    else:
        print("Signup Failed (could exist already):", res.text)

    # 2. Login
    print("\nTesting Login...")
    res = requests.post(f"{BASE_URL}/login", data={"username": "testuser", "password": "password123", "grant_type": "password"})
    if res.status_code != 200:
        print("Login Failed:", res.text)
        return
    token = res.json()["access_token"]
    print("Login Successful, got token.")

    # 3. Save Record
    print("\nTesting Save Record...")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    record_data = {
        "avg_db": "-20.0",
        "peak_db": "-10.0",
        "instability": "2.5",
        "pitch_hz": "220",
        "note": "A3",
        "is_strained": False,
        "indicators": [],
        "recommendation": "Looking good!"
    }
    res = requests.post(f"{BASE_URL}/records", headers=headers, json=record_data)
    print("Save Record Response:", res.json())

    # 4. Get Records
    print("\nTesting Get Records...")
    res = requests.get(f"{BASE_URL}/records", headers=headers)
    print("Get Records Response:", json.dumps(res.json(), indent=2))

    # 5. Suggest Songs
    print("\nTesting Suggest Songs...")
    res = requests.get(f"{BASE_URL}/suggest_songs?note=A3")
    print("Suggestions Response:", json.dumps(res.json(), indent=2))

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print("Error during tests:", e)
