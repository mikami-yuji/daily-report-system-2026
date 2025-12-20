
import os
import re
import sys

# Define the target names that are failing
TARGETS = ["木村（拓）", "木村（寿）", "山下（和）", "山下（和）次長"]
DESIGN_DIR = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ"

def normalize_text(text):
    # Same logic as main.py
    text = text.replace('（', '(').replace('）', ')').replace('　', ' ')
    return text.strip()

def hex_string(s):
    return ":".join("{:02x}".format(c) for c in s.encode('utf-8'))

def diagnose():
    print(f"Starting Diagnosis on: {DESIGN_DIR}")
    
    if not os.path.exists(DESIGN_DIR):
        print(f"CRITICAL: Design directory not found: {DESIGN_DIR}")
        return

    print("Listing all top-level directories...")
    try:
        all_dirs = [d for d in os.listdir(DESIGN_DIR) if os.path.isdir(os.path.join(DESIGN_DIR, d))]
    except Exception as e:
        print(f"CRITICAL: Failed to list directory: {e}")
        return

    print(f"Found {len(all_dirs)} directories.")
    
    with open("diagnosis_report.txt", "w", encoding="utf-8") as f:
        f.write(f"Diagnosis Report\n")
        f.write(f"Target Directory: {DESIGN_DIR}\n")
        f.write(f"Total Directories Scanned: {len(all_dirs)}\n\n")

        for target in TARGETS:
            f.write(f"--- Investigating Target: {target} ---\n")
            
            # 1. Extraction Simulation (Assuming target IS the extracted name)
            normalized_target = normalize_text(target)
            f.write(f"Normalized Target: '{normalized_target}' (Hex: {hex_string(normalized_target)})\n")
            
            stripped_target = re.sub(r'(次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$', '', normalized_target)
            f.write(f"Stripped Target:   '{stripped_target}' (Hex: {hex_string(stripped_target)})\n")

            match_found = False
            best_partial_match = None
            
            for dir_name in all_dirs:
                norm_dir = normalize_text(dir_name)
                
                # Check for Match
                is_match = False
                match_type = ""
                
                if normalized_target in norm_dir:
                    is_match = True
                    match_type = "Exact Normalized"
                elif stripped_target != normalized_target and stripped_target in norm_dir:
                    is_match = True
                    match_type = "Stripped Normalized"
                
                # Loose check for Partial Match (debugging aid)
                if not is_match:
                    # Check if at least the name part (without parens) exists?
                    # e.g. "木村"
                    core_name = target.split("（")[0].split("(")[0]
                    if len(core_name) >= 2 and core_name in dir_name:
                         if not best_partial_match: 
                             best_partial_match = dir_name

                if is_match:
                    f.write(f"  [SUCCESS] Match Found!\n")
                    f.write(f"    Folder: '{dir_name}'\n")
                    f.write(f"    Norm Folder: '{norm_dir}'\n")
                    f.write(f"    Match Type: {match_type}\n")
                    f.write(f"    Hex Dump: {hex_string(dir_name)}\n")
                    
                    # Try to list files inside
                    try:
                        full_path = os.path.join(DESIGN_DIR, dir_name)
                        files = os.listdir(full_path)
                        f.write(f"    Access Check: OK. Found {len(files)} items.\n")
                        f.write(f"    First 5 items: {', '.join(files[:5])}\n")
                    except Exception as e:
                        f.write(f"    Access Check: FAILED. Error: {e}\n")

                    match_found = True
                    # Don't break, see if multiple matches
            
            if not match_found:
                f.write(f"  [FAILURE] No match found.\n")
                if best_partial_match:
                    f.write(f"  [HINT] Found potentially related folder: '{best_partial_match}'\n")
                    f.write(f"         Hex Dump: {hex_string(best_partial_match)}\n")
                    f.write(f"         Normalized: '{normalize_text(best_partial_match)}'\n")
            
            f.write("\n")

    print("Diagnosis complete. Output written to diagnosis_report.txt")

if __name__ == "__main__":
    diagnose()
