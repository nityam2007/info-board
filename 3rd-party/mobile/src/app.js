/**
 * Info Board Mobile App
 * Capacitor-based mobile client for Info Board
 */

// Capacitor imports (loaded at runtime)
let Preferences = null;
let App = null;
let Share = null;

// Check if running in Capacitor
const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;

// State
const state = {
  serverUrl: '',
  password: '',
  connected: false,
  activeTab: 'text',
  selectedFile: null,
  recentPosts: [],
  stats: { totalPosts: 0, streak: 0, postsToday: 0 }
};

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  bindEvents();
  
  // Load Capacitor plugins if available
  if (isCapacitor) {
    await loadCapacitorPlugins();
    await handleShareIntent();
  }
  
  // Check saved settings
  await loadSettings();
  
  if (state.serverUrl) {
    await testConnection(true);
  }
});

// Cache DOM elements
function cacheElements() {
  elements.settingsScreen = document.getElementById('settings-screen');
  elements.mainScreen = document.getElementById('main-screen');
  elements.settingsForm = document.getElementById('settings-form');
  elements.serverUrlInput = document.getElementById('server-url');
  elements.passwordInput = document.getElementById('password');
  elements.connectBtn = document.getElementById('connect-btn');
  elements.connectionError = document.getElementById('connection-error');
  elements.settingsBtn = document.getElementById('settings-btn');
  elements.serverName = document.getElementById('server-name');
  elements.totalPosts = document.getElementById('total-posts');
  elements.streakCount = document.getElementById('streak-count');
  elements.todayCount = document.getElementById('today-count');
  elements.tabs = document.querySelectorAll('.tab');
  elements.captureContents = document.querySelectorAll('.capture-content');
  elements.textInput = document.getElementById('text-input');
  elements.urlInput = document.getElementById('url-input');
  elements.fileDrop = document.getElementById('file-drop');
  elements.fileInput = document.getElementById('file-input');
  elements.filePreview = document.getElementById('file-preview');
  elements.fileName = document.getElementById('file-name');
  elements.clearFile = document.getElementById('clear-file');
  elements.captureBtn = document.getElementById('capture-btn');
  elements.recentList = document.getElementById('recent-list');
  elements.toast = document.getElementById('toast');
  elements.loading = document.getElementById('loading');
}

// Bind events
function bindEvents() {
  // Settings form
  elements.settingsForm.addEventListener('submit', handleConnect);
  elements.settingsBtn.addEventListener('click', showSettings);
  
  // Tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // File input
  elements.fileDrop.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.clearFile.addEventListener('click', clearFile);
  
  // Drag and drop
  elements.fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.fileDrop.classList.add('dragover');
  });
  elements.fileDrop.addEventListener('dragleave', () => {
    elements.fileDrop.classList.remove('dragover');
  });
  elements.fileDrop.addEventListener('drop', handleFileDrop);
  
  // Capture
  elements.captureBtn.addEventListener('click', handleCapture);
  
  // Enter key to submit
  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleCapture();
    }
  });
  elements.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleCapture();
    }
  });
}

// Load Capacitor plugins
async function loadCapacitorPlugins() {
  try {
    const { Preferences: P } = await import('@capacitor/preferences');
    const { App: A } = await import('@capacitor/app');
    const { Share: S } = await import('@capacitor/share');
    Preferences = P;
    App = A;
    Share = S;
  } catch (e) {
    console.log('Running in browser mode (no Capacitor plugins)');
  }
}

// Handle share intent from other apps
async function handleShareIntent() {
  if (!App) return;
  
  App.addListener('appUrlOpen', async (data) => {
    console.log('App opened with URL:', data.url);
    // Handle deep links if needed
  });
  
  // Check if app was opened with shared content
  try {
    const { value } = await App.getLaunchUrl();
    if (value) {
      console.log('Launch URL:', value);
    }
  } catch (e) {
    console.log('No launch URL');
  }
}

// Settings management
async function loadSettings() {
  if (Preferences) {
    const { value: url } = await Preferences.get({ key: 'serverUrl' });
    const { value: pass } = await Preferences.get({ key: 'password' });
    state.serverUrl = url || '';
    state.password = pass || '';
  } else {
    // Fallback to localStorage
    state.serverUrl = localStorage.getItem('infoboard_serverUrl') || '';
    state.password = localStorage.getItem('infoboard_password') || '';
  }
  
  elements.serverUrlInput.value = state.serverUrl;
  elements.passwordInput.value = state.password;
}

