#!/usr/bin/env bash
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Ensure DISPLAY and XAUTHORITY are exported if running locally or via SSH
export DISPLAY="${DISPLAY:-:0}"
if [ -f "$HOME/.Xauthority" ]; then
    export XAUTHORITY="$HOME/.Xauthority"
fi

cd "$REPO_DIR"

echo "=== Starting OpenGolfSim Arcade Suite ==="
echo "Display: $DISPLAY"
echo "Launch Monitor Bridge: 0.0.0.0:9210 (GSPro) & 0.0.0.0:3111 (OGS)"

# Hardware-accelerated WebGPU/Vulkan flags
exec npx electron . "$@" \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --force_high_performance_gpu \
    --ignore-gpu-blocklist \
    --enable-experimental-web-platform-features
