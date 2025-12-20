import os
import time

def safe_walk(directory, query_lower, extensions, max_depth=3, current_depth=0, parent_matches_query=False):
    results = []
    try:
        # Use listdir instead of scandir/walk to avoid hanging
        items = os.listdir(directory)
    except Exception as e:
        print(f"WARN: Failed to listdir {directory}: {e}")
        return results

    dirs_to_visit = []

    for name in items:
        full_path = os.path.join(directory, name)
        name_lower = name.lower()
        
        # Check file match
        is_file_match = False
        if parent_matches_query and name_lower.endswith(extensions):
             is_file_match = True
        elif query_lower in name_lower and name_lower.endswith(extensions):
             is_file_match = True
             
        if is_file_match:
             # Treating as file match
             results.append(name)
        
        # Identify directories for recursion
        if current_depth < max_depth:
            next_parent_matches = parent_matches_query
            if not next_parent_matches:
                if query_lower in name_lower:
                    next_parent_matches = True
            
            # Recursion Filter
            if not next_parent_matches:
                if query_lower not in name_lower:
                    continue

            if '.' in name and not name.startswith('.'):
                continue
                
            try:
                if os.path.isdir(full_path):
                    dirs_to_visit.append((full_path, next_parent_matches))
            except Exception:
                pass
    
    # Recurse
    for subdir_path, matches_status in dirs_to_visit:
         sub_results = safe_walk(subdir_path, query_lower, extensions, max_depth, current_depth + 1, matches_status)
         results.extend(sub_results)
         if len(results) >= 50:
             break
    
    return results

def test():
    target = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ\大阪本社　07：森田"
    query = "117675"
    extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf')
    
    print(f"Testing safe_walk on {target} for {query}...", flush=True)
    start = time.time()
    results = safe_walk(target, query, extensions)
    end = time.time()
    
    print(f"Done in {end - start:.4f}s. Found {len(results)} items.", flush=True)
    for res in results:
        print(f" - {res}", flush=True)

if __name__ == "__main__":
    test()
