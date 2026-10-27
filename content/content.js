/**
 * CopyUnbound - Content Script
 * Unlocks text selection, right-click, copy/paste functionality
 * 
 * IMPORTANT: This script should UNBLOCK copying, not interfere with it.
 * We use stopImmediatePropagation to prevent site blockers, but we
 * must NOT preventDefault on copy/paste events.
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__copyUnboundInitialized) return;
  window.__copyUnboundInitialized = true;
  
  // State
  let isEnabled = false;
  let observer = null;
  const removedHandlers = new WeakMap();
  
  /**
   * Handler for events that sites commonly block
   * We stop propagation to prevent site handlers from canceling,
   * but we do NOT preventDefault - we want the browser's default behavior
   */
  function unblockHandler(event) {
    if (!isEnabled) return;
    
    // Stop the event from reaching site's blocking handlers
    // but allow the browser's default action to proceed
    event.stopImmediatePropagation();
    
    // Explicitly do NOT call preventDefault()
    // The browser should handle copy/paste/select normally
  }
  
  /**
   * Handler specifically for contextmenu (right-click)
   */
  function contextMenuHandler(event) {
    if (!isEnabled) return;
    
    // Stop site handlers from blocking the context menu
    event.stopImmediatePropagation();
    // Don't preventDefault - let the browser show the menu
  }
  
  /**
   * Handler for keyboard shortcuts
   */
  function keyboardHandler(event) {
    if (!isEnabled) return;
    
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const key = event.key?.toLowerCase();
    
    // Only intercept copy/paste/cut/select-all shortcuts
    if (isCtrlOrCmd && ['c', 'v', 'a', 'x'].includes(key)) {
      // Stop site handlers from blocking these shortcuts
      event.stopImmediatePropagation();
      // Don't preventDefault - let browser handle the actual copy/paste
    }
  }
  
  /**
   * Add event listeners in capture phase to intercept before site handlers
   */
  function addUnblockers() {
    // These events are commonly blocked by sites
    const eventsToUnblock = ['copy', 'cut', 'paste', 'selectstart'];
    
    eventsToUnblock.forEach(eventType => {
      document.addEventListener(eventType, unblockHandler, true);
    });
    
    // Context menu (right-click)
    document.addEventListener('contextmenu', contextMenuHandler, true);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', keyboardHandler, true);
  }
  
  /**
   * Remove event listeners
   */
  function removeUnblockers() {
    const eventsToUnblock = ['copy', 'cut', 'paste', 'selectstart'];
    
    eventsToUnblock.forEach(eventType => {
      document.removeEventListener(eventType, unblockHandler, true);
    });
    
    document.removeEventListener('contextmenu', contextMenuHandler, true);
    document.removeEventListener('keydown', keyboardHandler, true);
  }
  
  /**
   * Remove inline event handlers that block copying
   */
  function cleanInlineHandlers(element) {
    if (!element?.removeAttribute) return;
    
    const blockingHandlers = [
      'oncontextmenu', 
      'onselectstart', 
      'oncopy', 
      'oncut',
      'onpaste', 
      'ondragstart'
    ];
    
    blockingHandlers.forEach(handler => {
      if (element.hasAttribute(handler)) {
        // Store original for potential restoration
        if (!removedHandlers.has(element)) {
          removedHandlers.set(element, {});
        }
        removedHandlers.get(element)[handler] = element.getAttribute(handler);
        element.removeAttribute(handler);
      }
    });
  }
  
  /**
   * Restore inline handlers (for when disabling)
   */
  function restoreInlineHandlers(element) {
    if (!element || !removedHandlers.has(element)) return;
    
    const handlers = removedHandlers.get(element);
    Object.entries(handlers).forEach(([attr, value]) => {
      if (value !== null) {
        element.setAttribute(attr, value);
      }
    });
    removedHandlers.delete(element);
  }
  
  /**
   * Process all elements in document
   */
  function processDocument() {
    if (!document.body) return;
    
    // Clean document-level handlers
    cleanInlineHandlers(document.documentElement);
    cleanInlineHandlers(document.body);
    
    // Clean all elements
    document.querySelectorAll('*').forEach(cleanInlineHandlers);
  }
  
  /**
   * Set up MutationObserver for dynamic content
   */
  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver(mutations => {
      if (!isEnabled) return;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            cleanInlineHandlers(node);
            if (node.querySelectorAll) {
              node.querySelectorAll('*').forEach(cleanInlineHandlers);
            }
          }
        }
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Enable copy unlocking
   */
  function enable() {
    if (isEnabled) return;
    isEnabled = true;
    
    // Add CSS class for unlock styles (enables text selection via CSS)
    document.documentElement.classList.add('cu-unlock-active');
    
    // Add event unblockers
    addUnblockers();
    
    // Process existing elements (remove inline handlers)
    processDocument();
    
    // Watch for dynamic content
    setupObserver();
    
    console.log('CopyUnbound: Enabled for', window.location.hostname);
  }
  
  /**
   * Disable copy unlocking
   */
  function disable() {
    if (!isEnabled) return;
    isEnabled = false;
    
    // Remove CSS class
    document.documentElement.classList.remove('cu-unlock-active');
    
    // Remove event unblockers
    removeUnblockers();
    
    // Stop observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    console.log('CopyUnbound: Disabled for', window.location.hostname);
  }
  
  /**
   * Handle messages from background
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CU_STATE_CHANGE') {
      if (message.enabled) {
        enable();
      } else {
        disable();
      }
      sendResponse({ success: true });
    }
    return true;
  });
  
  /**
   * Initialize content script
   */
  function initialize() {
    chrome.runtime.sendMessage({ type: 'CU_CONTENT_READY' }, response => {
      if (chrome.runtime.lastError) {
        console.debug('CopyUnbound: Could not get initial state');
        return;
      }
      
      if (response?.enabled) {
        enable();
      }
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Handle late-loading body
  if (!document.body) {
    const bodyObserver = new MutationObserver(() => {
      if (document.body && isEnabled) {
        processDocument();
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }
})();
