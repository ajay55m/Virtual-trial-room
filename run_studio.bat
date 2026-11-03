@echo off
TITLE VirtualFit AI Studio Launcher
COLOR 06

echo ======================================================================
echo              VirtualFit AI Studio - Virtual Saree Try-On
echo ======================================================================
echo.
echo [*] Starting Backend Gateway & UI at http://localhost:8000 ...

:: Check Python 3.12 path
set "PY_EXE=%LocalAppData%\Programs\Python\Python312\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=python"

:: Launch uvicorn from backend directory
cd /d "%~dp0backend"
start "VirtualFit Backend" "%PY_EXE%" -m uvicorn main:app --reload --port 8000

:: Wait for initialization
timeout /t 2 /nobreak > nul

:: Open default browser
start http://localhost:8000

echo.
echo [OK] Application is running live at http://localhost:8000
echo      Leave this window open while using the app.
echo ======================================================================
pause
