import requests
import sys

def check_backend():
    url = "http://127.0.0.1:8001/files"
    print(f"Checking {url}...")
    try:
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"Error checking backend: {e}")

if __name__ == "__main__":
    check_backend()
