@echo off
setlocal EnableDelayedExpansion

title MineManager - Starting...

echo.
echo ==============================================
echo MineManager - Fresh Start Script (Bun)
echo ==============================================
echo.

echo [1/8] Killing existing Java processes (Minecraft servers)...
taskkill /F /IM java.exe >nul 2>&1
echo Done.

echo [2/8] Killing existing Node.js/Bun processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM bun.exe >nul 2>&1
echo Done.

echo [3/8] Killing existing FRP tunnel processes...
taskkill /F /IM frpc.exe >nul 2>&1
taskkill /F /IM playit.exe >nul 2>&1
echo Done.

echo [4/8] Killing processes on port 3000 (Next.js)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.

echo [5/8] Killing processes on port 25565 (Minecraft default)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :25565 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.

echo [6/8] Clearing Next.js cache and build artifacts...
if exist ".next" rmdir /S /Q ".next"
if exist "node_modules\.cache" rmdir /S /Q "node_modules\.cache"
if exist "dist" rmdir /S /Q "dist"
if exist "build" rmdir /S /Q "build"
echo Done.

echo.
echo [7/8] Running fresh build...
call bun run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Check the errors above.
    echo.
    pause
    exit /b 1
)
echo Build successful.

echo.
echo [8/8] Starting MineManager server...
echo.
echo ==============================================
echo Server ready at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo ==============================================
echo.

bun run start
