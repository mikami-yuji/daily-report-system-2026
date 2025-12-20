import os
import sys

def debug_access():
    target = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ\大阪本社　07：森田"
    print(f"DEBUG: Scanning {target}...", flush=True)
    
    try:
        items = os.listdir(target)
        print(f"Found {len(items)} items.", flush=True)
        
        folders = []
        files = []
        for name in items:
            full_path = os.path.join(target, name)
            if os.path.isdir(full_path):
                folders.append(name)
            else:
                files.append(name)
                
        print(f"Folders ({len(folders)}):", flush=True)
        for f in folders: # ALL folders
            print(f" [D] {f}", flush=True)
            
        print(f"Files ({len(files)}): skipped listing", flush=True)
            
    except Exception as e:
        print(f"Error scanning directory: {e}", flush=True)

if __name__ == "__main__":
    debug_access()
