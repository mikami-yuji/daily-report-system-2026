$cert = Get-ChildItem -Path "Cert:\CurrentUser\My" | Where-Object { $_.Subject -match "Asahipack" } | Select-Object -First 1

$targetFiles = @(
    "_app_update\DailyReportServer_v2.5.29.exe",
    "\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度\_app_update\DailyReportServer_v2.5.29.exe"
)

foreach ($f in $targetFiles) {
    if (Test-Path $f) {
        Unblock-File -Path $f -ErrorAction SilentlyContinue
        Set-AuthenticodeSignature -FilePath $f -Certificate $cert | Out-Null
        Write-Host "Signed: $f"
    }
}
