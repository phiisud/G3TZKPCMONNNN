#!/usr/bin/env node

/**
 * G3ZKP Messenger - Multi-Platform Build System
 * Production deployment package generator
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLATFORMS = {
  web: 'Web PWA',
  android: 'Android APK',
  ios: 'iOS PWA',
  windows: 'Windows Installer',
  mac: 'macOS App',
  linux: 'Linux Packages'
};

const BUILD_DIR = 'PRODUCTION_DEPLOYMENT_PACKAGES';
const UI_DIR = 'g3tzkp-messenger UI';
const SERVER_DIR = '.';

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function runCommand(command, cwd = process.cwd(), description = '') {
  try {
    log(`${description ? description + ': ' : ''}Running: ${command}`, 'info');
    const result = execSync(command, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    return result;
  } catch (error) {
    log(`Command failed: ${command}`, 'error');
    log(error.message, 'error');
    throw error;
  }
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, 'success');
  }
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  ensureDirectory(destDir);
  fs.copyFileSync(src, dest);
  log(`Copied: ${src} -> ${dest}`, 'success');
}

function buildWeb() {
  log('Building Web PWA...', 'info');

  // Install dependencies
  runCommand('npm install --legacy-peer-deps', UI_DIR, 'Installing dependencies');

  // Build production bundle
  runCommand('npm run build', UI_DIR, 'Building production bundle');

  // Create PWA package
  const webBuildDir = path.join(BUILD_DIR, 'web');
  ensureDirectory(webBuildDir);

  // Copy built files
  const distDir = path.join(UI_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    runCommand(`cp -r "${distDir}"/* "${webBuildDir}/"`, '.', 'Copying web build files');
  }

  // Create web app manifest
  const manifest = {
    name: 'G3ZKP Messenger',
    short_name: 'G3ZKP',
    description: 'Privacy-first decentralized messenger with zero-knowledge proofs',
    start_url: '/',
    display: 'standalone',
    background_color: '#010401',
    theme_color: '#00f3ff',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };

  fs.writeFileSync(path.join(webBuildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create service worker
  const swContent = `
self.addEventListener('install', (event) => {
  console.log('G3ZKP PWA installed');
});

self.addEventListener('activate', (event) => {
  console.log('G3ZKP PWA activated');
});

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  if (event.request.url.includes('/static/') ||
      event.request.url.includes('.js') ||
      event.request.url.includes('.css')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
`;

  fs.writeFileSync(path.join(webBuildDir, 'sw.js'), swContent);

  // Create deployment package
  runCommand(`cd "${BUILD_DIR}" && tar -czf g3zkp-web-pwa.tar.gz web/`, '.', 'Creating web PWA tar.gz package');

  log('Web PWA build completed!', 'success');
}

function buildAndroid() {
  log('Building Android APK...', 'info');

  // Install Capacitor
  runCommand('npm install @capacitor/android @capacitor/cli', UI_DIR, 'Installing Capacitor Android');

  // Initialize Capacitor
  runCommand('npx cap init "G3ZKP Messenger" "com.g3zkp.messenger" --web-dir=dist', UI_DIR, 'Initializing Capacitor');

  // Add Android platform
  runCommand('npx cap add android', UI_DIR, 'Adding Android platform');

  // Copy built web files
  runCommand('npx cap sync android', UI_DIR, 'Syncing web assets to Android');

  // Build Android APK
  const androidDir = path.join(UI_DIR, 'android');
  runCommand('./gradlew assembleDebug', androidDir, 'Building Android APK');

  // Copy APK to deployment directory
  const apkPath = path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk');
  const deployApkPath = path.join(BUILD_DIR, 'g3zkp-android-debug.apk');

  if (fs.existsSync(apkPath)) {
    copyFile(apkPath, deployApkPath);
  } else {
    log('APK not found at expected location', 'warning');
  }

  log('Android APK build completed!', 'success');
}

function buildIOS() {
  log('Building iOS PWA...', 'info');

  // Install Capacitor iOS
  runCommand('npm install @capacitor/ios', UI_DIR, 'Installing Capacitor iOS');

  // Add iOS platform
  runCommand('npx cap add ios', UI_DIR, 'Adding iOS platform');

  // Sync web assets
  runCommand('npx cap sync ios', UI_DIR, 'Syncing web assets to iOS');

  // Create iOS deployment package
  const iosDir = path.join(UI_DIR, 'ios');
  const iosBuildDir = path.join(BUILD_DIR, 'ios');
  ensureDirectory(iosBuildDir);

  if (fs.existsSync(iosDir)) {
    runCommand(`cp -r "${iosDir}"/* "${iosBuildDir}/"`, '.', 'Copying iOS project files');
  }

  // Create iOS build instructions
  const instructions = `# G3ZKP Messenger - iOS Build Instructions

## Prerequisites
- macOS with Xcode 15+
- iOS Simulator or physical device

## Build Steps
1. Open G3ZKP.xcworkspace in Xcode
2. Select target device/simulator
3. Product > Build (⌘B)
4. Product > Run (⌘R)

## App Store Deployment
1. Product > Archive
2. Window > Organizer
3. Distribute App > App Store Connect

## Configuration
- Bundle ID: com.g3zkp.messenger
- Team: [Your Apple Developer Team]
- Signing Certificate: [Your Distribution Certificate]
`;

  fs.writeFileSync(path.join(iosBuildDir, 'BUILD_INSTRUCTIONS.md'), instructions);

  // Create deployment package
  runCommand(`cd "${BUILD_DIR}" && tar -czf g3zkp-ios-project.tar.gz ios/`, '.', 'Creating iOS project tar.gz package');

  log('iOS PWA build completed!', 'success');
}

function buildElectron() {
  log('Building Electron desktop apps...', 'info');

  // Install Electron dependencies
  runCommand('npm install -D electron electron-builder wait-on concurrently', UI_DIR, 'Installing Electron dependencies');

  // Create Electron main process
  const electronMain = `const { app, BrowserWindow, ipcMain } = require('electron');
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
    backgroundColor: '#010401'
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
});`;

  fs.writeFileSync(path.join(UI_DIR, 'electron-main.js'), electronMain);

  // Create preload script
  const preloadScript = `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron
});`;

  fs.writeFileSync(path.join(UI_DIR, 'preload.js'), preloadScript);

  // Update package.json for Electron
  const packageJsonPath = path.join(UI_DIR, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  packageJson.main = 'electron-main.js';
  packageJson.scripts = {
    ...packageJson.scripts,
    'electron': 'electron .',
    'electron:build': 'electron-builder',
    'electron:dist': 'electron-builder --publish=never'
  };

  packageJson.build = {
    appId: 'com.g3zkp.messenger',
    productName: 'G3ZKP Messenger',
    directories: {
      output: '../../PRODUCTION_DEPLOYMENT_PACKAGES/electron'
    },
    files: [
      'dist/**/*',
      'electron-main.js',
      'preload.js',
      'node_modules/**/*'
    ],
    mac: {
      category: 'public.app-category.social-networking',
      target: [
        { target: 'dmg', arch: ['x64', 'arm64'] }
      ]
    },
    win: {
      target: [
        { target: 'nsis', arch: ['x64'] }
      ]
    },
    linux: {
      target: [
        { target: 'AppImage', arch: ['x64'] },
        { target: 'deb', arch: ['x64'] },
        { target: 'rpm', arch: ['x64'] }
      ]
    }
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Build Electron apps
  runCommand('npm run electron:dist', UI_DIR, 'Building Electron desktop apps');

  log('Electron desktop apps build completed!', 'success');
}

