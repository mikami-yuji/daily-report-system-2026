$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Asahipack DailyReportSystem" -CertStoreLocation "Cert:\CurrentUser\My"

$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
$rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$rootStore.Add($cert)
$rootStore.Close()

$publisherStore = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::TrustedPublisher, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
$publisherStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$publisherStore.Add($cert)
$publisherStore.Close()

$files = @(
    "dist\DailyReportServer.exe",
    "C:\Users\ASAHI\Desktop\DailyReportSystem\DailyReportServer.exe"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        Unblock-File -Path $f -ErrorAction SilentlyContinue
        Set-AuthenticodeSignature -FilePath $f -Certificate $cert
        Get-AuthenticodeSignature -FilePath $f | Format-List
    }
}
