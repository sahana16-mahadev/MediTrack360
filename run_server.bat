@echo off
cd /d "%~dp0"
title MediTrack 360 - Smart Medicine Expiry & Stock Tracker
echo =====================================================================
echo   MediTrack 360 - Smart Medicine Expiry & Stock Tracker
echo   Designed for Small Clinics and Rural Pharmacies
echo =====================================================================

set "PYTHON_EXEC="

REM 1. Check known working Python 3.12 runtime first
if exist "C:\Users\SAHANA M\AppData\Roaming\kimi-desktop\daimon-bundle\runtime\python\cpython-3.12\python.exe" (
    set "PYTHON_EXEC=C:\Users\SAHANA M\AppData\Roaming\kimi-desktop\daimon-bundle\runtime\python\cpython-3.12\python.exe"
)

REM 2. If not found, check py launcher
if not defined PYTHON_EXEC (
    py -3 -c "import sys; print(1)" >nul 2>nul && set "PYTHON_EXEC=py -3"
)

REM 3. If not found, check system python
if not defined PYTHON_EXEC (
    python -c "import sys; print(1)" >nul 2>nul && set "PYTHON_EXEC=python"
)

if not defined PYTHON_EXEC (
    echo [NOTICE] Python server runtime not found.
    echo Launching MediTrack 360 directly in your browser with full offline storage...
    start "" "%~dp0static\index.html"
    pause
    exit /b 0
)

echo [OK] Python runtime detected!
echo Starting MediTrack 360 server on http://localhost:5000 ...

REM Launch browser in 1 second
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:5000"

"%PYTHON_EXEC%" app.py
pause
