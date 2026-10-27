/**
 * CopyUnbound - Text Extractor Module
 * Extracts visible text from the page while avoiding sensitive content
 */

(function() {
  'use strict';
  
  // Selectors for sensitive elements to exclude
  const SENSITIVE_SELECTORS = [
    'input[type="password"]',
    'input[type="hidden"]',
    '[data-sensitive]',
    '[data-private]',
    '.password',
    '.secret',
    '.token',
    '.api-key',
    '.credential'
  ];
  
  // Elements to completely skip
  const SKIP_SELECTORS = [
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'svg',
    'canvas',
    'video',
    'audio',
    'object',
    'embed',
    ...SENSITIVE_SELECTORS
  ];
  
  /**
   * Check if element is visible
   */
  function isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    if (element.offsetParent === null && style.position !== 'fixed') return false;
    
    // Check if within viewport (roughly)
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    return true;
  }
  
  /**
   * Check if element should be skipped
   */
  function shouldSkip(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    
    return SKIP_SELECTORS.some(selector => {
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    });
  }
  
  /**
   * Extract text from a node recursively
   */
  function extractText(node, result = []) {
    if (!node) return result;
    
    // Handle text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push(text);
      }
      return result;
    }
    
    // Skip non-element nodes
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return result;
    }
    
    const element = node;
    
    // Skip excluded elements
    if (shouldSkip(element)) {
      return result;
    }
    
    // Skip hidden elements
    if (!isVisible(element)) {
      return result;
    }
    
    // Skip form inputs (don't extract values)
    const tag = element.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) {
      return result;
    }
    
    // Add line break for block elements
    const display = window.getComputedStyle(element).display;
    const isBlock = ['block', 'flex', 'grid', 'table', 'list-item'].some(d => 
      display.includes(d)
    );
    
    // Process children
    for (const child of node.childNodes) {
      extractText(child, result);
    }
    
    // Add separator for block elements
    if (isBlock && result.length > 0) {
      const last = result[result.length - 1];
      if (last && !last.endsWith('\n')) {
        result.push('\n');
      }
    }
    
    return result;
  }
  
  /**
   * Clean and format extracted text
   */
  function cleanText(textParts) {
    return textParts
      .join(' ')
      .replace(/\s+/g, ' ')        // Collapse whitespace
      .replace(/ \n /g, '\n')       // Clean newlines
      .replace(/\n+/g, '\n\n')      // Normalize paragraph breaks
      .trim();
  }
  
  /**
   * Main extraction function
   */
  window.__copyUnboundExtractText = function() {
    if (!document.body) {
      return '';
    }
    
    const textParts = extractText(document.body);
    return cleanText(textParts);
  };
})();
