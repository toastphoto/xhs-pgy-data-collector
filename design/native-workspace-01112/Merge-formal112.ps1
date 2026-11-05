param([string]$Directory = $PSScriptRoot)
$out = Join-Path $Directory 'PGY-formal112-setup.exe'
$stream = [IO.File]::Create($out)
try { foreach ($i in 1..3) { $inputStream = [IO.File]::OpenRead((Join-Path $Directory "PGY-formal112.part$i.bin")); try { $inputStream.CopyTo($stream) } finally { $inputStream.Dispose() } } } finally { $stream.Dispose() }
$sha=[Security.Cryptography.SHA256]::Create(); $file=[IO.File]::OpenRead($out)
try { $hash=[BitConverter]::ToString($sha.ComputeHash($file)).Replace('-','').ToLowerInvariant() } finally { $file.Dispose();$sha.Dispose() }
if ($hash -ne 'adcd1aff1730f6a978c12729a1123bbf56c676d5fbfcaa34cbebbd3d12ccc4d2') { throw 'SHA256 mismatch' }
Write-Output "Verified $hash. Installer NOT executed."
