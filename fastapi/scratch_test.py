import os
import requests

API_KEY = os.getenv("GEMINI_API_KEY", "")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
try:
    response = requests.get(url)
    print("Status:", response.status_code)
    if response.status_code == 200:
        models = response.json().get("models", [])
        for m in models:
            print(m.get("name"), "-", m.get("displayName"))
    else:
        print(response.text)
except Exception as e:
    print("Exception:", e)

