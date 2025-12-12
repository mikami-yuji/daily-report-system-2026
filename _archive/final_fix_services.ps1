# Daily Report System - Final Service Fix Script
# Run this script as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Daily Report System - Final Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Set paths
$nssmPath = "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe"
$pythonPath = "C:\Users\asahi\AppData\Local\Programs\Python\Python313\python.exe"

if (-not (Test-Path $pythonPath)) {
    Write-Host "ERROR: Python not found at $pythonPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Found Python at: $pythonPath" -ForegroundColor Green
Write-Host ""

# Stop and remove old services
Write-Host "Stopping and removing old services..." -ForegroundColor Yellow
Stop-Service DailyReportFrontend, DailyReportBackend -ErrorAction SilentlyContinue
& $nssmPath remove DailyReportFrontend confirm
& $nssmPath remove DailyReportBackend confirm

Write-Host ""
Write-Host "Installing Backend Service..." -ForegroundColor Green

# Install Backend Service with direct Python path
$backendDir = "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend"
& $nssmPath install DailyReportBackend $pythonPath "main.py"
& $nssmPath set DailyReportBackend AppDirectory $backendDir
& $nssmPath set DailyReportBackend DisplayName "Daily Report System - Backend API"
& $nssmPath set DailyReportBackend Description "Backend API server for the Daily Report System"
& $nssmPath set DailyReportBackend Start SERVICE_AUTO_START
& $nssmPath set DailyReportBackend AppStdout "$backendDir\service.log"
& $nssmPath set DailyReportBackend AppStderr "$backendDir\service_error.log"
& $nssmPath set DailyReportBackend AppRotateFiles 1
& $nssmPath set DailyReportBackend AppRotateBytes 1048576

Write-Host "Backend service installed!" -ForegroundColor Green
Write-Host ""

Write-Host "Installing Frontend Service..." -ForegroundColor Green

# Find npm path
$npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
if (-not $npmPath) {
    $npmPath = "C:\Program Files\nodejs\npm.cmd"
}

# Install Frontend Service
$frontendDir = "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\frontend"
& $nssmPath install DailyReportFrontend $npmPath "run start"
& $nssmPath set DailyReportFrontend AppDirectory $frontendDir
& $nssmPath set DailyReportFrontend DisplayName "Daily Report System - Frontend"
& $nssmPath set DailyReportFrontend Description "Frontend web server for the Daily Report System"
& $nssmPath set DailyReportFrontend Start SERVICE_AUTO_START
& $nssmPath set DailyReportFrontend AppStdout "$frontendDir\service.log"
& $nssmPath set DailyReportFrontend AppStderr "$frontendDir\service_error.log"
& $nssmPath set DailyReportFrontend AppRotateFiles 1
& $nssmPath set DailyReportFrontend AppRotateBytes 1048576
& $nssmPath set DailyReportFrontend DependOnService DailyReportBackend

Write-Host "Frontend service installed!" -ForegroundColor Green
Write-Host ""

Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host "This may take 10-15 seconds..." -ForegroundColor Yellow
Write-Host ""

# Start Backend
Start-Service DailyReportBackend
Write-Host "Backend starting..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check backend status
$backendStatus = (Get-Service DailyReportBackend).Status
if ($backendStatus -eq "Running") {
    Write-Host "✓ Backend is running!" -ForegroundColor Green
} else {
    Write-Host "✗ Backend status: $backendStatus" -ForegroundColor Red
    Write-Host "Check backend\service_error.log for details" -ForegroundColor Yellow
}

# Start Frontend
Start-Service DailyReportFrontend
Write-Host "Frontend starting..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check frontend status
$frontendStatus = (Get-Service DailyReportFrontend).Status
if ($frontendStatus -eq "Running") {
    Write-Host "✓ Frontend is running!" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend status: $frontendStatus" -ForegroundColor Red
    Write-Host "Check frontend\service_error.log for details" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Show service status
Write-Host "Services Status:" -ForegroundColor Yellow
Get-Service DailyReportBackend, DailyReportFrontend | Format-Table -AutoSize

Write-Host ""
Write-Host "Testing connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Backend API is accessible!" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend is not responding yet. Wait a moment and try accessing manually." -ForegroundColor Yellow
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Frontend is accessible!" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend is not responding yet. Wait a moment and try accessing manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Cyan
Write-Host "  Local:   http://localhost:3000" -ForegroundColor White
Write-Host "  Network: http://192.168.1.54:3000" -ForegroundColor White
Write-Host ""
Write-Host "The services will automatically start when the PC boots." -ForegroundColor Green
Write-Host ""

pause
