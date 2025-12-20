
import os
import shutil

backend_dir = os.getcwd() # Assumes run from backend dir
dist_path = os.path.join(backend_dir, "dist", "DailyReportSystem")

print(f"Finalizing distribution in: {dist_path}")

if not os.path.exists(dist_path):
    print("Error: dist path does not exist!")
    exit(1)

# 1. Copy config.json
config_src = os.path.join(backend_dir, "config.example.json")
config_dst = os.path.join(dist_path, "config.json")
if os.path.exists(config_src):
    shutil.copy2(config_src, config_dst)
    print(f"Copied config: {config_dst}")
else:
    print("Warning: config.example.json not found")

# 2. Create README.txt
readme_path = os.path.join(dist_path, "README.txt")
with open(readme_path, "w", encoding="utf-8") as f:
    f.write("営業日報システム\n\n")
    f.write("DailyReportSystem.exe をダブルクリックして起動してください。\n")
    f.write("黒い画面（コンソール）が表示されますが、正常な動作です。閉じないでください。\n")
    f.write("起動するとブラウザが自動的に開かない場合は、http://localhost:8001 にアクセスしてください。\n")
print("Created README.txt")

# 3. Create Launcher
bat_path = os.path.join(dist_path, "起動.bat")
with open(bat_path, "w", encoding="cp932") as f:
    f.write("@echo off\n")
    f.write("echo Starting Daily Report System...\n")
    f.write("start \"\" \"DailyReportSystem.exe\"\n")
    f.write("timeout /t 5\n")
    f.write("start http://localhost:8001\n")
print(f"Created launcher: {bat_path}")
