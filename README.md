# 🔥 FocusGuard – Stay Deep

A Chrome extension that eliminates YouTube distractions and blocks social media during your work hours.

## What It Does

### YouTube
- ✅ **Hides the entire home feed** – no recommendations, no infinite scroll
- ✅ **Blocks Shorts** everywhere on YouTube
- ✅ **Hides sidebar recommendations** while watching a video
- ✅ **Allows search** – you can still find specific content
- ✅ **Shows a focus banner** on the homepage reminding you why

### Site Blocking
- Blocks Instagram, Facebook, X/Twitter, TikTok (configurable)
- Shows a beautiful "Stay Focused" page instead
- Reddit toggle (off by default – you decide)

### Smart Scheduling
- Configurable work hours (default: 9AM–6PM)
- Choose work days (default: Monday–Saturday)
- Live countdown showing time until focus ends / starts

---

## Installation

1. **Download** and unzip the extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the `focus-guard` folder
6. The 🔥 icon will appear in your Chrome toolbar

---

## Usage

- Click the toolbar icon to open the popup
- Toggle sites on/off, adjust hours and days
- Hit **Save Settings** – changes apply immediately
- The badge shows **ACTIVE** during work hours, **OFF** otherwise

---

## Files

```
focus-guard/
├── manifest.json          # Extension config
├── background.js          # Service worker (scheduling + blocking rules)
├── popup.html/js          # The floating UI
├── youtube-content.js     # YouTube DOM manipulation
├── youtube-hide.css       # CSS to hide YT elements
├── blocker-content.js     # Social site blocker
├── blocked.html           # "Blocked" redirect page
├── block_rules.json       # declarativeNetRequest rules
└── icons/                 # Extension icons
```
