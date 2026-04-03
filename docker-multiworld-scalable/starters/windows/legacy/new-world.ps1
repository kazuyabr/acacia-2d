$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templateDir = Join-Path $scriptDir 'world'
$templateEnvPath = Join-Path $templateDir '.env.example'
$startAfterCreate = $false

if ($args.Count -gt 0) {
    switch ($args[0].ToLowerInvariant()) {
        'up' { $startAfterCreate = $true }
        '--up' { $startAfterCreate = $true }
        '-up' { $startAfterCreate = $true }
    }
}

if (-not (Test-Path $templateDir -PathType Container)) {
    throw "World template directory not found: $templateDir"
}

if (-not (Test-Path $templateEnvPath -PathType Leaf)) {
    throw "World template env file not found: $templateEnvPath"
}

$worldDirs = Get-ChildItem -Path $scriptDir -Directory | Where-Object { $_.Name -match '^world-(\d+)$' }
$worldNumbers = @(
    $worldDirs |
        ForEach-Object {
            $match = [regex]::Match($_.Name, '^world-(\d+)$')
            if ($match.Success) {
                [int]$match.Groups[1].Value
            }
        }
)
$nextNumber = if ($worldNumbers.Count -gt 0) { ($worldNumbers | Measure-Object -Maximum).Maximum + 1 } else { 1 }

$worldName = "world-$nextNumber"
$targetDir = Join-Path $scriptDir $worldName

if (Test-Path $targetDir) {
    throw "Target directory already exists: $targetDir"
}

$channelId = $nextNumber
$realmId = 'realm-1'
$serverId = 100 + $nextNumber
$gamePort = 9101 + (($nextNumber - 1) * 2)
$apiPort = $gamePort + 1
$composeProjectName = "acacia-scalable-$worldName"
$displayName = "Shinobi Farm - Realm 1 Channel $channelId"

Write-Host "Creating $worldName from template..."
Copy-Item -Path $templateDir -Destination $targetDir -Recurse

$targetEnvPath = Join-Path $targetDir '.env'
Copy-Item -Path $templateEnvPath -Destination $targetEnvPath -Force

$lines = Get-Content -Path $targetEnvPath
$updatedLines = foreach ($line in $lines) {
    if ($line -match '^[A-Z0-9_]+=') {
        $key, $value = $line -split '=', 2
        switch ($key) {
            'COMPOSE_PROJECT_NAME' { "COMPOSE_PROJECT_NAME=$composeProjectName"; continue }
            'WORLD_DIRECTORY' { "WORLD_DIRECTORY=$worldName"; continue }
            'REALM_ID' { "REALM_ID=$realmId"; continue }
            'CHANNEL_ID' { "CHANNEL_ID=$channelId"; continue }
            'PUBLIC_GAME_PORT' { "PUBLIC_GAME_PORT=$gamePort"; continue }
            'PUBLIC_API_PORT' { "PUBLIC_API_PORT=$apiPort"; continue }
            'NAME' { "NAME='$displayName'"; continue }
            'PORT' { "PORT=$gamePort"; continue }
            'API_PORT' { "API_PORT=$apiPort"; continue }
            'SERVER_ID' { "SERVER_ID=$serverId"; continue }
            'DISCORD_CHANNEL_ID' { "DISCORD_CHANNEL_ID=$channelId"; continue }
            default { $line }
        }
    }
    else {
        $line
    }
}

Set-Content -Path $targetEnvPath -Value $updatedLines

Write-Host "Created $worldName"
Write-Host "- Directory: $targetDir"
Write-Host "- Env file: $targetEnvPath"
Write-Host "- Realm ID: $realmId"
Write-Host "- Channel ID: $channelId"
Write-Host "- Server ID: $serverId"
Write-Host "- Game/API ports: $gamePort / $apiPort"

if ($startAfterCreate) {
    Write-Host "Starting $worldName..."
    docker compose --env-file $targetEnvPath -f (Join-Path $targetDir 'docker-compose.yml') up --build -d
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "$worldName is up."
}
else {
    Write-Host "Run to start manually: docker compose --env-file `"$targetEnvPath`" -f `"$(Join-Path $targetDir 'docker-compose.yml')`" up --build -d"
}

exit 0
