@echo off
echo Starting Daily Report System...

:: Start Backend
start "Daily Report Backend" cmd /k "cd backend && python main.py"

:: Start Frontend
start "Daily Report Frontend" cmd /k "cd frontend && npm run dev -- --webpack"

echo Servers are starting...
echo Backend will be at http://localhost:8001
echo Frontend will be at http://localhost:3000
echo You can minimize the opened windows, but do not close them.
pause
