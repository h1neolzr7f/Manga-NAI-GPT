@echo off
rem ASCII-only on purpose: changing the console codepage in the middle of a batch
rem file makes cmd.exe resume reading at shifted byte offsets and mangle non-ASCII
rem lines. All Chinese UI text lives in scripts\windows\start_manga_editor_nai.ps1 instead.
chcp 65001 >nul
title Manga-NAI-GPT
cd /d "%~dp0"

rem Forward optional launcher switches, e.g. -NoBrowser / -NoPrompt / -Ci.
rem A plain double-click passes none of them, which is the normal mode.
rem MNAI_NO_PAUSE=1 (or -Ci) skips the final pause so CI / scripts can exit.
call "%~dp0scripts\windows\start_manga_editor_nai.bat" %*
set "NAI_EXIT=%ERRORLEVEL%"

echo.
if not "%NAI_EXIT%"=="0" (
  echo  ========================================
  echo   Startup failed. See user_data\start.log
  echo  ========================================
  echo.
  if /I not "%MNAI_NO_PAUSE%"=="1" pause
  exit /b %NAI_EXIT%
)

echo  ========================================
echo   Local service stopped. You can close this window.
echo  ========================================
echo.
if /I not "%MNAI_NO_PAUSE%"=="1" pause
exit /b 0
