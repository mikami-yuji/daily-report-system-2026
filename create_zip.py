import os
import zipfile

def zip_directory(folder_path, output_path):
    # Files/Dirs to exclude
    EXCLUDE_DIRS = {
        'node_modules', '.next', '.git', '__pycache__', 'venv', 
        '.vscode', '.idea', 'screenshots', 'playground', 'brain', '.gemini'
    }
    EXCLUDE_FILES = {
        '.DS_Store', 'Thumbs.db', 'create_zip.py', 'fix_vbs.py', 
        'backend/extract_design_types.py', 'backend/repro_500.py', 'backend/test_write.py'
    }
    EXCLUDE_EXTENSIONS = {'.zip', '.log', '.err', '.tmp'}

    print(f"Creating ZIP archive: {output_path}")
    
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            # Modify dirs in-place to exclude unwanted directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, folder_path)
                
                # Check exclusions
                if any(part in EXCLUDE_DIRS for part in rel_path.split(os.sep)):
                    continue
                if file in EXCLUDE_FILES:
                    continue
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                # Specific file path based exclusions
                if rel_path in EXCLUDE_FILES or rel_path.replace('\\', '/') in EXCLUDE_FILES:
                    continue
                    
                print(f"Adding: {rel_path}")
                zipf.write(file_path, rel_path)

if __name__ == "__main__":
    current_dir = os.getcwd()
    # Name the zip file with date or version if needed, but simplistic is fine for now
    zip_name = "daily_report_system_dist.zip"
    output_zip = os.path.join(current_dir, zip_name)
    
    zip_directory(current_dir, output_zip)
    print(f"\nSUCCESS: Created {zip_name}")
