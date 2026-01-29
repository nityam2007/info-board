# Mobile App (Android)

> Capture content via Android share intent

## Features

- Share text, URLs, images to Info Board
- Appears in Android share menu
- Sends directly to backend API
- Offline queue (capture now, sync later)

## Tech Stack (Planned)

- React Native or Flutter
- Background sync
- Push notifications for AI suggestions

## Share Intent

The app registers as a share target for:
- `text/plain` - Text and URLs
- `image/*` - Images
- `*/*` - Any file type

## API Integration

```javascript
// Share handler
async function handleShare(sharedData) {
  if (sharedData.type === 'text') {
    await fetch(`${API_URL}/api/posts`, {
      method: 'POST',
      body: JSON.stringify({ content: sharedData.text, source: 'mobile' })
    });
  } else if (sharedData.type === 'file') {
    const base64 = await fileToBase64(sharedData.file);
    await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: JSON.stringify({ file: base64, filename: sharedData.filename })
    });
  }
}
```

## Status

Planned - not yet implemented.
