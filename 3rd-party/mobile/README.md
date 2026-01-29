# Info Board Mobile App

Capacitor-based mobile app for Info Board. Fast builds (~10-30 seconds vs Flutter's 3-4 minutes).

## Features

- **Capture**: Text notes, URLs, and files from your phone
- **Share Intent**: Receive shared content from other apps (browsers, Twitter, etc.)
- **Stats Dashboard**: 
  - Total captures, streak, today/week counts
  - Breakdown by type: Notes, Links, Images, Files
  - Manual refresh button
- **Recent Posts**: View your latest captures with type icons
- **Dark Theme**: Matches main Info Board aesthetic
- **Offline Settings**: Cached credentials work offline
- **PWA Support**: Installable as Progressive Web App

## Prerequisites

- Node.js 18+
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- Info Board server running

## Quick Start

```bash
# Install dependencies
npm install

# Build web assets
npm run build

# Add Android platform (first time only)
npm run cap:add:android

# Sync and build
npx cap sync android
```

## Building Android APK

### Command Line (Recommended)

```bash
# Set Java 17 (required)
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export ANDROID_HOME="$HOME/Android/Sdk"

# Build
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug --no-daemon

# APK location
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Android Studio

1. Open Android Studio: `npm run cap:open:android`
2. Build > Build Bundle(s) / APK(s) > Build APK(s)
3. APK saved to `android/app/build/outputs/apk/debug/`

## Development

### Browser Testing

```bash
npm run build
npm run dev
# Open http://localhost:3000
```

Note: Some features (Share Intent, Preferences) only work on native platforms.

### Live Reload (Android)

```bash
npm run android:run
```

### iOS (macOS only)

```bash
npm run cap:add:ios
npm run ios
```

## Project Structure

```
mobile/
├── src/
│   ├── index.html      # Main HTML structure
│   ├── app.css         # Styles (dark theme)
│   ├── app.js          # JavaScript logic
│   ├── manifest.json   # PWA manifest
│   ├── icon.svg        # Source icon
│   ├── icon-192.png    # PWA icon 192x192
│   └── icon-512.png    # PWA icon 512x512
├── dist/               # Built web assets (generated)
├── android/            # Android project (generated)
│   └── app/src/main/
│       ├── AndroidManifest.xml  # Share intents, permissions
│       ├── res/xml/network_security_config.xml  # HTTP support
│       └── java/.../MainActivity.java  # Share handler
├── ios/                # iOS project (generated)
├── capacitor.config.ts
├── package.json
└── infoboard-debug.apk # Pre-built debug APK
```

## Configuration

On first launch, enter:
- **Server URL**: Your Info Board server (e.g., `http://192.168.1.100:3000`)
- **Password**: Server password (if configured)

Settings are stored securely using Capacitor Preferences.

### HTTP Support (Development)

The app supports HTTP connections for local development. This is configured in:
- `android/app/src/main/AndroidManifest.xml` - `usesCleartextTraffic="true"`
- `android/app/src/main/res/xml/network_security_config.xml` - Allows cleartext

For production, use HTTPS.

## Share Intent (Android)

The app receives shared content from other apps:
- **Text**: Plain text notes
- **URLs**: Links from browsers, social apps
- **Images**: Photos from gallery, camera

Already configured in `AndroidManifest.xml`:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts/stats` | GET | Stats: total, streak, today, week, postsByType |
| `/api/posts?limit=10` | GET | Recent posts |
| `/api/posts` | POST | Create text post |
| `/api/upload/url` | POST | Save URL with metadata |
| `/api/upload` | POST | Upload file (base64) |

## Stats Response Format

```json
{
  "totalPosts": 150,
  "postsToday": 5,
  "postsThisWeek": 23,
  "streak": 7,
  "postsByType": {
    "text": 80,
    "url": 45,
    "image": 20,
    "file": 5
  }
}
```

## Troubleshooting

**Can't connect to server**
- For local servers, use IP address (not `localhost`)
- Ensure HTTP is allowed (network_security_config.xml)
- Check firewall allows connections

**Share intent not working**
- Verify AndroidManifest.xml has intent-filters
- Rebuild app: `./gradlew assembleDebug`
- Check MainActivity.java handles the intent

**Build fails**
- Run `npx cap sync android` to sync web assets
- Check Java version: `java -version` (needs 17+)
- Check Android SDK: `$ANDROID_HOME/tools/bin/sdkmanager --list`

**Stats not loading**
- Tap refresh button to retry
- Check server is running
- Verify API endpoint returns postsByType field

## Pre-built APK

A debug APK is included for quick testing:
```
infoboard-debug.apk (4.1MB)
```

Install via:
```bash
adb install infoboard-debug.apk
```

## License

MIT
