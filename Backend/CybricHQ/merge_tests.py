import json
import os
import glob
import re

def merge_reading_tests():
    source_files = [
        r"d:\CybricHQ\CybricHQ\tests\reading\01RT01 (3).json",
        r"d:\CybricHQ\CybricHQ\tests\reading\01RT02 (2).json"
    ]
    dest_file = r"d:\CybricHQ\CybricHQ\ielts-portal\public\data\reading_tests.json"
    
    merged_tests = []
    
    print(f"Processing Reading Tests...")
    for idx, filepath in enumerate(source_files, 1):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Construct test object
            # Use filename as title if not present, strip ID
            filename = os.path.splitext(os.path.basename(filepath))[0]
            
            # Ensure "passages" exists
            if "passages" not in data:
                print(f"Warning: No 'passages' found in {filename}, skipping.")
                continue
                
            test_obj = {
                "id": idx,
                "title": f"Reading Practice Test {idx} ({filename})",
                "passages": data["passages"]
            }
            merged_tests.append(test_obj)
            print(f"  Added: {filename} as ID {idx}")
            
        except Exception as e:
            print(f"  Error reading {filepath}: {e}")

    # Write to destination
    output = {"tests": merged_tests}
    with open(dest_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    print(f"Successfully wrote {len(merged_tests)} exams to {dest_file}")


def merge_listening_tests():
    source_dir = r"d:\CybricHQ\CybricHQ\tests\listening"
    dest_file = r"d:\CybricHQ\CybricHQ\ielts-portal\public\data\listening_tests.json"
    
    # Get all JSON files
    files = glob.glob(os.path.join(source_dir, "*.json"))
    # Sort carefully to ensure 01LT01 comes before 01LT02
    files.sort()
    
    merged_tests = []
    
    print(f"\nProcessing Listening Tests...")
    test_id_counter = 1
    
    for filepath in files:
        filename = os.path.basename(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Listening tests usually have 'sections' or 'parts'
            # We wrap it in a standard structure
            
            test_obj = {
                "id": test_id_counter,
                "title": f"Listening Practice Test {test_id_counter} ({os.path.splitext(filename)[0]})",
                # Include all keys from the source (usually "audio", "sections", etc.)
                **data 
            }
            
            merged_tests.append(test_obj)
            print(f"  Added: {filename} as ID {test_id_counter}")
            test_id_counter += 1
            
        except Exception as e:
             # Try utf-8-sig if encoding fails
            try:
                with open(filepath, 'r', encoding='utf-8-sig') as f:
                    data = json.load(f)
                test_obj = {
                    "id": test_id_counter,
                    "title": f"Listening Practice Test {test_id_counter} ({os.path.splitext(filename)[0]})",
                    **data 
                }
                merged_tests.append(test_obj)
                print(f"  Added (retry utf-8-sig): {filename} as ID {test_id_counter}")
                test_id_counter += 1
            except Exception as e2:
                print(f"  Error reading {filename}: {e}")

    # Write to destination
    output = {"tests": merged_tests}
    with open(dest_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    print(f"Successfully wrote {len(merged_tests)} exams to {dest_file}")

if __name__ == "__main__":
    merge_reading_tests()
    merge_listening_tests()
