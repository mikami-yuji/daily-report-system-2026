@echo off
cd backend
echo ==========================================
echo Starting Daily Report System (Debug Mode)
echo ==========================================
echo.
echo [1/3] Checking dependencies...
python -m pip install fastapi uvicorn pandas openpyxl
echo.
echo [2/3] Opening Browser...
start "" "http://localhost:8001"
echo.
echo [3/3] Starting Server...
echo If the window closes immediately, there is an error.
echo Please report any error messages displayed below.
echo.
python main.py
pause
