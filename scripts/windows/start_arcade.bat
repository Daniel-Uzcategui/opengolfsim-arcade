@echo off
setlocal
cd /d "%~dp0\..\.."

echo ========================================================
echo   Starting OpenGolfSim Arcade Suite
echo ========================================================
echo Launch Monitor TCP Bridge:
echo   - GSPro OpenAPI:   0.0.0.0:9210
echo   - Developer API:   0.0.0.0:3111
echo.

call npx electron . %* --enable-gpu-rasterization --enable-zero-copy --force_high_performance_gpu --ignore-gpu-blocklist --enable-experimental-web-platform-features
