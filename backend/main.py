from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
import logging
import os
import sys

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

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server_debug.log'),
        logging.StreamHandler()
    ]
)
logging.info("Server starting up...")

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
    import uvicorn, webbrowser, threading, socket
    def get_local_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
        except Exception:
            ip = '127.0.0.1'
        finally:
            s.close()
        return ip

    def ob():
        import time; time.sleep(2)
        # ホストPC自身は常に127.0.0.1で開くことで、DHCP等でIPが変わってもlocalStorageが維持されるようにします
        webbrowser.open("http://127.0.0.1:8001")
        local_ip = get_local_ip()
        logging.info(f"For access from other computers on the network, use: http://{local_ip}:8001")
    threading.Thread(target=ob, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
