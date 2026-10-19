#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
    OGS_FUSE_DIR="$HOME/Library/Application Support/opengolfsim-desktop/fuse"
    echo "=== Deploying Arcade Games to Regular OpenGolfSim Launcher (macOS) ==="
else
    OGS_FUSE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opengolfsim-desktop/fuse"
    echo "=== Deploying Arcade Games to Regular OpenGolfSim Launcher (Linux) ==="
fi
echo "Target Directory: $OGS_FUSE_DIR"

mkdir -p "$OGS_FUSE_DIR"

# Remove disabled prototypes if previously installed
rm -rf "$OGS_FUSE_DIR/CosmicBowling" "$OGS_FUSE_DIR/TitanBreaker"

GAMES=("BeerPong" "CaptureTheFlag" "Cornhole")

for GAME in "${GAMES[@]}"; do
    SRC_DIR="$REPO_DIR/games/$GAME"
    DEST_DIR="$OGS_FUSE_DIR/$GAME"
    
    if [ -d "$SRC_DIR" ]; then
        echo "Installing $GAME..."
        rm -rf "$DEST_DIR"
        mkdir -p "$DEST_DIR"
        cp -r "$SRC_DIR/"* "$DEST_DIR/"
        
        # Verify required files
        if [ -f "$DEST_DIR/game.json" ] && [ -f "$DEST_DIR/index.html" ]; then
            echo "  ✓ $GAME successfully installed with game.json and index.html"
        else
            echo "  ⚠ Warning: Missing game.json or index.html in $DEST_DIR"
        fi
    else
        echo "  ✗ Skipping $GAME: source directory not found at $SRC_DIR"
    fi
done

echo ""
echo "=== Deployment Complete! ==="
echo "All minigames are now available in your regular OpenGolfSim desktop launcher."
echo "Launch OpenGolfSim and select any of the installed games from the course/minigame selection menu."
