/**
 * CopyUnbound - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const hostnameEl = document.getElementById('hostname');
  const restrictedEl = document.getElementById('restricted');
  const toggleSectionEl = document.getElementById('toggle-section');
  const toggleEl = document.getElementById('toggle');
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const featuresEl = document.getElementById('features');
  const actionsEl = document.getElementById('actions');
  const copyTextBtn = document.getElementById('copy-text-btn');
  const textModal = document.getElementById('text-modal');
  const textPreview = document.getElementById('text-preview');
  const charCount = document.getElementById('char-count');
  const modalClose = document.getElementById('modal-close');
  const copyConfirmBtn = document.getElementById('copy-confirm-btn');
  
  let currentHostname = null;
  let isRestricted = false;
  
  /**
   * Update UI based on state
   */
  function updateUI(enabled, restricted = false) {
    isRestricted = restricted;
    
    if (restricted) {
      restrictedEl.classList.add('show');
      toggleSectionEl.classList.add('hidden');
      return;
    }
    
    restrictedEl.classList.remove('show');
    toggleSectionEl.classList.remove('hidden');
    
    toggleEl.checked = enabled;
    
    if (enabled) {
      statusEl.classList.add('enabled');
      statusTextEl.textContent = 'Enabled';
      featuresEl.classList.add('show');
      actionsEl.classList.add('show');
    } else {
      statusEl.classList.remove('enabled');
      statusTextEl.textContent = 'Disabled';
      featuresEl.classList.remove('show');
      actionsEl.classList.remove('show');
    }
  }
  
  /**
   * Get current state from background
   */
  async function getState() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CU_GET_STATE' }, resolve);
    });
  }
  
  /**
   * Set state via background
   */
  async function setState(enabled) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CU_SET_STATE', enabled }, resolve);
    });
  }
  
  /**
   * Extract visible text
   */
  async function extractText() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CU_EXTRACT_TEXT' }, resolve);
    });
  }
  
  // Initialize
  try {
    const state = await getState();
    
    if (state.hostname) {
      hostnameEl.textContent = state.hostname;
      currentHostname = state.hostname;
    } else {
      hostnameEl.textContent = 'N/A';
    }
    
    updateUI(state.enabled, state.restricted);
  } catch (e) {
    hostnameEl.textContent = 'Error';
    updateUI(false, true);
  }
  
  // Toggle handler
  toggleEl.addEventListener('change', async () => {
    const enabled = toggleEl.checked;
    
    try {
      const result = await setState(enabled);
      
      if (result.success) {
        updateUI(result.enabled, false);
      } else {
        // Revert toggle
        toggleEl.checked = !enabled;
      }
    } catch (e) {
      toggleEl.checked = !enabled;
    }
  });
  
  // Copy visible text button
  copyTextBtn.addEventListener('click', async () => {
    copyTextBtn.disabled = true;
    copyTextBtn.textContent = 'Extracting...';
    
    try {
      const result = await extractText();
      
      if (result.success && result.text) {
        textPreview.value = result.text;
        charCount.textContent = `${result.text.length} characters`;
        textModal.classList.add('show');
      } else {
        alert(result.error || 'Could not extract text from this page.');
      }
    } catch (e) {
      alert('Error extracting text: ' + e.message);
    } finally {
      copyTextBtn.disabled = false;
      copyTextBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Copy Visible Text
      `;
    }
  });
  
  // Close modal
  modalClose.addEventListener('click', () => {
    textModal.classList.remove('show');
  });
  
  // Copy confirmed text
  copyConfirmBtn.addEventListener('click', async () => {
    const text = textPreview.value;
    
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      copyConfirmBtn.textContent = 'Copied!';
      
      setTimeout(() => {
        copyConfirmBtn.textContent = 'Copy to Clipboard';
        textModal.classList.remove('show');
      }, 1500);
    } catch (e) {
      alert('Could not copy to clipboard: ' + e.message);
    }
  });
});
