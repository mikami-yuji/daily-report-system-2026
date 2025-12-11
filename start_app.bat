@echo off
echo Starting Daily Report System (Robust Mode - Python)...

:: Run the Python startup script
py "%~dp0start_services.py"

echo.
echo Startup script finished.
pause
