# UTF-8 で実行
$OutputEncoding = [System.Text.Encoding]::UTF8

# スクリプトの場所をプロジェクトルートとする
$ProjectRoot = $PSScriptRoot
if ([string]::IsNullOrEmpty($ProjectRoot)) {
    $ProjectRoot = (Get-Item ".").FullName
}
Write-Host "Project Root: $ProjectRoot"

# フロントエンドのディレクトリ
$FrontendDir = Join-Path $ProjectRoot "frontend"
$BackendStaticDir = Join-Path $ProjectRoot "backend\static"
$RootStaticDir = Join-Path $ProjectRoot "static"

# フロントエンドのビルド
Write-Host "Building frontend..." -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

# ビルド成果物 (frontend/out) のパス
$OutputDir = Join-Path $FrontendDir "out"

if (-not (Test-Path -LiteralPath $OutputDir)) {
    Write-Error "Build output directory not found at $OutputDir"
    exit 1
}

# backend/static への同期
Write-Host "Syncing to backend/static..." -ForegroundColor Yellow
if (-not (Test-Path -LiteralPath $BackendStaticDir)) {
    New-Item -ItemType Directory -Force -Path $BackendStaticDir | Out-Null
}
$DestNext1 = Join-Path $BackendStaticDir "_next"
if (Test-Path -LiteralPath $DestNext1) {
    Remove-Item -Recurse -Force -LiteralPath $DestNext1
}
Copy-Item -Path "$OutputDir\*" -Destination $BackendStaticDir -Recurse -Force

# root/static への同期
Write-Host "Syncing to root/static..." -ForegroundColor Yellow
if (-not (Test-Path -LiteralPath $RootStaticDir)) {
    New-Item -ItemType Directory -Force -Path $RootStaticDir | Out-Null
}
$DestNext2 = Join-Path $RootStaticDir "_next"
if (Test-Path -LiteralPath $DestNext2) {
    Remove-Item -Recurse -Force -LiteralPath $DestNext2
}
Copy-Item -Path "$OutputDir\*" -Destination $RootStaticDir -Recurse -Force

Write-Host "Sync completed successfully!" -ForegroundColor Green
