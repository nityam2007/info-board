// Info Board Chrome Extension - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pageTitle = document.getElementById('pageTitle');
  const pageUrl = document.getElementById('pageUrl');
  const capturePageBtn = document.getElementById('capturePageBtn');
  const noteInput = document.getElementById('noteInput');
  const captureNoteBtn = document.getElementById('captureNoteBtn');
  const captureSelectionBtn = document.getElementById('captureSelectionBtn');
  const openBoardBtn = document.getElementById('openBoardBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  // Get settings
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:3000',
    password: '',
    showNotifications: true
  });

  // Check connection
  async function checkConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testConnection' });
      if (response.success) {
        statusDot.classList.add('connected');
        statusDot.classList.remove('disconnected');
        statusText.textContent = 'Connected to Info Board';
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      statusDot.classList.add('disconnected');
      statusDot.classList.remove('connected');
      statusText.textContent = 'Not connected - check settings';
    }
  }

  // Get current tab info
  async function getCurrentTab() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
      pageTitle.textContent = response.title || 'No title';
      pageUrl.textContent = response.url || '';
      return response;
    } catch (error) {
      pageTitle.textContent = 'Unable to get page info';
      pageUrl.textContent = '';
      return null;
    }
  }

  // Show toast message
  function showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // Button state helper
  function setButtonState(btn, state, originalContent) {
    switch (state) {
      case 'loading':
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving...';
        break;
      case 'success':
        btn.disabled = true;
        btn.classList.add('success');
        btn.innerHTML = '✓ Saved!';
        setTimeout(() => {
          btn.disabled = false;
          btn.classList.remove('success');
          btn.innerHTML = originalContent;
        }, 2000);
        break;
      case 'error':
        btn.disabled = false;
        btn.classList.add('error');
        btn.innerHTML = '✗ Error';
        setTimeout(() => {
          btn.classList.remove('error');
          btn.innerHTML = originalContent;
        }, 2000);
        break;
      default:
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
  }

  // Capture current page
  capturePageBtn.addEventListener('click', async () => {
    const originalContent = capturePageBtn.innerHTML;
    setButtonState(capturePageBtn, 'loading');

    try {
      const tab = await getCurrentTab();
      if (!tab || !tab.url) throw new Error('No page to capture');

      const response = await chrome.runtime.sendMessage({
        action: 'captureUrl',
        url: tab.url,
        title: tab.title,
        source: 'extension'
      });

      if (response.success) {
        setButtonState(capturePageBtn, 'success', originalContent);
        showToast('Page saved to Info Board!');
      } else {
        throw new Error(response.error || 'Failed to save');
      }
    } catch (error) {
      setButtonState(capturePageBtn, 'error', originalContent);
      showToast(error.message, true);
    }
  });

  // Capture note
  captureNoteBtn.addEventListener('click', async () => {
    const text = noteInput.value.trim();
    if (!text) {
      noteInput.focus();
      noteInput.style.borderColor = '#ef4444';
      setTimeout(() => noteInput.style.borderColor = '', 500);
      return;
    }

    const originalContent = captureNoteBtn.innerHTML;
    setButtonState(captureNoteBtn, 'loading');

    try {
      // Check if it's a URL
      const isUrl = /^https?:\/\//i.test(text);
      
      let response;
      if (isUrl) {
        response = await chrome.runtime.sendMessage({
          action: 'captureUrl',
          url: text,
          title: '',
          source: 'extension'
        });
      } else {
        response = await chrome.runtime.sendMessage({
          action: 'captureText',
          text: text,
          source: 'extension'
        });
      }

      if (response.success) {
        setButtonState(captureNoteBtn, 'success', originalContent);
        showToast(isUrl ? 'Link saved!' : 'Note saved!');
        noteInput.value = '';
      } else {
        throw new Error(response.error || 'Failed to save');
      }
    } catch (error) {
      setButtonState(captureNoteBtn, 'error', originalContent);
      showToast(error.message, true);
    }
  });

  // Capture selection
  captureSelectionBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, async (response) => {
        if (response && response.text) {
          const result = await chrome.runtime.sendMessage({
            action: 'captureText',
            text: response.text,
            source: 'extension'
          });

          if (result.success) {
            showToast('Selection saved!');
          } else {
            showToast('Failed to save selection', true);
          }
        } else {
          showToast('No text selected', true);
        }
      });
    } catch (error) {
      showToast('Unable to capture selection', true);
    }
  });

  // Open Info Board
  openBoardBtn.addEventListener('click', async () => {
    chrome.tabs.create({ url: settings.apiUrl.replace(':3000', ':5173') });
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Keyboard shortcuts in note input
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      captureNoteBtn.click();
    }
  });

  // Initialize
  await checkConnection();
  await getCurrentTab();
});
