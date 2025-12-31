#!/bin/bash
# Circuit compilation in Docker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/zkp-circuits/build"

echo "========================================"
echo "G3ZKP CIRCUIT COMPILATION (Docker Linux)"
echo "========================================"
echo ""

# Create build directory
mkdir -p "$BUILD_DIR"

# Run Docker compilation
docker run --rm \
  -v "$SCRIPT_DIR/zkp-circuits:/zkp-build" \
  ubuntu:22.04 \
  bash -c '
    echo "Installing dependencies in Docker..."
    apt-get update -qq
    apt-get install -y -qq build-essential curl git wget pkg-config python3 nodejs npm >/dev/null 2>&1
    
    echo "Installing circom and snarkjs globally..."
    npm install -g circom@2.1.8 snarkjs@0.7.5 >/dev/null 2>&1
    
    cd /zkp-build
    echo "Installing local dependencies..."
    npm install 2>&1 | grep -E "added|up to date" || true
    
    echo ""
    echo "========================================"
    echo "COMPILING 12 CIRCUITS"
    echo "========================================"
    bash compile-circuits.sh
    
    echo ""
    echo "Build artifacts created:"
    ls -lah build/ | head -50
  '

echo ""
echo "✅ Compilation finished"
echo "Build directory: $BUILD_DIR"
ls -lah "$BUILD_DIR" | head -20
