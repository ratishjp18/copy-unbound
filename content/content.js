/**
 * CopyUnbound - Content Script
 * Unlocks text selection and copy functionality
 * 
 * MINIMAL INTERVENTION: Only act when copy is actually blocked
 */

(function() {
  'use strict';
  
  if (window.__copyUnboundInitialized) return;
  window.__copyUnboundInitialized = true;
  
  let isEnabled = false;
  let observer = null;
  
  // Code editors - never interfere
  const CODE_EDITOR_SELECTORS = ['.monaco-editor', '.CodeMirror', '.ace_editor', '.cm-editor'];
  
  function isInsideCodeEditor(element) {
    if (!element) return false;
    for (const selector of CODE_EDITOR_SELECTORS) {
      if (element.closest?.(selector)) return true;
    }
    return false;
  }
  
  /**
   * Only fix elements that have user-select: none
   */
  function fixUserSelect(element) {
    if (!element?.style) return;
    if (isInsideCodeEditor(element)) return;
    
    const tag = element.tagName?.toLowerCase();
    if (['script', 'style', 'iframe', 'svg', 'path', 'canvas', 'input', 'textarea', 'button', 'select'].includes(tag)) return;
    
    try {
      const computed = window.getComputedStyle(element);
      const userSelect = computed.userSelect || computed.webkitUserSelect;
      
      if (userSelect === 'none') {
        element.style.setProperty('user-select', 'text', 'important');
        element.style.setProperty('-webkit-user-select', 'text', 'important');
      }
    } catch (e) {}
  }
  
  /**
   * Remove ONLY inline handlers that block copy (oncopy="return false" etc)
   */
  function removeInlineBlockers(element) {
    if (!element?.hasAttribute) return;
    if (isInsideCodeEditor(element)) return;
    
    ['oncopy', 'oncut', 'onpaste', 'onselectstart', 'oncontextmenu'].forEach(attr => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        // Only remove if it's blocking (returns false or prevents default)
        if (value && (value.includes('false') || value.includes('preventDefault'))) {
          element.removeAttribute(attr);
        }
      }
    });
  }
  
  /**
   * Process document - only fix actual blockers
   */
  function processDocument() {
    if (!document.body) return;
    
    document.querySelectorAll('*').forEach(el => {
      fixUserSelect(el);
      removeInlineBlockers(el);
    });
  }
  
  /**
   * Mutation observer for dynamic content
   */
  function setupObserver() {
    if (observer) observer.disconnect();
    
    observer = new MutationObserver(mutations => {
      if (!isEnabled) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            fixUserSelect(node);
            removeInlineBlockers(node);
            node.querySelectorAll?.('*').forEach(el => {
              fixUserSelect(el);
              removeInlineBlockers(el);
            });
          }
        });
      });
    });
    
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  
  function enable() {
    if (isEnabled) return;
    isEnabled = true;
    
    document.documentElement.classList.add('cu-unlock-active');
    processDocument();
    setupObserver();
    
    console.log('CopyUnbound: Enabled (minimal mode)');
  }
  
  function disable() {
    if (!isEnabled) return;
    isEnabled = false;
    
    document.documentElement.classList.remove('cu-unlock-active');
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    console.log('CopyUnbound: Disabled');
  }
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CU_STATE_CHANGE') {
      message.enabled ? enable() : disable();
      sendResponse({ success: true });
    }
    return true;
  });
  
  function initialize() {
    chrome.runtime.sendMessage({ type: 'CU_CONTENT_READY' }, response => {
      if (chrome.runtime.lastError) return;
      if (response?.enabled) enable();
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
