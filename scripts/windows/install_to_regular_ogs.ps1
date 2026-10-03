# ==============================================================================
# Deploy Arcade Games to Regular OpenGolfSim Desktop Launcher (Windows)
# ==============================================================================
$ErrorActionPreference = "Stop"

$repoDir = (Resolve-Path "$PSScriptRoot\..\..").Path
$appDataDir = [Environment]::GetFolderPath("ApplicationData")
$ogsFuseDir = Join-Path $appDataDir "opengolfsim-desktop\fuse"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Deploying Arcade Games to Regular OpenGolfSim Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Destination: $ogsFuseDir`n" -ForegroundColor Gray

if (-not (Test-Path $ogsFuseDir)) {
    Write-Host "Creating FUSE games directory: $ogsFuseDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ogsFuseDir -Force | Out-Null
}

$games = @("BeerPong", "CaptureTheFlag", "Cornhole")

foreach ($game in $games) {
    $srcGameDir = Join-Path $repoDir "games\$game"
    $destGameDir = Join-Path $ogsFuseDir $game

    if (Test-Path $srcGameDir) {
        Write-Host "Installing $game..." -ForegroundColor White
        if (-not (Test-Path $destGameDir)) {
            New-Item -ItemType Directory -Path $destGameDir -Force | Out-Null
        }

        # Copy all game files (index.html, game.json, assets, media)
        Copy-Item -Path "$srcGameDir\*" -Destination $destGameDir -Recurse -Force

        # Verify key discovery files
        $gameJsonPath = Join-Path $destGameDir "game.json"
        $indexPath = Join-Path $destGameDir "index.html"
        if ((Test-Path $gameJsonPath) -and (Test-Path $indexPath)) {
            Write-Host "  [OK] $game registered and ready for OpenGolfSim" -ForegroundColor Green
        } else {
            Write-Host "  [WARNING] Missing game.json or index.html in $destGameDir" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [SKIPPED] Source directory not found: $srcGameDir" -ForegroundColor Red
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "All minigames are now available in your official OpenGolfSim app."
Write-Host "Open OpenGolfSim.exe and choose any game from the Course/Games selection menu.`n"
