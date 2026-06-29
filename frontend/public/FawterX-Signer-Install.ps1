$ErrorActionPreference = 'Stop'

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = Join-Path $env:ProgramFiles 'FawterX\Signer'
$exeName = 'FawterX-Signer.exe'
$exeSource = Join-Path $sourceDir $exeName
$exeTarget = Join-Path $installDir $exeName
$launcherTarget = Join-Path $installDir 'Launch-FawterXSigner.ps1'
$taskName = 'FawterX Signer Bridge'

if (-not (Test-Path $exeSource)) {
  throw "Missing signer executable next to installer: $exeSource"
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Force $exeSource $exeTarget

$launcher = @'
Start-Process -FilePath "{0}" -WindowStyle Hidden
'@ -f $exeTarget
Set-Content -Path $launcherTarget -Value $launcher -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherTarget`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DisallowStartIfOnBatteries:$false -StartWhenAvailable -MultipleInstances IgnoreNew

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'FawterX local signing bridge for USB token signing' | Out-Null

Write-Host 'FawterX Signer installed successfully.'
Write-Host "Installed to: $installDir"
Write-Host 'The signer will start automatically at logon.'
