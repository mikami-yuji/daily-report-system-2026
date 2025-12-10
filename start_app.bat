@echo off
echo Starting Daily Report System (Robust Mode)...

:: Bypass execution policy to allow running the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0start_robust.ps1"

echo.
echo Startup script finished.
pause
