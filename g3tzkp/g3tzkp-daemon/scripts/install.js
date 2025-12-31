#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAEMON_PATH = path.resolve(__dirname, '../src/daemon.js');
const PROTOCOL = 'g3tzkp';

function getOS() {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

function registerWindows() {
  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\${PROTOCOL}]
@="URL:G3TZKP Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\${PROTOCOL}\\shell]

[HKEY_CLASSES_ROOT\\${PROTOCOL}\\shell\\open]

[HKEY_CLASSES_ROOT\\${PROTOCOL}\\shell\\open\\command]
@="\\"${process.execPath.replace(/\\/g, '\\\\')}\\\" \\"${path.resolve(__dirname, 'protocol-handler.js').replace(/\\/g, '\\\\')}\\\" \\"%1\\""
`;

  const regFile = path.join(__dirname, 'g3tzkp-protocol.reg');
  fs.writeFileSync(regFile, regContent);
  
  console.log('[Windows] Registry file created:', regFile);
  console.log('[Windows] Run this command as Administrator:');
  console.log(`  reg import "${regFile}"`);
  console.log('');
  console.log('Or double-click the .reg file to install.');
}

function registerMacOS() {
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.g3tzkp.protocol</string>
    <key>CFBundleName</key>
    <string>G3TZKP Protocol Handler</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>g3tzkp-handler</string>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>G3TZKP Protocol</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>${PROTOCOL}</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`;

  const appDir = path.join(process.env.HOME, 'Applications', 'G3TZKP.app', 'Contents');
  const macOSDir = path.join(appDir, 'MacOS');
  
  fs.mkdirSync(macOSDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'Info.plist'), plistContent);
  
  const handlerScript = `#!/bin/bash
${process.execPath} ${path.resolve(__dirname, 'protocol-handler.js')} "$@"
`;
  
  const handlerPath = path.join(macOSDir, 'g3tzkp-handler');
  fs.writeFileSync(handlerPath, handlerScript);
  fs.chmodSync(handlerPath, '755');
  
  console.log('[macOS] App bundle created at:', path.dirname(appDir));
  console.log('[macOS] Registering with Launch Services...');
  
  try {
    execSync(`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${path.dirname(appDir)}"`);
    console.log('[macOS] Protocol handler registered successfully!');
  } catch (e) {
    console.log('[macOS] Please restart your computer to complete registration.');
  }
}

function registerLinux() {
  const desktopEntry = `[Desktop Entry]
Name=G3TZKP Protocol Handler
Exec=${process.execPath} ${path.resolve(__dirname, 'protocol-handler.js')} %u
Type=Application
Terminal=false
MimeType=x-scheme-handler/${PROTOCOL};
NoDisplay=true
`;

  const applicationsDir = path.join(process.env.HOME, '.local', 'share', 'applications');
  fs.mkdirSync(applicationsDir, { recursive: true });
  
  const desktopFile = path.join(applicationsDir, 'g3tzkp-handler.desktop');
  fs.writeFileSync(desktopFile, desktopEntry);
  
  console.log('[Linux] Desktop entry created:', desktopFile);
  
  try {
    execSync(`xdg-mime default g3tzkp-handler.desktop x-scheme-handler/${PROTOCOL}`);
    execSync('update-desktop-database ~/.local/share/applications/');
    console.log('[Linux] Protocol handler registered successfully!');
  } catch (e) {
    console.log('[Linux] Run these commands manually:');
    console.log(`  xdg-mime default g3tzkp-handler.desktop x-scheme-handler/${PROTOCOL}`);
    console.log('  update-desktop-database ~/.local/share/applications/');
  }
}

console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║     G3TZKP PROTOCOL INSTALLER                         ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

const os = getOS();
console.log(`Detected OS: ${os}`);
console.log('');

switch (os) {
  case 'windows':
    registerWindows();
    break;
  case 'macos':
    registerMacOS();
    break;
  case 'linux':
    registerLinux();
    break;
}

console.log('');
console.log('Next steps:');
console.log('  1. Start the daemon: npm start');
console.log('  2. Open in browser: g3tzkp://MESSENGER');
console.log('');
