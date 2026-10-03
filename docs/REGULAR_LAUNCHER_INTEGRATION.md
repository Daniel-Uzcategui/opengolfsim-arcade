# Integrating Arcade Games into the Official OpenGolfSim Desktop Launcher

This document explains how to install and run the arcade minigames directly inside the standard **OpenGolfSim Desktop Client** without needing the standalone arcade launcher.

---

## 1. How OpenGolfSim Discovers Minigames

The official OpenGolfSim desktop application (`app.asar`) scans a designated `fuse` directory in the user's application data folder on startup.

### Target Locations:
* **Windows**: `%APPDATA%\opengolfsim-desktop\fuse\`
  *(Typically `C:\Users\<Username>\AppData\Roaming\opengolfsim-desktop\fuse\`)*
* **Linux**: `~/.config/opengolfsim-desktop/fuse/`
* **macOS**: `~/Library/Application Support/opengolfsim-desktop/fuse/`

Every subfolder inside `fuse/` that contains a valid `game.json` and `index.html` is automatically recognized and populated into the OpenGolfSim minigame selection menu.

---

## 2. Directory Structure of an Installed Game

Inside `%APPDATA%\opengolfsim-desktop\fuse\` or `~/.config/opengolfsim-desktop/fuse/`:

```
fuse/
├── BeerPong/
│   ├── game.json          <-- Required metadata for OpenGolfSim launcher
│   ├── index.html         <-- Game entry point
│   ├── assets/            <-- Compiled JS bundles, CSS, and 3D models
│   ├── images/
│   ├── ktx2/
│   └── sounds/
├── CaptureTheFlag/
│   ├── game.json
│   ├── index.html
│   ├── assets/
│   └── ...
└── Cornhole/
    ├── game.json
    ├── index.html
    ├── assets/
    └── ...
```

---

## 3. The `game.json` Specification

OpenGolfSim reads the following keys from `game.json`:

```json
{
  "name": "beer-pong",
  "version": "1.0.0",
  "title": "Beer Pong",
  "description": "Arcade Golf Beer Pong! Chip, pitch, and bounce golf balls into a 10-cup pyramid rack from 15 to 200 yards."
}
```

* `name`: URL-safe internal slug.
* `version`: Semantic version string.
* `title`: Name rendered in the OpenGolfSim UI card.
* `description`: Subtitle/details displayed in the game selection modal.

---

## 4. Automated 1-Click Installation

We provide automated deployment scripts that copy all game assets and register the metadata automatically:

### On Windows:
Open PowerShell as your current user and run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\install_to_regular_ogs.ps1
```
Or with npm:
```bash
npm run install:ogs:win
```

### On Linux:
Run in your terminal:
```bash
bash scripts/linux/install_to_regular_ogs.sh
```
Or with npm:
```bash
npm run install:ogs:linux
```

---

## 5. Verification

1. Start your official OpenGolfSim desktop app:
   * **Windows**: Launch from Start Menu or Desktop shortcut (`OpenGolfSim.exe`).
   * **Linux**: Run `opengolfsim-desktop` or `/home/<user>/opengolfsim-app/main.js`.
2. Navigate to **Games / Arcade** in the main menu.
3. You will see **Beer Pong**, **Capture The Flag**, and **Cornhole** listed with their icons and descriptions.
4. Click **Play** — the game will launch using OpenGolfSim's native hardware-accelerated WebGPU viewport!
