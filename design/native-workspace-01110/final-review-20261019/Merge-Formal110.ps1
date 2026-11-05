$out = Join-Path $PWD 'PGY-Workbench-0.1.110-formal-candidate-setup.exe'
$stream = [IO.File]::Create($out)
try { foreach ($i in 1..3) { $inputStream = [IO.File]::OpenRead((Join-Path $PWD "PGY-formal110.part$i.bin")); try { $inputStream.CopyTo($stream) } finally { $inputStream.Dispose() } } } finally { $stream.Dispose() }
$sha = [Security.Cryptography.SHA256]::Create()
$file = [IO.File]::OpenRead($out)
try { $hash = [BitConverter]::ToString($sha.ComputeHash($file)).Replace('-','').ToLowerInvariant() } finally { $file.Dispose(); $sha.Dispose() }
if ($hash -ne 'a39dd227387dda38c930f5b7eebb83a119fe3863fdea342e5f6a95291f280efe') { throw 'SHA256 mismatch' }
Write-Output "SHA256 verified: $hash. REVIEW ONLY; installer was not launched."
