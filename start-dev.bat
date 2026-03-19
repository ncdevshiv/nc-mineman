@echo off
setlocal EnableDelayedExpansion

title MineManager - Dev Mode (Bun)

echo.
echo ==============================================
echo MineManager - Dev Start Script (Bun)
echo ==============================================
echo.

echo [1/3] Killing existing processes on port 3000 (dev server)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.

echo [2/3] Installing dependencies (bun install)...
call bun install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] bun install failed! Check the errors above.
    echo.
    pause
    exit /b 1
)
echo Dependencies ready.

echo [3/3] Starting Next.js dev server...
echo URL: http://localhost:3000
echo.

call bun run dev

echo.
echo Dev server stopped.
pause
