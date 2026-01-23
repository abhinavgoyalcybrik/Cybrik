import json
import os

# Paths
base_dir = r"d:\cybrik server\Cybrik\ielts-portal"
main_file = os.path.join(base_dir, "public", "data", "reading_tests.json")
new_file = os.path.join(base_dir, "01RT01.json")

# Load Main File
with open(main_file, "r", encoding="utf-8") as f:
    main_data = json.load(f)

# Load New File
with open(new_file, "r", encoding="utf-8") as f:
    new_test_data = json.load(f)

# Ensure ID consistency
if "id" not in new_test_data and "test_id" in new_test_data:
    new_test_data["id"] = new_test_data["test_id"]
elif "id" not in new_test_data:
    new_test_data["id"] = "01RT01"  # Fallback

# Check if already exists
existing_ids = [t.get("id") or t.get("test_id") for t in main_data["tests"]]
if new_test_data["id"] in existing_ids:
    print(f"Test {new_test_data['id']} already exists. Updating it...")
    # Remove old version
    main_data["tests"] = [t for t in main_data["tests"] if (t.get("id") or t.get("test_id")) != new_test_data["id"]]

# Add to list
main_data["tests"].insert(0, new_test_data) # Add to top

# Save
with open(main_file, "w", encoding="utf-8") as f:
    json.dump(main_data, f, indent=2, ensure_ascii=False)

print(f"Successfully merged {new_test_data['id']} into reading_tests.json")
