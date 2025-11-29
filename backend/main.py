from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import openpyxl
from datetime import datetime
import os
import shutil

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXCEL_DIR = "../"
DEFAULT_EXCEL_FILE = "daily_report_template.xlsm"

class ReportInput(BaseModel):
    日付: str
    行動内容: str
    エリア: str = ""
    得意先CD: str = ""
    訪問先名: str
    面談者: str = ""
    滞在時間: str = ""
    商談内容: str = ""
    提案物: str = ""
    次回プラン: str = ""
    上長コメント: str = ""
    コメント返信欄: str = ""

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

@app.get("/customers")
def get_customers(filename: str = DEFAULT_EXCEL_FILE):
    """Get customer list from the Excel file"""
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Read the '得意先_List' sheet
        df = pd.read_excel(excel_file, sheet_name='得意先_List', header=0)
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
        
        # Rename specific columns
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
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


@app.get("/reports")
def get_reports(filename: str = DEFAULT_EXCEL_FILE):
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Read the '営業日報' sheet
        df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
        
        # Clean up column names (remove newlines)
        df.columns = [str(col).replace('\n', '') for col in df.columns]
        
        # Rename specific columns to match frontend expectations
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
            '訪問先名得意先名': '訪問先名'
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
def get_interviewers(customer_cd: str, filename: str = DEFAULT_EXCEL_FILE):
    """Get list of interviewers for a specific customer"""
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Read the '営業日報' sheet
        df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
        
        # Clean up column names
        df.columns = [str(col).replace('\n', '') for col in df.columns]
        
        # Rename specific columns
        df = df.rename(columns={
            '得意先CD.': '得意先CD',
        })
        
        # Convert customer_cd to float for matching (Excel stores as float)
        try:
            customer_cd_float = float(customer_cd)
        except ValueError:
            # If conversion fails, try string matching
            customer_cd_float = customer_cd
        
        # Filter by customer code and get unique interviewers
        customer_reports = df[df['得意先CD'] == customer_cd_float]
        interviewers = customer_reports['面談者'].dropna().unique().tolist()
        
        # Remove empty strings and sort
        interviewers = [str(i).strip() for i in interviewers if str(i).strip() and str(i).strip() != 'nan']
        interviewers = sorted(set(interviewers))
        
        return {"customer_cd": customer_cd, "interviewers": interviewers}
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
        
        # Find the next empty row
        next_row = ws.max_row + 1
        
        # Get the last management number and increment it
        last_mgmt_num = ws.cell(row=ws.max_row, column=1).value
        new_mgmt_num = (last_mgmt_num + 1) if isinstance(last_mgmt_num, int) else next_row - 1
        
        # Prepare the data to write
        # Adjust column indices based on actual Excel structure (251113_2026-_-_008.xlsm)
        ws.cell(row=next_row, column=1, value=new_mgmt_num)  # 管理番号
        ws.cell(row=next_row, column=2, value=report.日付)  # 日付
        ws.cell(row=next_row, column=3, value=report.行動内容)  # 行動内容
        ws.cell(row=next_row, column=4, value=report.エリア)  # エリア
        ws.cell(row=next_row, column=5, value=report.得意先CD)  # 得意先CD.
        ws.cell(row=next_row, column=7, value=report.訪問先名)  # 訪問先名\n得意先名
        ws.cell(row=next_row, column=12, value=report.面談者)  # 面談者
        ws.cell(row=next_row, column=13, value=report.滞在時間)  # 滞在\n時間
        ws.cell(row=next_row, column=19, value=report.商談内容)  # 商談内容 (Index 19)
        ws.cell(row=next_row, column=20, value=report.提案物)  # 提案物 (Index 20)
        ws.cell(row=next_row, column=21, value=report.次回プラン)  # 次回プラン (Index 21)
        ws.cell(row=next_row, column=23, value=report.上長コメント)  # 上長コメント (Index 23)
        ws.cell(row=next_row, column=24, value=report.コメント返信欄)  # コメント返信欄 (Index 24)
        
        # Save the workbook
        wb.save(excel_file)
        wb.close()
        
        return {"message": "Report added successfully", "management_number": new_mgmt_num}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/reports/{management_number}")
def update_report(management_number: int, report: ReportInput, filename: str = DEFAULT_EXCEL_FILE):
    excel_file = os.path.join(EXCEL_DIR, filename)
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found")
    
    try:
        # Load workbook with openpyxl to preserve formulas and macros
        wb = openpyxl.load_workbook(excel_file, keep_vba=True)
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
        
        # Update the data
        ws.cell(row=target_row, column=2, value=report.日付)
        ws.cell(row=target_row, column=3, value=report.行動内容)
        ws.cell(row=target_row, column=4, value=report.エリア)
        ws.cell(row=target_row, column=5, value=report.得意先CD)
        ws.cell(row=target_row, column=7, value=report.訪問先名)
        ws.cell(row=target_row, column=12, value=report.面談者)
        ws.cell(row=target_row, column=13, value=report.滞在時間)
        ws.cell(row=target_row, column=19, value=report.商談内容)
        ws.cell(row=target_row, column=20, value=report.提案物)
        ws.cell(row=target_row, column=21, value=report.次回プラン)
        ws.cell(row=target_row, column=23, value=report.上長コメント)
        ws.cell(row=target_row, column=24, value=report.コメント返信欄)
        
        # Save the workbook
        wb.save(excel_file)
        wb.close()
        
        return {"message": "Report updated successfully"}
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
    uvicorn.run(app, host="0.0.0.0", port=8000)

