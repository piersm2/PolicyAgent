@echo off
rem Double-click to run PolicyAgent on this computer. Keep this window open while you use it.
cd /d "%~dp0"

where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again.
  pause
  exit /b 1
)

echo Installing or updating dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed

echo Building the app...
call npm run build
if errorlevel 1 goto failed

echo.
echo PolicyAgent is running at http://localhost:3000
echo Cowork feed: http://localhost:3000/api/feed?format=md
echo Close this window to stop the app.
echo.
start "" cmd /c "timeout /t 5 >/dev/null & start http://localhost:3000"
call npm start
goto :eof

:failed
echo.
echo Something went wrong above. Copy the messages and send them to whoever set this up.
pause