async function saveSettings() {
  if (Preferences) {
    await Preferences.set({ key: 'serverUrl', value: state.serverUrl });
    await Preferences.set({ key: 'password', value: state.password });
  } else {
    localStorage.setItem('infoboard_serverUrl', state.serverUrl);
    localStorage.setItem('infoboard_password', state.password);
  }
}

// Connection
async function handleConnect(e) {
  e.preventDefault();
  
  state.serverUrl = elements.serverUrlInput.value.trim().replace(/\/$/, '');
  state.password = elements.passwordInput.value;
  
  await testConnection(false);
}

async function testConnection(silent) {
  if (!silent) {
    elements.connectBtn.disabled = true;
    elements.connectBtn.querySelector('.btn-text').hidden = true;
    elements.connectBtn.querySelector('.btn-loading').hidden = false;
    elements.connectionError.hidden = true;
  }
  
  try {
    const response = await apiRequest('/api/posts/stats');
    
    if (response.ok) {
      const data = await response.json();
      state.stats = data;
      state.connected = true;
      await saveSettings();
      showMainScreen();
      updateStats();
      loadRecentPosts();
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error) {
    console.error('Connection error:', error);
    if (!silent) {
      elements.connectionError.textContent = 'Could not connect. Check URL and password.';
      elements.connectionError.hidden = false;
    }
    showSettings();
  } finally {
    if (!silent) {
      elements.connectBtn.disabled = false;
      elements.connectBtn.querySelector('.btn-text').hidden = false;
      elements.connectBtn.querySelector('.btn-loading').hidden = true;
    }
  }
}

// API request helper
async function apiRequest(endpoint, options = {}) {
  const url = state.serverUrl + endpoint;
  const headers = {
    ...options.headers
  };
  
  if (state.password) {
    headers['Authorization'] = `Bearer ${state.password}`;
  }
  
  return fetch(url, {
    ...options,
    headers
  });
}

// Screen navigation
function showSettings() {
  elements.mainScreen.hidden = true;
  elements.settingsScreen.hidden = false;
}

function showMainScreen() {
  elements.settingsScreen.hidden = true;
  elements.mainScreen.hidden = false;
  
  // Update server name display
  try {
    const url = new URL(state.serverUrl);
    elements.serverName.textContent = url.hostname;
  } catch {
    elements.serverName.textContent = 'Info Board';
  }
}

// Stats
function updateStats() {
  elements.totalPosts.textContent = formatNumber(state.stats.totalPosts || 0);
  elements.streakCount.textContent = state.stats.streak || 0;
  elements.todayCount.textContent = state.stats.postsToday || 0;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Tabs
function switchTab(tab) {
  state.activeTab = tab;
  
  elements.tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  elements.captureContents.forEach(c => {
    c.hidden = c.dataset.content !== tab;
  });
}

// File handling
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    setSelectedFile(file);
  }
}

function handleFileDrop(e) {
  e.preventDefault();
  elements.fileDrop.classList.remove('dragover');
  
  const file = e.dataTransfer.files[0];
  if (file) {
    setSelectedFile(file);
  }
}

function setSelectedFile(file) {
  state.selectedFile = file;
  elements.fileName.textContent = file.name;
  elements.fileDrop.hidden = true;
  elements.filePreview.hidden = false;
}

function clearFile() {
  state.selectedFile = null;
  elements.fileInput.value = '';
  elements.fileDrop.hidden = false;
  elements.filePreview.hidden = true;
}

// Capture
async function handleCapture() {
  const tab = state.activeTab;
  
  try {
    showLoading(true);
    
    let success = false;
    
    if (tab === 'text') {
      const content = elements.textInput.value.trim();
      if (!content) {
        showToast('Please enter some text', true);
        return;
      }
      success = await createTextPost(content);
      if (success) elements.textInput.value = '';
      
    } else if (tab === 'url') {
      const url = elements.urlInput.value.trim();
      if (!url) {
        showToast('Please enter a URL', true);
        return;
      }
      success = await createUrlPost(url);
      if (success) elements.urlInput.value = '';
      
    } else if (tab === 'file') {
      if (!state.selectedFile) {
        showToast('Please select a file', true);
        return;
      }
      success = await createFilePost(state.selectedFile);
      if (success) clearFile();
    }
    
    if (success) {
      showToast('Captured!');
      await refreshStats();
      await loadRecentPosts();
    }
    
  } catch (error) {
    console.error('Capture error:', error);
    showToast('Failed to capture. Try again.', true);
  } finally {
    showLoading(false);
  }
}

