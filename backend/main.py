from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import pandas as pd
import openpyxl
from datetime import datetime
import os
import shutil
import json

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Load configuration
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get('excel_dir', r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度')
        except Exception as e:
            print(f"Warning: Failed to load config.json: {e}")
            return r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度'
    return r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度'

EXCEL_DIR = load_config()
DEFAULT_EXCEL_FILE = "daily_report_template.xlsm"

class ReportInput(BaseModel):
    model_config = {"populate_by_name": True}
    
    日付: str
    行動内容: str
    エリア: str = ""
    得意先CD: str = ""
    直送先CD: str = ""
    訪問先名: str
    直送先名: str = ""
    重点顧客: str = ""
    ランク: str = ""
    面談者: str = ""
    滞在時間: str = ""
    商談内容: str = ""
    提案物: str = ""
    次回プラン: str = ""
    デザイン提案有無: str = ""
    デザイン種別: str = ""
    デザイン名: str = ""
    デザイン進捗状況: str = ""
    デザイン依頼No: str = Field("", alias="デザイン依頼No.")
    上長コメント: str = ""
    コメント返信欄: str = ""
    上長: str = ""
    山澄常務: str = ""
    岡本常務: str = ""
    中野次長: str = ""
    既読チェック: str = ""

    @field_validator('得意先CD', '直送先CD', mode='before')
    @classmethod
    def convert_to_string(cls, v):
        if v is None:
            return ""
        return str(v)

@app.get("/")
def read_root():
    return {"message": "Daily Report API is running"}

@app.get("/files")
def list_excel_files():
    """List all Excel files in the directory"""
    try:
        files = []
        for file in os.listdir(EXCEL_DIR):
            if file.endswith(('.xlsx', '.xlsm')):
                file_path = os.path.join(EXCEL_DIR, file)
                file_size = os.path.getsize(file_path)
                file_mtime = os.path.getmtime(file_path)
                files.append({
                    "name": file,
                    "size": file_size,
                    "modified": datetime.fromtimestamp(file_mtime).isoformat()
                })
        return {"files": files, "default": DEFAULT_EXCEL_FILE}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Cache for Excel dataframes: {(filename, sheet_name): {'mtime': float, 'df': pd.DataFrame}}
CACHE = {}

def create_backup(file_path):
    try:
        backup_dir = os.path.join(os.path.dirname(file_path), 'backup')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = os.path.basename(file_path)
        name, ext = os.path.splitext(filename)
        backup_filename = f"{name}_{timestamp}{ext}"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(file_path, backup_path)
        print(f"Backup created: {backup_path}")
    except Exception as e:
        print(f"Warning: Failed to create backup: {e}")


def get_cached_dataframe(filename: str, sheet_name: str) -> pd.DataFrame:
    """
    Get dataframe from cache or read from Excel file if modified or not in cache.
    """
    excel_file = os.path.join(EXCEL_DIR, filename)
    
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    current_mtime = os.path.getmtime(excel_file)
    cache_key = (filename, sheet_name)
    
    if cache_key in CACHE:
        cached_data = CACHE[cache_key]
        if cached_data['mtime'] == current_mtime:
            return cached_data['df'].copy() # Return copy to prevent mutation of cached data
            
    # Read from file
    try:
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=0)
        CACHE[cache_key] = {'mtime': current_mtime, 'df': df}
        return df.copy()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

@app.get("/customers")
def get_customers(filename: str = DEFAULT_EXCEL_FILE):
    """Get customer list from the Excel file"""
    try:
        # Get dataframe from cache
        df = get_cached_dataframe(filename, '得意先_List')
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
        
        # Rename specific columns
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
            '直送先CD.': '直送先CD',
        })
        
        # Fill NaN values with empty strings
        df = df.fillna(value='')
        
        # Convert to dict
        records = df.to_dict(orient="records")
        
        # Clean the records
        import math
        cleaned_records = []
        for record in records:
            cleaned_record = {}
            for key, value in record.items():
                if isinstance(value, float):
                    if math.isnan(value) or math.isinf(value):
                        cleaned_record[key] = None
                    else:
                        cleaned_record[key] = value
                elif value == '':
                    cleaned_record[key] = None
                elif isinstance(value, str):
                    import re
                    cleaned_value = re.sub(r'_x000D_', '\n', value)
                    cleaned_value = cleaned_value.replace('\r', '')
                    cleaned_record[key] = cleaned_value
                else:
                    cleaned_record[key] = value
            cleaned_records.append(cleaned_record)

        return cleaned_records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        

