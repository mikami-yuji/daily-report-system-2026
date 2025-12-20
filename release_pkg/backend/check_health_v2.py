import urllib.request
import urllib.error
import sys

def check_backend():
    url = "http://127.0.0.1:8001/files"
    print(f"Checking {url}...")
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            print(f"Status Code: 200") # urlopen raises on error usually
            print(f"Response: {response.read().decode('utf-8')[:500]}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(f"Reason: {e.reason}")
        print(f"Body: {e.read().decode('utf-8')[:500]}")
    except Exception as e:
        print(f"Error checking backend: {e}")

if __name__ == "__main__":
    check_backend()
