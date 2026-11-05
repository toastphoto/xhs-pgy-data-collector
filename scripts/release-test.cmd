@echo off
setlocal
cd /d "%~dp0.."
if "%~1"=="" goto usage
if not defined PGY_TEST_PYTHON if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set "PGY_TEST_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not defined NODE_PATH if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright" set "NODE_PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
if not defined PGY_TEST_PYTHON set "PGY_TEST_PYTHON=python"
"%PGY_TEST_PYTHON%" scripts\release_tester.py run --installer "%~1"
set "RESULT=%ERRORLEVEL%"
echo.
echo 0 = release gates passed; 1 = failed; 2 = automatic checks complete, acceptance pending.
echo Reports: tmp\release-tests
pause
exit /b %RESULT%
:usage
echo Drag a Windows setup EXE onto this file, or run: release-test.cmd "C:\path\setup.exe"
echo No installation, real login, real sends, or cloud writes are performed.
pause
exit /b 2
