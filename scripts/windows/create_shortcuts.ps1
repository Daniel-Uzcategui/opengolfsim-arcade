$repoDir = (Resolve-Path "$PSScriptRoot\..\..").Path
$targetBat = Join-Path $repoDir "scripts\windows\start_arcade.bat"

$wsh = New-Object -ComObject WScript.Shell

# 1. Desktop Shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktopPath "OpenGolfSim Arcade.lnk"
$shortcut = $wsh.CreateShortcut($desktopLnk)
$shortcut.TargetPath = "cmd.exe"
$shortcut.Arguments = "/c `"$targetBat`""
$shortcut.WorkingDirectory = $repoDir
$shortcut.Description = "OpenGolfSim Arcade Minigame Suite"
$shortcut.WindowStyle = 7 # Minimized launch window for cmd
$shortcut.Save()
Write-Host "  [OK] Created Desktop Shortcut: $desktopLnk" -ForegroundColor Green

# 2. Start Menu Shortcut
$startMenuPath = Join-Path ([Environment]::GetFolderPath("Programs")) "OpenGolfSim Arcade"
if (-not (Test-Path $startMenuPath)) {
    New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
}
$startLnk = Join-Path $startMenuPath "OpenGolfSim Arcade.lnk"
$shortcut2 = $wsh.CreateShortcut($startLnk)
$shortcut2.TargetPath = "cmd.exe"
$shortcut2.Arguments = "/c `"$targetBat`""
$shortcut2.WorkingDirectory = $repoDir
$shortcut2.Description = "OpenGolfSim Arcade Minigame Suite"
$shortcut2.WindowStyle = 7
$shortcut2.Save()
Write-Host "  [OK] Created Start Menu Shortcut: $startLnk" -ForegroundColor Green
