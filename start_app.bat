@echo off
echo Starting Daily Report System 2026...

:: Start Backend
start "Daily Report Backend 2026" cmd /k "cd backend && py main.py"

:: Start Frontend
start "Daily Report Frontend 2026" cmd /k "cd frontend && npm run dev"

echo Servers are starting...
echo Backend will be at http://localhost:8001
echo Frontend will be at http://localhost:3000
echo You can minimize the opened windows, but do not close them.
pause
