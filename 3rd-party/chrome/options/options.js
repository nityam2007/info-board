// Info Board Chrome Extension - Options Page

// Default settings
const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:3000',
  password: '',
  showNotifications: true
};

// DOM Elements
const form = document.getElementById('settings-form');
const apiUrlInput = document.getElementById('apiUrl');
const passwordInput = document.getElementById('password');
const showNotificationsInput = document.getElementById('showNotifications');
const togglePasswordBtn = document.getElementById('toggle-password');
const testConnectionBtn = document.getElementById('test-connection');
const statusDiv = document.getElementById('status');
const connectionStatusDiv = document.getElementById('connection-status');
const openInfoBoardLink = document.getElementById('open-info-board');

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  
  apiUrlInput.value = settings.apiUrl;
  passwordInput.value = settings.password;
  showNotificationsInput.checked = settings.showNotifications;
  
  // Update the "Open Info Board" link
  updateOpenLink(settings.apiUrl);
}

// Update the Open Info Board link
function updateOpenLink(apiUrl) {
  openInfoBoardLink.href = apiUrl;
  openInfoBoardLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: apiUrl });
  });
}

// Save settings
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    apiUrl: apiUrlInput.value.replace(/\/$/, ''), // Remove trailing slash
    password: passwordInput.value,
    showNotifications: showNotificationsInput.checked
  };
  
  try {
    await chrome.storage.sync.set(settings);
    showStatus('Settings saved successfully!', 'success');
    updateOpenLink(settings.apiUrl);
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
});

// Toggle password visibility
togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  
  // Update icon (swap between eye and eye-off)
  togglePasswordBtn.innerHTML = isPassword
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`;
  
  togglePasswordBtn.title = isPassword ? 'Hide password' : 'Show password';
});

// Test connection
testConnectionBtn.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value.replace(/\/$/, '');
  
  if (!apiUrl) {
    showStatus('Please enter an API URL first', 'error');
    return;
  }
  
  testConnectionBtn.disabled = true;
  testConnectionBtn.classList.add('loading');
  testConnectionBtn.textContent = 'Testing';
  connectionStatusDiv.classList.add('hidden');
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add auth header if password is set
    if (passwordInput.value) {
      headers['Authorization'] = `Bearer ${passwordInput.value}`;
    }
    
    const response = await fetch(`${apiUrl}/api/posts?limit=1`, {
      method: 'GET',
      headers
    });
    
    if (response.ok) {
      showConnectionStatus(true, 'Connected to Info Board');
    } else if (response.status === 401) {
      showConnectionStatus(false, 'Authentication failed - check your password');
    } else {
      showConnectionStatus(false, `Server returned ${response.status}`);
    }
  } catch (error) {
    showConnectionStatus(false, 'Cannot reach server - check the URL');
  } finally {
    testConnectionBtn.disabled = false;
    testConnectionBtn.classList.remove('loading');
    testConnectionBtn.textContent = 'Test Connection';
  }
});

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusDiv.classList.add('hidden');
  }, 3000);
}

// Show connection status
function showConnectionStatus(connected, message) {
  connectionStatusDiv.innerHTML = `
    <span class="indicator"></span>
    <span>${message}</span>
  `;
  connectionStatusDiv.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
  connectionStatusDiv.classList.remove('hidden');
}

// Listen for API URL changes to update the link
apiUrlInput.addEventListener('input', () => {
  updateOpenLink(apiUrlInput.value || DEFAULT_SETTINGS.apiUrl);
});
