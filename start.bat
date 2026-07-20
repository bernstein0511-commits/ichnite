@echo off
REM Ichnite backend launcher (Windows).
REM Double-click this file: it creates a virtual environment (first run only),
REM installs dependencies, and starts the server.

cd /d "%~dp0backend\api"

if not exist .venv (
    echo [1/2] Setting up virtual environment, please wait...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [2/2] Checking dependencies...
pip install -q -r requirements.txt

echo.
echo Starting Ichnite backend. Press Ctrl+C to stop.
echo Open http://localhost:8000/docs to confirm it is running.
echo.

uvicorn main:app --host 127.0.0.1 --port 8000

pause
