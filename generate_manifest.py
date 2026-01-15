import os
import json

# --- CONFIGURATION ---
# This line sets the "base" directory to wherever this script is saved
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# We look for Case01, Case02... inside that base directory
CASE_FOLDERS = [f"Case{i:02d}" for i in range(1, 11)] 
OUTPUT_FILE = os.path.join(BASE_DIR, "data.json")

def generate_manifest():
    manifest = {}
    print(f"Scanning directory: {BASE_DIR}\n")

    for case_name in CASE_FOLDERS:
        # Build the full path to the case folder
        case_path = os.path.join(BASE_DIR, case_name)

        if not os.path.exists(case_path):
            print(f"[MISSING] {case_name} (Expected at: {case_path})")
            continue
        
        manifest[case_name] = []
        
        # Walk through files in the case directory
        for filename in os.listdir(case_path):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                manifest[case_name].append(filename)
                
        # Sort files to ensure 'a' comes before 'b'
        manifest[case_name].sort()
        print(f"[OK]      {case_name}: Found {len(manifest[case_name])} files.")

    # Save data.json in the same folder as this script
    with open(OUTPUT_FILE, "w") as f:
        json.dump(manifest, f, indent=4)
    
    print(f"\nSuccess! Manifest saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_manifest()
    