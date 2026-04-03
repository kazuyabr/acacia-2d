$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$includeMongo = $false

if ($args.Count -gt 0) {
    switch ($args[0].ToLowerInvariant()) {
        'mongo' { $includeMongo = $true }
        '--mongo' { $includeMongo = $true }
        '-mongo' { $includeMongo = $true }
    }
}

Write-Host 'Stopping world-2...'
docker compose --env-file (Join-Path $scriptDir 'world-2/.env') -f (Join-Path $scriptDir 'world-2/docker-compose.yml') down
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Stopping world-1...'
docker compose --env-file (Join-Path $scriptDir 'world-1/.env') -f (Join-Path $scriptDir 'world-1/docker-compose.yml') down
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($includeMongo) {
    Write-Host 'Stopping optional local Mongo...'
    docker compose -f (Join-Path $scriptDir 'docker-compose.mongo-local.yml') down
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host 'Stopping scalable base stack...'
docker compose -f (Join-Path $scriptDir 'docker-compose.yml') down
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Scalable stack is down.'
exit 0
