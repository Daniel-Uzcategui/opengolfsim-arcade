@echo off
setlocal
cd /d "%~dp0\..\.."

echo ========================================================
echo   OpenGolfSim Arcade Suite - Windows Setup
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org (v18+ recommended).
    pause
    exit /b 1
)

echo [1/3] Node.js detected:
node -v
echo.

echo [2/3] Installing Node dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install encountered errors.
    pause
    exit /b 1
)
echo.

echo [3/3] Creating Windows Desktop and Start Menu shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcuts.ps1"
echo.

echo ========================================================
echo   Installation Successful!
echo ========================================================
echo To start OpenGolfSim Arcade:
echo   - Double-click the "OpenGolfSim Arcade" desktop shortcut, or
echo   - Run: scripts\windows\start_arcade.bat
echo.
echo To install these games directly into the official OpenGolfSim app:
echo   - Run: powershell -ExecutionPolicy Bypass -File scripts\windows\install_to_regular_ogs.ps1
echo.
pause
