import os
import subprocess
import sys
import time
import socket
import json

# Configuration
BACKEND_PORT = 8001
FRONTEND_PORT = 3000
BACKEND_DIR = "backend"
FRONTEND_DIR = "frontend"
CONFIG_FILE = os.path.join(BACKEND_DIR, "config.json")
DEFAULT_NETWORK_PATH = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度"

def print_colored(text, color_code):
    # 96=Cyan, 92=Green, 93=Yellow, 91=Red
    print(f"\033[{color_code}m{text}\033[0m")
    sys.stdout.flush()

def kill_port(port):
    """Kill process listening on the specified port."""
    try:
        cmd = f'netstat -ano | findstr :{port}'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')
        
        killed = False
        for line in lines:
            parts = line.split()
            if not parts: continue
            if len(parts) >= 5 and str(port) in parts[1]:
                pid = parts[-1]
                print(f"ポート {port} (PID {pid}) を使用中のプロセスを終了しています...")
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                killed = True
        
        if killed:
             print_colored(f"ポート {port} を解放しました。", "92") # Green
        else:
             print_colored(f"ポート {port} は利用可能です。", "92") # Green

    except Exception as e:
        print_colored(f"ポート {port} の確認中にエラー: {e}", "91") # Red

def check_network_path():
    path = DEFAULT_NETWORK_PATH
    # Try to load from config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                path = config.get('excel_dir', DEFAULT_NETWORK_PATH)
                print("設定ファイル(config.json)を読み込みました。")
        except Exception as e:
            print(f"設定読み込み警告: {e}")
    
    print(f"確認パス: {path}")
    if os.path.exists(path):
         print_colored("ネットワークパスへのアクセス: OK", "92")
    else:
         print_colored("警告: ネットワークパスにアクセスできません！", "91")
         print("接続を試みています...")
         try:
             os.listdir(path)
             if os.path.exists(path):
                 print_colored("接続が確立されました！", "92")
             else:
                 print_colored("ネットワークドライブに接続できませんでした。", "93") # Yellow
         except:
             print_colored("ネットワークドライブに接続できませんでした。ローカルキャッシュを使用します。", "93")

def start_services():
    # Set encoding to utf-8 for stdout just in case, though Python usually handles it
    sys.stdout.reconfigure(encoding='utf-8')

    print_colored("営業日報システム - 強力な起動スクリプト (Python)", "96") # Cyan
    
    # 1. Kill ports
    print("\n[1/4] ポートを確認中...")
    kill_port(BACKEND_PORT)
    kill_port(FRONTEND_PORT)
    
    # 2. Check Network
    print("\n[2/4] ネットワーク接続を確認中...")
    check_network_path()
    
    # 3. Start Backend
    print("\n[3/4] バックエンドを起動中...")
    subprocess.Popen(f'start "Backend" /MIN cmd /k "cd {BACKEND_DIR} && python main.py"', shell=True)
    print("バックエンドを起動しました。")
    
    # 4. Start Frontend
    print("\n[4/4] フロントエンドを起動中...")
    subprocess.Popen(f'start "Frontend" /MIN cmd /k "cd {FRONTEND_DIR} && npm run dev"', shell=True)
    print("フロントエンドを起動しました。")
    
    print_colored("\n起動シーケンス完了。", "96")
    print(f"バックエンド: http://localhost:{BACKEND_PORT}")
    print(f"フロントエンド: http://localhost:{FRONTEND_PORT}")
    print("ウィンドウは最小化されています。閉じないでください。")
    sys.stdout.flush()

if __name__ == "__main__":
    os.system('') # Enable VT100
    start_services()
