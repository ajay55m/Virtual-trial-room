@echo off
TITLE AURA Kiosk Enterprise Launcher
COLOR 0B

echo ======================================================================
echo          AURA VIRTUAL FITTING ROOM - ENTERPRISE KIOSK RUNNER
echo ======================================================================
echo.

:: 1. Start Backend Gateway
echo [*] Starting AURA FastAPI Gateway (Port 8000)...
start "AURA API Gateway" /min powershell -NoExit -Command "cd 'C:\AI\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: 2. Start Frontend Dev / Preview
echo [*] Starting Kiosk Interactive Frontend (Port 5173)...
start "AURA Kiosk UI" /min powershell -NoExit -Command "cd 'C:\AI\frontend'; npm run dev"

:: Wait for services to initialize
echo [*] Waiting for services to become healthy...
timeout /t 3 /nobreak > nul

:: 3. Launch Chrome or Edge in True Kiosk Fullscreen Mode
echo [*] Launching Display in Retail Kiosk Lockdown Mode...
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start chrome --kiosk --incognito --disable-pinch --overscroll-history-navigation=0 "http://localhost:5173"
) else (
    start msedge --kiosk --incognito "http://localhost:5173"
)

echo.
echo [OK] AURA Kiosk running in Enterprise Kiosk Mode.
echo      Press Alt+F4 to exit kiosk screen when finished.
echo ======================================================================
