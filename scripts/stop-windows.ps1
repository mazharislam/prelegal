# Stop and remove the Prelegal container. The database goes with it, by design.
docker rm -f prelegal 2>$null | Out-Null

Write-Host "Prelegal stopped"
