import subprocess
import os
import time

app_dir = r"C:\Users\ASAHI\Desktop\DailyReportSystem_20260831"
exe = os.path.join(app_dir, "DailyReportServer.exe")

bat_path = os.path.join(app_dir, "_test_explorer.bat")
bat_content = f'''@echo off
ping 127.0.0.1 -n 3 > nul
explorer.exe "{exe}"
del "%~f0"
'''
with open(bat_path, "w", encoding="cp932") as f:
    f.write(bat_content)

subprocess.Popen(["cmd.exe", "/c", bat_path], cwd=app_dir)
print("Spawned bat. Python exiting immediately...")
os._exit(0)
