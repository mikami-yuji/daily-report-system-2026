# Daily Report System - Robust Startup Script (Japanese)

# Set output encoding to Shift-JIS (CP932) for Japanese Windows Console
[Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(932)

Write-Host "営業日報システム - 強力な起動スクリプト" -ForegroundColor Cyan

# Configuration
$BackendPort = 8001
$FrontendPort = 3000
$ConfigPath = Join-Path $PSScriptRoot "backend\config.json"

# --- Load Configuration from JSON ---
# This avoids hardcoding Japanese characters in the script itself causing encoding issues.
if (Test-Path $ConfigPath) {
    try {
        # PS 5.1 reads JSON as UTF-8
        $Config = Get-Content $ConfigPath -Encoding UTF8 | ConvertFrom-Json
        $NetworkPath = $Config.excel_dir
        Write-Host "設定ファイル(config.json)からパスを読み込みました。" -ForegroundColor Gray
    } catch {
        Write-Error "設定ファイルの読み込みに失敗しました。"
        $NetworkPath = ""
    }
} else {
    Write-Warning "config.json が見つかりません。setup_for_company.ps1 を実行してください。"
    # Fallback to the hardcoded path if config is missing (Risk of Mojibake if file encoding is wrong)
    # We will try to rely on the config file primarily.
    $NetworkPath = "\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度"
}

# --- Function to Kill Process by Port ---
function Kill-PortProcess {
    param ( [int]$Port )
    
    $tcpConnection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($tcpConnection) {
        $processId = $tcpConnection.OwningProcess
        Write-Host "ポート $Port は使用中です (PID: $processId)。終了します..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Write-Host "プロセスを終了しました。" -ForegroundColor Green
        } catch {
            Write-Host "プロセスの終了に失敗しました: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "ポート $Port は利用可能です。" -ForegroundColor Green
    }
}

# --- 1. Cleanup Old Processes ---
Write-Host "`n[1/4] ポートの確認中..."
Kill-PortProcess -Port $BackendPort
Kill-PortProcess -Port $FrontendPort

# --- 2. Network Path Validation ---
Write-Host "`n[2/4] ネットワーク接続を確認中..."
if ([string]::IsNullOrWhiteSpace($NetworkPath)) {
    Write-Warning "ネットワークパスが設定されていません。"
} else {
    Write-Host "確認するパス: $NetworkPath"
    
    if (Test-Path $NetworkPath) {
        Write-Host "ネットワークパスへのアクセスを確認しました: OK" -ForegroundColor Green
    } else {
        Write-Host "警告: ネットワークパスにアクセスできません！" -ForegroundColor RED
        Write-Host "パス: $NetworkPath"
        Write-Host "接続を試みています..."
        # Simple 'ls' to trigger authentication/connection if possible
        Get-ChildItem $NetworkPath -ErrorAction SilentlyContinue | Out-Null
        
        if (Test-Path $NetworkPath) {
            Write-Host "接続が確立されました！" -ForegroundColor Green
        } else {
            Write-Warning "ネットワークドライブに接続できませんでした。利用可能であればローカルキャッシュを使用します。"
        }
    }
}

# --- 3. Start Backend ---
Write-Host "`n[3/4] バックエンドを起動中..."
$BackendScript = "cd backend; python main.py"
Start-Process cmd -ArgumentList "/k $BackendScript" -WindowStyle Minimized
Write-Host "バックエンドが起動しました。"

# --- 4. Start Frontend ---
Write-Host "`n[4/4] フロントエンドを起動中..."
$FrontendScript = "cd frontend; npm run dev"
Start-Process cmd -ArgumentList "/k $FrontendScript" -WindowStyle Minimized
Write-Host "フロントエンドが起動しました。"

Write-Host "`n起動シーケンスが完了しました。" -ForegroundColor Cyan
Write-Host "バックエンド: http://localhost:$BackendPort"
Write-Host "フロントエンド: http://localhost:$FrontendPort"
Write-Host "ウィンドウは最小化されています。閉じないでください。"
