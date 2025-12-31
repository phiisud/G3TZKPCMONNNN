#!/bin/bash
set -e

echo "========================================="
echo "G3ZKP CIRCUIT COMPILATION (Docker/Ubuntu)"
echo "========================================="
echo ""

cd /zkp-build
pwd

echo "Step 1: Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq build-essential curl git wget pkg-config python3 >/dev/null 2>&1

echo "Step 2: Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs >/dev/null 2>&1
node --version
npm --version

echo "Step 3: Installing circom and snarkjs globally..."
npm install -g circom@2.1.8 snarkjs@0.7.5 >/dev/null 2>&1
echo "✅ Global tools installed"

echo "Step 4: Installing local npm dependencies..."
npm install >/dev/null 2>&1
echo "✅ Local dependencies installed"

echo ""
echo "Step 5: Running circuit compilation..."
bash compile-circuits.sh

echo ""
echo "========================================="
echo "BUILD COMPLETE"
echo "========================================="
ls -lah build/

# Create summary
echo ""
echo "Summary:"
wasm_count=$(find build -name "*.wasm" -type f | wc -l)
zkey_count=$(find build -name "*_final.zkey" -type f | wc -l)
vkey_count=$(find build -name "*_verification_key.json" -type f | wc -l)

echo "✅ WASM files: $wasm_count"
echo "✅ Proving keys: $zkey_count"
echo "✅ Verification keys: $vkey_count"
