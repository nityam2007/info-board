# Info Board Mobile App

Capacitor-based mobile app for Info Board. Fast builds (~10-30 seconds vs Flutter's 3-4 minutes).

## Features

- Capture text notes, URLs, and files from your phone
- Receive shared content from other apps (share intent)
- View recent captures
- Track your capture streak
- Dark theme matching main app
- Works offline (cached data)

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

# Add Android platform
npm run cap:add:android

# Open in Android Studio
npm run cap:open:android
```

## Development

### Browser Testing

```bash
npm run build
npm run dev
# Open http://localhost:3000
```

### Android

```bash
# Sync and open Android Studio
npm run android

# Or run directly on device/emulator
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
│   ├── index.html    # Main HTML structure
│   ├── app.css       # Styles (dark theme)
│   ├── app.js        # JavaScript logic
│   ├── manifest.json # PWA manifest
│   └── icon.svg      # App icon
├── dist/             # Built web assets (generated)
├── android/          # Android project (generated)
├── ios/              # iOS project (generated)
├── capacitor.config.ts
└── package.json
```

## Configuration

On first launch, enter:
- **Server URL**: Your Info Board server (e.g., `https://infoboard.example.com`)
- **Password**: Server password (if configured)

Settings are stored securely using Capacitor Preferences (or localStorage in browser).

## Share Intent (Android)

The app can receive shared content from other apps:
- Share text/URLs from browsers, Twitter, etc.
- Content is automatically captured to your Info Board

To enable this after building, edit `android/app/src/main/AndroidManifest.xml` and add to the main activity:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts/stats` | GET | Get total posts, streak, today count |
| `/api/posts` | GET | Get recent posts |
| `/api/posts` | POST | Create text post |
| `/api/upload/url` | POST | Save URL with metadata |
| `/api/upload` | POST | Upload file (base64) |

## Building for Production

### Android APK

1. Open Android Studio: `npm run cap:open:android`
2. Build > Generate Signed Bundle/APK
3. Follow the signing wizard

### iOS

1. Open Xcode: `npm run cap:open:ios`
2. Product > Archive
3. Distribute via App Store or Ad Hoc

## Troubleshooting

**Can't connect to server**
- Check server URL includes `https://`
- Verify server is running and accessible
- Check password if configured

**Share intent not working**
- Ensure AndroidManifest.xml has the intent-filter
- Rebuild the app after changes

**Build fails**
- Run `npm run cap:sync` to sync web assets
- Check Android Studio / Xcode for specific errors

## License

MIT
