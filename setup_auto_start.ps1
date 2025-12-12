# 営業日報システム 自動起動設定スクリプト
# このスクリプトを管理者権限で実行すると、Windowsログイン時に自動的にアプリが起動します

param(
    [switch]$Uninstall
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskNameBackend = "DailyReportSystem-Backend"
$TaskNameFrontend = "DailyReportSystem-Frontend"

if ($Uninstall) {
    Write-Host "自動起動を無効にしています..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskNameBackend -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskNameFrontend -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "自動起動を無効にしました。" -ForegroundColor Green
    exit 0
}

Write-Host "営業日報システムの自動起動を設定しています..." -ForegroundColor Cyan

# 既存のタスクを削除
Unregister-ScheduledTask -TaskName $TaskNameBackend -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskNameFrontend -Confirm:$false -ErrorAction SilentlyContinue

# バックエンド起動用バッチファイルを作成
$BackendBat = Join-Path $ScriptDir "backend\start_backend_hidden.vbs"
$BackendBatContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$($ScriptDir)\backend"
WshShell.Run "cmd /c python -m uvicorn main:app --host 0.0.0.0 --port 8001", 0, False
"@
[System.IO.File]::WriteAllText($BackendBat, $BackendBatContent, [System.Text.Encoding]::GetEncoding("shift_jis"))

# フロントエンド起動用VBSファイルを作成（ウィンドウ非表示）
$FrontendVbs = Join-Path $ScriptDir "frontend\start_frontend_hidden.vbs"
$FrontendVbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$($ScriptDir)\frontend"
WshShell.Run "cmd /c npm run dev", 0, False
"@
[System.IO.File]::WriteAllText($FrontendVbs, $FrontendVbsContent, [System.Text.Encoding]::GetEncoding("shift_jis"))

# タスクスケジューラに登録（ログイン時に自動起動）
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

# バックエンドタスク
$ActionBackend = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$BackendBat`"" -WorkingDirectory "$ScriptDir\backend"
Register-ScheduledTask -TaskName $TaskNameBackend -Trigger $Trigger -Action $ActionBackend -Principal $Principal -Description "営業日報システム - バックエンドサーバー" -Force

# フロントエンドタスク（バックエンドの5秒後に起動）
$TriggerFrontend = New-ScheduledTaskTrigger -AtLogOn
$ActionFrontend = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$FrontendVbs`"" -WorkingDirectory "$ScriptDir\frontend"
$SettingsFrontend = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)
Register-ScheduledTask -TaskName $TaskNameFrontend -Trigger $TriggerFrontend -Action $ActionFrontend -Principal $Principal -Description "営業日報システム - フロントエンドサーバー" -Settings $SettingsFrontend -Force

Write-Host ""
Write-Host "=== 設定完了 ===" -ForegroundColor Green
Write-Host "次回のWindowsログインから、営業日報システムが自動的に起動します。" -ForegroundColor White
Write-Host ""
Write-Host "ブラウザで http://localhost:3000 にアクセスしてください。" -ForegroundColor Cyan
Write-Host ""
Write-Host "自動起動を無効にするには: .\setup_auto_start.ps1 -Uninstall" -ForegroundColor Gray
