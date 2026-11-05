param(
  [Parameter(Mandatory=$true)][string]$Executable,
  [Parameter(Mandatory=$true)][string]$TrialRoot
)
$ErrorActionPreference='Stop'
$exePath=[IO.Path]::GetFullPath($Executable)
$asarPath=Join-Path ([IO.Path]::GetDirectoryName($exePath)) 'resources/app.asar'
$stream=[IO.File]::OpenRead($asarPath)
try { $digest=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($stream)).Replace('-','').ToLower() } finally { $stream.Dispose() }
if($digest -ne 'e57dd8774677d50e0bd1a20b6c9a4e8ab2fa56f0ca2be3e7a9ab0d7cb510ad39'){throw 'Unexpected ASAR: only the exact 0.1.107 candidate is allowed'}
$trialPath=Join-Path ([IO.Path]::GetFullPath($TrialRoot)) ('pgy-01107-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($trialPath) | Out-Null
$previousBackend=$env:ELECTRON_START_BACKEND
try {
  $env:ELECTRON_START_BACKEND='false'
  Write-Output ('Temporary test profile: '+$trialPath)
  Write-Output 'Manual acceptance only. No copied profile, automatic login, send or cloud write.'
  Start-Process -FilePath $exePath -ArgumentList ('--user-data-dir="'+$trialPath+'"') -Wait
} finally { $env:ELECTRON_START_BACKEND=$previousBackend }
