@echo off
rem Runs the companion and restarts it after a self-update (exit code 75) or a crash.
cd /d "%~dp0"
:loop
node src\index.js >> gateway.log 2>&1
if %ERRORLEVEL%==75 goto loop
if %ERRORLEVEL%==0 goto end
timeout /t 30 /nobreak >nul
goto loop
:end
