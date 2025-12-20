import os

MAIN_PY_PATH = 'backend/main.py'

NEW_CODE = '''# --- Sales Data Integration (Global) ---
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SALES_CSV_PATH = os.path.join(DATA_DIR, 'sales_data.csv')
os.makedirs(DATA_DIR, exist_ok=True)

global_sales_df = None

def load_sales_data():
    """Loads sales data from CSV into global DataFrame."""
    global global_sales_df
    if not os.path.exists(SALES_CSV_PATH):
        logging.info("No existing sales data found.")
        return

    try:
        logging.info("Loading sales data from disk...")
        try:
            df = pd.read_csv(SALES_CSV_PATH, encoding='cp932')
        except:
            df = pd.read_csv(SALES_CSV_PATH, encoding='utf-8')
        
        df.columns = [str(col).strip() for col in df.columns]
        
        if '得意先コード' in df.columns:
            df['得意先コード'] = df['得意先コード'].astype(str).str.split('.').str[0]
            global_sales_df = df
            logging.info(f"Sales data loaded successfully. {len(df)} rows.")
        else:
            logging.error("Sales CSV missing '得意先コード' column.")
    except Exception as e:
        logging.error(f"Failed to load sales data: {e}")

# Load on startup
load_sales_data()

@app.post("/api/sales/upload")
async def upload_sales_csv(file: UploadFile = File(...)):
    """
    Uploads a global sales data CSV file, saves it, and unloads it into memory.
    """
    try:
        logging.info(f"Receiving sales CSV: {file.filename}")
        contents = await file.read()
        
        import io
        try:
            pd.read_csv(io.BytesIO(contents), encoding='cp932')
        except:
            try:
                pd.read_csv(io.BytesIO(contents), encoding='utf-8')
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid CSV format. Please use Shift-JIS or UTF-8.")

        with open(SALES_CSV_PATH, "wb") as f:
            f.write(contents)
        
        logging.info("Sales CSV saved to disk.")
        load_sales_data()
        
        return {"message": "Sales data uploaded and processed successfully."}

    except Exception as e:
        logging.error(f"Error uploading sales CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/sales/{customer_code}")
async def get_sales_data(customer_code: str):
    """
    Retrieves sales data for a specific customer from the global dataset.
    """
    if global_sales_df is None:
        return {"found": False, "message": "Sales data not yet uploaded."}
    
    try:
        target_code = str(customer_code).split('.')[0]
        matched_row = global_sales_df[global_sales_df['得意先コード'] == target_code]
        
        if matched_row.empty:
            return {"found": False, "message": "Customer not found in sales data."}
        
        row = matched_row.iloc[0]
        
        def get_val(col):
            val = row.get(col)
            if pd.isna(val):
                return None
            if hasattr(val, 'item'): 
                return val.item() 
            return val

        from datetime import datetime
        data = {
            "found": True,
            "rank": get_val('順位'),
            "rank_class": get_val('ランク'),
            "sales_amount": get_val('売上金額'),
            "gross_profit": get_val('粗利'),
            "sales_yoy": get_val('前年比') if '前年比' in global_sales_df.columns else None,
            "sales_2y_ago": get_val('前々年売上'),
            "profit_2y_ago": get_val('前々年粗利'),
            "customer_name": get_val('得意先名称'),
            "updated_at": datetime.now().isoformat()
        }
        return data

    except Exception as e:
        logging.error(f"Error retrieving sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")
'''

with open(MAIN_PY_PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
end_index = -1

for i, line in enumerate(lines):
    if '@app.post("/api/sales/parse")' in line:
        start_index = i
    if '# --- Static File Serving' in line and start_index != -1:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    print(f"Replacing lines {start_index} to {end_index}")
    new_lines = lines[:start_index] + [NEW_CODE + '\n\n'] + lines[end_index:]
    
    with open(MAIN_PY_PATH, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Success")
else:
    print("Could not find block to replace")
    if start_index != -1:
        print(f"Found start at {start_index} but not end")
