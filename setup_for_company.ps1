# 社内PC用セットアップスクリプト
# 実行すると、バックエンドの設定ファイル(config.json)を自動作成し、
# アプリケーションを起動します。

Write-Host "社内PC用セットアップを開始します..." -ForegroundColor Cyan

# バックエンドディレクトリへ移動
$BackendDir = Join-Path $PSScriptRoot "backend"
if (!(Test-Path $BackendDir)) {
    Write-Error "backendディレクトリが見つかりません。プロジェクトルートで実行してください。"
    exit 1
}

# config.jsonの内容（社内ネットワークパスを設定）
$ConfigContent = @{
    excel_dir = "\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度"
}

# JSONファイル作成（UTF-8 BOMなし）
$JsonPath = Join-Path $BackendDir "config.json"
$JsonString = ConvertTo-Json $ConfigContent -Compress
[System.IO.File]::WriteAllText($JsonPath, $JsonString, (New-Object System.Text.UTF8Encoding $false))

Write-Host "設定ファイル(config.json)を作成しました。" -ForegroundColor Green
Write-Host "設定パス: $($ConfigContent.excel_dir)" -ForegroundColor Gray

# ネットワークパスのアクセス確認
if (Test-Path $ConfigContent.excel_dir) {
    Write-Host "ネットワークパスへのアクセスを確認しました: OK" -ForegroundColor Green
} else {
    Write-Host "警告: ネットワークパスにアクセスできません。" -ForegroundColor Yellow
    Write-Host "VPNに接続しているか、社内ネットワークに繋がっているか確認してください。" -ForegroundColor Yellow
}

Write-Host "`nアプリケーションを起動します..." -ForegroundColor Cyan

# start_app.batを実行
$StartScript = Join-Path $PSScriptRoot "start_app.bat"
if (Test-Path $StartScript) {
    Start-Process $StartScript
} else {
    Write-Error "start_app.batが見つかりません。"
}
