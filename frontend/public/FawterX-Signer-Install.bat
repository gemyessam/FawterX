@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%FawterX-Signer-Install.ps1"
exit /b %errorlevel%
