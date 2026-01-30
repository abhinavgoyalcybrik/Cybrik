#!/usr/bin/env python3
"""
Process reading test JSON files and generate reading_tests.json
Converts individual test files (01RT01.json, 01RT02.json, etc.) into a unified format
"""

import json
import os
from pathlib import Path

# Test book names mapping
BOOK_NAMES = {
    "01": "Cambridge IELTS 1",
    "03": "Cambridge IELTS 3",
    "05": "Cambridge IELTS 5",
    "08": "Cambridge IELTS 8",
    "10": "Cambridge IELTS 10",
    "11": "Cambridge IELTS 11",
    "12": "Cambridge IELTS 12",
    "13": "Cambridge IELTS 13",
    "14": "Cambridge IELTS 14",
    "15": "Cambridge IELTS 15",
    "16": "Cambridge IELTS 16",
    "17": "Cambridge IELTS 17",
}

def process_reading_tests():
    """Process all reading test JSON files and create consolidated reading_tests.json"""
    
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    source_dir = project_root / "readingg" / "readingg"
    output_file = project_root / "public" / "data" / "reading_tests.json"
    
    if not source_dir.exists():
        print(f"❌ Error: Source directory not found: {source_dir}")
        return
    
    # Get all test files
    test_files = sorted(source_dir.glob("*.json"))
    
    if not test_files:
        print(f"❌ Error: No JSON files found in {source_dir}")
        return
    
    print(f"📚 Found {len(test_files)} reading test files")
    
    tests = []
    
    for test_file in test_files:
        filename = test_file.stem  # e.g., "01RT01"
        
        # Parse filename: 01RT01 -> book=01, test=01
        if len(filename) != 6 or not filename[2:4] == "RT":
            print(f"⚠️  Skipping invalid filename: {filename}")
            continue
        
        book_num = filename[:2]
        test_num = filename[4:6]
        
        # Read the test file
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                test_data = json.load(f)
        except Exception as e:
            print(f"❌ Error reading {filename}: {e}")
            continue
        
        # Get book name (keep for reference but don't use in title)
        book_name = BOOK_NAMES.get(book_num, f"Cambridge IELTS {int(book_num)}")
        
        # Store temporarily - we'll assign sequential numbers after sorting
        test_obj = {
            "id": filename,
            "title": "",  # Will be set later with sequential number
            "description": "IELTS Academic Reading Test",
            "book": book_name,
            "book_num": int(book_num),
            "test_number": int(test_num),
            "passages": test_data.get("passages", [])
        }
        
        tests.append(test_obj)
    
    # Sort tests by book and test number to maintain order
    tests.sort(key=lambda x: (x['book_num'], x['test_number']))
    
    # Assign sequential test numbers
    for idx, test in enumerate(tests, start=1):
        test['title'] = f"Reading Test {idx}"
        test['sequential_number'] = idx
        print(f"✅ Processed: {test['title']} (from {test['book']} Test {test['test_number']})")
    
    # Create final structure
    output_data = {
        "metadata": {
            "total_tests": len(tests),
            "generated_at": "2026-01-30",
            "description": "IELTS Academic Reading Tests",
            "books_included": list(set([t['book'] for t in tests]))
        },
        "tests": tests
    }
    
    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"\n✨ Successfully generated: {output_file}")
        print(f"📊 Total tests: {len(tests)}")
        print(f"📚 Books: {', '.join(sorted(set([t['book'] for t in tests])))}")
    except Exception as e:
        print(f"\n❌ Error writing output file: {e}")

if __name__ == "__main__":
    process_reading_tests()
