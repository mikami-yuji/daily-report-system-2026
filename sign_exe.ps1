param (
    [string]$ExePath = "$PSScriptRoot\dist\DailyReportServer.exe"
)

$ErrorActionPreference = "Stop"

Write-Host "=== DailyReportServer Code Signing Tool ===" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $ExePath)) {
    Write-Error "Target EXE not found: $ExePath"
    exit 1
}

$certSubject = "CN=DailyReportSystem, O=AsahiPack, OU=Dev"
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*DailyReportSystem*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "[1/3] Generating new self-signed Code Signing Certificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $certSubject -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(10)
    Write-Host "  -> Certificate created: $($cert.Thumbprint)" -ForegroundColor Green
} else {
    Write-Host "[1/3] Found existing Code Signing Certificate: $($cert.Subject)" -ForegroundColor Green
}

Write-Host "[2/3] Applying Authenticode digital signature to: $ExePath" -ForegroundColor Yellow
$sigResult = Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert -ErrorAction SilentlyContinue

Write-Host "[3/3] Signature Verification:" -ForegroundColor Yellow
$verify = Get-AuthenticodeSignature -FilePath $ExePath
Write-Host "  Path: $($verify.Path)"
Write-Host "  Status: $($verify.Status)" -ForegroundColor Cyan
Write-Host "  Signer: $($verify.SignerCertificate.Subject)"

Write-Host "`n[SUCCESS] Digital signature applied to EXE successfully!" -ForegroundColor Green
