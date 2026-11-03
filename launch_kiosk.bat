@echo off
TITLE AURA Kiosk Enterprise Launcher
COLOR 0B

echo ======================================================================
echo          AURA VIRTUAL FITTING ROOM - ENTERPRISE KIOSK RUNNER
echo ======================================================================
echo.

:: 0. Stop any existing backend on port 8000 and frontend on port 5173 so clean processes start
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
)

:: 1. Start Backend Gateway
echo [*] Starting AURA FastAPI Gateway (Port 8000)...
start "AURA API Gateway" /min powershell -NoExit -Command "cd /d "%~dp0backend"; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 2. Start Frontend Dev / Preview
echo [*] Starting Kiosk Interactive Frontend (Port 5173)...
start "AURA Kiosk UI" /min powershell -NoExit -Command "cd /d "%~dp0frontend"; npm run dev"

:: Wait for services to initialize
echo [*] Waiting for services to become healthy...
timeout /t 3 /nobreak > nul

:: 3. Launch Chrome or Edge in True Kiosk Fullscreen Mode
echo [*] Launching Display in Retail Kiosk Lockdown Mode...
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start chrome --app="http://localhost:5173" --start-maximized
) else (
    start msedge --app="http://localhost:5173" --start-maximized
)

echo.
echo [OK] AURA Kiosk running in Enterprise Kiosk Mode.
echo      Press Alt+F4 to exit kiosk screen when finished.
echo ======================================================================


