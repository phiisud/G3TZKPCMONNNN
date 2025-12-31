#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║     G3TZKP PROTOCOL DAEMON INSTALLER                  ║"
echo "║              One-Click P2P Network Setup              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo ""
    echo "Please install Node.js first:"
    echo "  https://nodejs.org/en/download/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[ERROR] Node.js 18+ required. You have: $(node -v)"
    exit 1
fi

echo "[1/4] Creating installation directory..."
INSTALL_DIR="$HOME/.g3tzkp"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/cache"
mkdir -p "$INSTALL_DIR/daemon"

echo "[2/4] Downloading G3TZKP Daemon..."
BOOTSTRAP="https://fb0c92fb-c5ce-4bf2-af3c-47d838dd952b-00-1n4r8m214ay9j.worf.replit.dev"

curl -sL "$BOOTSTRAP/daemon-package.tar.gz" -o "$INSTALL_DIR/daemon-package.tar.gz" 2>/dev/null

if [ ! -f "$INSTALL_DIR/daemon-package.tar.gz" ] || [ ! -s "$INSTALL_DIR/daemon-package.tar.gz" ]; then
    echo "[INFO] Downloading from alternative source..."
    
    mkdir -p "$INSTALL_DIR/daemon/src"
    mkdir -p "$INSTALL_DIR/daemon/scripts"
    
    cat > "$INSTALL_DIR/daemon/package.json" << 'PKGJSON'
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
PKGJSON

    curl -sL "$BOOTSTRAP/api/daemon-files/daemon.js" -o "$INSTALL_DIR/daemon/src/daemon.js"
    curl -sL "$BOOTSTRAP/api/daemon-files/peer-network.js" -o "$INSTALL_DIR/daemon/src/peer-network.js"
    curl -sL "$BOOTSTRAP/api/daemon-files/install.js" -o "$INSTALL_DIR/daemon/scripts/install.js"
    curl -sL "$BOOTSTRAP/api/daemon-files/protocol-handler.js" -o "$INSTALL_DIR/daemon/scripts/protocol-handler.js"
fi

echo "[3/4] Installing dependencies..."
cd "$INSTALL_DIR/daemon"
npm install --silent 2>/dev/null || npm install

echo "[4/4] Registering g3tzkp:// protocol..."
node scripts/install.js 2>/dev/null || echo "[INFO] Protocol registration may need manual step"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║            INSTALLATION COMPLETE!                     ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║  To start the daemon:                                  ║"
echo "║    cd ~/.g3tzkp/daemon && npm start                   ║"
echo "║                                                        ║"
echo "║  Then open in browser:                                 ║"
echo "║    g3tzkp://MESSENGER                                  ║"
echo "║                                                        ║"
echo "║  Or visit:                                             ║"
echo "║    http://127.0.0.1:47777/open/MESSENGER               ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

read -p "Start the daemon now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm start
fi
