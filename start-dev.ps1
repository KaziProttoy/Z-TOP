$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPort = 8000
$frontendPort = 3000

function Test-TcpPort([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-TcpPort $backendPort)) {
    $backendCommand = "Set-Location '$repoRoot\backend'; python -m uvicorn app.main:app --reload --port $backendPort"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand
}

if (-not (Test-TcpPort $frontendPort)) {
    $frontendCommand = "Set-Location '$repoRoot\frontend'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand
}

Write-Host "Z-TOP is starting."
Write-Host "Frontend: http://localhost:$frontendPort"
Write-Host "Backend:  http://localhost:$backendPort"