@app.get("/interviewers")
def get_interviewers(customer_code: str, filename: str = DEFAULT_EXCEL_FILE):
    """Get list of interviewers for a specific customer"""
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Read the '営業日報' sheet
        df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
        
        # Rename specific columns to match frontend expectations
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
        })
        
        # Filter by customer code
        customer_reports = df[df['得意先CD'] == customer_code]
        
        # Get unique interviewers, excluding NaN and '-'
        interviewers = customer_reports['面談者'].dropna().unique().tolist()
        interviewers = [i for i in interviewers if i and str(i).strip() not in ['-', 'nan', '']]
        
        return interviewers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/{management_number}")
def get_report_by_id(management_number: int, filename: str = DEFAULT_EXCEL_FILE):
    """指定された管理番号の日報を取得"""
    try:
        # Get dataframe from cache
        df = get_cached_dataframe(filename, '営業日報')
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '') for col in df.columns]
        
        # Rename specific columns
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
            '訪問先名得意先名': '訪問先名'
        })
        
        # Filter by management number
        report_df = df[df['管理番号'] == management_number]
        
        if report_df.empty:
            raise HTTPException(status_code=404, detail=f"Report with management number {management_number} not found")
        
        # Get the first (and should be only) record
        record = report_df.iloc[0].to_dict()
        
        # Clean the record
        import math
        cleaned_record = {}
        for key, value in record.items():
            if isinstance(value, float):
                if math.isnan(value) or math.isinf(value):
                    cleaned_record[key] = None
                elif key == '得意先CD' and not math.isnan(value):
                    cleaned_record[key] = str(int(value))
                else:
                    cleaned_record[key] = value
            elif value == '':
                cleaned_record[key] = None
            elif isinstance(value, str):
                import re
                cleaned_value = re.sub(r'_x000D_', '\n', value)
                cleaned_value = cleaned_value.replace('\r', '')
                cleaned_record[key] = cleaned_value
            else:
                cleaned_record[key] = value
        
        return cleaned_record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports")
def get_reports(filename: str = DEFAULT_EXCEL_FILE):
    try:
        print(f"DEBUG: Fetching reports for {filename} from {EXCEL_DIR}")
        # Get dataframe from cache
        df = get_cached_dataframe(filename, '営業日報')
        
        # Clean up column names (remove newlines and strip)
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
        
        # Rename specific columns to match frontend expectations
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
            '訪問先名得意先名': '訪問先名',
            '直送先CD.': '直送先CD',
            '直送先名.': '直送先名'
        })
        
        # Replace all NaN, infinity, and null values with None
        # Use fillna to replace NaN with None
        df = df.fillna(value='')
        
        # Convert dates to string to avoid serialization issues
        if '日付' in df.columns:
             df['日付'] = df['日付'].astype(str)
        
        # Convert to dict and manually clean any remaining problematic values
        records = df.to_dict(orient="records")
        
        # Clean the records to ensure JSON compatibility
        import math
        cleaned_records = []
        for record in records:
            cleaned_record = {}
            for key, value in record.items():
                if isinstance(value, float):
                    if math.isnan(value) or math.isinf(value):
                        cleaned_record[key] = None
                    # Convert customer code to string without decimal
                    elif key in ['得意先CD', '直送先CD'] and not math.isnan(value):
                        cleaned_record[key] = str(int(value))
                    else:
                        cleaned_record[key] = value
                elif value == '':
                    cleaned_record[key] = None
                elif isinstance(value, str):
                    # Replace Excel's carriage return artifacts with proper newlines
                    import re
                    cleaned_value = re.sub(r'_x000D_', '\n', value)
                    cleaned_value = cleaned_value.replace('\r', '')
                    cleaned_record[key] = cleaned_value
                else:
                    cleaned_record[key] = value
            cleaned_records.append(cleaned_record)

        return cleaned_records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/interviewers/{customer_cd}")
