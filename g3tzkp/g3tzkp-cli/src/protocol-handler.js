import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const GATEWAY_PORT = 8080;

export async function registerProtocol() {
  const platform = os.platform();
  
  switch (platform) {
    case 'win32':
      return registerWindows();
    case 'darwin':
      return registerMacOS();
    case 'linux':
      return registerLinux();
    default:
      console.log(`Unsupported platform: ${platform}`);
      console.log('Manual registration required');
      printManualInstructions();
  }
}

export async function unregisterProtocol() {
  const platform = os.platform();
  
  switch (platform) {
    case 'win32':
      return unregisterWindows();
    case 'darwin':
      return unregisterMacOS();
    case 'linux':
      return unregisterLinux();
    default:
      console.log(`Unsupported platform: ${platform}`);
  }
}

function registerWindows() {
  const handlerScript = `@echo off
set URL=%1
set URL=%URL:g3tzkp://=%
for /f "tokens=1 delims=/" %%a in ("%URL%") do set NAME=%%a
start http://localhost:${GATEWAY_PORT}/%NAME%
`;

  const scriptsDir = path.join(os.homedir(), '.g3tzkp');
  fs.mkdirSync(scriptsDir, { recursive: true });
  
  const batPath = path.join(scriptsDir, 'g3tzkp-handler.bat');
  fs.writeFileSync(batPath, handlerScript);

  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\Classes\\g3tzkp]
@="URL:G3TZKP Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\\Software\\Classes\\g3tzkp\\shell]

[HKEY_CURRENT_USER\\Software\\Classes\\g3tzkp\\shell\\open]

[HKEY_CURRENT_USER\\Software\\Classes\\g3tzkp\\shell\\open\\command]
@="\\"${batPath.replace(/\\/g, '\\\\')}\\\" \\"%1\\""
`;

  const regPath = path.join(os.tmpdir(), 'g3tzkp-protocol.reg');
  fs.writeFileSync(regPath, regContent);
  
  try {
    execSync(`reg import "${regPath}"`, { stdio: 'pipe' });
    fs.unlinkSync(regPath);
    console.log('Windows registry updated');
    console.log('Handler script installed at:', batPath);
  } catch (error) {
    console.log('Registry file created at:', regPath);
    console.log('Handler script installed at:', batPath);
    console.log('Run the .reg file as administrator to complete installation');
  }
}

function unregisterWindows() {
  try {
    execSync('reg delete "HKEY_CURRENT_USER\\Software\\Classes\\g3tzkp" /f', { stdio: 'pipe' });
    console.log('Protocol handler removed from Windows registry');
  } catch (error) {
    console.log('Could not remove registry entry');
  }
}

function registerMacOS() {
  const handlerScript = `#!/bin/bash
URL="$1"
NAME=$(echo "$URL" | sed 's|g3tzkp://||' | sed 's|/.*||')
open "http://localhost:${GATEWAY_PORT}/$NAME"
`;

  const scriptPath = path.join(os.homedir(), '.g3tzkp', 'open-handler.sh');
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, handlerScript);
  fs.chmodSync(scriptPath, '755');

  const appPath = path.join(os.homedir(), 'Applications', 'G3TZKP Handler.app');
  const contentsPath = path.join(appPath, 'Contents');
  const macOSPath = path.join(contentsPath, 'MacOS');
  
  fs.mkdirSync(macOSPath, { recursive: true });
  
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>handler</string>
    <key>CFBundleIdentifier</key>
    <string>com.g3tzkp.handler</string>
    <key>CFBundleName</key>
    <string>G3TZKP Handler</string>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>G3TZKP Protocol</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>g3tzkp</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`;

  fs.writeFileSync(path.join(contentsPath, 'Info.plist'), infoPlist);
  
  const handlerBin = `#!/bin/bash
"${scriptPath}" "$@"
`;
  fs.writeFileSync(path.join(macOSPath, 'handler'), handlerBin);
  fs.chmodSync(path.join(macOSPath, 'handler'), '755');

  console.log('macOS handler app created at:', appPath);
  console.log('Run: open ~/Applications/G3TZKP\\ Handler.app to register');
}

function unregisterMacOS() {
  const appPath = path.join(os.homedir(), 'Applications', 'G3TZKP Handler.app');
  if (fs.existsSync(appPath)) {
    fs.rmSync(appPath, { recursive: true });
    console.log('Handler app removed');
  }
}

function registerLinux() {
  const handlerScript = `#!/bin/bash
URL="$1"
NAME=$(echo "$URL" | sed 's|g3tzkp://||' | sed 's|/.*||')
xdg-open "http://localhost:${GATEWAY_PORT}/$NAME"
`;

  const scriptsDir = path.join(os.homedir(), '.g3tzkp');
  fs.mkdirSync(scriptsDir, { recursive: true });
  
  const scriptPath = path.join(scriptsDir, 'g3tzkp-handler.sh');
  fs.writeFileSync(scriptPath, handlerScript);
  fs.chmodSync(scriptPath, '755');

  const desktopEntry = `[Desktop Entry]
Name=G3TZKP Handler
Exec=${scriptPath} %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/g3tzkp;
`;

  const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
  fs.mkdirSync(appsDir, { recursive: true });
  
  const desktopPath = path.join(appsDir, 'g3tzkp-handler.desktop');
  fs.writeFileSync(desktopPath, desktopEntry);
  
  try {
    execSync(`xdg-mime default g3tzkp-handler.desktop x-scheme-handler/g3tzkp`, { stdio: 'pipe' });
    console.log('Linux protocol handler registered');
    console.log('Handler script installed at:', scriptPath);
  } catch (error) {
    console.log('Desktop file created at:', desktopPath);
    console.log('Handler script installed at:', scriptPath);
    console.log('Run: xdg-mime default g3tzkp-handler.desktop x-scheme-handler/g3tzkp');
  }
}

function unregisterLinux() {
  const desktopPath = path.join(os.homedir(), '.local', 'share', 'applications', 'g3tzkp-handler.desktop');
  if (fs.existsSync(desktopPath)) {
    fs.unlinkSync(desktopPath);
    console.log('Linux handler removed');
  }
}

function printManualInstructions() {
  console.log(`
Manual Protocol Registration:

The g3tzkp:// protocol redirects to the local gateway at:
  http://localhost:${GATEWAY_PORT}/APP_NAME

For any browser, you can simply use:
  http://localhost:${GATEWAY_PORT}/MESSENGER

To access your deployed apps directly.
`);
}
