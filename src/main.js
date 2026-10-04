const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');

// ============================================================================
// GPU & WebGPU Acceleration Flags
// ============================================================================
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// ============================================================================
// Path Resolution (Standalone Portable Mode + Regular OpenGolfSim Mode)
// ============================================================================
function getSystemFuseDir() {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'opengolfsim-desktop', 'fuse');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'opengolfsim-desktop', 'fuse');
  } else {
    // Linux and others
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opengolfsim-desktop', 'fuse');
  }
}

function resolveGameHtml(gameName) {
  // 1. Check local repo ./games/<gameName>/index.html first (portable distribution)
  const localGamePath = path.join(__dirname, '..', 'games', gameName, 'index.html');
  if (fs.existsSync(localGamePath)) {
    return localGamePath;
  }

  // 2. Check system FUSE directory (regular OpenGolfSim launcher path)
  const systemGamePath = path.join(getSystemFuseDir(), gameName, 'index.html');
  if (fs.existsSync(systemGamePath)) {
    return systemGamePath;
  }

  // 3. Check case-insensitive variants
  const gamesRoot = path.join(__dirname, '..', 'games');
  if (fs.existsSync(gamesRoot)) {
    const entries = fs.readdirSync(gamesRoot);
    const match = entries.find(e => e.toLowerCase() === gameName.toLowerCase());
    if (match) {
      const matchPath = path.join(gamesRoot, match, 'index.html');
      if (fs.existsSync(matchPath)) return matchPath;
    }
  }

  return null;
}

let mainWindow = null;
let currentGame = null;
let activeLMConnections = 0;

function loadMenu() {
  if (!mainWindow) return;
  currentGame = null;
  mainWindow.loadFile(path.join(__dirname, 'menu.html'));
  mainWindow.setTitle('OpenGolfSim Arcade Hub');
}

function loadGame(gameName, options) {
  if (!mainWindow) return;
  const gamePath = resolveGameHtml(gameName);
  if (gamePath) {
    console.log(`[Launcher] Loading game: ${gameName} from ${gamePath}`);
    currentGame = gameName;
    const query = (options && options.quality) ? { quality: options.quality } : {};
    mainWindow.loadFile(gamePath, { query });
    mainWindow.setTitle(`OpenGolfSim - ${gameName}`);
  } else {
    console.error(`[Launcher] Game not found: ${gameName}`);
    loadMenu();
  }
}

function dispatchShotToWindow(shot) {
  if (!mainWindow || !mainWindow.webContents) {
    console.warn('[LaunchMonitor] Cannot dispatch shot: mainWindow not ready');
    return;
  }

  // If player is currently at the menu, automatically start BeerPong!
  if (!currentGame) {
    console.log('[LaunchMonitor] Player shot taken from menu - auto-launching BeerPong...');
    loadGame('BeerPong');
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        dispatchShotToWindow(shot);
      }, 1200);
    });
    return;
  }

  console.log(`[LaunchMonitor] Forwarding shot to ${currentGame}:`, JSON.stringify(shot));
  const script = `
    try {
      window.postMessage({ type: 'shot', shot: ${JSON.stringify(shot)} }, '*');
    } catch (e) {
      console.error('[LaunchMonitor] Failed to postMessage:', e);
    }
  `;
  mainWindow.webContents.executeJavaScript(script).catch(err => {
    console.error('[LaunchMonitor] executeJavaScript error:', err);
  });
}

function notifyLMStatus(message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('lm-status-update', {
      connected: activeLMConnections > 0,
      activeConnections: activeLMConnections,
      message: message
    });
  }
}

// ============================================================================
// Launch Monitor Bridge (GSPro OpenAPI on 9210 + OGS Developer API on 3111)
// ============================================================================

