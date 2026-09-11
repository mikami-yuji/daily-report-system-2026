import logging
import os
import sys

# Setup logging immediately before any internal imports to ensure output is captured
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server_debug.log', encoding='utf-8', mode='a'),
        logging.StreamHandler(sys.stdout)
    ]
)

print("=" * 60)
print("  営業日報システム 2026 (Daily Report System)")
print("  起動処理中... (Wi-Fiオフ・オフライン環境でも動作します)")
print("=" * 60)
sys.stdout.flush()

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

import asyncio
from contextlib import asynccontextmanager

import config
import routes_reports
import routes_images
import routes_sales
import routes_stats
import routes_proxy
import routes_updater
import sync_queue

logging.info("Server initialized successfully.")


async def sync_worker_loop():
    """30秒ごとに未同期キューの処理を試みる自動再同期タスク"""
    while True:
        try:
            await asyncio.sleep(30)
            if sync_queue.get_pending_task_count() > 0:
                # ファイルサーバー接続可能であれば同期実行
                if sync_queue.check_file_server_connected():
                    logging.info("Auto-sync: Pending sync tasks detected and server reachable. Processing...")
                    res = await asyncio.to_thread(sync_queue.process_sync_queue)
                    if res.get("processed", 0) > 0:
                        logging.info(f"Auto-sync completed: {res}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.warning(f"Error in sync_worker_loop: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時: バックグラウンド同期ワーカーを開始
    worker_task = asyncio.create_task(sync_worker_loop())
    yield
    # 終了時: ワーカーを安全に停止
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(lifespan=lifespan)

# CORS settings
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"Validation error on {request.url.path}: {exc.errors()}")
    logging.error(f"Request body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)[:500]}
    )

# Include routers
app.include_router(routes_reports.router)
app.include_router(routes_images.router)
app.include_router(routes_sales.router)
app.include_router(routes_stats.router)
app.include_router(routes_proxy.router)
app.include_router(routes_updater.router)

# Mount static files
STATIC_DIR = os.path.join(config.BUNDLE_DIR, "static")
if os.path.exists(STATIC_DIR):
    if os.path.exists(os.path.join(STATIC_DIR, "_next")):
        app.mount("/_next", StaticFiles(directory=os.path.join(STATIC_DIR, "_next")), name="next_assets")
        
    @app.get("/")
    async def serve_index():
        p = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(p) if os.path.exists(p) else {"msg": "No static"}
        
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        clean_path = full_path.rstrip("/")
        fp = os.path.join(STATIC_DIR, clean_path)
        if os.path.isfile(fp): 
            return FileResponse(fp)
        if not os.path.splitext(clean_path)[1]:
            html_fp = fp + ".html"
            if os.path.isfile(html_fp):
                return FileResponse(html_fp)
        dir_index = os.path.join(fp, "index.html")
        if os.path.isdir(fp) and os.path.isfile(dir_index):
            return FileResponse(dir_index)
        si = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(si) if os.path.exists(si) else {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn, webbrowser, threading, socket, time
    import urllib.request

    # 1. 既存プロセスの稼働チェック（2重起動防止）
    try:
        req = urllib.request.Request("http://127.0.0.1:8001/api/health", headers={"User-Agent": "StartupCheck"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            if resp.status == 200:
                print("\n[INFO] 営業日報システムは既に起動しています。ブラウザを開きます...")
                sys.stdout.flush()
                webbrowser.open("http://127.0.0.1:8001")
                time.sleep(1.0)
                sys.exit(0)
    except Exception:
        pass

    def get_local_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        try:
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
        except Exception:
            ip = '127.0.0.1'
        finally:
            s.close()
        return ip

    def ob():
        time.sleep(1.5)
        # ホストPC自身は常に127.0.0.1で開くことで、DHCP等でIPが変わってもlocalStorageが維持されます
        webbrowser.open("http://127.0.0.1:8001")
        local_ip = get_local_ip()
        print(f"\n[INFO] 他のPC・タブレットからアクセスする場合: http://{local_ip}:8001")
        sys.stdout.flush()

    print("[1/3] ローカルキャッシュと設定の準備完了")
    print(f"      - Excel格納先: {config.EXCEL_DIR}")
    print(f"      - デフォルト日報: {config.DEFAULT_EXCEL_FILE}")
    print("[2/3] ブラウザ自動起動タスクを開始中...")
    threading.Thread(target=ob, daemon=True).start()

    print("[3/3] Webサーバーを起動しています (http://127.0.0.1:8001)...")
    print("      ※この画面を閉じるとシステムが終了します（最小化してご利用ください）\n")
    sys.stdout.flush()

    for retry in range(10):
        try:
            uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
            break
        except OSError as e:
            if retry < 9:
                logging.warning(f"Port 8001 is in use ({e}). Retrying in 1.5s... ({retry + 1}/10)")
                time.sleep(1.5)
            else:
                raise

