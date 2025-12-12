# Daily Report System - Service Management Guide

## Overview
The Daily Report System runs as two Windows services that automatically start when the PC boots.

## Services

### Backend Service
- **Service Name**: `DailyReportBackend`
- **Display Name**: Daily Report System - Backend API
- **Port**: 8000

### Frontend Service
- **Service Name**: `DailyReportFrontend`
- **Display Name**: Daily Report System - Frontend
- **Port**: 3000

---

## Installation

### Prerequisites
- Administrator privileges required
- NSSM (Non-Sucking Service Manager) downloaded and extracted

### Install Services

Run the following commands in PowerShell **as Administrator**:

```powershell
# Set NSSM path
$nssmPath = "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe"

# Install Backend Service
& $nssmPath install DailyReportBackend "C:\Windows\py.exe" "main.py"
& $nssmPath set DailyReportBackend AppDirectory "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend"
& $nssmPath set DailyReportBackend DisplayName "Daily Report System - Backend API"
& $nssmPath set DailyReportBackend Description "Backend API server for the Daily Report System"
& $nssmPath set DailyReportBackend Start SERVICE_AUTO_START
& $nssmPath set DailyReportBackend AppStdout "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend\service.log"
& $nssmPath set DailyReportBackend AppStderr "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend\service_error.log"

# Install Frontend Service
& $nssmPath install DailyReportFrontend "C:\Program Files\nodejs\npm.cmd" "run start"
& $nssmPath set DailyReportFrontend AppDirectory "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\frontend"
& $nssmPath set DailyReportFrontend DisplayName "Daily Report System - Frontend"
& $nssmPath set DailyReportFrontend Description "Frontend web server for the Daily Report System"
& $nssmPath set DailyReportFrontend Start SERVICE_AUTO_START
& $nssmPath set DailyReportFrontend AppStdout "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\frontend\service.log"
& $nssmPath set DailyReportFrontend AppStderr "c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\frontend\service_error.log"

# Set Frontend to depend on Backend (Frontend starts after Backend)
& $nssmPath set DailyReportFrontend DependOnService DailyReportBackend
```

---

## Service Management

### Start Services

```powershell
# Start Backend
Start-Service DailyReportBackend

# Start Frontend
Start-Service DailyReportFrontend

# Or start both
Start-Service DailyReportBackend, DailyReportFrontend
```

### Stop Services

```powershell
# Stop Frontend first
Stop-Service DailyReportFrontend

# Stop Backend
Stop-Service DailyReportBackend

# Or stop both
Stop-Service DailyReportFrontend, DailyReportBackend
```

### Restart Services

```powershell
# Restart Backend
Restart-Service DailyReportBackend

# Restart Frontend
Restart-Service DailyReportFrontend
```

### Check Service Status

```powershell
# Check status
Get-Service DailyReportBackend, DailyReportFrontend

# Or use Services GUI
services.msc
```

---

## Uninstall Services

If you need to remove the services:

```powershell
$nssmPath = "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe"

# Stop services first
Stop-Service DailyReportFrontend, DailyReportBackend

# Remove services
& $nssmPath remove DailyReportFrontend confirm
& $nssmPath remove DailyReportBackend confirm
```

---

## Troubleshooting

### Services won't start

1. Check service logs:
   - Backend: `c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\backend\service_error.log`
   - Frontend: `c:\Users\asahi\.gemini\antigravity\playground\drifting-apollo\frontend\service_error.log`

2. Verify ports are not in use:
   ```powershell
   netstat -ano | findstr ":3000"
   netstat -ano | findstr ":8000"
   ```

3. Check Windows Event Viewer:
   - Open Event Viewer (`eventvwr.msc`)
   - Navigate to Windows Logs → Application
   - Look for errors from DailyReportBackend or DailyReportFrontend

### Application not accessible

1. Verify services are running:
   ```powershell
   Get-Service DailyReportBackend, DailyReportFrontend
   ```

2. Check if ports are listening:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 3000
   Test-NetConnection -ComputerName localhost -Port 8000
   ```

3. Try accessing directly:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/docs

### Restart after code changes

After updating the application code:

```powershell
Restart-Service DailyReportFrontend, DailyReportBackend
```

---

## Access URLs

- **Local Access**: http://localhost:3000
- **Network Access**: http://192.168.1.54:3000
- **Backend API Docs**: http://localhost:8000/docs
