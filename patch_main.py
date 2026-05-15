import os
import re

def patch():
    path = r'c:\Users\asahi\.gemini\antigravity\playground\pyro-eclipse-2026\backend\main.py'
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # get_team_summary 関数の開始点を探し、それ以降を全て差し替える
    # これにより、インデントの不整合を根絶する
    match = re.search(r'def get_team_summary\(', content)
    if not match:
        print("Could not find get_team_summary")
        return

    header = content[:match.start()]
    
    new_tail = """def get_team_summary(month: str = None):
    try:
        logging.info(f"--- Team Summary Aggregation Start: month={month} ---")
        target_files = [f for f in os.listdir(EXCEL_DIR) if f.endswith('.xlsm') and not f.startswith('~$')]
        results = []
        for fname in target_files:
            try:
                df = get_cached_dataframe(fname, '営業日報')
                if df is None: continue
                df.columns = [str(c).replace('\\n', '').strip() for c in df.columns]
                date_col = next((c for c in df.columns if '日付' in c), '日付')
                action_col = next((c for c in df.columns if '行動内容' in c), '行動内容')
                df['dt'] = pd.to_datetime(df[date_col], errors='coerce')
                if month:
                    df = df[df['dt'].dt.strftime('%y/%m') == month]
                if not df.empty:
                    staff = fname.replace('.xlsm', '')
                    v = df[action_col].astype(str).str.contains('訪問', na=False).sum()
                    c = len(df) - v
                    results.append({"staff": staff, "total": len(df), "visits": int(v), "calls": int(c)})
            except: continue
        return {"records": results, "count": len(results)}
    except Exception as e:
        logging.error(f"Team summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats/dashboard")
def get_dashboard_stats(filename: str = DEFAULT_EXCEL_FILE):
    try:
        logging.info(f"--- Dashboard Stats for {filename} ---")
        df = get_cached_dataframe(filename, '営業日報')
        if df is None or df.empty:
            return {"summary": {"totalReports": 0, "thisMonth": 0, "visits": 0, "calls": 0}, "priority": {"uniqueCustomers": 0, "visits": 0, "calls": 0}, "monthly": [], "ranking": [], "updatedAt": datetime.now().isoformat()}

        df.columns = [str(col).replace('\\n', '').strip() for col in df.columns]
        date_col = next((c for c in df.columns if '日付' in c or '年月日' in c), '日付')
        action_col = next((c for c in df.columns if '行動内容' in c), '行動内容')
        priority_col = next((c for c in df.columns if '重点' in c), '重点顧客')
        customer_col = next((c for c in df.columns if '得意先CD' in c), '得意先CD')
        area_col = next((c for c in df.columns if 'エリア' in c), 'エリア')

        def parse_dt(x):
            if not x or str(x).strip() == '': return pd.NaT
            s = str(x).strip()
            try:
                d = pd.to_datetime(s, format='%y/%m/%d')
                if d.year < 2000: d = d + pd.offsets.DateOffset(years=2000)
                return d
            except: pass
            d = pd.to_datetime(s, errors='coerce')
            if pd.notna(d) and d.year < 100: d = d + pd.offsets.DateOffset(years=2000)
            return d

        df['dt'] = df[date_col].apply(parse_dt)
        vdf = df.dropna(subset=['dt']).copy()
        if vdf.empty:
            return {"summary": {"totalReports": 0, "thisMonth": 0, "visits": 0, "calls": 0}, "priority": {"uniqueCustomers": 0, "visits": 0, "calls": 0}, "monthly": [], "ranking": [], "updatedAt": datetime.now().isoformat()}

        total = len(vdf)
        tm = datetime.now()
        tm_cnt = int(((vdf['dt'].dt.year == tm.year) & (vdf['dt'].dt.month == tm.month)).sum())
        is_v = vdf[action_col].astype(str).str.contains('訪問', na=False)
        is_c = vdf[action_col].astype(str).str.contains('電話', na=False)
        is_p = vdf[priority_col].fillna('').astype(str).apply(lambda x: x != '' and x != '-')
        pdf = vdf[is_p]

        vdf['m'] = vdf['dt'].dt.strftime('%y/%m')
        monthly = []
        for m, g in vdf.groupby('m'):
            mv = g[action_col].astype(str).str.contains('訪問', na=False).sum()
            mc = len(g) - mv
            monthly.append({"month": m, "visits": int(mv), "calls": int(mc)})
        monthly.sort(key=lambda x: x['month'], reverse=True)

        return {
            "summary": {"totalReports": total, "thisMonth": tm_cnt, "visits": int(is_v.sum()), "calls": int(is_c.sum())},
            "priority": {"uniqueCustomers": int(pdf[customer_col].nunique()), "visits": int((pdf[action_col].astype(str).str.contains('訪問', na=False)).sum()), "calls": int((pdf[action_col].astype(str).str.contains('電話', na=False)).sum())},
            "monthly": monthly,
            "ranking": [],
            "updatedAt": datetime.now().isoformat()
        }
    except Exception as e:
        logging.error(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

STATIC_DIR = os.path.join(BUNDLE_DIR, "static")
if os.path.exists(STATIC_DIR):
    if os.path.exists(os.path.join(STATIC_DIR, "_next")):
         app.mount("/_next", StaticFiles(directory=os.path.join(STATIC_DIR, "_next")), name="next_assets")
    @app.get("/")
    async def serve_index():
        p = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(p) if os.path.exists(p) else {"msg": "No static"}
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        fp = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(fp): return FileResponse(fp)
        si = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(si) if os.path.exists(si) else {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn, webbrowser, threading
    def ob():
        import time; time.sleep(2); webbrowser.open("http://localhost:8001")
    threading.Thread(target=ob, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header + new_tail)
    print("Successfully patched main.py using regex.")

if __name__ == "__main__":
    patch()
