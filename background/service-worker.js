/**
 * CopyUnbound - Background Service Worker
 * Manages state, icon updates, and messaging between popup and content scripts
 */

const STORAGE_PREFIX = 'cu_enabled_';

/**
 * Extract hostname from URL
 */
function getHostname(url) {
  try {
    if (!url) return null;
    
    // Restricted URLs
    const restricted = [
      'chrome://', 'chrome-extension://', 'edge://', 
      'about:', 'devtools://', 'file://'
    ];
    
    if (restricted.some(r => url.startsWith(r))) {
      return null;
    }
    
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Get storage key for a hostname
 */
function getStorageKey(hostname) {
  return STORAGE_PREFIX + hostname;
}

/**
 * Check if extension is enabled for a hostname
 */
async function isEnabledForHost(hostname) {
  if (!hostname) return false;
  const key = getStorageKey(hostname);
  const result = await chrome.storage.local.get(key);
  return result[key] === true;
}

/**
 * Set enabled state for a hostname
 */
async function setEnabledForHost(hostname, enabled) {
  if (!hostname) return;
  const key = getStorageKey(hostname);
  
  if (enabled) {
    await chrome.storage.local.set({ [key]: true });
  } else {
    await chrome.storage.local.remove(key);
  }
}

/**
 * Update extension icon for a tab
 */
async function updateIcon(tabId, enabled, restricted = false) {
  try {
    let iconName;
    let title;
    
    if (restricted) {
      iconName = 'restricted';
      title = 'CopyUnbound - Unavailable';
    } else if (enabled) {
      iconName = 'enabled';
      title = 'CopyUnbound - ON';
    } else {
      iconName = 'disabled';
      title = 'CopyUnbound - OFF';
    }
    
    await chrome.action.setIcon({
      tabId,
      path: {
        '16': `icons/${iconName}-16.png`,
        '32': `icons/${iconName}-32.png`,
        '48': `icons/${iconName}-48.png`,
        '128': `icons/${iconName}-128.png`
      }
    });
    
    await chrome.action.setTitle({ tabId, title });
  } catch (e) {
    // Tab might be closed
    console.debug('Could not update icon:', e.message);
  }
}

/**
 * Send state change to content script
 */
async function notifyContentScript(tabId, enabled) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CU_STATE_CHANGE',
      enabled
    });
  } catch {
    // Content script not ready
  }
}

/**
 * Update tab state (icon + notify)
 */
async function updateTabState(tabId, url) {
  const hostname = getHostname(url);
  
  if (!hostname) {
    await updateIcon(tabId, false, true);
    return;
  }
  
  const enabled = await isEnabledForHost(hostname);
  await updateIcon(tabId, enabled, false);
}

// Tab updated listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateTabState(tabId, tab.url);
  }
});

