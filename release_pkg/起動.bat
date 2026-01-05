@echo off
chcp 932 >nul

:: Change to the directory where this batch file is located
cd /d "%~dp0"

echo ===============================================
echo Starting Daily Report System...
echo Current directory: %CD%
echo ===============================================
echo.

:: Check for Python - prioritize py launcher
echo Checking Python installation...
set PYTHON_CMD=
set PYTHON_FOUND=0

:: Try py launcher first
where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    set PYTHON_FOUND=1
)

:: If py not found, try python but avoid Windows Store stub
if %PYTHON_FOUND% equ 0 (
    for /f "tokens=*" %%i in ('where python 2^>nul') do (
        if not "%%i"=="C:\Windows\System32\python" (
            if not "%%i"=="C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\python.exe" (
                set PYTHON_CMD=python
                set PYTHON_FOUND=1
                goto :python_found
            )
        )
    )
)

:python_found
if %PYTHON_FOUND% equ 0 (
    echo Error: Python is not installed.
    echo Please install Python from https://python.org/downloads
    pause
    exit /b
)

echo Using Python: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

:: Check libraries
echo Checking required libraries...
%PYTHON_CMD% -c "import fastapi; import uvicorn; import pandas" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ===============================================
    echo Error: Required libraries not found.
    echo ===============================================
    echo.
    echo Please run the install batch file first.
    echo.
    pause
    exit /b
)

:: Check if main.py exists
if not exist "backend\main.py" (
    echo Error: backend\main.py not found.
    echo Current directory: %CD%
    pause
    exit /b
)

echo.
echo ===============================================
echo Starting backend server...
echo ===============================================
echo.

start "Daily Report Backend" %PYTHON_CMD% backend\main.py
timeout /t 5 >nul

echo Opening browser...
start http://localhost:8001

echo.
echo ===============================================
echo Application started!
echo ===============================================
echo.
echo The application is running in a separate window.
echo You can close this window.
echo.
pause
