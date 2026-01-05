@echo off
chcp 932 >nul

:: Change to the directory where this batch file is located
cd /d "%~dp0"

echo ===============================================
echo Installing dependencies...
echo Current directory: %CD%
echo ===============================================
echo.

:: Check for Python - prioritize py launcher
echo Checking Python installation...
set PYTHON_CMD=
set PYTHON_FOUND=0

:: Try py launcher first (recommended for Windows)
where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    set PYTHON_FOUND=1
    echo Found Python Launcher: py
)

:: If py not found, try python but avoid Windows Store stub
if %PYTHON_FOUND% equ 0 (
    for /f "tokens=*" %%i in ('where python 2^>nul') do (
        if not "%%i"=="C:\Windows\System32\python" (
            if not "%%i"=="C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\python.exe" (
                set PYTHON_CMD=python
                set PYTHON_FOUND=1
                echo Found Python: %%i
                goto :python_found
            )
        )
    )
)

:python_found
if %PYTHON_FOUND% equ 0 (
    echo.
    echo ===============================================
    echo Error: Python is not installed.
    echo ===============================================
    echo.
    echo Please install Python from: https://python.org/downloads
    echo.
    echo During installation:
    echo   1. Check "Add Python to PATH"
    echo   2. Click "Install Now"
    echo.
    pause
    exit /b
)

echo.
echo Using Python: %PYTHON_CMD%
echo.
echo Python version:
%PYTHON_CMD% --version
echo.

:: Check pip
echo Checking pip...
%PYTHON_CMD% -m pip --version
if %errorlevel% neq 0 (
    echo.
    echo ===============================================
    echo Error: pip is not working.
    echo Trying to install/upgrade pip...
    echo ===============================================
    %PYTHON_CMD% -m ensurepip --upgrade
    if %errorlevel% neq 0 (
        echo.
        echo Failed to install pip.
        echo Please reinstall Python and make sure pip is included.
        pause
        exit /b
    )
)

echo.
echo ===============================================
echo Installing libraries from requirements.txt...
echo ===============================================
echo.

:: Install packages
%PYTHON_CMD% -m pip install -r backend\requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo ===============================================
    echo Error: Installation failed.
    echo ===============================================
    echo.
    echo Please check:
    echo   - Internet connection
    echo   - Firewall settings
    echo   - Try running as Administrator
    echo.
    pause
    exit /b
)

echo.
echo ===============================================
echo Success! Installation completed.
echo ===============================================
echo.
echo You can now run the startup batch file.
echo.
pause
