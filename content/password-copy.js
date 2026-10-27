/**
 * CopyUnbound - Password Copy Module
 * Finds password fields and lets user copy their values
 */

(function() {
  'use strict';
  
  // Find all password fields on the page
  const passwordFields = document.querySelectorAll('input[type="password"]');
  const textFields = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
  
  // Combine all inputs
  const allInputs = [...passwordFields, ...textFields].filter(input => input.value);
  
  if (allInputs.length === 0) {
    showMessage('No filled input fields found on this page', 'error');
    return;
  }
  
  // If there's a password field with value, prioritize it
  const passwordWithValue = [...passwordFields].find(p => p.value);
  
  if (passwordWithValue) {
    copyToClipboard(passwordWithValue.value, 'Password');
  } else if (allInputs.length === 1) {
    // Only one input with value
    copyToClipboard(allInputs[0].value, 'Field value');
  } else {
    // Multiple inputs - show picker
    showInputPicker(allInputs);
  }
  
  /**
   * Copy text to clipboard
   */
  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showMessage(`${label} copied! (${text.length} chars)`, 'success');
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showMessage(`${label} copied! (${text.length} chars)`, 'success');
      } catch (e) {
        showMessage('Copy failed: ' + e.message, 'error');
      }
      document.body.removeChild(textarea);
    }
  }
  
  /**
   * Show input picker when multiple fields exist
   */
  function showInputPicker(inputs) {
    const modal = document.createElement('div');
    modal.id = 'cu-password-picker';
    modal.innerHTML = `
      <style>
        #cu-password-picker {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .cu-picker-dialog {
          background: white;
          border-radius: 12px;
          padding: 20px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .cu-picker-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #333;
        }
        .cu-picker-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }
        .cu-picker-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
        }
        .cu-picker-item:hover {
          background: #e8f4fd;
          border-color: #4a90d9;
        }
        .cu-picker-icon {
          width: 24px;
          height: 24px;
          color: #666;
        }
        .cu-picker-info {
          flex: 1;
        }
        .cu-picker-type {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
        }
        .cu-picker-value {
          font-size: 14px;
          color: #333;
          font-family: monospace;
        }
        .cu-picker-close {
          margin-top: 16px;
          width: 100%;
          padding: 10px;
          background: #eee;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .cu-picker-close:hover {
          background: #ddd;
        }
      </style>
      <div class="cu-picker-dialog">
        <div class="cu-picker-title">� Select a field to copy</div>
        <div class="cu-picker-list"></div>
        <button class="cu-picker-close">Cancel</button>
      </div>
    `;
    
    const list = modal.querySelector('.cu-picker-list');
    
    inputs.forEach((input, index) => {
      const isPassword = input.type === 'password';
      const displayValue = isPassword ? '•'.repeat(Math.min(input.value.length, 12)) : 
                          (input.value.length > 30 ? input.value.substring(0, 30) + '...' : input.value);
      const type = isPassword ? 'Password' : (input.type || 'Text');
      
      const item = document.createElement('div');
      item.className = 'cu-picker-item';
      item.innerHTML = `
        <svg class="cu-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${isPassword ? 
            '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' :
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
          }
        </svg>
        <div class="cu-picker-info">
          <div class="cu-picker-type">${type} (${input.value.length} chars)</div>
          <div class="cu-picker-value">${displayValue}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        copyToClipboard(input.value, type);
        modal.remove();
      });
      
      list.appendChild(item);
    });
    
    modal.querySelector('.cu-picker-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
  }
  
  /**
   * Show message
   */
  function showMessage(text, type) {
    const existing = document.getElementById('cu-copy-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('div');
    msg.id = 'cu-copy-message';
    msg.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#27ae60' : '#dc3545'};
      color: white;
      padding: 14px 28px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    msg.textContent = (type === 'success' ? '✓ ' : '✗ ') + text;
    document.body.appendChild(msg);
    
    setTimeout(() => msg.remove(), 3000);
  }
})();
