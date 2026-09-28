@echo off
title CIPHERTRACE - Test Phone Connection
echo ========================================================
echo   CIPHERTRACE Android - USB Device Connection Checker
echo ========================================================
echo.
echo Checking connected devices via ADB...
adb devices -l
echo.
echo Setting up USB reverse port forward (tcp:8000 -> tcp:8000)...
adb reverse tcp:8000 tcp:8000
echo.
echo If your device shows "unauthorized", check your phone screen
echo and tap "Allow USB debugging".
echo.
pause
