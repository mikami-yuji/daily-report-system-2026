@echo off
chcp 65001 > nul
echo ========================================================
echo   株式会社アサヒパック 営業日報システム 電子署名証明書登録
echo ========================================================
echo.
echo Windowsのセキュリティ・スマートアプリコントロールでブロックされないよう、
echo アサヒパックの電子署名証明書をPCに登録（信頼）します。
echo.
echo ※確認画面（ユーザーアカウント制御・証明書のインストール警告）が出たら、
echo   「はい」または「インストール」をクリックしてください。
echo.
pause

set CERT_FILE=%~dp0asahipack_cert.cer

if not exist "%CERT_FILE%" (
    echo [INFO] EXEから証明書を直接抽出中...
    powershell -ExecutionPolicy Bypass -Command "$f = Join-Path '%~dp0' 'DailyReportServer_v2.5.31.exe'; if (-not (Test-Path $f)) { $f = (Get-ChildItem (Join-Path '%~dp0' 'DailyReportServer*.exe') | Select-Object -First 1).FullName }; if ($f) { $sig = Get-AuthenticodeSignature $f; if ($sig.SignerCertificate) { [System.IO.File]::WriteAllBytes('%CERT_FILE%', $sig.SignerCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)); Write-Host '証明書の抽出に成功しました' } }"
)

if not exist "%CERT_FILE%" (
    echo [ERROR] 証明書ファイル asahipack_cert.cer が見つかりません。
    pause
    exit /b 1
)

echo.
echo 証明書をインポート中 (ユーザー＆ローカルマシン)...

:: 1. certutil によるインポート（User & LocalMachine）
certutil.exe -addstore -f -user Root "%CERT_FILE%" > nul 2>&1
certutil.exe -addstore -f -user TrustedPublisher "%CERT_FILE%" > nul 2>&1
certutil.exe -addstore -f Root "%CERT_FILE%" > nul 2>&1
certutil.exe -addstore -f TrustedPublisher "%CERT_FILE%" > nul 2>&1

:: 2. PowerShell による確実なインポート
powershell -ExecutionPolicy Bypass -Command "Import-Certificate -FilePath '%CERT_FILE%' -CertStoreLocation 'Cert:\LocalMachine\Root' -ErrorAction SilentlyContinue; Import-Certificate -FilePath '%CERT_FILE%' -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher' -ErrorAction SilentlyContinue; Import-Certificate -FilePath '%CERT_FILE%' -CertStoreLocation 'Cert:\CurrentUser\Root' -ErrorAction SilentlyContinue; Import-Certificate -FilePath '%CERT_FILE%' -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' -ErrorAction SilentlyContinue"

echo.
echo ========================================================
echo   登録が完了しました！
echo   EXEをダブルクリックして起動できるかご確認ください。
echo ========================================================
echo.
pause
