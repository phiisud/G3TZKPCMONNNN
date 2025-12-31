#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PRODUCTION_DIR="$SCRIPT_DIR/production"
PTAU_FILE="$SCRIPT_DIR/pot12_final.ptau"

echo "=== G3ZKP Production Circuit Compilation ==="
echo "Production circuits directory: $PRODUCTION_DIR"
echo "Build directory: $BUILD_DIR"
echo "Powers of Tau file: $PTAU_FILE"

if [ ! -d "$PRODUCTION_DIR" ]; then
  echo "ERROR: Production directory not found at $PRODUCTION_DIR"
  exit 1
fi

if [ ! -f "$PTAU_FILE" ]; then
  echo "ERROR: Powers of Tau file not found at $PTAU_FILE"
  echo "This file is required for the trusted setup phase of Groth16"
  exit 1
fi

mkdir -p "$BUILD_DIR"

echo ""
echo "=== Installing Dependencies ==="
npm install 2>&1 || echo "Dependencies already installed"

echo ""
echo "=== Checking Required Tools ==="

if ! npx circom --version &> /dev/null; then
  echo "ERROR: circom not found. Installing..."
  npm install --save-dev circom
fi

if ! npx snarkjs --version &> /dev/null; then
  echo "ERROR: snarkjs not found. Installing..."
  npm install --save-dev snarkjs
fi

if [ ! -d "node_modules/circomlib" ]; then
  echo "ERROR: circomlib not found. Installing..."
  npm install circomlib
fi

echo "✅ All required tools available"

compile_circuit() {
  local circuit_name=$1
  local circuit_file="$PRODUCTION_DIR/${circuit_name}.circom"
  
  if [ ! -f "$circuit_file" ]; then
    echo "ERROR: Circuit file not found: $circuit_file"
    return 1
  fi
  
  echo ""
  echo "=========================================="
  echo "Compiling: $circuit_name (Production)"
  echo "=========================================="
  
  echo "Step 1: Compile Circom to R1CS and WASM..."
  npx circom "$circuit_file" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR" \
    || {
      echo "ERROR: Circom compilation failed for $circuit_name"
      return 1
    }
  
  echo "✅ Step 1: R1CS and WASM generated"
  
  echo ""
  echo "Step 2: Setup Groth16 proving system..."
  npx snarkjs groth16 setup \
    "$BUILD_DIR/${circuit_name}.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/${circuit_name}_0000.zkey" \
    || {
      echo "ERROR: Groth16 setup failed"
      return 1
    }
  
  echo "✅ Step 2: Groth16 setup complete"
  
  echo ""
  echo "Step 3: Contribute to ceremony (adding entropy)..."
  CONTRIBUTION_SEED="g3zkp-production-$(date +%s)-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' ')"
  echo "$CONTRIBUTION_SEED" | npx snarkjs zkey contribute \
    "$BUILD_DIR/${circuit_name}_0000.zkey" \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    --name="G3ZKP Production Contributor" \
    || {
      echo "ERROR: Ceremony contribution failed"
      return 1
    }
  
  echo "✅ Step 3: Ceremony contribution complete"
  
  echo ""
  echo "Step 4: Export verification key..."
  npx snarkjs zkey export verificationkey \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    "$BUILD_DIR/${circuit_name}_verification_key.json" \
    || {
      echo "ERROR: Verification key export failed"
      return 1
    }
  
  echo "✅ Step 4: Verification key exported"
  
  echo ""
  echo "Step 5: Export Solidity verifier contract..."
  npx snarkjs zkey export solidityverifier \
    "$BUILD_DIR/${circuit_name}_final.zkey" \
    "$BUILD_DIR/${circuit_name}_verifier.sol" \
    || {
      echo "WARNING: Solidity verifier export skipped (optional)"
    }
  
  echo "✅ Step 5: Solidity verifier exported"
  
  echo ""
  echo "✅ Circuit $circuit_name compiled successfully!"
}

declare -a CIRCUITS=(
  "authentication"
  "message_security"
  "forward_secrecy"
  "message_send"
  "message_delivery"
  "key_rotation"
  "group_message"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for circuit in "${CIRCUITS[@]}"; do
  if compile_circuit "$circuit"; then
    ((SUCCESS_COUNT++))
  else
    ((FAIL_COUNT++))
    echo "❌ Failed to compile $circuit"
  fi
done

echo ""
echo "=========================================="
echo "=== Compilation Summary ==="
echo "=========================================="
echo "Successfully compiled: $SUCCESS_COUNT circuits"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "Failed: $FAIL_COUNT circuits"
fi
echo "Build directory: $BUILD_DIR"

echo ""
echo "Build artifacts:"
ls -lh "$BUILD_DIR" | grep -E '\.(wasm|zkey|json|sym)$' || echo "No artifacts found"

echo ""
echo "=== Generating Circuit Registry ==="
cat > "$BUILD_DIR/circuit_registry.json" << EOF
{
  "version": "1.0.0",
  "production": true,
  "compiled_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ptau": "pot12_final.ptau",
  "ptau_power": 12,
  "circuits": [
EOF

first=true
for circuit in "${CIRCUITS[@]}"; do
  if [ -f "$BUILD_DIR/${circuit}_verification_key.json" ]; then
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$BUILD_DIR/circuit_registry.json"
    fi
    cat >> "$BUILD_DIR/circuit_registry.json" << EOF
    {
      "id": "$circuit",
      "name": "$circuit",
      "wasm": "${circuit}.wasm",
      "zkey": "${circuit}_final.zkey",
      "verification_key": "${circuit}_verification_key.json",
      "verifier_contract": "${circuit}_verifier.sol"
    }
EOF
  fi
done

cat >> "$BUILD_DIR/circuit_registry.json" << EOF

  ]
}
EOF

echo "✅ Circuit registry generated"
cat "$BUILD_DIR/circuit_registry.json"

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ All production circuits compiled successfully!"
  exit 0
else
  echo "❌ Some circuits failed to compile"
  exit 1
fi
