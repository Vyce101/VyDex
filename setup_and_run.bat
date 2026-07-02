@REM Starts the local development launcher.
@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev\setup-and-run.ps1" %*
exit /b %ERRORLEVEL%
