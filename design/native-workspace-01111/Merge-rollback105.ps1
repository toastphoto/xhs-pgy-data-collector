param([string]$Directory = $PSScriptRoot)
$out = Join-Path $Directory 'PGY-rollback105-setup.exe'
$stream = [IO.File]::Create($out)
try { foreach ($i in 1..3) { $inputStream = [IO.File]::OpenRead((Join-Path $Directory "PGY-rollback105.part$i.bin")); try { $inputStream.CopyTo($stream) } finally { $inputStream.Dispose() } } } finally { $stream.Dispose() }
$sha = [Security.Cryptography.SHA256]::Create(); $file = [IO.File]::OpenRead($out)
try { $hash = [BitConverter]::ToString($sha.ComputeHash($file)).Replace('-','').ToLowerInvariant() } finally { $file.Dispose(); $sha.Dispose() }
if ($hash -ne 'c4d28c9eba07080fd2459b6a20f4e22ce0053316737fe781cae7ceb91610a3a4') { throw 'SHA256 mismatch' }
Write-Output "Verified: $hash. Installer NOT executed."
