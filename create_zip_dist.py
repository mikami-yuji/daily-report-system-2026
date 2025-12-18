import shutil
import os

src_dir = r"c:\Users\asahi\.gemini\antigravity\playground\pyro-eclipse\backend\dist\DailyReportSystem"
output_filename = r"c:\Users\asahi\.gemini\antigravity\playground\pyro-eclipse\DailyReportSystem_Standalone"

if os.path.exists(src_dir):
    shutil.make_archive(output_filename, 'zip', src_dir)
    print(f"Created {output_filename}.zip")
else:
    print(f"Source directory not found: {src_dir}")
