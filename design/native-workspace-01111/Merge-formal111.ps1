param([string]$Directory = $PSScriptRoot)
$out = Join-Path $Directory 'PGY-formal111-setup.exe'
$stream = [IO.File]::Create($out)
try { foreach ($i in 1..3) { $inputStream = [IO.File]::OpenRead((Join-Path $Directory "PGY-formal111.part$i.bin")); try { $inputStream.CopyTo($stream) } finally { $inputStream.Dispose() } } } finally { $stream.Dispose() }
$sha = [Security.Cryptography.SHA256]::Create(); $file = [IO.File]::OpenRead($out)
try { $hash = [BitConverter]::ToString($sha.ComputeHash($file)).Replace('-','').ToLowerInvariant() } finally { $file.Dispose(); $sha.Dispose() }
if ($hash -ne '0df8ccd7621ff8d116a277e5d0d3e2e87970d2585aee1a38172685ff9975b242') { throw 'SHA256 mismatch' }
Write-Output "Verified: $hash. Installer NOT executed."
