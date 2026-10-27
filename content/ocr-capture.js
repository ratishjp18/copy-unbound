/**
 * CopyUnbound - OCR Screen Capture Module
 * Allows selecting a region of the screen to extract text via OCR
 */

(function() {
  'use strict';
  
  if (window.__copyUnboundOCRInitialized) return;
  window.__copyUnboundOCRInitialized = true;
  
  let isCapturing = false;
  let overlay = null;
  let selection = null;
  let startX = 0;
  let startY = 0;
  let tesseractLoaded = false;
  let tesseractWorker = null;
  
  /**
   * Load Tesseract.js dynamically
   */
  async function loadTesseract() {
    if (tesseractLoaded) return;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => {
        tesseractLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(script);
    });
  }
  
  /**
   * Initialize Tesseract worker
   */
  async function initTesseractWorker() {
    if (tesseractWorker) return tesseractWorker;
    
    await loadTesseract();
    
    showStatus('Initializing OCR engine...');
    
    tesseractWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          showStatus(`Recognizing text... ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    return tesseractWorker;
  }
  
  /**
   * Show status message
   */
  function showStatus(message) {
    let statusEl = document.getElementById('cu-ocr-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'cu-ocr-status';
      statusEl.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(statusEl);
    }
    statusEl.textContent = message;
    return statusEl;
  }
  
  /**
   * Hide status message
   */
  function hideStatus() {
    const statusEl = document.getElementById('cu-ocr-status');
    if (statusEl) statusEl.remove();
  }
  
  /**
   * Create the capture overlay
   */
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'cu-ocr-overlay';
    overlay.innerHTML = `
      <style>
        #cu-ocr-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.3);
          cursor: crosshair;
          z-index: 2147483647;
          user-select: none;
        }
        #cu-ocr-selection {
          position: absolute;
          border: 2px dashed #4a90d9;
          background: rgba(74, 144, 217, 0.15);
          pointer-events: none;
          display: none;
        }
        #cu-ocr-instructions {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.85);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 2147483647;
        }
      </style>
      <div id="cu-ocr-instructions">
        📷 Click and drag to select the area with text. Press ESC to cancel.
      </div>
      <div id="cu-ocr-selection"></div>
    `;
    document.body.appendChild(overlay);
    selection = overlay.querySelector('#cu-ocr-selection');
    
    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }
  
  /**
   * Remove the overlay
   */
  function removeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      selection = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    isCapturing = false;
  }
  
  /**
   * Mouse down - start selection
   */
  function onMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0';
    selection.style.height = '0';
    selection.style.display = 'block';
  }
  
  /**
   * Mouse move - update selection
   */
  function onMouseMove(e) {
    if (e.buttons !== 1) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
  }
  
  /**
   * Mouse up - capture the selection
   */
  async function onMouseUp(e) {
    const rect = selection.getBoundingClientRect();
    
    if (rect.width < 20 || rect.height < 20) {
      removeOverlay();
      showError('Selection too small. Please select a larger area.');
      return;
    }
    
    // Store selection dimensions before hiding overlay
    const captureRect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    
    // Hide overlay before capture
    overlay.style.display = 'none';
    
    // Small delay to ensure overlay is hidden
    await new Promise(r => setTimeout(r, 100));
    
    try {
      showStatus('Capturing screen...');
      
      // Request screenshot from background
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'CU_CAPTURE_OCR',
          rect: {
            x: captureRect.x * window.devicePixelRatio,
            y: captureRect.y * window.devicePixelRatio,
            width: captureRect.width * window.devicePixelRatio,
            height: captureRect.height * window.devicePixelRatio
          }
        }, resolve);
      });
      
      removeOverlay();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to capture screen');
      }
      
      // Crop the image to selection
      showStatus('Processing image...');
      const croppedImage = await cropImage(response.imageData, {
        x: captureRect.x * window.devicePixelRatio,
        y: captureRect.y * window.devicePixelRatio,
        width: captureRect.width * window.devicePixelRatio,
        height: captureRect.height * window.devicePixelRatio
      });
      
      // Run OCR
      showStatus('Loading OCR engine...');
      const worker = await initTesseractWorker();
      
      showStatus('Recognizing text...');
      const result = await worker.recognize(croppedImage);
      
      hideStatus();
      
      const text = result.data.text.trim();
      
      if (text) {
        showOCRResult(text);
      } else {
        showError('No text found in the selected area. Try selecting a different region.');
      }
      
    } catch (err) {
      removeOverlay();
      hideStatus();
      showError(err.message);
    }
  }
  
  /**
   * Crop image to selection rectangle
   */
  async function cropImage(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(
          img,
          rect.x, rect.y, rect.width, rect.height,
          0, 0, rect.width, rect.height
        );
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load captured image'));
      img.src = dataUrl;
    });
  }
  
  /**
   * Key down - cancel on ESC
   */
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      removeOverlay();
      hideStatus();
    }
  }
  
  /**
   * Show OCR result in a modal
   */
  function showOCRResult(text) {
    const modal = document.createElement('div');
    modal.id = 'cu-ocr-result-modal';
    modal.innerHTML = `
      <style>
        #cu-ocr-result-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .cu-ocr-dialog {
          background: white;
          border-radius: 12px;
          box-shadow: 0 25px 80px rgba(0,0,0,0.4);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          animation: cu-slide-up 0.2s ease;
        }
        @keyframes cu-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .cu-ocr-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e8e8e8;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }
        .cu-ocr-title {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cu-ocr-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0 4px;
          line-height: 1;
        }
        .cu-ocr-close:hover {
          color: #333;
        }
        .cu-ocr-body {
          padding: 20px;
          flex: 1;
          overflow: auto;
        }
        .cu-ocr-textarea {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          font-family: inherit;
        }
        .cu-ocr-textarea:focus {
          outline: none;
          border-color: #4a90d9;
          box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.15);
        }
        .cu-ocr-footer {
          padding: 16px 20px;
          border-top: 1px solid #e8e8e8;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
          border-radius: 0 0 12px 12px;
        }
        .cu-ocr-charcount {
          font-size: 12px;
          color: #888;
        }
        .cu-ocr-copy-btn {
          background: #4a90d9;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cu-ocr-copy-btn:hover {
          background: #357abd;
        }
        .cu-ocr-copy-btn.copied {
          background: #27ae60;
        }
      </style>
      <div class="cu-ocr-dialog">
        <div class="cu-ocr-header">
          <h3 class="cu-ocr-title">📝 Extracted Text (OCR)</h3>
          <button class="cu-ocr-close">&times;</button>
        </div>
        <div class="cu-ocr-body">
          <textarea class="cu-ocr-textarea">${escapeHtml(text)}</textarea>
        </div>
        <div class="cu-ocr-footer">
          <span class="cu-ocr-charcount">${text.length} characters</span>
          <button class="cu-ocr-copy-btn">Copy to Clipboard</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const textarea = modal.querySelector('.cu-ocr-textarea');
    const copyBtn = modal.querySelector('.cu-ocr-copy-btn');
    const closeBtn = modal.querySelector('.cu-ocr-close');
    
    // Close modal
    const close = () => modal.remove();
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    });
    
    // Copy text
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy to Clipboard';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        // Fallback
        textarea.select();
        document.execCommand('copy');
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy to Clipboard';
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    });
    
    // Focus and select text
    textarea.focus();
    textarea.select();
  }
  
  /**
   * Show error message
   */
  function showError(message) {
    hideStatus();
    
    const toast = document.createElement('div');
    toast.id = 'cu-ocr-error';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 14px 28px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 16px rgba(220, 53, 69, 0.4);
    `;
    toast.textContent = '❌ ' + message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
  
  /**
   * Escape HTML entities
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  /**
   * Start capture mode
   */
  window.__copyUnboundStartOCR = function() {
    if (isCapturing) return;
    isCapturing = true;
    createOverlay();
  };
  
  // Listen for OCR start message
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.type === 'CU_START_OCR') {
      window.__copyUnboundStartOCR();
      respond({ success: true });
    }
    return true;
  });
})();
