import json
import os

files = [
    'd:/cybrik server/Cybrik/ielts-portal/public/data/listening_tests.json',
    'd:/cybrik server/Cybrik/ielts-portal/public/data/reading_tests.json'
]

for p in files:
    try:
        with open(p, 'r', encoding='utf-8') as f:
            data = json.load(f)
            count = len(data.get('tests', []))
            print(f"{p}: {count} tests")
            if count > 0:
                print(f"  First ID: {data['tests'][0].get('test_id')}")
    except Exception as e:
        print(f"{p}: Error {e}")
