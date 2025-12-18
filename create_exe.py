import os
import subprocess
import shutil
import sys

def run_command(command, cwd=None):
    print(f"Running: {command}")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"Error running command: {command}")
        sys.exit(1)

def main():
    base_dir = os.getcwd()
    frontend_dir = os.path.join(base_dir, "frontend")
    backend_dir = os.path.join(base_dir, "backend")
    
    # 0. Clean .next manually to ensure fresh build
    dot_next = os.path.join(frontend_dir, ".next")
    if os.path.exists(dot_next):
        try:
            print("Cleaning .next directory...")
            shutil.rmtree(dot_next)
        except Exception as e:
            print(f"Warning: Failed to clean .next: {e}")

    # 1. Build Frontend
    print("--- Building Frontend ---")
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
         print("Installing dependencies...")
         run_command("npm install", cwd=frontend_dir)
    
    print("Running build...")
    run_command("npm run build", cwd=frontend_dir)
    
    # Check if out exists
    out_dir = os.path.join(frontend_dir, "out")
    if not os.path.exists(out_dir):
        print("Error: Frontend build failed (out directory not found)")
        sys.exit(1)
        
    # 2. Prepare Backend Static Files
    print("--- Preparing Static Files ---")
    static_dir = os.path.join(backend_dir, "static")
    if os.path.exists(static_dir):
        print("Removing existing static dir...")
        # handle permission errors if file is locked
        try:
            shutil.rmtree(static_dir)
        except Exception as e:
            print(f"Warning: Failed to remove static dir: {e}")
            pass
            
    if not os.path.exists(static_dir):
        shutil.copytree(out_dir, static_dir)
        print(f"Copied {out_dir} to {static_dir}")
    else:
        # manual copy if rmtree failed (merge/overwrite)
        shutil.copytree(out_dir, static_dir, dirs_exist_ok=True)
    
    # 3. Create Exe with PyInstaller
    print("--- Creating Exe ---")
    # Verify PyInstaller is installed
    try:
        subprocess.run([sys.executable, "-m", "PyInstaller", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except:
        print("PyInstaller not found. Installing...")
        run_command(f"{sys.executable} -m pip install pyinstaller")
        
    # PyInstaller command
    # We include static folder using --add-data
    # On Windows separator is ;
    sep = ";" if os.name == 'nt' else ":"
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--console", 
        "--name", "DailyReportSystem",
        "--add-data", f"static{sep}static",
        "--clean",
        "main.py"
    ]
    
    # Additional hidden imports if needed
    # cmd.extend(["--hidden-import", "engineio.async_drivers.threading"]) # Example
    
    cmd_str = " ".join(cmd)
    
    run_command(cmd_str, cwd=backend_dir)
    
    print("--- Build Complete ---")
    dist_path = os.path.join(backend_dir, "dist", "DailyReportSystem")
    print(f"Executable is located at: {dist_path}")
    
    # Create simple readme
    readme_path = os.path.join(dist_path, "README.txt")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("営業日報システム\n\n")
        f.write("DailyReportSystem.exe をダブルクリックして起動してください。\n")
        f.write("黒い画面（コンソール）が表示されますが、正常な動作です。閉じないでください。\n")
        f.write("起動するとブラウザが自動的に開かない場合は、http://localhost:8001 にアクセスしてください。\n")

    # Create a wrapper batch file for easy launching and auto-open browser
    bat_path = os.path.join(dist_path, "起動.bat")
    with open(bat_path, "w", encoding="cp932") as f:
        f.write("@echo off\n")
        f.write("echo Starting Daily Report System...\n")
        f.write("start \"\" \"DailyReportSystem.exe\"\n")
        f.write("timeout /t 5\n")
        f.write("start http://localhost:8001\n")
    
    print(f"Created launcher: {bat_path}")

if __name__ == "__main__":
    main()
