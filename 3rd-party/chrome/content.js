// Info Board Chrome Extension - Content Script

// Quick note dialog HTML
const QUICK_NOTE_HTML = `
<div id="info-board-overlay" class="info-board-overlay">
  <div class="info-board-dialog">
    <div class="info-board-header">
      <span class="info-board-logo">📋</span>
      <span class="info-board-title">Quick Note to Info Board</span>
      <button class="info-board-close" id="info-board-close">&times;</button>
    </div>
    <div class="info-board-body">
      <textarea 
        id="info-board-note" 
        class="info-board-textarea" 
        placeholder="Type your note here..."
        autofocus
      ></textarea>
    </div>
    <div class="info-board-footer">
      <button class="info-board-btn info-board-btn-secondary" id="info-board-cancel">Cancel</button>
      <button class="info-board-btn info-board-btn-primary" id="info-board-save">
        <span class="info-board-btn-icon">💾</span>
        Save Note
      </button>
    </div>
  </div>
</div>
`;

// Track if dialog is open
let dialogOpen = false;

// Show quick note dialog
function showQuickNote(prefillText = '') {
  if (dialogOpen) return;
  dialogOpen = true;
  
  // Create dialog container
  const container = document.createElement('div');
  container.innerHTML = QUICK_NOTE_HTML;
  document.body.appendChild(container.firstElementChild);
  
  const overlay = document.getElementById('info-board-overlay');
  const textarea = document.getElementById('info-board-note');
  const closeBtn = document.getElementById('info-board-close');
  const cancelBtn = document.getElementById('info-board-cancel');
  const saveBtn = document.getElementById('info-board-save');
  
  // Prefill with selected text if any
  if (prefillText) {
    textarea.value = prefillText;
  }
  
  // Focus textarea
  setTimeout(() => textarea.focus(), 100);
  
  // Close function
  function closeDialog() {
    overlay.classList.add('info-board-closing');
    setTimeout(() => {
      overlay.remove();
      dialogOpen = false;
    }, 200);
  }
  
  // Save function
  async function saveNote() {
    const text = textarea.value.trim();
    if (!text) {
      textarea.classList.add('info-board-error');
      setTimeout(() => textarea.classList.remove('info-board-error'), 500);
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="info-board-spinner"></span> Saving...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureText',
        text: text,
        source: 'extension'
      });
      
      if (response.success) {
        saveBtn.innerHTML = '<span class="info-board-btn-icon">✓</span> Saved!';
        setTimeout(closeDialog, 500);
      } else {
        throw new Error(response.error || 'Failed to save');
      }
    } catch (error) {
      saveBtn.innerHTML = '<span class="info-board-btn-icon">⚠️</span> Error';
      saveBtn.disabled = false;
      setTimeout(() => {
        saveBtn.innerHTML = '<span class="info-board-btn-icon">💾</span> Save Note';
      }, 2000);
    }
  }
  
  // Event listeners
  closeBtn.addEventListener('click', closeDialog);
  cancelBtn.addEventListener('click', closeDialog);
  saveBtn.addEventListener('click', saveNote);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });
  
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveNote();
    }
    if (e.key === 'Escape') {
      closeDialog();
    }
  });
}

// Get selected text
function getSelection() {
  return window.getSelection().toString().trim();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'showQuickNote':
      const selectedText = getSelection();
      showQuickNote(selectedText);
      sendResponse({ success: true });
      break;
      
    case 'getSelection':
      sendResponse({ text: getSelection() });
      break;
      
    default:
      sendResponse({ success: false });
  }
  
  return true;
});
