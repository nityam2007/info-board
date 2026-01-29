# Info Board Chrome Extension

> Capture anything from your browser to Info Board with one click

## Features

- **Page Capture** - Save current page URL, title, and metadata
- **Text Selection** - Capture highlighted text
- **Image Capture** - Right-click any image to save it
- **Link Capture** - Save links without navigating to them
- **Quick Notes** - Write notes directly from any page
- **Keyboard Shortcuts** - Fast capture without clicking
- **Notifications** - Get feedback when content is saved

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this folder: `3rd-party/chrome`
5. The extension icon should appear in your toolbar

### Configure Settings

1. Click the extension icon in the toolbar
2. Click the **gear icon** or right-click the extension and select **Options**
3. Enter your Info Board server URL (default: `http://localhost:3000`)
4. Enter your password (if required)
5. Click **Test Connection** to verify
6. Click **Save Settings**

## Usage

### Context Menu (Right-Click)

Right-click on any page to access the "Save to Info Board" menu:

| Option | Description |
|--------|-------------|
| Save this page | Captures the page URL and title |
| Save selected text | Captures highlighted text |
| Save this link | Captures a link URL |
| Save this image | Downloads and saves an image |
| Quick note... | Opens a note dialog |

### Popup

Click the extension icon to open the popup:

- **Quick Note** - Type and save a note
- **Capture Page** - Save current page
- **Capture Selection** - Save selected text
- **Open Info Board** - Go to your Info Board

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+B` | Capture current page (B = Board) |
| `Alt+Shift+N` | Capture selected text (N = Note) |

> These shortcuts are designed to not conflict with system or browser shortcuts.
> You can customize them at `chrome://extensions/shortcuts`

## File Structure

```
chrome/
├── manifest.json       # Extension configuration
├── background.js       # Service worker (API calls, context menus)
├── content.js          # Content script (quick note dialog)
├── content.css         # Content script styles
├── popup/
│   ├── popup.html      # Popup UI
│   ├── popup.js        # Popup logic
│   └── popup.css       # Popup styles
├── options/
│   ├── options.html    # Settings page UI
│   ├── options.js      # Settings logic
│   └── options.css     # Settings styles
└── icons/
    ├── icon16.png      # 16x16 icon
    ├── icon32.png      # 32x32 icon
    ├── icon48.png      # 48x48 icon
    └── icon128.png     # 128x128 icon
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/posts` | POST | Create text post |
| `/api/posts` | GET | Test connection |
| `/api/upload/url` | POST | Save URL/link |
| `/api/upload` | POST | Upload image |

## Settings Storage

Settings are synced across Chrome instances using `chrome.storage.sync`:

```javascript
{
  apiUrl: 'http://localhost:3000',  // Info Board server URL
  password: '',                      // Auth password (optional)
  showNotifications: true            // Show success/error notifications
}
```

## Troubleshooting

### Extension not working?

1. Check that Info Board server is running
2. Verify the API URL in settings
3. Test connection in the options page
4. Check browser console for errors (`chrome://extensions` → Details → Inspect views)

### Notifications not showing?

1. Ensure notifications are enabled in extension settings
2. Check Chrome notification permissions
3. Look for the notification bell icon in Chrome

### Images not saving?

1. Some sites block image downloads (CORS)
2. Try right-clicking and opening the image in a new tab first
3. Check if the image URL is accessible

## Development

### Making Changes

1. Edit the source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging

- **Background script**: `chrome://extensions` → Details → Inspect views: service worker
- **Popup**: Right-click popup → Inspect
- **Content script**: Open DevTools on any page → Console

## License

Part of the Info Board project. See root LICENSE file.
