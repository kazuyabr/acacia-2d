@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "TEMPLATE_DIR=%SCRIPT_DIR%\world"
set "TEMPLATE_ENV=%TEMPLATE_DIR%\.env.example"
set "START_AFTER_CREATE=0"

if /I "%~1"=="up" set "START_AFTER_CREATE=1"
if /I "%~1"=="--up" set "START_AFTER_CREATE=1"
if /I "%~1"=="-up" set "START_AFTER_CREATE=1"

if not exist "%TEMPLATE_DIR%\" (
    echo World template directory not found: %TEMPLATE_DIR%
    exit /b 1
)

if not exist "%TEMPLATE_ENV%" (
    echo World template env file not found: %TEMPLATE_ENV%
    exit /b 1
)

set "MAX_WORLD=0"
for /d %%D in ("%SCRIPT_DIR%\world-*") do (
    set "WORLD_NAME=%%~nxD"
    set "WORLD_NUMBER=!WORLD_NAME:world-=!"
    echo(!WORLD_NUMBER!| findstr /r "^[0-9][0-9]*$" >nul
    if not errorlevel 1 (
        if !WORLD_NUMBER! GTR !MAX_WORLD! set "MAX_WORLD=!WORLD_NUMBER!"
    )
)

set /a NEXT_NUMBER=MAX_WORLD+1
set "WORLD_NAME=world-%NEXT_NUMBER%"
set "TARGET_DIR=%SCRIPT_DIR%\%WORLD_NAME%"
set "TARGET_ENV=%TARGET_DIR%\.env"
set /a CHANNEL_ID=NEXT_NUMBER
set "REALM_ID=realm-1"
set /a SERVER_ID=100+NEXT_NUMBER
set /a GAME_PORT=9101+((NEXT_NUMBER-1)*2)
set /a API_PORT=GAME_PORT+1
set "COMPOSE_PROJECT_NAME=acacia-scalable-%WORLD_NAME%"
set "DISPLAY_NAME=Shinobi Farm - Realm 1 Channel %CHANNEL_ID%"
set "COMPOSE_FILE=%TARGET_DIR%\docker-compose.yml"

if exist "%TARGET_DIR%\" (
    echo Target directory already exists: %TARGET_DIR%
    exit /b 1
)

echo Creating %WORLD_NAME% from template...
xcopy "%TEMPLATE_DIR%" "%TARGET_DIR%\" /E /I /Q /Y >nul
if errorlevel 1 exit /b %errorlevel%
copy /Y "%TEMPLATE_ENV%" "%TARGET_ENV%" >nul
if errorlevel 1 exit /b %errorlevel%

powershell -NoProfile -ExecutionPolicy Bypass -Command "$envPath = [System.IO.Path]::GetFullPath('%TARGET_ENV%'); $lines = Get-Content -Path $envPath; $replacements = @{ 'COMPOSE_PROJECT_NAME' = '%COMPOSE_PROJECT_NAME%'; 'WORLD_DIRECTORY' = '%WORLD_NAME%'; 'REALM_ID' = '%REALM_ID%'; 'CHANNEL_ID' = '%CHANNEL_ID%'; 'PUBLIC_GAME_PORT' = '%GAME_PORT%'; 'PUBLIC_API_PORT' = '%API_PORT%'; 'NAME' = '''%DISPLAY_NAME%'''; 'PORT' = '%GAME_PORT%'; 'API_PORT' = '%API_PORT%'; 'SERVER_ID' = '%SERVER_ID%'; 'DISCORD_CHANNEL_ID' = '%CHANNEL_ID%' }; $updated = foreach ($line in $lines) { if ($line -match '^[A-Z0-9_]+=') { $key, $value = $line -split '=', 2; if ($replacements.ContainsKey($key)) { '{0}={1}' -f $key, $replacements[$key]; continue } }; $line }; Set-Content -Path $envPath -Value $updated"
if errorlevel 1 exit /b %errorlevel%

echo Created %WORLD_NAME%
echo - Directory: %TARGET_DIR%
echo - Env file: %TARGET_ENV%
echo - Realm ID: %REALM_ID%
echo - Channel ID: %CHANNEL_ID%
echo - Server ID: %SERVER_ID%
echo - Game/API ports: %GAME_PORT% / %API_PORT%

if "%START_AFTER_CREATE%"=="1" (
    echo Starting %WORLD_NAME%...
    docker compose --env-file "%TARGET_ENV%" -f "%COMPOSE_FILE%" up --build -d
    if errorlevel 1 exit /b %errorlevel%
    echo %WORLD_NAME% is up.
) else (
    echo Run to start manually: docker compose --env-file "%TARGET_ENV%" -f "%COMPOSE_FILE%" up --build -d
)

exit /b 0
