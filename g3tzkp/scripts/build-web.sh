#!/bin/bash
# G3ZKP Messenger - Web PWA Build Script

set -e

echo "🌐 Building G3ZKP Web PWA..."

# Navigate to UI directory
cd "g3tzkp-messenger UI"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build production bundle
echo "🔨 Building production bundle..."
pnpm run build

# Create deployment directory
echo "📁 Creating deployment package..."
mkdir -p ../PRODUCTION_DEPLOYMENT_PACKAGES/web

# Copy built files
cp -r dist/* ../PRODUCTION_DEPLOYMENT_PACKAGES/web/

# Create PWA manifest
cat > ../PRODUCTION_DEPLOYMENT_PACKAGES/web/manifest.json << 'EOF'
{
  "name": "G3ZKP Messenger",
  "short_name": "G3ZKP",
  "description": "Privacy-first decentralized messenger with zero-knowledge proofs",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#010401",
  "theme_color": "#00f3ff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF

# Create service worker
cat > ../PRODUCTION_DEPLOYMENT_PACKAGES/web/sw.js << 'EOF'
self.addEventListener('install', (event) => {
  console.log('G3ZKP PWA installed');
});

self.addEventListener('activate', (event) => {
  console.log('G3ZKP PWA activated');
});

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  if (event.request.url.includes('/static/') ||
      event.request.url.includes('.js') ||
      event.request.url.includes('.css')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
EOF

# Create deployment package
cd ../PRODUCTION_DEPLOYMENT_PACKAGES
zip -r g3zkp-web-pwa.zip web/

echo "✅ Web PWA build completed!"
echo "📦 Package: PRODUCTION_DEPLOYMENT_PACKAGES/g3zkp-web-pwa.zip"