# Instructions for AI Coding Agents (Cursor, Antigravity, Claude, Copilot)

This document establishes the Standard Operating Procedures (SOP), architectural rules, and verified code patterns for AI coding agents modifying or extending **OpenGolfSim Arcade**.

---

## 1. Core Principles & Golden Rules

1. **Strictly FUSE Engine (Three.js WebGPU / Rapier3D)**:
   * Do not generate Unity bundles, native C++ executables, or Unreal wrappers.
   * All 3D rendering happens via Three.js with WebGPU/WebGL shaders.
   * All rigid body physics calculations occur via the Rapier3D WASM runtime.

2. **Coordinates & Unit System**:
   * **Right-handed, $Y$-up** coordinate system.
   * Units are strictly **meters** across all meshes, waypoints, and velocities.
   * $+Z$ points down the fairway/range (forward).
   * $+Y$ points up.
   * $+X$ points right, $-X$ points left.

3. **Horizontal Launch Angle (HLA) & Spin Axis Signs**:
   * Standard launch monitors (Garmin R10, GSPro) define **negative HLA as Left / Pull** and **positive HLA as Right / Push**.
   * FUSE's internal `ballPhysics.ts` formula `_launchFull` rotates ball heading around $+Y$ by `degToRad(-hla)`.
   * **Rule**: When bridging external launch monitor packets into FUSE, you **MUST invert** both `HLA` and `SpinAxis`:
     ```javascript
     const hla = -(Number(b.HLA) || 0);
     const spinAxis = -(Number(b.SpinAxis) || 0);
     ```

4. **Camera Aiming & Target Selection Math**:
   * Never modify the world coordinate position of targets (cups, flags) to aim!
   * Calculate the base azimuth from the ball to the target:
     $$\theta_{\text{target}} = \text{atan2}(X_{\text{target}} - X_{\text{ball}}, Z_{\text{target}} - Z_{\text{ball}})$$
   * Add any player keyboard/touch aim nudge $\theta_{\text{nudge}}$ to this base azimuth.
   * Project the aim point along the distance vector:
     $$X_{\text{aim}} = X_{\text{ball}} + \sin(\theta_{\text{aim}}) \cdot D$$
     $$Z_{\text{aim}} = Z_{\text{ball}} + \cos(\theta_{\text{aim}}) \cdot D$$
   * Always call `golfBall.aimAt(aimPoint)` whenever the aim point updates so physics aligns with camera orientation.

5. **2D Cross Product for Lateral HUD Orientation**:
   * When determining whether an aim line is Left or Right of a target flag or cup in the horizontal plane:
     $$\text{cross} = \text{targetDir}_z \cdot \text{aimDir}_x - \text{targetDir}_x \cdot \text{aimDir}_z$$
     * If $\text{cross} > 0$: Aim is **Right** of target.
     * If $\text{cross} < 0$: Aim is **Left** of target.

---

## 2. Directory Layout & Discovery Conventions

```
opengolfsim-arcade/
├── src/                    <-- Arcade Hub launcher (main.js, menu.html, preload.js)
├── games/
│   ├── BeerPong/           <-- Must contain game.json, index.html, assets/
│   ├── CaptureTheFlag/
│   └── Cornhole/
├── scripts/
│   ├── linux/              <-- bash scripts for Linux deployment
│   └── windows/            <-- bat and ps1 scripts for Windows deployment
└── docs/                   <-- Architecture and integration documentation
```

### Self-Contained Bundling Rule
Each game under `games/<GameName>` must be completely self-contained. The `index.html` file inside each game folder must reference `./assets/...` (relative path) so that it functions identically:
* Inside `opengolfsim-arcade/games/<GameName>/`
* Inside Linux `~/.config/opengolfsim-desktop/fuse/<GameName>/`
* Inside Windows `%APPDATA%\opengolfsim-desktop\fuse\<GameName>\`

---

## 3. Launch Monitor TCP Bridge Patterns

When working in `src/main.js`:
* **Chunk Fragmentation Handling**: Launch monitor data sent over TCP sockets can arrive fragmented or concatenated. Always buffer incoming chunks and extract complete `{ ... }` JSON objects using recursive depth-counting before calling `JSON.parse`.
* **Immediate Acknowledgment**: Always return `{ Code: 200, Message: "Shot received successfully" }` to the client socket immediately upon receiving a packet to prevent launch monitor timeouts.
* **Auto-Launch on Swing**: If the user swings from the launcher hub menu (`currentGame === null`), auto-launch the default game (Beer Pong), wait for window `did-finish-load`, and dispatch the pending shot.

---

## 4. Verification Checklist Before Submitting Code

Before creating a commit or reporting completion:
1. **Cross-Platform Path Check**: Verify path separators use `path.join()` or forward slashes. No hardcoded `/home/daniel` or `C:\Users\Daniel`.
2. **Physics Verification**: Run a test injection on port `9210` with:
   * $HLA = -3.5$: Ball must start **LEFT** in the 3D scene.
   * $HLA = +3.5$: Ball must start **RIGHT** in the 3D scene.
3. **Regular Launcher Deployment**: Test running the deployment script (`install_to_regular_ogs.ps1` or `.sh`) and confirm that both `game.json` and `index.html` exist in the target directory.
4. **Console Cleanliness**: Ensure no unhandled promise rejections or WebGL/WebGPU shader compilation errors.
