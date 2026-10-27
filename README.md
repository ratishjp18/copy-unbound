# 🔓 CopyUnbound

**Advanced Chrome Extension for Unlocking Text Selection and Copying**

CopyUnbound is a privacy-first Chrome extension that restores text selection, right-click, copy/paste functionality, and more on websites that intentionally restrict these actions.

> ⚠️ **For Personal Local Use Only** - This extension is designed to be installed via Chrome Developer Mode and is not intended for Chrome Web Store distribution.

---

## ✨ Features

### Core Functionality

- **🔤 Text Selection Unlocking** - Restore text selection on websites using CSS `user-select: none` or JavaScript restrictions
- **🖱️ Right-Click Restoration** - Re-enable the browser's native context menu when blocked by websites
- **⌨️ Keyboard Shortcuts** - Restore Ctrl+C/Cmd+C, Ctrl+V/Cmd+V, Ctrl+A/Cmd+A, and Ctrl+X/Cmd+X
- **🔑 Password Field Support** - Allow paste operations in password fields that block them
- **📄 Copy Visible Text** - Extract and copy all visible text from a page with one click
- **⚡ Dynamic Content Support** - Works with React, Vue, Angular, and other SPA frameworks

### Privacy & Security

- ✅ No data collection
- ✅ No telemetry or analytics
- ✅ No external API calls
- ✅ No clipboard monitoring
- ✅ Works completely offline
- ✅ Minimal permissions required

---

## 📸 Screenshots

| Popup (Disabled) | Popup (Enabled) |
|------------------|-----------------|
| Orange icon indicates extension is OFF | Green icon indicates extension is ON |

---

## 🚀 Installation

### Step 1: Download the Extension

```bash
git clone https://github.com/yourusername/copy-unbound.git
```

Or download and extract the ZIP file.

### Step 2: Open Chrome Extensions

1. Open Google Chrome
2. Navigate to `chrome://extensions`
3. Or go to Menu → More Tools → Extensions

### Step 3: Enable Developer Mode

Toggle the **"Developer mode"** switch in the top-right corner of the extensions page.

### Step 4: Load the Extension

1. Click **"Load unpacked"**
2. Navigate to and select the `copy-unbound` folder (the one containing `manifest.json`)
3. Click "Select Folder"

### Step 5: Pin the Extension (Optional)

1. Click the puzzle piece icon (Extensions) in Chrome's toolbar
2. Find "CopyUnbound"
3. Click the pin icon to keep it visible

---

## 📖 Usage

### Basic Usage

1. **Visit a website** where copying is restricted
2. **Click the CopyUnbound icon** in your toolbar
3. **Toggle the switch ON** for that website
4. Text selection, right-click, and copy shortcuts should now work

### Per-Website Settings

- Settings are saved **per hostname** (e.g., `example.com`)
- Each website remembers its ON/OFF state
- Settings persist across browser restarts
- The extension is **OFF by default** for all websites

### Copy Visible Text

When enabled on a website:
1. Click the CopyUnbound icon
2. Click **"Copy Visible Text"**
3. Review the extracted text in the preview
4. Click **"Copy to Clipboard"** to confirm

### Icon States

| Icon Color | Meaning |
|------------|---------|
| 🟢 Green | Extension is enabled for this website |
| 🟠 Orange | Extension is disabled for this website |
| ⚫ Gray | Website is restricted (chrome://, extensions, etc.) |

---

## 📁 Project Structure

```
copy-unbound/
├── manifest.json           # Extension manifest (V3)
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   ├── content.js          # Content script (injected into pages)
│   ├── unlock.css          # CSS overrides for unlocking
│   └── text-extractor.js   # Visible text extraction module
├── popup/
│   ├── popup.html          # Popup interface
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── icons/                  # Extension icons
├── tests/
│   └── test-page.html      # Local test page
├── .gitignore
└── README.md
```

---

## 🔧 Technical Details

### Manifest V3 Compliance

CopyUnbound uses Chrome's Manifest V3 format with:
- Service worker for background processing
- Content scripts for page injection
- Modern Chrome APIs (`chrome.storage`, `chrome.scripting`, `chrome.action`)

### How It Works

1. **CSS Override**: Injected CSS rules override `user-select: none` and similar restrictions
2. **Event Interception**: Capture-phase event listeners intercept and stop propagation of blocking events
3. **Inline Handler Removal**: Removes `oncontextmenu`, `oncopy`, etc. attributes
4. **MutationObserver**: Monitors for dynamically added content

### Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save per-website settings |
| `activeTab` | Access current tab information |
| `scripting` | Inject content scripts |
| `clipboardWrite` | Enable copy functionality |
| `clipboardRead` | Enable paste functionality |
| `<all_urls>` | Work on any website |

---

## ⚠️ Known Limitations

1. **Chrome Internal Pages**: Cannot run on `chrome://`, `chrome-extension://`, or `edge://` URLs
2. **Canvas/WebGL Text**: Text rendered in canvas elements cannot be selected (use "Copy Visible Text")
3. **Protected Content**: Does not bypass DRM, paywalls, or authentication
4. **Cross-Origin Frames**: Limited functionality in iframes from different domains
5. **Some Dynamic Sites**: Heavily obfuscated sites may require page reload after enabling

---

## 🧪 Testing

Open `tests/test-page.html` in your browser to test all features:

1. CSS-protected text
2. JavaScript copy blocking
3. Right-click blocking
4. Inline event handlers
5. Password field paste
6. Dynamic content
7. Table selection
8. Contenteditable elements

---

## 🔒 Privacy Policy

CopyUnbound is designed with privacy as a core principle:

- **No Data Collection**: We don't collect any user data
- **No Analytics**: No tracking scripts or analytics
- **No External Requests**: The extension makes no network requests
- **Local Storage Only**: All settings are stored locally in Chrome
- **No Clipboard Logging**: We don't monitor or log clipboard contents
- **Open Source**: All code is available for inspection

---

## 🐛 Troubleshooting

### Extension not working on a site?

1. Make sure the extension is toggled ON for that site
2. Try refreshing the page
3. Check if it's a Chrome restricted page (chrome://, etc.)
4. Check the browser console for errors

### Copy still blocked?

Some sites use advanced techniques. Try:
1. Toggle OFF, refresh, then toggle ON
2. Use the "Copy Visible Text" feature instead

### Reload the extension after code changes

1. Go to `chrome://extensions`
2. Find CopyUnbound
3. Click the refresh icon (🔄)

---

## 📝 License

This project is for personal, educational use only.

---

## 🤝 Contributing

This is a personal utility project. Feel free to fork and modify for your own use.

---

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/copy-unbound.git

# Open Chrome extensions page
# chrome://extensions

# Enable Developer Mode
# Click "Load unpacked"
# Select the copy-unbound folder
# Done!
```

---

**Made with ❤️ for a more accessible web**
