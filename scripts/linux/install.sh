#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "=== Installing OpenGolfSim Arcade Suite (Linux) ==="
echo "Repository Path: $REPO_DIR"

# 1. Check Node.js and npm
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js (v18+ recommended)."
    exit 1
fi
echo "Found Node.js: $(node -v)"
echo "Found npm: $(npm -v)"

# 2. Install dependencies
cd "$REPO_DIR"
echo "Installing Node dependencies..."
npm install

# 3. Create CLI launcher script
mkdir -p "$HOME/.local/bin"
cat << 'EOF' > "$HOME/.local/bin/opengolfsim-arcade"
#!/usr/bin/env bash
REPO_DIR="$HOME/opengolfsim-arcade"
if [ ! -d "$REPO_DIR" ]; then
    # Try finding repository in Documents or GitHub
    if [ -d "$HOME/Documents/GitHub/opengolfsim-arcade" ]; then
        REPO_DIR="$HOME/Documents/GitHub/opengolfsim-arcade"
    elif [ -d "$HOME/GitHub/opengolfsim-arcade" ]; then
        REPO_DIR="$HOME/GitHub/opengolfsim-arcade"
    fi
fi

cd "$REPO_DIR"
exec npx electron . "$@"
EOF
chmod +x "$HOME/.local/bin/opengolfsim-arcade"

# 4. Create Desktop shortcut
mkdir -p "$HOME/.local/share/applications"
cat << EOF > "$HOME/.local/share/applications/opengolfsim-arcade.desktop"
[Desktop Entry]
Name=OpenGolfSim Arcade
Comment=Tour-grade Arcade Minigame Suite for OpenGolfSim
Exec=$HOME/.local/bin/opengolfsim-arcade
Icon=golf
Terminal=false
Type=Application
Categories=Game;Simulation;Sports;
EOF
chmod +x "$HOME/.local/share/applications/opengolfsim-arcade.desktop"

echo ""
echo "=== Installation Complete! ==="
echo "To start the Arcade Hub:"
echo "  1. Run: bash scripts/linux/start_arcade.sh"
echo "  2. Or run: ~/.local/bin/opengolfsim-arcade"
echo "  3. Or launch from your Applications menu (OpenGolfSim Arcade)"
echo ""
echo "To install minigames into the official OpenGolfSim desktop launcher:"
echo "  bash scripts/linux/install_to_regular_ogs.sh"
