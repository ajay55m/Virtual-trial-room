@echo off
TITLE AURA Virtual Trial Room Desktop App
COLOR 0A

echo ======================================================================
echo              AURA AI VIRTUAL TRIAL ROOM - DESKTOP v2.0
echo ======================================================================
echo [*] Starting Python 3.12 with MediaPipe BlazePose and OpenCV...
echo [*] Stand 1.5m back in the safe zone.
echo [*] Controls: [Q] Quit  [N] Next Shirt  [P] Prev Shirt  [S] Screenshot
echo ======================================================================
echo.

py -3.12 app.py

pause

