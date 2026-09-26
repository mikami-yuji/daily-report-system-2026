@echo off
cd /d "%~dp0"
echo ========================================================
echo   営業日報システム 2026 を起動しています...
echo   （スマートアプリコントロールの影響を受けずに起動します）
echo ========================================================
echo.

py -3 backend\main.py
if %ERRORLEVEL% NEQ 0 (
    python backend\main.py
)
pause
