const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Advanced GPU hardware acceleration flags
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

const outputDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const targets = [
  { name: 'arcade_hub.png', url: path.join(__dirname, 'src/menu.html'), wait: 2000 },
  { name: 'beer_pong.png', url: path.join(__dirname, 'games/BeerPong/index.html'), wait: 5000 },
  { name: 'capture_the_flag.png', url: path.join(__dirname, 'games/CaptureTheFlag/index.html'), wait: 5000 },
  { name: 'cornhole.png', url: path.join(__dirname, 'games/Cornhole/index.html'), wait: 5000 }
];

async function captureAll() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  for (const target of targets) {
    console.log(`Loading ${target.name} from ${target.url}...`);
    await win.loadFile(target.url);
    console.log(`Waiting ${target.wait}ms for rendering...`);
    await new Promise(r => setTimeout(r, target.wait));

    const image = await win.webContents.capturePage();
    const savePath = path.join(outputDir, target.name);
    fs.writeFileSync(savePath, image.toPNG());
    console.log(`Saved screenshot: ${savePath} (${fs.statSync(savePath).size} bytes)`);
  }

  console.log('All screenshots captured successfully!');
  app.quit();
}

app.whenReady().then(captureAll);