// Tab activated listener
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      await updateTabState(tabId, tab.url);
    }
  } catch {
    // Tab may not exist
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
  try {
    switch (message.type) {
      case 'CU_GET_STATE': {
        // Popup requesting state
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { hostname: null, enabled: false, restricted: true };
        }
        
        const tab = tabs[0];
        const hostname = getHostname(tab.url);
        
        if (!hostname) {
          return { hostname: null, enabled: false, restricted: true };
        }
        
        const enabled = await isEnabledForHost(hostname);
        return { hostname, enabled, restricted: false };
      }
      
      case 'CU_SET_STATE': {
        // Popup toggling state
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { success: false, error: 'No active tab' };
        }
        
        const tab = tabs[0];
        const hostname = getHostname(tab.url);
        
        if (!hostname) {
          return { success: false, error: 'Restricted page' };
        }
        
        await setEnabledForHost(hostname, message.enabled);
        await updateIcon(tab.id, message.enabled, false);
        await notifyContentScript(tab.id, message.enabled);
        
        return { success: true, enabled: message.enabled };
      }
      
      case 'CU_CONTENT_READY': {
        // Content script initialized
        const hostname = getHostname(sender.tab?.url);
        const enabled = await isEnabledForHost(hostname);
        return { enabled };
      }
      
      case 'CU_EXTRACT_TEXT': {
        // Request to extract visible text
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { success: false, error: 'No active tab' };
        }
        
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: extractVisibleText
          });
          
          if (results && results[0]) {
            return { success: true, text: results[0].result };
          }
          
          return { success: false, error: 'Could not extract text' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'CU_START_OCR_CAPTURE': {
        // Start OCR capture mode
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { success: false, error: 'No active tab' };
        }
        
        try {
          // Inject OCR capture script
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content/ocr-capture.js']
          });
          
          // Start capture mode
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'CU_START_OCR' });
          
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'CU_START_PASSWORD_COPY': {
        // Start password copy mode
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { success: false, error: 'No active tab' };
        }
        
        try {
          // Inject and execute password copy function directly
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              // Find ALL inputs that might contain passwords
              const allInputs = document.querySelectorAll('input');
              let passwordValue = null;
              let foundField = null;
              
              // Debug info
              let debugInfo = [];
              
              for (const input of allInputs) {
                const type = input.type || 'text';
                const hasValue = input.value && input.value.length > 0;
                const placeholder = input.placeholder || '';
                const name = input.name || '';
                const id = input.id || '';
                
                debugInfo.push({
                  type,
                  hasValue,
                  valueLength: input.value?.length || 0,
                  name,
                  id,
                  placeholder: placeholder.substring(0, 20)
                });
                
                // Check password type fields first
                if (type === 'password' && hasValue) {
                  passwordValue = input.value;
                  foundField = 'password';
                  break;
                }
              }
              
              // If no password field found, look for any input with dots/bullets in its visible value
              if (!passwordValue) {
                for (const input of allInputs) {
                  if (input.value && input.value.length > 0) {
                    // Check if it looks like a password field by name/id
                    const lowerName = (input.name || '').toLowerCase();
                    const lowerId = (input.id || '').toLowerCase();
                    if (lowerName.includes('pass') || lowerId.includes('pass') || 
                        lowerName.includes('pwd') || lowerId.includes('pwd') ||
                        lowerName.includes('secret') || lowerId.includes('secret')) {
                      passwordValue = input.value;
                      foundField = 'named-password';
                      break;
                    }
                  }
                }
              }
              
              // Still nothing? Try to trigger focus on password fields to get autofill value
              if (!passwordValue) {
                const pwdFields = document.querySelectorAll('input[type="password"]');
                for (const pwd of pwdFields) {
                  // Dispatch focus event
                  pwd.focus();
                  pwd.dispatchEvent(new Event('focus', { bubbles: true }));
                  pwd.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  // Check value again
                  if (pwd.value && pwd.value.length > 0) {
                    passwordValue = pwd.value;
                    foundField = 'autofill-triggered';
                    break;
                  }
                }
              }
              
              if (!passwordValue) {
                // Return debug info to help troubleshoot
                return { 
                  success: false, 
                  error: 'No password value found. Fields found: ' + JSON.stringify(debugInfo.slice(0, 5))
                };
              }
              
              // Copy to clipboard using multiple methods
              let copied = false;
              
              // Method 1: Clipboard API
              if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                  // Create a temporary focused element
                  const btn = document.createElement('button');
                  btn.style.cssText = 'position:fixed;left:-9999px;';
                  document.body.appendChild(btn);
                  btn.focus();
                  
                  navigator.clipboard.writeText(passwordValue).then(() => {
                    copied = true;
                  }).catch(() => {});
                  
                  document.body.removeChild(btn);
                } catch (e) {}
              }
              
              // Method 2: execCommand (fallback)
              if (!copied) {
                const textarea = document.createElement('textarea');
                textarea.value = passwordValue;
                textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
                textarea.setAttribute('readonly', '');
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                textarea.setSelectionRange(0, passwordValue.length);
                
                try {
                  copied = document.execCommand('copy');
                } catch (e) {}
                
                document.body.removeChild(textarea);
              }
              
              // Show result message
              const msg = document.createElement('div');
              msg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:' + (copied ? '#27ae60' : '#dc3545') + ';color:white;padding:14px 28px;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:500;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
              msg.textContent = copied 
                ? '✓ Password copied! (' + passwordValue.length + ' characters)' 
                : '✗ Copy failed - try Ctrl+C manually';
              document.body.appendChild(msg);
              setTimeout(() => msg.remove(), 4000);
              
              return { 
                success: copied, 
                length: passwordValue.length,
                foundField,
                error: copied ? null : 'Copy command failed'
              };
            }
          });
          
          if (results && results[0] && results[0].result) {
            return results[0].result;
          }
          
          return { success: false, error: 'Script execution failed' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'CU_CAPTURE_OCR': {
        // Capture screen and perform OCR
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          
          // Send the captured image back to content script for processing
          // The content script will crop and run OCR
          return { 
            success: true, 
            imageData: dataUrl,
            rect: message.rect
          };
        } catch (e) {
          return { success: false, error: 'Could not capture screen: ' + e.message };
        }
      }
      
      case 'CU_COPY_TABLE': {
        // Extract and copy table data
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs.length) {
          return { success: false, error: 'No active tab' };
        }
        
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              // Find all tables and grid-like structures
              const tables = [];
              
              // Standard HTML tables
              document.querySelectorAll('table').forEach(table => {
                const rows = [];
                
                // Get headers from thead or first row with th
                const headerCells = [];
                table.querySelectorAll('thead th, thead td, tr:first-child th').forEach(cell => {
                  // Get text from spans or direct text
                  const spans = cell.querySelectorAll('span');
                  if (spans.length > 0) {
                    spans.forEach(span => {
                      const text = span.innerText.trim();
                      if (text && !headerCells.includes(text)) {
                        headerCells.push(text);
                      }
                    });
                  } else {
                    const text = cell.innerText.trim();
                    if (text) {
                      headerCells.push(text);
                    }
                  }
                });
                if (headerCells.length > 0) {
                  rows.push(headerCells);
                }
                
                // Get body rows
                table.querySelectorAll('tbody tr, tr').forEach(tr => {
                  // Skip header rows
                  if (tr.querySelector('th') && tr.closest('thead')) return;
                  if (tr === table.querySelector('tr:first-child') && headerCells.length > 0) return;
                  
                  const cells = [];
                  tr.querySelectorAll('td, th').forEach(cell => {
                    // Get text from nested elements
                    let text = '';
                    const spans = cell.querySelectorAll('span, div, p');
                    if (spans.length > 0) {
                      const texts = [];
                      spans.forEach(el => {
                        const t = el.innerText.trim();
                        if (t && !texts.includes(t)) texts.push(t);
                      });
                      text = texts.join(' ');
                    } else {
                      text = cell.innerText.trim();
                    }
                    cells.push(text);
                  });
                  if (cells.length > 0 && cells.some(c => c)) {
                    rows.push(cells);
                  }
                });
                
                if (rows.length > 0) {
                  tables.push(rows);
                }
              });
              
              // ARIA grid tables
              document.querySelectorAll('[role="grid"], [role="table"]').forEach(grid => {
                if (grid.tagName === 'TABLE') return; // Already processed
                
                const rows = [];
                
                // Get headers
                const headerRow = [];
                grid.querySelectorAll('[role="columnheader"], [role="rowheader"]').forEach(header => {
                  headerRow.push(header.innerText.trim());
                });
                if (headerRow.length > 0) {
                  rows.push(headerRow);
                }
                
                // Get rows
                grid.querySelectorAll('[role="row"]').forEach(row => {
                  const cells = [];
                  row.querySelectorAll('[role="cell"], [role="gridcell"]').forEach(cell => {
                    cells.push(cell.innerText.trim());
                  });
                  if (cells.length > 0 && cells.join('') !== headerRow.join('')) {
                    rows.push(cells);
                  }
                });
                
                if (rows.length > 0) {
                  tables.push(rows);
                }
              });
              
              // Div-based grids (common in React/Angular apps)
              document.querySelectorAll('[class*="grid"], [class*="Grid"], [class*="datagrid"], [class*="DataGrid"]').forEach(grid => {
                // Skip if already processed
                if (grid.tagName === 'TABLE') return;
                if (grid.closest('table')) return;
                
                const rows = [];
                
                // Look for header row
                const headerEl = grid.querySelector('[class*="header"], [class*="Header"], [class*="head"], [class*="Head"]');
                if (headerEl) {
                  const headerCells = [];
                  headerEl.querySelectorAll('span, [class*="cell"], [class*="Cell"], [class*="column"], [class*="Column"]').forEach(cell => {
                    const text = cell.innerText.trim();
                    if (text && text.length < 100 && !headerCells.includes(text)) {
                      headerCells.push(text);
                    }
                  });
                  if (headerCells.length > 0) {
                    rows.push(headerCells);
                  }
                }
                
                // Look for body rows
                const bodyEl = grid.querySelector('[class*="body"], [class*="Body"], [class*="content"], [class*="Content"]') || grid;
                bodyEl.querySelectorAll('[class*="row"], [class*="Row"]').forEach(row => {
                  // Skip header rows
                  if (row.className && (row.className.includes('header') || row.className.includes('Header'))) return;
                  
                  const cells = [];
                  row.querySelectorAll('[class*="cell"], [class*="Cell"], span').forEach(cell => {
                    const text = cell.innerText.trim();
                    if (text && text.length < 500) {
                      cells.push(text);
                    }
                  });
                  if (cells.length > 0) {
                    rows.push(cells);
                  }
                });
                
                if (rows.length > 1) {
                  tables.push(rows);
                }
              });
              
              if (tables.length === 0) {
                return { success: false, error: 'No tables found on this page' };
              }
              
              // Convert to TSV (tab-separated values)
              let output = '';
              tables.forEach((table, idx) => {
                if (idx > 0) output += '\n\n';
                table.forEach(row => {
                  output += row.join('\t') + '\n';
                });
              });
              
              // Copy to clipboard using multiple methods
              let copied = false;
              
              // Method 1: Clipboard API
              if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                  navigator.clipboard.writeText(output);
                  copied = true;
                } catch (e) {}
              }
              
              // Method 2: execCommand fallback
              if (!copied) {
                const textarea = document.createElement('textarea');
                textarea.value = output;
                textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                  copied = document.execCommand('copy');
                } catch (e) {}
                document.body.removeChild(textarea);
              }
              
              // Show success message
              const totalRows = tables.reduce((sum, t) => sum + t.length, 0);
              const msg = document.createElement('div');
              msg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:white;padding:14px 28px;border-radius:8px;font-family:system-ui;font-size:15px;font-weight:500;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
              msg.textContent = copied 
                ? '✓ Table copied! (' + totalRows + ' rows)' 
                : '✗ Copy failed';
              document.body.appendChild(msg);
              setTimeout(() => msg.remove(), 3000);
              
              return { success: copied, rows: totalRows, tables: tables.length };
            }
          });
          
          if (results && results[0] && results[0].result) {
            return results[0].result;
          }
          
          return { success: false, error: 'Script execution failed' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      default:
        return { error: 'Unknown message type' };
    }
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Extract visible text from page (injected function)
 */
