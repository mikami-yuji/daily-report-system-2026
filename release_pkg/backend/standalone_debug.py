import os

def search_design_images_debug(query: str, filename: str = None):
    print(f"Starting debug search for query='{query}', filename='{filename}'")
    DESIGN_DIR = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ"
    
    if not os.path.exists(DESIGN_DIR):
         print("Design directory not found")
         return

    search_roots = [DESIGN_DIR]
    
    if filename:
        name_part = os.path.splitext(os.path.basename(filename))[0]
        print(f"Extracted name_part: {name_part}")
        
        found_folder = None
        print(f"DEBUG: Looking for folder matching '{name_part}' in {DESIGN_DIR}")
        
        try:
            for root, dirs, files in os.walk(DESIGN_DIR):
                # Optimize: only go 1-2 levels deep for user folder findings
                # DESIGN_DIR is level 0
                rel_path = root[len(DESIGN_DIR):]
                current_depth = rel_path.count(os.sep)
                if rel_path == "": current_depth = 0
                
                print(f"Scanning: {root} (Depth: {current_depth})")
                
                if current_depth > 1: 
                    # Optimization: Don't walk deep into subfolders while looking for the User Folder
                    # But we MUST allow recursing into the User Folder once found?
                    # No, this loop is just finding the USER FOLDER.
                    # We can probably just list directories at level 1 (Branch) and level 2 (User).
                    
                    # os.walk yields 3-tuple. modifying dirs in-place prunes walk.
                    # If we are at depth 1 (Branch), we want to check its dirs (Users).
                    # If we are at depth 2 (User), we found it or not?
                    # The user folder like "大阪本社　08：見上" is actually a SUBFOLDER of "大阪本社"? or direct?
                    # 'dir' output shows:
                    # DESIGN_DIR/大阪本社　08：見上
                    # Wait, 'dir' output showed:
                    # d-----        2025/12/16     17:52                大阪本社　08：見上
                    # This is DIRECTLY inside DESIGN_DIR if 'dir' was run on DESIGN_DIR.
                    # "ディレクトリ: \\Asahipack02..."
                    # So the depth is 0! The user folders are direct children.
                    pass

                # Check dirs in current root
                for d in dirs:
                    if name_part in d:
                        found_folder = os.path.join(root, d)
                        print(f"DEBUG: Found User Folder: {found_folder}")
                        break
                if found_folder:
                    break
                
                # If we are at root, we continue to subdirs.
                # If the folders are direct children, os.walk will show them in 'dirs' of root.
                # So we don't need to walk deep.
                if current_depth >= 1:
                    # Stop walking deeper if we assumed user folders are at root or depth 1
                    # Based on DIR output: "大阪本社　08：見上" is in the root of DESIGN_DIR.
                    # So we just need to search dirs of DESIGN_DIR.
                    del dirs[:] # Stop recursion
        except Exception as e:
            print(f"Error walking dirs: {e}")

        if found_folder:
            search_roots = [found_folder]
        else:
            print("Folder not found, checking all...")

    image_files = []
    valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf') 
    
    count = 0
    MAX_RESULTS = 50
    
    for search_root in search_roots:
        print(f"DEBUG: Searching for '{query}' in {search_root} (Recursive)")
        
        try:
            for root, dirs, files in os.walk(search_root):
                for file in files:
                    if query.lower() in file.lower() and file.lower().endswith(valid_extensions):
                        full_path = os.path.join(root, file)
                        print(f"Found: {full_path}")
                        # rel_path = os.path.relpath(full_path, DESIGN_DIR)
                        # folder_name = os.path.basename(root)
                        count += 1
                        if count >= MAX_RESULTS:
                            return
                if count >= MAX_RESULTS:
                    return
        except Exception as e:
             print(f"Error searching files: {e}")

if __name__ == "__main__":
    test_search_debug("117486", "見上.xlsm")
