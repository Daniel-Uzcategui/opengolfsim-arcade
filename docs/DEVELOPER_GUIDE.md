# OpenGolfSim Arcade - Developer Guide & Technical Reference

This guide documents the architecture, physics pipelines, coordinate transformations, and design patterns established for the **FUSE** engine in OpenGolfSim.

---

## 1. Engine Architecture Overview

OpenGolfSim v1.19+ runs on the **FUSE Engine**:
* **Rendering**: [Three.js](https://threejs.org/) utilizing the modern **WebGPU / WebGL** pipeline.
* **Physics Simulation**: [Rapier3D](https://rapier.rs/) compiled to WebAssembly (WASM).
* **Launch Monitor Ingestion**: High-performance TCP bridges supporting **GSPro OpenAPI** (port `9210`) and the native **OpenGolfSim Developer API** (port `3111`).
* **Game Delivery**: Decoupled HTML5 / ES Module bundles capable of running:
  1. Standalone via the cross-platform **OpenGolfSim Arcade Launcher**.
  2. Directly embedded inside the official **OpenGolfSim Desktop Client** (`app.asar`).

---

## 2. Coordinate Systems & Physics Sign Conventions

### 2.1 Three.js / FUSE World Coordinates
FUSE operates strictly in a **Right-Handed, Y-Up** coordinate system measured in **meters**:
* **$+Z$ Axis**: Forward down the target line / range / fairway.
* **$-Z$ Axis**: Backward (behind the tee box / player).
* **$+Y$ Axis**: Vertical elevation (upward).
* **$-Y$ Axis**: Downward (gravity acts at $-9.81\ \text{m/s}^2$).
* **$+X$ Axis**: Right of the target line.
* **$-X$ Axis**: Left of the target line.

```
       +Y (Up)
        |
        |   +Z (Forward / Target)
        |  /
        | /
        +------ +X (Right)
       /
      /
    -X (Left)
```

---

### 2.2 Launch Monitor HLA (Horizontal Launch Angle) Inversion

#### The Industry Standard (Garmin R10 / GSPro)
In radar launch monitors (Garmin Approach R10, TrackMan, FlightScope) and the GSPro Open API:
* **Negative HLA ($< 0$)**: **PULL / LEFT** (e.g. $-3.5^\circ$ indicates a shot starting left of the target line).
* **Positive HLA ($> 0$)**: **PUSH / RIGHT** (e.g. $+3.5^\circ$ indicates a shot starting right of the target line).
* **Negative Spin Axis ($< 0$)**: **DRAW / HOOK** (curves to the left).
* **Positive Spin Axis ($> 0$)**: **FADE / SLICE** (curves to the right).

#### FUSE Internal Math
In the FUSE ball physics pipeline (`ballPhysics.ts` -> `_launchFull`):
```typescript
const hlaRad = MathUtils.degToRad(-hla);
const launchVector = new Vector3(0, Math.sin(vlaRad), Math.cos(vlaRad));
launchVector.applyAxisAngle(new Vector3(0, 1, 0), hlaRad);
```
* Rotating around the $+Y$ axis by a **positive angle** turns $+Z$ toward $+X$ (Right).
* Rotating around $+Y$ by a **negative angle** turns $+Z$ toward $-X$ (Left).
* Because FUSE applies `degToRad(-hla)`:
  * If raw $HLA = +4^\circ$, FUSE rotates by $-4^\circ$, sending the ball to $-X$ (**LEFT**).
  * If raw $HLA = -4^\circ$, FUSE rotates by $+4^\circ$, sending the ball to $+X$ (**RIGHT**).

#### The Solution (Implemented in `src/main.js`)
To align external launch monitor data with FUSE physics, **both `HLA` and `SpinAxis` must be inverted before dispatching**:
```javascript
const hla = -(Number(b.HLA) || 0);
const spinAxis = -(Number(b.SpinAxis) || 0);
```
With this mapping:
$$\theta_{\text{shot}} = \theta_{\text{aim}} + \text{HLA}_{\text{garmin}}$$
A $-4^\circ$ pull on the Garmin R10 results in a shot trajectory starting exactly $4^\circ$ left of the target in FUSE.

---

## 3. Camera Aim & Target Selection Pipeline

### 3.1 Relative Angle Offsetting (Mountain Vista Pattern)
In earlier versions, aiming left or right directly shifted the target cup/pin's $X$ coordinate in world space. This distorted pyramid racks and caused aiming at non-centered cups to produce wildly erratic azimuths.

The correct approach defines the aim line as an **angular offset relative to the selected target**:

```typescript
// 1. Calculate base azimuth of the target cup or flag from the ball origin
const dx = targetCupPos.x - ballStartPos.x;
const dz = targetCupPos.z - ballStartPos.z;
const targetBaseAzimuthDeg = Math.atan2(dx, dz) * (180 / Math.PI);

// 2. Add user nudge / keyboard tilt angle
const totalAimAngleDeg = targetBaseAzimuthDeg + userNudgeAngleDeg;
const totalAimAngleRad = (totalAimAngleDeg * Math.PI) / 180;

// 3. Project aim point along the distance ray
const distanceMeters = targetCupPos.distanceTo(ballStartPos);
aimPoint.set(
  ballStartPos.x + Math.sin(totalAimAngleRad) * distanceMeters,
  targetCupPos.y,
  ballStartPos.z + Math.cos(totalAimAngleRad) * distanceMeters
);

// 4. Align ball orientation and camera
golfBall.aimAt(aimPoint);
shotCamera.setPositions(ballStartPos, aimPoint);
```

### 3.2 2D Cross-Product for Relative Target Feedback
When calculating whether the aim line is pointed left or right of a specific target (used for HUD guidance):

```typescript
// 2D normalized direction vectors in the horizontal plane (X, Z)
const flagDirX = flagPos.x - ballPos.x;
const flagDirZ = flagPos.z - ballPos.z;
const aimDirX = aimPos.x - ballPos.x;
const aimDirZ = aimPos.z - ballPos.z;

// In a right-handed system where +Z is forward and +X is right:
// Cross product (Z1 * X2 - X1 * Z2) determines signed lateral orientation:
const cross = (flagDirZ * aimDirX) - (flagDirX * aimDirZ);
const isRight = cross > 0;
const isLeft = cross < 0;
```

---

## 4. 3D Raycasting Target Selection

To allow players to click on cups or flag poles directly in the 3D viewport, configure a `THREE.Raycaster`:

```typescript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(targetMeshes, true);

  if (intersects.length > 0) {
    const hitObject = intersects[0].object;
    // Identify target by userData.id or traverse parent hierarchy
    selectTargetById(hitObject.userData.targetId);
  }
});
```

---

## 5. Adding a New Arcade Minigame

To contribute a new game (e.g. `games/Darts/`):

1. **Create the Game Directory**:
   ```
   games/Darts/
   ├── index.html
   ├── game.json
   └── assets/
   ```

2. **Define `game.json` Metadata**:
   ```json
   {
     "name": "darts",
     "version": "1.0.0",
     "title": "Darts Golf",
     "description": "Chip and pitch at a giant radial dartboard in the fairway."
   }
   ```

3. **Listen for Shot Events**:
   Your game's entry point must listen for window message events dispatched by the launcher:
   ```javascript
   window.addEventListener('message', (event) => {
     if (event.data && event.data.type === 'shot') {
       const shot = event.data.shot;
       // Execute shot simulation in Rapier3D / FUSE
       fuseGame.launchBall(shot);
     }
   });
   ```

4. **Register in Arcade Menu (`src/menu.html`)**:
   Add a game card with `onclick="launchGame('Darts')"`.