// Create posts
async function createTextPost(content) {
  const response = await apiRequest('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  
  return response.ok;
}

async function createUrlPost(url) {
  const response = await apiRequest('/api/upload/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  return response.ok;
}

async function createFilePost(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const response = await apiRequest('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: base64,
            mimeType: file.type
          })
        });
        resolve(response.ok);
      } catch (e) {
        reject(e);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Refresh stats
async function refreshStats() {
  try {
    const response = await apiRequest('/api/posts/stats');
    if (response.ok) {
      state.stats = await response.json();
      updateStats();
    }
  } catch (e) {
    console.error('Failed to refresh stats:', e);
  }
}

// Recent posts
async function loadRecentPosts() {
  try {
    const response = await apiRequest('/api/posts?limit=10');
    if (response.ok) {
      const data = await response.json();
      state.recentPosts = data.posts || [];
      renderRecentPosts();
    }
  } catch (e) {
    console.error('Failed to load recent posts:', e);
  }
}

function renderRecentPosts() {
  if (state.recentPosts.length === 0) {
    elements.recentList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✨</span>
        <p>No captures yet. Start by adding something above!</p>
      </div>
    `;
    return;
  }
  
  elements.recentList.innerHTML = state.recentPosts.map(post => {
    const icon = getPostIcon(post.content_type);
    const text = getPostPreview(post);
    const time = formatRelativeTime(post.created_at);
    const thumb = getPostThumbnail(post);
    
    return `
      <div class="recent-item" data-id="${post.id}">
        <div class="recent-icon">${icon}</div>
        <div class="recent-content">
          <div class="recent-text">${escapeHtml(text)}</div>
          <div class="recent-meta">${time}</div>
        </div>
        ${thumb ? `<img class="recent-thumb" src="${thumb}" alt="">` : ''}
      </div>
    `;
  }).join('');
}

function getPostIcon(contentType) {
  if (!contentType) return '📝';
  if (contentType.startsWith('image/')) return '🖼️';
  if (contentType.startsWith('video/')) return '🎬';
  if (contentType.startsWith('audio/')) return '🎵';
  if (contentType === 'text/x-url') return '🔗';
  if (contentType === 'application/pdf') return '📄';
  return '📝';
}

function getPostPreview(post) {
  if (post.content_type === 'text/x-url' && post.metadata?.title) {
    return post.metadata.title;
  }
  return post.content?.substring(0, 100) || 'No content';
}

function getPostThumbnail(post) {
  if (post.content_type?.startsWith('image/') && post.content) {
    return `${state.serverUrl}/uploads/${post.content}`;
  }
  if (post.metadata?.thumbnail) {
    return post.metadata.thumbnail;
  }
  return null;
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toast
let toastTimeout;
function showToast(message, isError = false) {
  clearTimeout(toastTimeout);
  
  const toast = elements.toast;
  toast.querySelector('.toast-message').textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 3000);
}

// Loading
function showLoading(show) {
  elements.loading.hidden = !show;
}

// Handle incoming shares (for Android intent handling)
window.handleSharedContent = async function(type, content) {
  console.log('Received shared content:', type, content);
  
  if (!state.connected) {
    // Store for later
    sessionStorage.setItem('pendingShare', JSON.stringify({ type, content }));
    return;
  }
  
  showLoading(true);
  
  try {
    let success = false;
    
    if (type === 'text') {
      // Check if it looks like a URL
      if (content.match(/^https?:\/\//)) {
        success = await createUrlPost(content);
      } else {
        success = await createTextPost(content);
      }
    } else if (type === 'url') {
      success = await createUrlPost(content);
    }
    
    if (success) {
      showToast('Captured from share!');
      await refreshStats();
      await loadRecentPosts();
    }
  } catch (e) {
    console.error('Failed to handle shared content:', e);
    showToast('Failed to capture shared content', true);
  } finally {
    showLoading(false);
  }
};

// Check for pending shares after connection
const originalShowMainScreen = showMainScreen;
showMainScreen = function() {
  originalShowMainScreen();
  
  // Check for pending share
  const pending = sessionStorage.getItem('pendingShare');
  if (pending) {
    sessionStorage.removeItem('pendingShare');
    const { type, content } = JSON.parse(pending);
    window.handleSharedContent(type, content);
  }
};