function startLaunchMonitorServers() {
  // 1. GSPro Open API TCP Server (Port 9210)
  // Standard port for Springbok / MLM2PRO-GSPro-Connector and Garmin Approach R10
  const gsproServer = net.createServer((socket) => {
    activeLMConnections++;
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[GSPro-Bridge] Launch Monitor connected from ${clientAddr}`);
    notifyLMStatus(`LAUNCH MONITOR CONNECTED (${clientAddr})`);

    // Send initial handshake as expected by GSPro OpenAPI v1 / v2
    const handshake = {
      Code: 201,
      Message: 'GSPro Connect Successful',
      Player: { Handed: 'RH', Club: 'DR' }
    };
    try {
      socket.write(JSON.stringify(handshake) + '\n');
    } catch (e) {
      console.warn('[GSPro-Bridge] Handshake write error:', e.message);
    }

    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      // Process complete JSON objects
      while (true) {
        const startIdx = buffer.indexOf('{');
        if (startIdx === -1) {
          buffer = '';
          break;
        }
        if (startIdx > 0) {
          buffer = buffer.slice(startIdx);
        }

        let parsedObj = null;
        let endIdx = -1;
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                endIdx = i;
                break;
              }
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = buffer.slice(0, endIdx + 1);
          buffer = buffer.slice(endIdx + 1);
          try {
            parsedObj = JSON.parse(jsonStr);
          } catch (e) {
            console.warn('[GSPro-Bridge] Failed to parse JSON chunk:', e.message);
          }

          if (parsedObj) {
            handleGSProPayload(socket, parsedObj);
          }
        } else {
          // Incomplete message, wait for more data
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.warn(`[GSPro-Bridge] Socket error (${clientAddr}):`, err.message);
    });

    socket.on('close', () => {
      activeLMConnections = Math.max(0, activeLMConnections - 1);
      console.log(`[GSPro-Bridge] Client disconnected (${clientAddr})`);
      notifyLMStatus(activeLMConnections > 0 ? 'LM CONNECTED' : 'LM BRIDGE ACTIVE: GSPRO (9210) & OGS (3111)');
    });
  });

  gsproServer.on('error', (err) => {
    console.error('[GSPro-Bridge] Server error:', err.message);
  });

  gsproServer.listen(9210, '0.0.0.0', () => {
    console.log('[GSPro-Bridge] GSPro Open API TCP server listening on 0.0.0.0:9210');
  });

  // 2. OpenGolfSim Developer API TCP Server (Port 3111)
  const ogsServer = net.createServer((socket) => {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[OGS-API] Developer API client connected from ${clientAddr}`);

    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'shot' && msg.shot) {
            let s = msg.shot;
            if (msg.unit === 'metric' && s.ballSpeed) {
              s.ballSpeed = s.ballSpeed * 2.23694; // m/s to mph
            }
            dispatchShotToWindow(s);
            socket.write(JSON.stringify({ status: 200, message: 'Shot received' }) + '\n');
          }
        } catch (e) {
          console.warn('[OGS-API] Parse error:', e.message);
        }
      }
    });

    socket.on('error', (err) => {
      console.warn(`[OGS-API] Socket error (${clientAddr}):`, err.message);
    });
  });

  ogsServer.on('error', (err) => {
    console.error('[OGS-API] Server error:', err.message);
  });

  ogsServer.listen(3111, '0.0.0.0', () => {
    console.log('[OGS-API] Developer API TCP server listening on 0.0.0.0:3111');
  });
}

function handleGSProPayload(socket, data) {
  console.log('[GSPro-Bridge] Payload received:', JSON.stringify(data).slice(0, 150) + '...');

  // Acknowledge receipt immediately so connector doesn't timeout
  const ack = {
    Code: 200,
    Message: 'Shot received successfully'
  };
  try {
    socket.write(JSON.stringify(ack) + '\n');
  } catch (e) {}

  // Check if payload contains BallData (launch monitor shot)
  if (data.BallData && typeof data.BallData.Speed === 'number') {
    const b = data.BallData;

    // Convert from GSPro OpenAPI ball metrics to OpenGolfSim Shot format
    const speed = Math.max(1, Number(b.Speed) || 30);
    const vla = Number(b.VLA) || 15;
    
    // =========================================================================
    // INVERT HLA and SpinAxis to match FUSE physics convention:
    // In GSPro/Garmin: HLA < 0 is Left (pull), HLA > 0 is Right (push).
    // In FUSE ballPhysics: -hla rotates to -X (Left) when hla > 0.
    // Therefore: -Number(b.HLA) maps standard golf launch angle to FUSE!
    // =========================================================================
    const hla = -(Number(b.HLA) || 0);
    const totalSpin = Number(b.TotalSpin) || 3500;
    const spinAxis = -(Number(b.SpinAxis) || 0);
    const backSpin = Number(b.Backspin) || Math.round(totalSpin * Math.cos((spinAxis * Math.PI) / 180));
    const sideSpin = Number(b.SideSpin) || Math.round(totalSpin * Math.sin((spinAxis * Math.PI) / 180));

    const shot = {
      ballSpeed: speed,
      verticalLaunchAngle: vla,
      horizontalLaunchAngle: hla,
      spinSpeed: totalSpin,
      totalSpin: totalSpin,
      spinAxis: spinAxis,
      backSpin: backSpin,
      sideSpin: sideSpin
    };

    dispatchShotToWindow(shot);
  }
}

// ============================================================================
// Electron Window Management & IPC
// ============================================================================

function createWindow(targetGame = null) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(width, 1920),
    height: Math.min(height, 1080),
    backgroundColor: '#050914',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    autoHideMenuBar: true,
    title: targetGame ? `OpenGolfSim - ${targetGame}` : 'OpenGolfSim Arcade'
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Global key bindings inside window
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && input.type === 'keyDown') {
      loadMenu();
      event.preventDefault();
    }
  });

  // IPC handlers
  ipcMain.on('launch-game', (_event, gameName, options) => {
    loadGame(gameName, options);
  });

  ipcMain.on('return-menu', () => {
    loadMenu();
  });

  ipcMain.handle('get-connection-status', () => {
    return {
      connected: activeLMConnections > 0,
      activeConnections: activeLMConnections,
      ports: [9210, 3111]
    };
  });

  if (targetGame) {
    loadGame(targetGame);
  } else {
    loadMenu();
  }
}

app.whenReady().then(() => {
  startLaunchMonitorServers();

  const requestedGame = process.argv[2];
  if (requestedGame && (requestedGame.toLowerCase().includes('beer') || requestedGame === 'BeerPong')) {
    createWindow('BeerPong');
  } else if (requestedGame && (requestedGame.toLowerCase().includes('flag') || requestedGame.toLowerCase().includes('ctf') || requestedGame === 'CaptureTheFlag')) {
    createWindow('CaptureTheFlag');
  } else if (requestedGame && (requestedGame.toLowerCase().includes('corn') || requestedGame === 'Cornhole')) {
    createWindow('Cornhole');
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
