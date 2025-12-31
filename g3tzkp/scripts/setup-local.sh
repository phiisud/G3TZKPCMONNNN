#!/bin/bash
# G3ZKP Messenger Local Development Setup

set -e

echo "🚀 Setting up G3ZKP Messenger for LOCAL P2P development..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p {data/{messages,keys,proofs,logs,circuits},config,zkp-circuits,client/web/build,scripts}

# Initialize package.json if needed
if [ ! -f "package.json" ]; then
    echo "📦 Initializing package.json..."
    npm init -y
fi

# Install dependencies
echo "📥 Installing Node.js dependencies..."
npm install

# Install workspace dependencies
echo "📥 Installing workspace dependencies..."
npm install

# Initialize ZKP circuits
if [ ! -f "zkp-circuits/package.json" ]; then
    echo "🔐 Setting up ZKP circuits..."
    cd zkp-circuits
    npm init -y
    npm install circom snarkjs
    cd ..
fi

# Build JavaScript packages
echo "🏗️ Building JavaScript packages..."
npm run build 2>/dev/null || echo "Build script not yet available"

# Create local configuration
echo "⚙️ Creating local configuration..."
cat > config/local.config.json << 'EOF'
{
  "node": {
    "type": "pwa",
    "id": "local-node-001",
    "version": "1.0.0",
    "capabilities": ["messaging", "zkp", "p2p"]
  },
  "network": {
    "mode": "local_p2p",
    "bootstrapNodes": [],
    "enableRelay": false,
    "enableNatTraversal": false,
    "maxConnections": 50,
    "connectionTimeout": 30000,
    "localPort": 4001,
    "httpPort": 3000,
    "metricsPort": 8080
  },
  "security": {
    "zkpCircuitVersion": "g3zkp-v1.0",
    "encryptionProtocol": "x25519-chacha20poly1305",
    "forwardSecrecy": true,
    "postCompromiseSecurity": true,
    "auditLevel": "paranoid",
    "keyRotationInterval": 86400000
  },
  "messenger": {
    "provisionMode": "AUTO",
    "minProofs": 10,
    "proofExpirationDays": 90,
    "messageRetentionDays": 30,
    "maxMessageSize": 10485760,
    "bandwidthCapacity": 50000000,
    "messageStorage": 1073741824,
    "maxConnections": 50
  }
}
EOF

# Set executable permissions
echo "🔑 Setting permissions..."
chmod +x scripts/*.sh 2>/dev/null || echo "Scripts directory not found yet"

echo "✅ Local development setup complete!"
echo "🚀 Run 'npm start' to start the G3ZKP Messenger node"
echo "🌐 Web interface will be available at http://localhost:3000"
echo "📁 Data will be stored in ./data/"
echo "🔐 ZKP circuits can be built in ./zkp-circuits/"
