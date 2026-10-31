@echo off
cd /d %~dp0
echo Starting Body-Fit AI Try-On Backend on port 8000...
python -m uvicorn body_fit_api:app --reload --port 8000
pause

