@echo off
TITLE VirtualFit Standalone AI Try-On
COLOR 0B

echo ======================================================================
echo              VirtualFit Standalone AI Try-On Studio
echo ======================================================================
echo.
echo [*] Starting Backend Server at http://localhost:8000 ...

cd /d "%~dp0backend"
start "VirtualFit Backend" python -m uvicorn main:app --reload --port 8000

timeout /t 2 /nobreak > nul
start http://localhost:8000

echo.
echo [OK] Running at http://localhost:8000
echo ======================================================================
pause

