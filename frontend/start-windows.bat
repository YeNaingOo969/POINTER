@echo off
rem Double-click to run the POINTER frontend and open it in your default browser.
title POINTER frontend
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Install the LTS version once, then double-click this file again:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  echo   or download the LTS installer from https://nodejs.org
  echo.
  pause
  exit /b 1
)

node scripts\start.mjs %*
if errorlevel 1 pause