function extractVisibleText() {
  const sensitiveSelectors = [
    'input[type="password"]',
    'input[type="hidden"]',
    '[data-sensitive]',
    '.password',
    '.secret',
    '.token'
  ];
  
  const excludeSelectors = [
    'script', 'style', 'noscript', 'template',
    'iframe', 'svg', 'canvas', 'video', 'audio',
    ...sensitiveSelectors
  ];
  
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           el.offsetParent !== null;
  }
  
  function getText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    
    const el = node;
    const tag = el.tagName.toLowerCase();
    
    // Skip excluded elements
    if (excludeSelectors.some(sel => el.matches(sel))) {
      return '';
    }
    
    // Skip hidden elements
    if (!isVisible(el)) {
      return '';
    }
    
    // Skip form inputs (extract label text only)
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return '';
    }
    
    // Recursively get text from children
    let text = '';
    for (const child of node.childNodes) {
      text += getText(child) + ' ';
    }
    
    return text.trim();
  }
  
  const bodyText = getText(document.body);
  
  // Clean up whitespace
  return bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// On extension install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('CopyUnbound installed/updated');
  
  // Update icons for all existing tabs
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.id) {
        await updateTabState(tab.id, tab.url);
      }
    }
  } catch (e) {
    console.debug('Error updating tabs:', e.message);
  }
});

/**
 * OCR functionality using offscreen document
 */
let ocrWorker = null;

async function performOCR(imageDataUrl) {
  // Create offscreen document for OCR if needed
  try {
    // Use dynamic import for Tesseract in service worker context
    // For now, we'll do a simpler approach - capture and process in content script
    return { success: false, error: 'OCR processing - please wait...' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Capture visible tab and crop to selection
 */
async function captureAndCrop(tabId, rect) {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // We need to crop the image to the selected region
    // This requires an offscreen document or sending to content script
    return { 
      success: true, 
      imageData: dataUrl,
      rect: rect
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