def get_interviewers(
    customer_cd: str, 
    filename: str = DEFAULT_EXCEL_FILE,
    customer_name: Optional[str] = None,
    delivery_name: Optional[str] = None
):
    """Get list of interviewers for a specific customer with optional name filtering"""
    try:
        # Get dataframe from cache
        df = get_cached_dataframe(filename, '営業日報')
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '') for col in df.columns]
        
        # Rename specific columns to standard names
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
            '直送先CD.': '直送先CD',
            '訪問先名得意先名': '訪問先名', # Case where \n was removed
            '訪問先名\n得意先名': '訪問先名', # Just in case
        })
        
        # Convert customer_cd to float for matching (Excel stores as float)
        try:
            customer_cd_float = float(customer_cd)
        except ValueError:
            # If conversion fails, try string matching
            customer_cd_float = customer_cd
        
        # Base filter: customer code
        # Handle potential float/string mismatch by trying both if needed, but usually float is correct for number-like CDs
        customer_reports = df[df['得意先CD'] == customer_cd_float]
        
        # Name filtering logic
        if delivery_name:
            # If delivery_name is provided, filter by it
            # Ensure '直送先名' column exists
            if '直送先名' in customer_reports.columns:
                customer_reports = customer_reports[customer_reports['直送先名'] == delivery_name]
        
        # If no delivery_name, or if we want to also filter by customer_name when delivery_name is NOT set
        # The requirement is "past interviewers matching ... Direct Delivery Name (if provided) OR Customer Name (if matching)"
        # If we selected a delivery destination, we used the block above.
        # If we selected a customer (without direct delivery), we should strictly filter by that customer name if possible, 
        # to avoid showing interviewers from other branches if they share the same Customer CD (rare but possible).
        # OR more importantly, if we are in "Direct Delivery" mode, we already filtered.
        # If we are NOT in "Direct Delivery" mode (delivery_name is None), we might want to filter by customer_name
        # to ensure we don't pick up rows that HAVE a direct delivery name (i.e. different destination).
        elif customer_name:
             if '訪問先名' in customer_reports.columns:
                 # Filter rows where Visit Name contains customer_name OR matches exactly
                 # Since '訪問先名' in DB might contain 'Customer Name Direct Delivery Name' now,
                 # strict matching might be tricky.
                 # But usually '訪問先名' == 'Customer Name' for standard records.
                 # Let's try exact match or contains.
                 # Also, we might want to EXCLUDE rows that have a '直送先名' if we are selecting a generic customer?
                 # User said: " 直近のログではなく、得意先名や直送先名が一致する過去に入力した面談者のみ"
                 
                 # If delivery_name is NOT provided, it effectively means we want records for the main customer.
                 # So we should probably match rows where Visit Name is exactly Customer Name, OR contains it.
                 # Let's use simple filtering: if customer_name is passed, try to filter by it.
                 # But keep in mind 訪問先名 might include 直送先名 suffix now.
                 pass

        # Updated Strategy for clarity:
        # 1. Base: Customer CD
        # 2. If delivery_name provided: matches '直送先名' == delivery_name
        # 3. If delivery_name NOT provided but customer_name provided: matches '訪問先名' == customer_name OR '直送先名' is Empty/NaN
        #    (This covers the case where we selected the main customer and want to exclude direct delivery branches)
        
        if delivery_name and '直送先名' in customer_reports.columns:
            customer_reports = customer_reports[customer_reports['直送先名'] == delivery_name]
        elif '直送先名' in customer_reports.columns:
             # If no delivery name specified, we prefer rows that ALSO have no delivery name specified
             # This avoids suggesting interviewers specific to a branch when we selected the HQ
             customer_reports = customer_reports[
                 customer_reports['直送先名'].isna() | 
                 (customer_reports['直送先名'] == '') | 
                 (customer_reports['直送先名'] == None)
             ]

        interviewers = customer_reports['面談者'].dropna().unique().tolist()
        
        # Remove empty strings and sort
        interviewers = [str(i).strip() for i in interviewers if str(i).strip() and str(i).strip() != 'nan']
        interviewers = sorted(set(interviewers))
        
        return {"customer_cd": customer_cd, "interviewers": interviewers}
    except Exception as e:
        print(f"Error in get_interviewers: {str(e)}") # Add logging
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/designs/{customer_cd}")
def get_designs(customer_cd: str, filename: str = DEFAULT_EXCEL_FILE):
    """Get list of design requests for a specific customer"""
    try:
        # Get dataframe from cache
        df = get_cached_dataframe(filename, '営業日報')
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '') for col in df.columns]
        
        # Rename specific columns
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
        })
        
        # Convert customer_cd to float for matching
        try:
            customer_cd_float = float(customer_cd)
        except ValueError:
            customer_cd_float = customer_cd
        
        # Filter by customer code
        customer_reports = df[df['得意先CD'] == customer_cd_float].copy()
        
        # Filter for records with design request number
        design_reports = customer_reports[customer_reports['デザイン依頼No.'].notna()]
        
        # Get unique design request numbers
        unique_design_nos = design_reports['デザイン依頼No.'].unique()
        
        designs = []
        for design_no in unique_design_nos:
            # Get all records for this design number
            design_records = design_reports[design_reports['デザイン依頼No.'] == design_no]
            
            # Get the latest record (assuming lower down in Excel is newer, or we could sort by date if available)
            # Here we just take the last one in the dataframe which corresponds to the last row in Excel
            latest_record = design_records.iloc[-1]
            
            # Get the status
            status = str(latest_record['デザイン進捗状況']) if pd.notna(latest_record['デザイン進捗状況']) else ""
            
            # Skip designs with completed/rejected statuses: 出稿, 不採用(コンペ負け), 不採用(企画倒れ)
            if '出稿' in status or 'コンペ負け' in status or '企画倒れ' in status:
                continue
            
            design_info = {
                "デザイン依頼No": design_no,
                "デザイン名": str(latest_record['デザイン名']) if pd.notna(latest_record['デザイン名']) else "",
                "デザイン種別": str(latest_record['デザイン種別']) if pd.notna(latest_record['デザイン種別']) else "",
                "デザイン進捗状況": status,
                "デザイン提案有無": str(latest_record['デザイン提案有無']) if pd.notna(latest_record['デザイン提案有無']) else ""
            }
            designs.append(design_info)
            
        return {"customer_cd": customer_cd, "designs": designs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reports")
def add_report(report: ReportInput, filename: str = DEFAULT_EXCEL_FILE):
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Load workbook with openpyxl to preserve formulas and macros
        wb = openpyxl.load_workbook(excel_file, keep_vba=True)
        ws = wb['営業日報']
        
        # Find the maximum management number and its row by scanning all rows
        max_mgmt_num = 0
        max_mgmt_row = 1  # Default to header row if no data found
        for row in range(2, ws.max_row + 1):  # Start from row 2 (skip header)
            mgmt_num = ws.cell(row=row, column=1).value
            try:
                if mgmt_num is not None:
                    val = int(mgmt_num)
                    if val > max_mgmt_num:
                        max_mgmt_num = val
                        max_mgmt_row = row
            except (ValueError, TypeError):
                continue
        
        print(f"DEBUG: Max Mgmt Num: {max_mgmt_num}, Max Mgmt Row: {max_mgmt_row}")

        # Increment to get new management number
        new_mgmt_num = max_mgmt_num + 1
        
        # Insert at the row immediately after the last management number
        next_row = max_mgmt_row + 1
        print(f"DEBUG: Writing to Row: {next_row}")
        
        # Prepare the data to write
        # Adjust column indices based on actual Excel structure (251113_2026-_-_008.xlsm)
        # Also copy styles from the previous row (max_mgmt_row) to the new row (next_row)
        
        from copy import copy

        def copy_style(source_cell, target_cell):
            if source_cell.has_style:
                target_cell.font = copy(source_cell.font)
                target_cell.border = copy(source_cell.border)
                target_cell.fill = copy(source_cell.fill)
                target_cell.number_format = copy(source_cell.number_format)
                target_cell.protection = copy(source_cell.protection)
                target_cell.alignment = copy(source_cell.alignment)

        # Define the columns to write to and their values
        columns_to_write = {
            1: new_mgmt_num, # 管理番号
            2: report.日付, # 日付
            3: report.行動内容, # 行動内容
            4: report.エリア, # エリア
            5: report.得意先CD, # 得意先CD.
            6: report.直送先CD, # 直送先CD.
            7: report.訪問先名, # 訪問先名\n得意先名
            8: report.直送先名, # 直送先名
            9: report.重点顧客, # 重点顧客
            10: report.ランク, # ランク
            12: report.面談者, # 面談者
            13: report.滞在時間, # 滞在\n時間
            14: report.デザイン提案有無, # デザイン提案有無
            15: report.デザイン種別, # デザイン種別
            16: report.デザイン名, # デザイン名
            17: report.デザイン進捗状況, # デザイン進捗状況
            18: report.デザイン依頼No, # デザイン依頼No.
            19: report.商談内容, # 商談内容 (Index 19)
            20: report.提案物, # 提案物 (Index 20)
            21: report.次回プラン # 次回プラン (Index 21)
        }

        for col_idx, value in columns_to_write.items():
            target_cell = ws.cell(row=next_row, column=col_idx)
            target_cell.value = value
            
            # Copy style from the row above (max_mgmt_row)
            # Ensure we are copying from a valid row
            if max_mgmt_row >= 2:
                source_cell = ws.cell(row=max_mgmt_row, column=col_idx)
                copy_style(source_cell, target_cell)

        
        # Create backup before saving
        create_backup(excel_file)
        
        # Save the workbook
        wb.save(excel_file)
        wb.close()
        
        
        # Clear cache
        cache_key = (filename, '営業日報')
        if cache_key in CACHE:
            del CACHE[cache_key]
        
        return {
            "message": "Report added successfully", 
            "management_number": new_mgmt_num,
            "file_path": os.path.abspath(excel_file)
        }
    except PermissionError:
        raise HTTPException(
            status_code=409,
            detail="ファイルが開かれているため保存できません。Excelファイルを閉じてから再度実行してください。"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reports/{management_number}")
def update_report(management_number: int, report: ReportInput, filename: str = DEFAULT_EXCEL_FILE):
    """既存の日報を更新（全項目対応）"""
    try:
        excel_file = os.path.join(EXCEL_DIR, filename)
        
        # Load the workbook
        wb = openpyxl.load_workbook(excel_file, keep_vba=True)
        if '営業日報' not in wb.sheetnames:
            raise HTTPException(status_code=404, detail="Sheet '営業日報' not found")
             
        ws = wb['営業日報']
        
        # Find the row with the matching management number
        target_row = None
        for row in range(2, ws.max_row + 1):
            cell_value = ws.cell(row=row, column=1).value
            if cell_value == management_number:
                target_row = row
                break
        
        if not target_row:
            raise HTTPException(status_code=404, detail=f"Report with management number {management_number} not found")
        
        # Update all fields (same column mapping as add_report)
        columns_to_write = {
            2: report.日付,
            3: report.行動内容,
            4: report.エリア,
            5: report.得意先CD,
            6: report.直送先CD,
            7: report.訪問先名,
            8: report.直送先名,
            9: report.重点顧客,
            10: report.ランク,
            12: report.面談者,
            13: report.滞在時間,
            14: report.デザイン提案有無,
            15: report.デザイン種別,
            16: report.デザイン名,
            17: report.デザイン進捗状況,
            18: report.デザイン依頼No,
            19: report.商談内容,
            20: report.提案物,
            21: report.次回プラン
        }

        for col_idx, value in columns_to_write.items():
            ws.cell(row=target_row, column=col_idx, value=value)
        
        # Create backup before saving
        create_backup(excel_file)
        
        # Save the workbook
        wb.save(excel_file)
        wb.close()
        
        # Clear cache for this file
        cache_key = (filename, '営業日報')
        if cache_key in CACHE:
            del CACHE[cache_key]
        
        return {"message": "Report updated successfully", "management_number": management_number}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(
            status_code=409,
            detail="ファイルが開かれているため保存できません。Excelファイルを閉じてから再度実行してください。"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reports/{management_number}")
def delete_report(management_number: int, filename: str = DEFAULT_EXCEL_FILE):
    """指定された管理番号の日報を削除"""
    try:
        excel_file = os.path.join(EXCEL_DIR, filename)
        
        # Load the workbook
        wb = openpyxl.load_workbook(excel_file, keep_vba=True)
        if '営業日報' not in wb.sheetnames:
            raise HTTPException(status_code=404, detail="Sheet '営業日報' not found")
             
        ws = wb['営業日報']
        
        # Find the row with the matching management number
        target_row = None
        for row in range(2, ws.max_row + 1):
            cell_value = ws.cell(row=row, column=1).value
            if cell_value == management_number:
                target_row = row
                break
        
        if not target_row:
            raise HTTPException(status_code=404, detail=f"Report with management number {management_number} not found")
        
        # Delete the row
        ws.delete_rows(target_row, 1)
        
        # Save the workbook
        wb.save(excel_file)
        wb.close()
        
        # Clear cache for this file
        cache_key = (filename, '営業日報')
        if cache_key in CACHE:
            del CACHE[cache_key]
        
        return {"message": "Report deleted successfully", "management_number": management_number}
    except HTTPException:
        raise
    except PermissionError:
        raise HTTPException(
            status_code=409,
            detail="ファイルが開かれているため保存できません。Excelファイルを閉じてから再度実行してください。"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an Excel file to the backend directory"""
    try:
        # Validate file extension
        if not file.filename.endswith(('.xlsx', '.xlsm')):
            raise HTTPException(status_code=400, detail="Only .xlsx and .xlsm files are allowed")
        
        # Save the uploaded file
        file_path = os.path.join(EXCEL_DIR, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

