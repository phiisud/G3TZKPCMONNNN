#!/bin/bash
# G3ZKP Messenger - Server Deployment Package Build Script

set -e

echo "🖥️ Building G3ZKP Server Deployment Package..."

# Create deployment directory
mkdir -p PRODUCTION_DEPLOYMENT_PACKAGES/server

# Copy server files
echo "📁 Copying server files..."
cp messaging-server.js PRODUCTION_DEPLOYMENT_PACKAGES/server/
cp package.json PRODUCTION_DEPLOYMENT_PACKAGES/server/
cp package-lock.json PRODUCTION_DEPLOYMENT_PACKAGES/server/

# Copy ZKP circuits
if [ -d "zkp-circuits/build" ]; then
  echo "🔐 Copying ZKP circuits..."
  cp -r zkp-circuits/build PRODUCTION_DEPLOYMENT_PACKAGES/server/
fi

# Copy media storage directory (create if doesn't exist)
if [ -d "media_storage" ]; then
  echo "📸 Copying media storage..."
  cp -r media_storage PRODUCTION_DEPLOYMENT_PACKAGES/server/
else
  mkdir -p PRODUCTION_DEPLOYMENT_PACKAGES/server/media_storage
fi

# Copy public directory
if [ -d "public" ]; then
  echo "🌐 Copying public assets..."
  cp -r public PRODUCTION_DEPLOYMENT_PACKAGES/server/
fi

# Create server startup script
echo "📜 Creating startup script..."
cat > PRODUCTION_DEPLOYMENT_PACKAGES/server/start-server.sh << 'EOF'
#!/bin/bash
# G3ZKP Messenger Server Startup Script

echo "🚀 Starting G3ZKP Messenger Server..."
echo "====================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "📦 Node.js version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-3001}

# Create necessary directories
mkdir -p media_storage
mkdir -p zkp-circuits/build

echo "🔐 Setting up cryptographic circuits..."
echo "⚙️ Environment: NODE_ENV=$NODE_ENV"
echo "🌐 Port: $PORT"
echo "====================================="

# Start the server
echo "🚀 Starting server..."
exec node messaging-server.js
EOF

# Make startup script executable
chmod +x PRODUCTION_DEPLOYMENT_PACKAGES/server/start-server.sh

# Create environment template
cat > PRODUCTION_DEPLOYMENT_PACKAGES/server/.env.example << 'EOF'
# G3ZKP Messenger Server Environment Variables

# Server Configuration
NODE_ENV=production
PORT=3001
MESSAGING_PORT=3001

# Business Verification (UK Companies House)
COMPANIES_HOUSE_API_KEY=your_companies_house_api_key_here
COMPANIES_HOUSE_KEY=your_companies_house_api_key_here

# Transit APIs
TFL_API_KEY=your_tfl_api_key_here
DB_API_KEY=your_db_api_key_here
NS_API_KEY=your_ns_api_key_here
SNCF_API_KEY=your_sncf_api_key_here

# Traffic & Navigation
TOMTOM_API_KEY=your_tomtom_api_key_here
HERE_API_KEY=your_here_api_key_here

# Flight Tracking
OPENSKY_USERNAME=your_opensky_username
OPENSKY_PASSWORD=your_opensky_password
RAPIDAPI_KEY=your_rapidapi_key

# Security
SESSION_SECRET=your_secure_random_session_secret_here

# Replit (if deploying there)
REPLIT_DEV_DOMAIN=your_replit_dev_domain
REPL_SLUG=your_repl_slug
EOF

# Create README for server deployment
cat > PRODUCTION_DEPLOYMENT_PACKAGES/server/README.md << 'EOF'
# G3ZKP Messenger Server

## Quick Start

1. **Extract the package:**
   ```bash
   tar -xzf g3zkp-server.tar.gz
   cd server
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the server:**
   ```bash
   ./start-server.sh
   ```

The server will start on port 3001 by default.

## API Endpoints

- **Health Check:** `GET /api/health`
- **WebSocket:** `ws://localhost:3001` (Socket.IO)
- **Navigation:** `POST /api/navigation/route`
- **Transit:** `GET /api/transit/journey`
- **Business:** `POST /api/verify-company`
- **ZKP:** `POST /api/zkp/generate`

## Environment Variables

See `.env.example` for all required configuration options.

## Production Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "messaging-server.js"]
```

### Systemd Service
```ini
[Unit]
Description=G3ZKP Messenger Server
After=network.target

[Service]
Type=simple
User=g3zkp
WorkingDirectory=/opt/g3zkp-server
ExecStart=/opt/g3zkp-server/start-server.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

## Monitoring

The server provides health endpoints and logs all cryptographic operations for audit purposes.
EOF

# Create deployment package
echo "📦 Creating deployment package..."
cd PRODUCTION_DEPLOYMENT_PACKAGES
tar -czf g3zkp-server.tar.gz server/

echo "✅ Server deployment package created!"
echo "📦 Package: PRODUCTION_DEPLOYMENT_PACKAGES/g3zkp-server.tar.gz"