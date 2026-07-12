# Build the image and start Prelegal on http://localhost:8000
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker rm -f prelegal 2>$null | Out-Null
docker run -d --name prelegal -p 8000:8000 prelegal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Prelegal is starting on http://localhost:8000"
