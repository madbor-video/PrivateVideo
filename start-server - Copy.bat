@echo off
title PrivateVideo Server
cd /d "%~dp0"

echo Starting PrivateVideo Server...
echo.
echo Website: http://localhost:3000
echo Admin:   http://localhost:3000/admin.html
echo.
echo Keep this window open while using the website.
echo.

node server.js

pause