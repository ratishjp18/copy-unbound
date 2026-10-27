/**
 * CopyUnbound - Tesseract OCR Worker
 * Runs OCR processing in an offscreen document
 */

// We'll load Tesseract.js from CDN for simplicity
// In production, you'd bundle this locally

let tesseractLoaded = false;
let worker = null;

async function loadTesseract() {
  if (tesseractLoaded) return;
  
  // Load Tesseract.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  
  tesseractLoaded = true;
}

async function initWorker() {
  if (worker) return worker;
  
  await loadTesseract();
  
  worker = await Tesseract.createWorker('eng', 1, {
    logger: m => console.debug('Tesseract:', m)
  });
  
  return worker;
}

async function recognizeImage(imageData) {
  const w = await initWorker();
  const result = await w.recognize(imageData);
  return result.data.text;
}

// Export for use
self.recognizeImage = recognizeImage;
self.initWorker = initWorker;
