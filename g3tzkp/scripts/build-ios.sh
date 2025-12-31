#!/bin/bash
# G3ZKP Messenger - iOS PWA Build Script

set -e

echo "🍎 Building G3ZKP iOS PWA..."

# Navigate to UI directory
cd "g3tzkp-messenger UI"

# Install Capacitor iOS
echo "📦 Installing Capacitor iOS..."
pnpm add @capacitor/ios

# Initialize Capacitor if not already done
if [ ! -f "capacitor.config.json" ]; then
  echo "⚙️ Initializing Capacitor..."
  npx cap init "G3ZKP Messenger" "com.g3zkp.messenger" --web-dir=dist
fi

# Add iOS platform
echo "📱 Adding iOS platform..."
npx cap add ios

# Build web assets
echo "🔨 Building web assets..."
pnpm run build

# Sync to iOS
echo "🔄 Syncing assets to iOS..."
npx cap sync ios

# Create deployment directory and copy iOS project
echo "📁 Creating iOS deployment package..."
mkdir -p ../PRODUCTION_DEPLOYMENT_PACKAGES/ios
cp -r ios/* ../PRODUCTION_DEPLOYMENT_PACKAGES/ios/

# Create build instructions
cat > ../PRODUCTION_DEPLOYMENT_PACKAGES/ios/BUILD_INSTRUCTIONS.md << 'EOF'
# G3ZKP Messenger - iOS Build Instructions

## Prerequisites
- macOS with Xcode 15+
- iOS Simulator or physical device
- Apple Developer Account

## Build Steps
1. Open G3ZKP.xcworkspace in Xcode
2. Select target device/simulator
3. Product > Build (⌘B)
4. Product > Run (⌘R)

## App Store Deployment
1. Product > Archive
2. Window > Organizer
3. Distribute App > App Store Connect

## Configuration
- Bundle ID: com.g3zkp.messenger
- Team: [Your Apple Developer Team]
- Signing Certificate: [Your Distribution Certificate]

## PWA Features
- Add to Home Screen support
- Offline functionality
- Push notifications (requires additional setup)
- Camera and microphone access
EOF

# Create deployment package
cd ../PRODUCTION_DEPLOYMENT_PACKAGES
zip -r g3zkp-ios-project.zip ios/

echo "✅ iOS PWA build completed!"
echo "📦 Project: PRODUCTION_DEPLOYMENT_PACKAGES/g3zkp-ios-project.zip"