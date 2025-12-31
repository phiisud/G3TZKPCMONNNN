#!/bin/bash
# G3ZKP Messenger - Electron Desktop Apps Build Script

set -e

echo "🖥️ Building G3ZKP Electron Desktop Apps..."

# Navigate to UI directory
cd "g3tzkp-messenger UI"

# Install Electron dependencies
echo "📦 Installing Electron dependencies..."
pnpm add -D electron electron-builder wait-on concurrently

# Create Electron main process
cat > electron-main.js << 'EOF'
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#010401',
    title: 'G3ZKP Messenger'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
EOF

# Create preload script
cat > preload.js << 'EOF'
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron
});
EOF

# Update package.json for Electron
echo "⚙️ Updating package.json for Electron..."

# Add Electron scripts and build configuration
jq '.main = "electron-main.js" |
    .scripts.electron = "electron ." |
    .scripts["electron:build"] = "electron-builder" |
    .scripts["electron:dist"] = "electron-builder --publish=never" |
    .build = {
      "appId": "com.g3zkp.messenger",
      "productName": "G3ZKP Messenger",
      "directories": {
        "output": "../../PRODUCTION_DEPLOYMENT_PACKAGES/electron"
      },
      "files": [
        "dist/**/*",
        "electron-main.js",
        "preload.js",
        "node_modules/**/*"
      ],
      "mac": {
        "category": "public.app-category.social-networking",
        "target": [
          { "target": "dmg", "arch": ["x64", "arm64"] }
        ]
      },
      "win": {
        "target": [
          { "target": "nsis", "arch": ["x64"] }
        ]
      },
      "linux": {
        "target": [
          { "target": "AppImage", "arch": ["x64"] },
          { "target": "deb", "arch": ["x64"] },
          { "target": "rpm", "arch": ["x64"] }
        ]
      }
    }' package.json > package.json.tmp && mv package.json.tmp package.json

# Build web assets
echo "🔨 Building web assets..."
pnpm run build

# Build Electron apps for all platforms
echo "🏗️ Building Electron apps..."
pnpm run electron:dist

echo "✅ Electron desktop apps build completed!"
echo "📦 Apps: PRODUCTION_DEPLOYMENT_PACKAGES/electron/"
echo "  - Windows: .exe installer"
echo "  - macOS: .dmg disk image"
echo "  - Linux: .AppImage, .deb, .rpm"