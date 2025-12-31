#!/bin/bash
# G3ZKP Messenger - Android APK Build Script

set -e

echo "🤖 Building G3ZKP Android APK..."

# Navigate to UI directory
cd "g3tzkp-messenger UI"

# Install Capacitor Android
echo "📦 Installing Capacitor Android..."
pnpm add @capacitor/android @capacitor/cli

# Initialize Capacitor if not already done
if [ ! -f "capacitor.config.json" ]; then
  echo "⚙️ Initializing Capacitor..."
  npx cap init "G3ZKP Messenger" "com.g3zkp.messenger" --web-dir=dist
fi

# Add Android platform
echo "📱 Adding Android platform..."
npx cap add android

# Build web assets
echo "🔨 Building web assets..."
pnpm run build

# Sync to Android
echo "🔄 Syncing assets to Android..."
npx cap sync android

# Build Android APK
echo "🏗️ Building Android APK..."
cd android
./gradlew assembleDebug

# Copy APK to deployment directory
echo "📁 Copying APK to deployment directory..."
mkdir -p ../../PRODUCTION_DEPLOYMENT_PACKAGES
cp app/build/outputs/apk/debug/app-debug.apk ../../PRODUCTION_DEPLOYMENT_PACKAGES/g3zkp-android-debug.apk

echo "✅ Android APK build completed!"
echo "📦 APK: PRODUCTION_DEPLOYMENT_PACKAGES/g3zkp-android-debug.apk"