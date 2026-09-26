$cert = Get-ChildItem -Path "Cert:\CurrentUser\My" | Where-Object { $_.Subject -match "Asahipack" } | Select-Object -First 1

$targetFiles = @(
    "dist\DailyReportServer.exe",
    "C:\Users\ASAHI\Desktop\DailyReportSystem\DailyReportServer.exe",
    "_app_update\DailyReportServer_v2.5.31.exe",
    "\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度\_app_update\DailyReportServer_v2.5.31.exe"
)

foreach ($f in $targetFiles) {
    if (Test-Path $f) {
        Unblock-File -Path $f -ErrorAction SilentlyContinue
        $sig = Set-AuthenticodeSignature -FilePath $f -Certificate $cert
        $check = Get-AuthenticodeSignature -FilePath $f
        Write-Host "Signed: $f -> Status: $($check.Status), Signer: $($check.SignerCertificate.Subject)"
    } else {
        Write-Host "File not found: $f"
    }
}
