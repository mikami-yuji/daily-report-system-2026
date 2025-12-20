import requests
import urllib.parse

def test_search():
    query = "117486"
    filename = "本社008　2025年度用日報【見上】.xlsm"
    
    # URL encode params
    params = {
        'query': query,
        'filename': filename
    }
    
    url = "http://127.0.0.1:8001/images/search"
    print(f"Testing {url} with params: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"Error checking backend: {e}")

if __name__ == "__main__":
    test_search()
