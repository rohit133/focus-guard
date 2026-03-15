// FocusGuard – YouTube Content Script (SOLID Refactor)

/**
 * ── DOM UTILS (Single Responsibility: Browser interaction) ──
 */
class DomUtils {
  static async onBodyReady() {
    if (document.body) return document.body;
    return new Promise(resolve => {
      const obs = new MutationObserver(() => {
        if (document.body) { obs.disconnect(); resolve(document.body); }
      });
      obs.observe(document.documentElement, { childList: true });
    });
  }
}

/**
 * ── ROUTE MANAGER (Single Responsibility: URL & State matching) ──
 */
class RouteManager {
  static getRouteInfo() {
    const path = location.pathname;
    const search = new URLSearchParams(location.search);
    return {
      isHome: path === "/" && !search.get("search_query") && !search.get("v"),
      isShorts: path.startsWith('/shorts'),
      isWatch: path === "/watch" || search.has("v")
    };
  }
}

/**
 * ── MEDIA CONTROL (Single Responsibility: Silent distraction killer) ──
 */
class MediaControl {
  constructor() {
    this.stopperInterval = null;
  }

  start(isActive) {
    if (!isActive) return this.stop();
    if (this.stopperInterval) return;

    this.stopperInterval = setInterval(() => {
      const route = RouteManager.getRouteInfo();
      const media = document.querySelectorAll('video, audio');

      media.forEach(el => {
        const isShortsEl = el.closest('[is-shorts]') || el.closest('ytd-reel-video-renderer');
        
        if (route.isShorts || isShortsEl) {
          this.killMedia(el);
        } else if (route.isHome) {
          el.pause();
          el.muted = true;
        }
      });

      this.disableAutoplay();
    }, 400);
  }

  killMedia(el) {
    el.pause();
    el.muted = true;
    el.volume = 0;
    el.currentTime = 0;
  }

  disableAutoplay() {
    const btn = document.querySelector('.ytp-autonav-toggle-button');
    if (btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
  }

  stop() {
    if (this.stopperInterval) {
      clearInterval(this.stopperInterval);
      this.stopperInterval = null;
    }
  }
}

/**
 * ── UI ENGINE (Single Responsibility: DOM Manipulation) ──
 */
class UiEngine {
  static apply(isActive) {
    document.documentElement.classList.toggle("focusguard-active", isActive);
    if (!document.body) return;
    document.body.classList.toggle("focusguard-active", isActive);

    const route = RouteManager.getRouteInfo();
    const browse = document.querySelector('ytd-browse[page-subtype="home"]');

    if (isActive && (route.isHome || route.isShorts)) {
      this.injectBanner();
      // More aggressive hiding for SPA transition
      const primary = document.querySelector('ytd-browse[page-subtype="home"] #primary');
      if (primary) primary.style.display = 'none';
      if (browse) browse.style.display = 'none';
    } else {
      this.removeBanner();
      const primary = document.querySelector('ytd-browse[page-subtype="home"] #primary');
      if (primary) primary.style.display = '';
      if (browse) browse.style.display = '';
    }

    if (isActive && route.isWatch) {
      const secondary = document.getElementById('secondary');
      if (secondary) secondary.style.display = 'none';
      this.forceTheaterMode();
    }
  }

  static forceTheaterMode() {
    // Only attempt on watch page
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (!watchFlexy) return;

    // If not already in theater mode
    if (!watchFlexy.hasAttribute('theater')) {
      const theaterButton = document.querySelector('.ytp-size-button');
      if (theaterButton) {
        theaterButton.click();
      }
    }
  }

  static injectBanner() {
    if (document.getElementById("fg-banner-container")) return;
    const container = document.createElement("div");
    container.id = "fg-banner-container";
    container.innerHTML = `
      <div id="fg-banner">
        <div style="font-size: 40px; margin-bottom: 20px;">🔒</div>
        <div class="fg-title">FOCUS MODE ACTIVE</div>
        <div class="fg-subtitle">Your home feed is hidden to keep you on track.</div>
      </div>
    `;
    document.body.appendChild(container);
  }

  static removeBanner() {
    const b = document.getElementById("fg-banner-container");
    if (b) b.remove();
  }
}

/**
 * ── YOUTUBE FOCUS SYSTEM (Orchestrator) ──
 */
class YouTubeFocusSystem {
  constructor() {
    this.isActive = false;
    this.media = new MediaControl();
    this.shortsObserver = null;
    this.lastUrl = location.href;
  }

  async init() {
    await DomUtils.onBodyReady();
    await this.syncState();
    this.setupListeners();
    this.startShortsHider();
  }

  async syncState() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_FOCUS_STATE" });
      this.isActive = res?.active || false;
    } catch {
      this.isActive = false;
    }
    this.applyState();
  }

  applyState() {
    UiEngine.apply(this.isActive);
    this.media.start(this.isActive);
  }

  setupListeners() {
    // SPA Navigation
    const navObs = new MutationObserver(() => {
      if (location.href !== this.lastUrl) {
        this.lastUrl = location.href;
        this.syncState();
        setTimeout(() => this.syncState(), 1000); // Re-sync for late loads
      }
    });
    navObs.observe(document.documentElement, { childList: true, subtree: true });

    // Background updates
    chrome.runtime.onMessage.addListener(msg => {
      if (msg.type === "FOCUS_STATE_CHANGED") {
        this.isActive = msg.active;
        this.applyState();
      }
    });
  }

  startShortsHider() {
    const hide = () => {
      if (!this.isActive) return;
      ['ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'a[href*="/shorts"]']
        .forEach(s => document.querySelectorAll(s).forEach(el => el.style.display = 'none'));
    };
    hide();
    this.shortsObserver = new MutationObserver(hide);
    this.shortsObserver.observe(document.body, { childList: true, subtree: true });
  }
}

const focusSystem = new YouTubeFocusSystem();
focusSystem.init();
