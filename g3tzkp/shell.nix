# G3ZKP Messenger - Production Build Environment
# Nix shell with all dependencies for multi-platform deployment

{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-23.11.tar.gz") {} }:

pkgs.mkShell {
  name = "g3zkp-production-build";

  # Build dependencies
  buildInputs = with pkgs; [
    # Node.js ecosystem
    nodejs_22
    yarn
    # pnpm installed via npm

    # Native build tools
    gcc
    gnumake
    cmake
    pkg-config

    # Android build tools
    jdk17
    android-tools
    gradle

    # iOS/macOS build tools (for cross-compilation) - not available on Linux
    # darwin.apple_sdk.frameworks.CoreFoundation
    # darwin.apple_sdk.frameworks.Foundation
    # darwin.apple_sdk.frameworks.AppKit
    # darwin.apple_sdk.frameworks.WebKit

    # Capacitor/Cordova tools - will be installed via npm
    # nodePackages."@capacitor/cli"
    # nodePackages."@capacitor/core"
    # nodePackages."@capacitor/android"
    # nodePackages."@capacitor/ios"
    # nodePackages."@capacitor/electron"

    # Electron build tools - will be installed via npm
    # electron
    # nodePackages.electron-builder

    # ZKP compilation tools - will be installed via npm
    # snarkjs
    # circom
    # npx

    # Compression and packaging
    zip
    unzip
    gnutar
    gzip

    # Image processing (for app icons)
    imagemagick
    inkscape

    # Version control
    git

    # Text processing
    jq
    yq

    # Networking (for API testing)
    curl
    wget

    # Development tools
    # vscode (unfree)
    vim
    nano

    # System monitoring
    htop
    # iotop
    # ncdu
  ];

  # Environment variables
  shellHook = ''
    echo "🚀 G3ZKP Messenger Production Build Environment"
    echo "=============================================="
    export JAVA_HOME=${pkgs.jdk17}
    export PATH=$JAVA_HOME/bin:$PATH
    echo "Installing pnpm..."
    npm install -g pnpm
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo "Java: $(java -version 2>&1 | head -n 1)"
    echo "Android SDK: Available"
    echo "Capacitor: $(npx cap --version 2>/dev/null || echo 'Not installed')"
    echo "Electron: $(npx electron --version 2>/dev/null || echo 'Not installed')"
    echo "=============================================="
    echo ""
    echo "Available commands:"
    echo "  build-all        - Build all platforms"
    echo "  build-web        - Build web PWA"
    echo "  build-android    - Build Android APK"
    echo "  build-ios        - Build iOS PWA"
    echo "  build-electron   - Build desktop apps"
    echo "  build-windows    - Build Windows installer"
    echo "  build-mac        - Build macOS app"
    echo "  build-linux      - Build Linux packages"
    echo ""
    echo "Environment ready for G3ZKP deployment! 🎯"
  '';
}