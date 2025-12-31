#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('📦 Installing G3TZKP Messenger dependencies...\n');

const dependencies = {
  electron: [
    'electron@^28.0.0',
    'electron-builder@^24.9.1',
    'electron-updater@^6.1.7',
    'electron-vite@^2.0.0'
  ],
  pwa: [
    'vite-plugin-pwa@^0.17.4',
    'workbox-window@^7.0.0'
  ]
};

function installDeps(deps, dev = true) {
  const flag = dev ? '-D' : '';
  const cmd = `pnpm add ${flag} ${deps.join(' ')}`;
  console.log(`Running: ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('✅ Installation successful\n');
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  }
}

console.log('Installing Electron dependencies...');
installDeps(dependencies.electron, true);

console.log('Installing PWA dependencies...');
installDeps(dependencies.pwa, true);

console.log('\n✅ All dependencies installed successfully!');
console.log('\nNext steps:');
console.log('1. Run: node build-all-platforms.js');
console.log('2. Check release/ directory for builds');
