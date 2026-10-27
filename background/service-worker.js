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