function buildServerPackage() {
  log('Building server deployment package...', 'info');

  const serverBuildDir = path.join(BUILD_DIR, 'server');
  ensureDirectory(serverBuildDir);

  // Copy server files
  const serverFiles = [
    'messaging-server.js',
    'package.json',
    'package-lock.json',
    'zkp-circuits/build/',
    'media_storage/',
    'public/'
  ];

  serverFiles.forEach(file => {
    const srcPath = path.join(SERVER_DIR, file);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(serverBuildDir, file);
      if (fs.statSync(srcPath).isDirectory()) {
        runCommand(`cp -r "${srcPath}" "${destPath}"`, '.', `Copying directory: ${file}`);
      } else {
        copyFile(srcPath, destPath);
      }
    }
  });

  // Create server startup script
  const startupScript = `#!/bin/bash
# G3ZKP Messenger Server Startup Script

echo "Starting G3ZKP Messenger Server..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Set environment variables
export NODE_ENV=production
export PORT=3001

# Start the server
echo "Server starting on port 3001..."
exec node messaging-server.js`;

  fs.writeFileSync(path.join(serverBuildDir, 'start-server.sh'), startupScript);
  fs.chmodSync(path.join(serverBuildDir, 'start-server.sh'), '755');

  // Create deployment package
  runCommand(`cd "${BUILD_DIR}" && tar -czf g3zkp-server.tar.gz server/`, '.', 'Creating server deployment package');

  log('Server deployment package created!', 'success');
}

