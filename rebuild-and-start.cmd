@echo off
echo ============================================================
echo  Semantiqa: Rebuild Native Modules and Start
echo ============================================================
echo.
echo This script will:
echo   1. Rebuild native modules for Electron
echo   2. Start the application
echo.
echo IMPORTANT: Make sure the application is closed before running this!
echo.
pause

echo.
echo [1/2] Rebuilding native modules...
call pnpm rebuild
if errorlevel 1 (
    echo.
    echo ERROR: Failed to rebuild native modules.
    echo Make sure the application is completely closed and try again.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting application...
call pnpm run build
if errorlevel 1 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo.
echo Starting Electron app...
call pnpm --filter @semantiqa/app-main run start

echo.
echo Application closed.
pause

