#!/bin/bash

echo "🔐 G3ZKP ZERO-KNOWLEDGE PROOF INTEGRATION TEST"
echo "=============================================="
echo ""

PROJECT_DIR="g3tzkp-messenger UI"
ZKP_DIR="zkp-circuits"

echo "1️⃣ Check ZKP Circuit Source Files"
echo "==================================="
if [ -d "$ZKP_DIR" ]; then
    CIRCUIT_COUNT=$(find "$ZKP_DIR" -name "*.circom" ! -path "*/node_modules/*" | wc -l)
    echo "✅ ZKP circuits directory found"
    echo "   📊 Found $CIRCUIT_COUNT circuit files"
    
    find "$ZKP_DIR" -name "*.circom" ! -path "*/node_modules/*" | sort | sed 's/^/   ✓ /'
else
    echo "❌ ZKP circuits directory not found"
    exit 1
fi

echo ""
echo "2️⃣ Check Powers of Tau Files"
echo "============================"
PTAU_COUNT=$(find "$ZKP_DIR" -name "*.ptau" ! -path "*/node_modules/*" | wc -l)
if [ "$PTAU_COUNT" -gt 0 ]; then
    echo "✅ Powers of Tau files found ($PTAU_COUNT files)"
    find "$ZKP_DIR" -name "*.ptau" ! -path "*/node_modules/*" -exec ls -lh {} \; | awk '{print "   " $9 " (" $5 ")"}'
else
    echo "❌ No Powers of Tau files found - needed for circuit compilation"
fi

echo ""
echo "3️⃣ Check for Compiled Circuit Artifacts"
echo "======================================="
WASM_COUNT=$(find "$ZKP_DIR" -name "*.wasm" ! -path "*/node_modules/*" | wc -l)
ZKEY_COUNT=$(find "$ZKP_DIR" -name "*.zkey" ! -path "*/node_modules/*" | wc -l)
VKEY_COUNT=$(find "$ZKP_DIR" -name "*verification_key.json" ! -path "*/node_modules/*" | wc -l)

if [ "$WASM_COUNT" -gt 0 ]; then
    echo "✅ Circuit WebAssembly files found ($WASM_COUNT)"
else
    echo "⚠️  No .wasm files - circuits not compiled yet"
fi

if [ "$ZKEY_COUNT" -gt 0 ]; then
    echo "✅ Proving key files found ($ZKEY_COUNT)"
else
    echo "⚠️  No .zkey files - trusted setup not completed"
fi

if [ "$VKEY_COUNT" -gt 0 ]; then
    echo "✅ Verification key files found ($VKEY_COUNT)"
else
    echo "⚠️  No verification_key.json files - keys not exported"
fi

COMPILATION_STATUS="❌ NOT COMPILED"
if [ "$WASM_COUNT" -gt 0 ] && [ "$ZKEY_COUNT" -gt 0 ]; then
    COMPILATION_STATUS="✅ COMPILED"
fi
echo ""
echo "Circuit Compilation Status: $COMPILATION_STATUS"

echo ""
echo "4️⃣ Check ZKPService Implementation"
echo "=================================="
ZKP_SERVICE="$PROJECT_DIR/src/services/ZKPService.ts"
if [ -f "$ZKP_SERVICE" ]; then
    echo "✅ ZKPService.ts exists"
    
    # Check for key methods
    METHODS=("generateProof" "verifyProof" "generateMessageProof" "generateDeliveryProof" "generateForwardSecrecyProof")
    for method in "${METHODS[@]}"; do
        if grep -q "async $method\|$method(" "$ZKP_SERVICE"; then
            echo "   ✓ Method found: $method"
        else
            echo "   ✗ Method missing: $method"
        fi
    done
    
    # Check simulation mode
    if grep -q "simulation" "$ZKP_SERVICE"; then
        echo "   ⚠️  Simulation mode detected"
    fi
else
    echo "❌ ZKPService.ts not found"
fi

echo ""
echo "5️⃣ Check ZKP Messaging Integration"
echo "==================================="
MESSAGING_SERVICE="$PROJECT_DIR/src/services/MessagingService.ts"
if [ -f "$MESSAGING_SERVICE" ]; then
    if grep -q "import.*zkpService\|from.*ZKPService" "$MESSAGING_SERVICE"; then
        echo "✅ ZKPService imported in MessagingService"
    else
        echo "⚠️  ZKPService not imported in MessagingService"
    fi
    
    if grep -q "generateMessageProof\|zkpProofId" "$MESSAGING_SERVICE"; then
        echo "✅ ZKP proof generation called in messaging"
    else
        echo "⚠️  ZKP proof generation not found in sendMessage"
    fi
    
    if grep -q "verifyProof" "$MESSAGING_SERVICE"; then
        echo "✅ ZKP proof verification found in messaging"
    else
        echo "⚠️  ZKP proof verification not found in message handling"
    fi
else
    echo "❌ MessagingService.ts not found"
fi

echo ""
echo "6️⃣ Check snarkjs Dependency"
echo "=========================="
PACKAGE_JSON="$PROJECT_DIR/package.json"
if [ -f "$PACKAGE_JSON" ]; then
    if grep -q '"snarkjs"' "$PACKAGE_JSON"; then
        echo "✅ snarkjs listed in package.json"
        VERSION=$(grep '"snarkjs"' "$PACKAGE_JSON" | head -1 | grep -o '\^[0-9.]*' || echo 'unknown')
        echo "   Version: $VERSION"
    else
        echo "⚠️  snarkjs not in package.json dependencies"
    fi
else
    echo "❌ package.json not found"
fi

echo ""
echo "7️⃣ Check for ZKP Build Configuration"
echo "===================================="
if [ -f "$ZKP_DIR/compile-circuits.sh" ]; then
    echo "✅ Circuit compilation script found"
    echo "   📝 To compile circuits, run:"
    echo "   bash zkp-circuits/compile-circuits.sh"
else
    echo "⚠️  compile-circuits.sh not found"
fi

if [ -f "$ZKP_DIR/package.json" ]; then
    echo "✅ ZKP package.json found"
else
    echo "⚠️  ZKP package.json not found"
fi

echo ""
echo "8️⃣ Summary"
echo "=========="
echo ""

# Determine overall status
OVERALL_STATUS="🟡 PARTIAL"
if [ "$WASM_COUNT" -gt 0 ] && [ "$ZKEY_COUNT" -gt 0 ]; then
    if grep -q "import.*zkpService" "$MESSAGING_SERVICE" && grep -q "generateMessageProof" "$MESSAGING_SERVICE"; then
        OVERALL_STATUS="🟢 READY"
    else
        OVERALL_STATUS="🟡 COMPILED NOT INTEGRATED"
    fi
elif [ "$CIRCUIT_COUNT" -gt 0 ]; then
    OVERALL_STATUS="🟡 CIRCUITS EXIST, NOT COMPILED"
else
    OVERALL_STATUS="🔴 NO CIRCUITS FOUND"
fi

echo "Overall ZKP Status: $OVERALL_STATUS"
echo ""

if [ "$COMPILATION_STATUS" = "❌ NOT COMPILED" ]; then
    echo "⚠️  NEXT STEPS:"
    echo "  1. Install dependencies:"
    echo "     cd zkp-circuits && npm install"
    echo ""
    echo "  2. Compile circuits:"
    echo "     bash compile-circuits.sh"
    echo ""
    echo "  3. Deploy compiled artifacts with application"
    echo ""
fi

echo "✅ ZKP Integration Test Complete"
