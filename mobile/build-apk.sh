#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22
export ANDROID_HOME="$HOME/Android/Sdk"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Generating JS bundle..."
npx expo export --platform android --output-dir /tmp/expo-bundle-$$
mkdir -p android/app/src/main/assets
cp /tmp/expo-bundle-$$/_expo/static/js/android/*.hbc android/app/src/main/assets/index.android.bundle
rm -rf /tmp/expo-bundle-$$

echo "Building APK... (first time may take 10-15 minutes)"
cd android
./gradlew assembleDebug 2>&1

echo ""
echo "=== If build succeeded, APK is at: ==="
echo "$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