function createDeploymentManifest() {
  const manifest = {
    name: 'G3ZKP Messenger',
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    platforms: Object.keys(PLATFORMS),
    packages: {
      web: 'g3zkp-web-pwa.tar.gz',
      android: 'g3zkp-android-debug.apk',
      ios: 'g3zkp-ios-project.tar.gz',
      windows: 'electron builds in electron/ directory',
      mac: 'electron builds in electron/ directory',
      linux: 'electron builds in electron/ directory',
      server: 'g3zkp-server.tar.gz'
    },
    requirements: {
      web: 'Modern web browser with PWA support',
      android: 'Android 8.0+',
      ios: 'iOS 14.0+ with Safari',
      windows: 'Windows 10+',
      mac: 'macOS 11.0+',
      linux: 'Ubuntu 18.04+, Fedora 30+, or similar',
      server: 'Node.js 18+, Linux/macOS/Windows server'
    },
    installation: {
      web: 'Extract zip and serve files with web server, or deploy to hosting platform',
      android: 'Install APK file on Android device',
      ios: 'Open project in Xcode, build and deploy to device/simulator',
      desktop: 'Run the installer/package for your platform',
      server: 'Extract tar.gz, run ./start-server.sh'
    },
    configuration: {
      environment_variables: [
        'COMPANIES_HOUSE_API_KEY',
        'TOMTOM_API_KEY',
        'HERE_API_KEY',
        'TFL_API_KEY',
        'NODE_ENV=production',
        'PORT=3001'
      ]
    }
  };

  fs.writeFileSync(path.join(BUILD_DIR, 'deployment-manifest.json'), JSON.stringify(manifest, null, 2));
  log('Deployment manifest created!', 'success');
}

function main() {
  const args = process.argv.slice(2);
  const targetPlatform = args[0];

  log('🚀 G3ZKP Messenger Multi-Platform Build System', 'info');
  log('==============================================', 'info');

  ensureDirectory(BUILD_DIR);

  try {
    if (!targetPlatform || targetPlatform === 'all') {
      log('Building all platforms...', 'info');

      buildWeb();
      buildAndroid();
      buildIOS();
      buildElectron();
      buildServerPackage();
      createDeploymentManifest();

      log('🎉 All platforms built successfully!', 'success');
      log(`📦 Deployment packages available in: ./${BUILD_DIR}`, 'success');

    } else {
      switch (targetPlatform) {
        case 'web':
          buildWeb();
          break;
        case 'android':
          buildAndroid();
          break;
        case 'ios':
          buildIOS();
          break;
        case 'electron':
          buildElectron();
          break;
        case 'server':
          buildServerPackage();
          break;
        default:
          log(`Unknown platform: ${targetPlatform}`, 'error');
          log(`Available platforms: ${Object.keys(PLATFORMS).join(', ')}`, 'info');
          process.exit(1);
      }
    }

    // List all created packages
    log('\n📦 Generated Deployment Packages:', 'success');
    const packages = fs.readdirSync(BUILD_DIR);
    packages.forEach(pkg => {
      const stats = fs.statSync(path.join(BUILD_DIR, pkg));
      const size = (stats.size / 1024 / 1024).toFixed(2);
      log(`  - ${pkg} (${size} MB)`, 'success');
    });

  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildWeb, buildAndroid, buildIOS, buildElectron, buildServerPackage };
