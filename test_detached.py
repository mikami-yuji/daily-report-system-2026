import subprocess
import os
import time

app_dir = r"C:\Users\ASAHI\Desktop\DailyReportSystem_20260831"
exe = os.path.join(app_dir, "DailyReportServer.exe")

CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200

# DETACHED_PROCESS 付きで起動してみる
p = subprocess.Popen(
    [exe],
    cwd=app_dir,
    creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
    close_fds=True
)

print(f"Spawned with DETACHED_PROCESS PID: {p.pid}")
time.sleep(3)
poll = p.poll()
print(f"Process status after 3 seconds: {poll}")
