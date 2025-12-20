import os
import time

def debug_isdir():
    target = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ\大阪本社　07：森田"
    print(f"DEBUG: Listing {target}...", flush=True)
    
    items = os.listdir(target)
    print(f"Found {len(items)} items. Checking isdir speed for first 50...", flush=True)
    
    start = time.time()
    folder_count = 0
    for i, name in enumerate(items[:50]):
        full_path = os.path.join(target, name)
        is_d = os.path.isdir(full_path)
        if is_d:
            folder_count += 1
        # print(f"{i}: {name} -> Dir? {is_d}", flush=True)
    
    end = time.time()
    duration = end - start
    print(f"Checked 50 items in {duration:.4f} seconds.", flush=True)
    print(f"Found {folder_count} folders.", flush=True)

if __name__ == "__main__":
    debug_isdir()
