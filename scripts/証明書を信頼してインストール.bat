@echo off
chcp 65001 > nul
echo ========================================================
echo   株式会社アサヒパック 営業日報システム 電子署名証明書登録
echo ========================================================
echo.
echo Windowsのセキュリティでブロックされないよう、
echo アサヒパックの電子署名証明書をPCに登録（信頼）します。
echo.
echo ※確認画面（ユーザーアカウント制御・証明書のインストール警告）が出たら、
echo   「はい」または「インストール」をクリックしてください。
echo.
pause

set CERT_FILE=%~dp0asahipack_cert.cer

if not exist "%CERT_FILE%" (
    powershell -Command "$c = Get-ChildItem -Path 'Cert:\CurrentUser\My' | Where-Object { $_.Subject -match 'Asahipack' } | Select-Object -First 1; Export-Certificate -Cert $c -FilePath '%CERT_FILE%'"
)

echo 証明書をインポート中...
certutil.exe -addstore -user Root "%CERT_FILE%"
certutil.exe -addstore -user TrustedPublisher "%CERT_FILE%"

echo.
echo ========================================================
echo   完了しました！EXEをダブルクリックして起動できます。
echo ========================================================
echo.
pause
