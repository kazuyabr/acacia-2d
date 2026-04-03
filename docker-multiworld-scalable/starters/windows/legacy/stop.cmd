@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "INCLUDE_MONGO=0"

if /I "%~1"=="mongo" set "INCLUDE_MONGO=1"
if /I "%~1"=="--mongo" set "INCLUDE_MONGO=1"
if /I "%~1"=="-mongo" set "INCLUDE_MONGO=1"

echo Stopping world-2...
docker compose --env-file "%SCRIPT_DIR%\world-2\.env" -f "%SCRIPT_DIR%\world-2\docker-compose.yml" down
if errorlevel 1 exit /b %errorlevel%

echo Stopping world-1...
docker compose --env-file "%SCRIPT_DIR%\world-1\.env" -f "%SCRIPT_DIR%\world-1\docker-compose.yml" down
if errorlevel 1 exit /b %errorlevel%

if "%INCLUDE_MONGO%"=="1" (
    echo Stopping optional local Mongo...
    docker compose -f "%SCRIPT_DIR%\docker-compose.mongo-local.yml" down
    if errorlevel 1 exit /b %errorlevel%
)

echo Stopping scalable base stack...
docker compose -f "%SCRIPT_DIR%\docker-compose.yml" down
if errorlevel 1 exit /b %errorlevel%

echo Scalable stack is down.
exit /b 0
