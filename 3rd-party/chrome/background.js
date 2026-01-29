// Info Board Chrome Extension - Background Service Worker

// Default settings
const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:3000',
  password: '',
  showNotifications: true
};

// Get settings from storage
async function getSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return result;
}

// API helper function
async function apiRequest(endpoint, method, body) {
  const settings = await getSettings();
  const url = `${settings.apiUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(settings.password && { 'Authorization': `Bearer ${settings.password}` })
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Show notification
async function showNotification(title, message, isError = false) {
  const settings = await getSettings();
  if (!settings.showNotifications) return;
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: isError ? 2 : 1
  });
}

// Capture functions
async function captureText(text, source = 'extension') {
  try {
    await apiRequest('/api/posts', 'POST', {
      content: text,
      source: source
    });
    await showNotification('Captured!', `Text saved to Info Board`);
    return { success: true };
  } catch (error) {
    await showNotification('Capture Failed', error.message, true);
    return { success: false, error: error.message };
  }
}

async function captureUrl(url, title = '', source = 'extension') {
  try {
    await apiRequest('/api/upload/url', 'POST', {
      url: url,
      title: title,
      source: source
    });
    await showNotification('Captured!', `Link saved: ${title || url}`);
    return { success: true };
  } catch (error) {
    await showNotification('Capture Failed', error.message, true);
    return { success: false, error: error.message };
  }
}

async function captureImage(imageUrl, pageUrl = '', source = 'extension', tabId = null) {
  try {
    let base64 = null;
    let mimeType = 'image/png';
    let filename = imageUrl.split('/').pop().split('?')[0] || 'image.png';
    
    // Clean up filename
    if (!filename.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i)) {
      filename = 'image.png';
    }
    
    // Method 1: Try direct fetch (works for CORS-enabled images)
    try {
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        mimeType = blob.type || 'image/png';
        base64 = await blobToBase64(blob);
      }
    } catch (e) {
      console.log('Direct fetch failed, trying content script method:', e.message);
    }
    
    // Method 2: Ask content script to capture via canvas (bypasses CORS)
    if (!base64 && tabId) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'captureImage',
          imageUrl: imageUrl
        });
        
        if (response && response.success && response.base64) {
          base64 = response.base64;
          mimeType = response.mimeType || 'image/png';
        }
      } catch (e) {
        console.log('Content script capture failed:', e.message);
      }
    }
    
    // Method 3: Try fetch with no-cors and blob URL
    if (!base64) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        mimeType = blob.type || 'image/png';
        base64 = await blobToBase64(blob);
      } catch (e) {
        console.log('No-cors fetch failed:', e.message);
      }
    }
    
    if (!base64) {
      throw new Error('Could not capture image. Try saving the image manually first.');
    }
    
    // Upload to Info Board
    await apiRequest('/api/upload', 'POST', {
      file: base64,
      filename: filename,
      mimeType: mimeType,
      source: source,
      metadata: { sourceUrl: pageUrl, originalUrl: imageUrl }
    });
    
    await showNotification('Captured!', 'Image saved to Info Board');
    return { success: true };
    
  } catch (error) {
    console.error('Image capture failed:', error);
    await showNotification('Capture Failed', error.message, true);
    return { success: false, error: error.message };
  }
}

// Helper to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// Context menu setup
function setupContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Parent menu
    chrome.contextMenus.create({
      id: 'info-board-parent',
      title: 'Save to Info Board',
      contexts: ['page', 'selection', 'link', 'image']
    });

    // Save page
    chrome.contextMenus.create({
      id: 'capture-page',
      parentId: 'info-board-parent',
      title: '📄 Save this page',
      contexts: ['page']
    });

    // Save selection
    chrome.contextMenus.create({
      id: 'capture-selection',
      parentId: 'info-board-parent',
      title: '📝 Save selected text',
      contexts: ['selection']
    });

    // Save link
    chrome.contextMenus.create({
      id: 'capture-link',
      parentId: 'info-board-parent',
      title: '🔗 Save this link',
      contexts: ['link']
    });

    // Save image
    chrome.contextMenus.create({
      id: 'capture-image',
      parentId: 'info-board-parent',
      title: '🖼️ Save this image',
      contexts: ['image']
    });

    // Separator
    chrome.contextMenus.create({
      id: 'separator',
      parentId: 'info-board-parent',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image']
    });

    // Quick note
    chrome.contextMenus.create({
      id: 'quick-note',
      parentId: 'info-board-parent',
      title: '✏️ Quick note...',
      contexts: ['page', 'selection', 'link', 'image']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'capture-page':
      await captureUrl(tab.url, tab.title);
      break;
      
    case 'capture-selection':
      if (info.selectionText) {
        await captureText(info.selectionText);
      }
      break;
      
    case 'capture-link':
      if (info.linkUrl) {
        await captureUrl(info.linkUrl, info.linkUrl);
      }
      break;
      
    case 'capture-image':
      if (info.srcUrl) {
        await captureImage(info.srcUrl, tab.url, 'extension', tab.id);
      }
      break;
      
    case 'quick-note':
      // Send message to content script to show quick note dialog
      chrome.tabs.sendMessage(tab.id, { action: 'showQuickNote' });
      break;
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  switch (command) {
    case 'capture-page':
      await captureUrl(tab.url, tab.title);
      break;
      
    case 'capture-selection':
      // Get selection from content script
      chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, async (response) => {
        if (response && response.text) {
          await captureText(response.text);
        } else {
          await showNotification('No Selection', 'Please select some text first', true);
        }
      });
      break;
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'captureText':
          const textResult = await captureText(message.text, message.source || 'extension');
          sendResponse(textResult);
          break;
          
        case 'captureUrl':
          const urlResult = await captureUrl(message.url, message.title, message.source || 'extension');
          sendResponse(urlResult);
          break;
          
        case 'captureImage':
          const imageResult = await captureImage(
            message.imageUrl, 
            message.pageUrl, 
            message.source || 'extension',
            sender.tab?.id
          );
          sendResponse(imageResult);
          break;
          
        case 'getCurrentTab':
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ url: tab.url, title: tab.title });
          break;
          
        case 'testConnection':
          const settings = await getSettings();
          try {
            const response = await fetch(`${settings.apiUrl}/api/posts?limit=1`);
            sendResponse({ success: response.ok });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  
  // Set default settings if not set
  chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
    chrome.storage.sync.set(result);
  });
});

// Re-setup context menus on startup
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});
