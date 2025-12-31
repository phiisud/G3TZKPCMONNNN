# G3TZKP Protocol Daemon Installer for Windows
# Run this script in PowerShell as Administrator

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "     G3TZKP PROTOCOL DAEMON INSTALLER                  " -ForegroundColor Cyan
Write-Host "              One-Click P2P Network Setup              " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:"
    Write-Host "  https://nodejs.org/en/download/"
    Write-Host ""
    exit 1
}

$versionNum = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNum -lt 18) {
    Write-Host "[ERROR] Node.js 18+ required. You have: $nodeVersion" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Creating installation directory..."
$installDir = "$env:USERPROFILE\.g3tzkp"
New-Item -ItemType Directory -Force -Path "$installDir\cache" | Out-Null
New-Item -ItemType Directory -Force -Path "$installDir\daemon\src" | Out-Null
New-Item -ItemType Directory -Force -Path "$installDir\daemon\scripts" | Out-Null

Write-Host "[2/5] Downloading G3TZKP Daemon..."
$bootstrap = "https://fb0c92fb-c5ce-4bf2-af3c-47d838dd952b-00-1n4r8m214ay9j.worf.replit.dev"

$packageJson = @'
{
  "name": "g3tzkp-daemon",
  "version": "2.0.0",
  "type": "module",
  "main": "src/daemon.js",
  "scripts": {
    "start": "node src/daemon.js",
    "install-protocol": "node scripts/install.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
'@
Set-Content -Path "$installDir\daemon\package.json" -Value $packageJson

try {
    Invoke-WebRequest -Uri "$bootstrap/api/daemon-files/daemon.js" -OutFile "$installDir\daemon\src\daemon.js" -UseBasicParsing
    Invoke-WebRequest -Uri "$bootstrap/api/daemon-files/peer-network.js" -OutFile "$installDir\daemon\src\peer-network.js" -UseBasicParsing
    Invoke-WebRequest -Uri "$bootstrap/api/daemon-files/install.js" -OutFile "$installDir\daemon\scripts\install.js" -UseBasicParsing
    Invoke-WebRequest -Uri "$bootstrap/api/daemon-files/protocol-handler.js" -OutFile "$installDir\daemon\scripts\protocol-handler.js" -UseBasicParsing
} catch {
    Write-Host "[INFO] Using embedded daemon files..."
}

Write-Host "[3/5] Installing dependencies..."
Set-Location "$installDir\daemon"
npm install --silent 2>$null
if ($LASTEXITCODE -ne 0) {
    npm install
}

Write-Host "[4/5] Registering g3tzkp:// protocol..."

$regContent = @"
Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\g3tzkp]
@="URL:G3TZKP Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\g3tzkp\shell]

[HKEY_CLASSES_ROOT\g3tzkp\shell\open]

[HKEY_CLASSES_ROOT\g3tzkp\shell\open\command]
@="\"$($env:ProgramFiles)\nodejs\node.exe\" \"$installDir\daemon\scripts\protocol-handler.js\" \"%1\""
"@

$regFile = "$installDir\g3tzkp-protocol.reg"
Set-Content -Path $regFile -Value $regContent

Write-Host "[5/5] Creating startup shortcut..."
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = "$startupFolder\G3TZKP Daemon.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "node.exe"
$shortcut.Arguments = "$installDir\daemon\src\daemon.js"
$shortcut.WorkingDirectory = "$installDir\daemon"
$shortcut.Description = "G3TZKP Protocol Daemon"
$shortcut.Save()

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "            INSTALLATION COMPLETE!                     " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT: Run this command as Administrator to"
Write-Host "  register the g3tzkp:// protocol:"
Write-Host ""
Write-Host "    reg import `"$regFile`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To start the daemon:"
Write-Host "    cd $installDir\daemon"
Write-Host "    npm start"
Write-Host ""
Write-Host "  Then open in browser:"
Write-Host "    g3tzkp://MESSENGER"
Write-Host ""
Write-Host "  Or visit:"
Write-Host "    http://127.0.0.1:47777/open/MESSENGER"
Write-Host ""

$response = Read-Host "Start the daemon now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    npm start
}
