# Daily Report System - Service Fix Script
# Run this script as Administrator to fix the Python path issue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Daily Report System - Service Fix" -ForegroundColor Cyan
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
$pyPath = (Get-Command py -ErrorAction SilentlyContinue).Source

if (-not $pyPath) {
    Write-Host "ERROR: Python launcher (py.exe) not found!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Found Python at: $pyPath" -ForegroundColor Green
Write-Host ""

# Stop services
Write-Host "Stopping services..." -ForegroundColor Yellow
Stop-Service DailyReportFrontend, DailyReportBackend -ErrorAction SilentlyContinue

# Remove old services
Write-Host "Removing old services..." -ForegroundColor Yellow
& $nssmPath remove DailyReportFrontend confirm
& $nssmPath remove DailyReportBackend confirm

Write-Host ""
Write-Host "Installing Backend Service with correct Python path..." -ForegroundColor Green

# Install Backend Service with correct Python path
$backendDir = "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend"
& $nssmPath install DailyReportBackend $pyPath "main.py"
& $nssmPath set DailyReportBackend AppDirectory $backendDir
& $nssmPath set DailyReportBackend DisplayName "Daily Report System - Backend API"
& $nssmPath set DailyReportBackend Description "Backend API server for the Daily Report System"
& $nssmPath set DailyReportBackend Start SERVICE_AUTO_START
& $nssmPath set DailyReportBackend AppStdout "$backendDir\service.log"
& $nssmPath set DailyReportBackend AppStderr "$backendDir\service_error.log"
& $nssmPath set DailyReportBackend AppRotateFiles 1
& $nssmPath set DailyReportBackend AppRotateBytes 1048576

Write-Host "Backend service installed successfully!" -ForegroundColor Green
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

# Set Frontend to depend on Backend
& $nssmPath set DailyReportFrontend DependOnService DailyReportBackend

Write-Host "Frontend service installed successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "Starting services..." -ForegroundColor Yellow

# Start services
Start-Service DailyReportBackend
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Start-Service DailyReportFrontend
Write-Host "Waiting for frontend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services Status:" -ForegroundColor Yellow
Get-Service DailyReportBackend, DailyReportFrontend | Format-Table -AutoSize

Write-Host ""
Write-Host "Testing connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend is not responding. Check service_error.log" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Frontend is running!" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend is not responding. Check service_error.log" -ForegroundColor Red
}

Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Yellow
Write-Host "  Local:   http://localhost:3000" -ForegroundColor White
Write-Host "  Network: http://192.168.1.54:3000" -ForegroundColor White
Write-Host ""

pause
