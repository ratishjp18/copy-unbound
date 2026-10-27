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
  const toolsSectionEl = document.getElementById('tools-section');
  const copyTextBtn = document.getElementById('copy-text-btn');
  const textModal = document.getElementById('text-modal');
  const textPreview = document.getElementById('text-preview');
  const charCount = document.getElementById('char-count');
  const modalClose = document.getElementById('modal-close');
  const copyConfirmBtn = document.getElementById('copy-confirm-btn');
  const ocrBtn = document.getElementById('ocr-btn');
  
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
      toolsSectionEl.classList.add('hidden');
      return;
    }
    
    restrictedEl.classList.remove('show');
    toggleSectionEl.classList.remove('hidden');
    toolsSectionEl.classList.remove('hidden');
    
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
  
  // Copy Password button handler
  const copyPasswordBtn = document.getElementById('copy-password-btn');
  
  copyPasswordBtn.addEventListener('click', async () => {
    copyPasswordBtn.disabled = true;
    copyPasswordBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Copying...
    `;
    
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'CU_START_PASSWORD_COPY' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (result && result.success) {
        copyPasswordBtn.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied! (${result.length} chars)
        `;
        copyPasswordBtn.style.background = '#27ae60';
        copyPasswordBtn.style.color = 'white';
        
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        alert(result?.error || 'Could not copy password. Make sure the password field has a value.');
        resetPasswordButton();
      }
    } catch (e) {
      alert('Error: ' + e.message);
      resetPasswordButton();
    }
  });
  
  function resetPasswordButton() {
    copyPasswordBtn.disabled = false;
    copyPasswordBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Copy Password from Field
    `;
  }

  // OCR button handler
  ocrBtn.addEventListener('click', async () => {
    ocrBtn.disabled = true;
    ocrBtn.innerHTML = `
      <svg class="btn-icon spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
      </svg>
      Starting capture...
    `;
    
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'CU_START_OCR_CAPTURE' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (result && result.success) {
        // Close popup - capture will happen on page
        window.close();
      } else {
        alert(result?.error || 'Could not start OCR capture. Try reloading the page.');
        resetOcrButton();
      }
    } catch (e) {
      alert('Error: ' + e.message);
      resetOcrButton();
    }
  });
  
  function resetOcrButton() {
    ocrBtn.disabled = false;
    ocrBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      Extract Text from Image (OCR)
    `;
  }
});
