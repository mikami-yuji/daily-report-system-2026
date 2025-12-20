import os

def find_missing():
    target = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ\大阪本社　07：森田"
    query = "117675"
    print(f"DEBUG: Searching for ALL occurrences of {query} in {target}...", flush=True)
    
    # Simple listdir recursive (unoptimized for speed, just for finding)
    # We limit depth to avoid infinite loops, but we scan EVERYTHING.
    
    def scan(directory, depth=0):
        if depth > 3: return
        try:
            items = os.listdir(directory)
        except:
            return
            
        for name in items:
            full_path = os.path.join(directory, name)
            
            if query in name:
                print(f"FOUND: {full_path}", flush=True)
                
            try:
                if os.path.isdir(full_path):
                    # Recurse unconditionally
                    scan(full_path, depth + 1)
            except:
                pass

    scan(target)
    print("Search complete.", flush=True)

if __name__ == "__main__":
    find_missing()
