#!/usr/bin/env bash
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OS_NAME="$(uname -s)"

cd "$REPO_DIR"

echo "=== Starting OpenGolfSim Arcade Suite ($OS_NAME) ==="
echo "Launch Monitor Bridge: 0.0.0.0:9210 (GSPro) & 0.0.0.0:3111 (OGS)"

if [ "$OS_NAME" = "Darwin" ]; then
    exec npx electron . "$@" \
        --ignore-gpu-blocklist \
        --enable-gpu-rasterization \
        --enable-unsafe-webgpu \
        --enable-experimental-web-platform-features
else
    # Ensure DISPLAY and XAUTHORITY are exported if running locally or via SSH on Linux
    export DISPLAY="${DISPLAY:-:0}"
    if [ -f "$HOME/.Xauthority" ]; then
        export XAUTHORITY="$HOME/.Xauthority"
    fi
    echo "Display: $DISPLAY"
    exec npx electron . "$@" \
        --enable-gpu-rasterization \
        --enable-zero-copy \
        --force_high_performance_gpu \
        --ignore-gpu-blocklist \
        --enable-unsafe-webgpu \
        --enable-experimental-web-platform-features
fi
