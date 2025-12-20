
import os
import re

def test_search_logic():
    # Simulated filenames (from User report)
    filenames = [
        "2025年度日報【木村（拓）】.xlsm",
        "2025年度日報【木村（寿）】.xlsm",
        "2025年度日報【山下（和）次長】.xlsm",
        "2025年度日報【山下（尚）次長】.xlsm"
    ]

    # Simulated Directory Listings (Hypothetical - we need to see what matches)
    # Trying various possibilities of how they might be named on disk
    mock_files = [
        "01：木村(拓)",     # Half-width parens
        "02：木村（寿）",   # Full-width parens
        "03：山下(和)次長", # Half-width parens + suffix
        "04：山下（尚）次長", # Full-width parens + suffix
        "05：山下(和)",    # No suffix
        "06：木村 拓",      # Space instead of parens
    ]
    
    print("--- Starting Reproduction Test ---")

    for filename in filenames:
        print(f"\nProcessing Filename: {filename}")
        
        # 1. Extraction Logic (Current)
        match = re.search(r'【(.*?)】', filename)
        if match:
            name_part = match.group(1)
            print(f"  Extracted Name: '{name_part}' (Hex: {name_part.encode('utf-8').hex()})")
        else:
            name_part = os.path.splitext(os.path.basename(filename))[0]
            print(f"  Extracted Name (Fallback): '{name_part}'")

        # 2. Matching Logic (Current)
        found = False
        for folder in mock_files:
            # The logic in main.py is: if name_part in entry.name
            if name_part in folder:
                print(f"  [MATCH FOUND] folder: '{folder}'")
                found = True
                break
        
        if not found:
            print("  [FAIL] No matching folder found.")

        # 3. Enhanced Matching Logic (Proposed)
        # Normalize: Convert full-width parens to half-width, strip whitespace?
        def normalize(s):
            return s.replace('（', '(').replace('）', ')').strip()

        if not found:
            print("  Retrying with Normalization...")
            norm_name = normalize(name_part)
            print(f"  Normalized Name: '{norm_name}'")
            
            for folder in mock_files:
                norm_folder = normalize(folder)
                if norm_name in norm_folder:
                    print(f"  [MATCH FOUND (Normalized)] folder: '{folder}'")
                    found = True
                    break

if __name__ == "__main__":
    test_search_logic()
