@echo off
setlocal
echo ---------------------------------------------------
echo  営業日報システム デバッグ起動モード
echo ---------------------------------------------------
echo.
echo [1/3] バックエンドを起動します...
cd backend
start "DailyReport Backend (Debug)" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8001"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] バックエンドディレクトリへの移動に失敗しました。
    pause
    exit /b
)
cd ..

timeout /t 3 > nul

echo.
echo [2/3] フロントエンドを起動します...
cd frontend
start "DailyReport Frontend (Debug)" cmd /k "npm run dev"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] フロントエンドディレクトリへの移動に失敗しました。
    pause
    exit /b
)
cd ..

echo.
echo [3/3] ブラウザを開きます...
timeout /t 5 > nul
start http://localhost:3000

echo.
echo ===================================================
echo  起動処理が完了しました。
echo  もし黒い画面にエラーが表示されている場合は、
echo  その内容を教えてください。
echo ===================================================
pause