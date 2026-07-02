@REM Safely updates Git-tracked project files without starting the app.
@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev\update.ps1" %*
exit /b %ERRORLEVEL%
