@echo off
setlocal DisableDelayedExpansion
set "NIGHTSHIFT_SOURCE=%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Lab.ps1" -Mode Activate
exit
