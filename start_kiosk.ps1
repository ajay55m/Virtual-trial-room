<#
.SYNOPSIS
    AURA Virtual Fitting Room - Enterprise Production Launcher
.DESCRIPTION
    Launches FastAPI Gateway, Vite Frontend, and Chromium in hardware Kiosk Lockdown Mode.
#>

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         AURA VIRTUAL FITTING ROOM - ENTERPRISE KIOSK RUNNER          " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Start Backend Gateway
Write-Host "[*] Launching API Gateway (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\AI\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000" -WindowStyle Minimized

# 2. Start Frontend
Write-Host "[*] Launching Kiosk Touch UI (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\AI\frontend'; npm run dev" -WindowStyle Minimized

# 3. Healthcheck poll
Write-Host "[*] Waiting for gateway healthcheck..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 4. Open in Kiosk Lockdown Mode
Write-Host "[*] Launching Chromium in Retail Kiosk Fullscreen Mode..." -ForegroundColor Green
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromeExe) {
    Start-Process $chromeExe -ArgumentList "--kiosk", "--incognito", "--disable-pinch", "--overscroll-history-navigation=0", "http://localhost:5173"
} else {
    Start-Process "msedge.exe" -ArgumentList "--kiosk", "--incognito", "http://localhost:5173"
}

Write-Host "`n[OK] Kiosk is live in full retail lockdown mode." -ForegroundColor Green
Write-Host "     Press [Alt + F4] on keyboard to exit kiosk screen.`n" -ForegroundColor Gray
