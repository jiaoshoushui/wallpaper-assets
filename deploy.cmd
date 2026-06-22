@echo off
setlocal
cd /d "%~dp0"

echo.
echo  wallpaper-assets deploy
echo  =======================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Please install Node.js.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

call node scripts\deploy.mjs %*
set DEPLOY_EXIT=%ERRORLEVEL%

echo.
if %DEPLOY_EXIT%==0 (
  echo Done.
) else (
  echo Failed with exit code %DEPLOY_EXIT%.
)
echo.
pause
exit /b %DEPLOY_EXIT%
