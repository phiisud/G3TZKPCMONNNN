#!/bin/bash

# G3ZKP Zero-Knowledge Proof Circuit Compilation Script
# Uses Hermez Powers of Tau ceremony files for trusted setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PTAU_DIR="$SCRIPT_DIR/ptau"
CIRCUITS_DIR="$SCRIPT_DIR"

echo "=== G3ZKP Circuit Compilation ==="
echo "Build directory: $BUILD_DIR"

mkdir -p "$BUILD_DIR"
mkdir -p "$PTAU_DIR"

PTAU_FILE="$SCRIPT_DIR/pot12_final.ptau"
if [ ! -f "$PTAU_FILE" ]; then
  echo "ERROR: Powers of Tau file not found at $PTAU_FILE"
  echo "Please ensure the Perpetual Powers of Tau ceremony file is present"
  exit 1
else
  echo "Using Perpetual Powers of Tau ceremony file: $PTAU_FILE"
fi

compile_circuit() {
  local circuit_name=$1
  local circuit_file="$CIRCUITS_DIR/${circuit_name}.circom"
  
  if [ ! -f "$circuit_file" ]; then
    echo "Circuit file not found: $circuit_file"
    return 1
  fi
  
  echo ""
  echo "=== Compiling $circuit_name ==="
  
  echo "Step 1: Compiling Circom to R1CS and WASM..."
  npx circom2 "$circuit_file" --r1cs --wasm --sym -o "$BUILD_DIR" 2>&1 || {
    echo "Circom compilation failed for $circuit_name"
    return 1
  }

  echo "Step 2: Setting up Groth16 proving system..."
  npx snarkjs groth16 setup \
    "$BUILD_DIR/${circuit_name}.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/${circuit_name}_0000.zkey"

  echo "Step 3: Contributing to ceremony (adding entropy)..."
  echo "g3zkp-secure-random-contribution-$(date +%s)" | npx snarkjs zkey contribute \
    "$BUILD_DIR/${circuit_name}_0000.zkey" \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    --name="G3ZKP Contributor"

  echo "Step 4: Exporting verification key..."
  npx snarkjs zkey export verificationkey \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    "$BUILD_DIR/${circuit_name}_verification_key.json"

  echo "Step 5: Exporting Solidity verifier (optional)..."
  npx snarkjs zkey export solidityverifier \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    "$BUILD_DIR/${circuit_name}_verifier.sol" 2>/dev/null || echo "Solidity export skipped"
  
  echo "Circuit $circuit_name compiled successfully!"
}

echo ""
echo "Checking for circom installation..."
if ! npx circom2 --version &> /dev/null; then
  echo "ERROR: circom2 not found. Please install circom2 first."
  echo "Installation: npm install circom2"
  exit 1
fi

echo "Checking for snarkjs installation..."
if ! npx snarkjs --version &> /dev/null; then
  echo "ERROR: snarkjs not found. Installing..."
  npm install snarkjs
fi

echo ""
echo "Available circuits in production directory:"
ls -la "$CIRCUITS_DIR"/*.circom 2>/dev/null || echo "No .circom files found"

for circuit_file in "$CIRCUITS_DIR"/*.circom; do
  if [ -f "$circuit_file" ]; then
    circuit_name=$(basename "$circuit_file" .circom)
    compile_circuit "$circuit_name" || echo "Failed to compile $circuit_name, continuing..."
  fi
done

echo ""
echo "=== Compilation Complete ==="
echo "Build artifacts in: $BUILD_DIR"
ls -la "$BUILD_DIR"

echo ""
echo "Circuit Registry JSON:"
cat > "$BUILD_DIR/circuit_registry.json" << EOF
{
  "version": "1.0.0",
  "compiled_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ptau": "pot12_final.ptau (Powers of Tau Ceremony)",
  "circuits": [
$(for f in "$BUILD_DIR"/*_verification_key.json; do
  if [ -f "$f" ]; then
    name=$(basename "$f" _verification_key.json)
    echo "    {\"name\": \"$name\", \"verification_key\": \"${name}_verification_key.json\", \"zkey\": \"${name}_final.zkey\"},"
  fi
done | sed '$ s/,$//')
  ]
}
EOF

cat "$BUILD_DIR/circuit_registry.json"
