@echo off
TITLE Virtual Trial Room Web Client (Port 5500)
cd /d "%~dp0"
echo Starting Web Client on http://localhost:5500 ...
python -m http.server 5500
pause
