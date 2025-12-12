@echo off
chcp 932 > nul
setlocal

echo ---------------------------------------------------
echo  営業日報システムを起動しています...
echo  (この画面は閉じないでください)
echo ---------------------------------------------------

where python > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Pythonが見つかりません。インストールしてください。
    pause
    exit /b
)

where npm > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js (npm) が見つかりません。インストールしてください。
    pause
    exit /b
)

echo [1/3] バックエンド(サーバー)を起動中...
cd backend
start /min "Daily Report Backend" cmd /c "python -m uvicorn main:app --host 0.0.0.0 --port 8001"
cd ..

timeout /t 3 > nul

echo [2/3] フロントエンド(画面)を起動中...
cd frontend
start /min "Daily Report Frontend" cmd /c "npm run dev"
cd ..

echo [3/3] ブラウザを起動します...
timeout /t 5 > nul
start http://localhost:3000

echo.
echo ===================================================
echo  起動完了！
echo  ブラウザが表示されるまでお待ちください。
echo.
echo  終了するには、この画面を閉じてから
echo  「営業日報システム停止.vbs」を実行してください。
echo ===================================================
pause