// FocusGuard – Popup JS (Refactored for SOLID & Clean Code)

// Constants
const DEFAULT_SETTINGS = {
  enabled: true,
  schedule: {
    days: [0, 1, 2, 3, 4, 5 ],
    start: "00:00",
    end: "23:59",
  },
  blockedSites: { instagram: true, facebook: true, twitter: true, reddit: false, tiktok: true },
  customSites: [],
  pauseUntil: 0,
  pauseCount: 0,
  pauseResetDay: null,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Utility functions
function normalizeSettings(raw = {}) {
  const normalized = { ...DEFAULT_SETTINGS, ...raw };

  // migrate legacy fields
  if (raw.workDays || raw.startHour !== undefined || raw.endHour !== undefined) {
    normalized.schedule = {
      days: raw.workDays ?? DEFAULT_SETTINGS.schedule.days,
      start: raw.startHour !== undefined ? `${String(raw.startHour).padStart(2, "0")}:00` : DEFAULT_SETTINGS.schedule.start,
      end: raw.endHour !== undefined ? `${String(raw.endHour).padStart(2, "0")}:00` : DEFAULT_SETTINGS.schedule.end,
    };
  }

  normalized.schedule = {
    ...DEFAULT_SETTINGS.schedule,
    ...normalized.schedule,
  };

  normalized.schedule.days = Array.isArray(normalized.schedule.days)
    ? normalized.schedule.days
    : DEFAULT_SETTINGS.schedule.days;

  normalized.customSites = Array.isArray(normalized.customSites) ? normalized.customSites : DEFAULT_SETTINGS.customSites;

  // Once enabled, it stays enabled. The checkbox is informational only.
  normalized.enabled = true;

  return normalized;
}

function getAllowedHostPatterns() {
  const manifest = chrome.runtime.getManifest();
  return Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
}

function domainMatchesHostPermission(domain, pattern) {
  // pattern like *://*.example.com/*
  const withoutScheme = pattern.replace(/^[^/]+:\/\//, "");
  const hostPart = withoutScheme.replace(/\/\*$/, "");

  // Normalize user input domain for comparison
  const normalizedDomain = domain.toLowerCase().replace(/^\*\./, "");

  if (hostPart.startsWith("*.")) {
    const base = hostPart.slice(2);
    // allow exact base and any subdomain
    return (
      normalizedDomain === base ||
      normalizedDomain.endsWith(`.${base}`)
    );
  }

  // exact match only
  return normalizedDomain === hostPart;
}

function isDomainAllowed(domain) {
  const allowedPatterns = getAllowedHostPatterns();
  return allowedPatterns.some(pattern => domainMatchesHostPermission(domain, pattern));
}

// Classes

class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
  }

  async load() {
    const res = await chrome.storage.sync.get("settings");
    this.settings = normalizeSettings(res.settings);
    return this.settings;
  }

  async save() {
    await chrome.storage.sync.set({ settings: this.settings });
    await chrome.runtime.sendMessage({ type: "FORCE_UPDATE" });
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
  }
}

class UIManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
  }

  renderAll() {
    const settings = this.settingsManager.getSettings();

    // Master toggle (informational only)
    const masterToggle = document.getElementById("masterToggle");
    masterToggle.checked = true;
    masterToggle.disabled = true;

    // Pause button state
    this.updatePauseButton();

    // Site checkboxes
    document.querySelectorAll(".mini-switch input[data-site]").forEach(cb => {
      const site = cb.dataset.site;
      cb.checked = settings.blockedSites?.[site] || false;
      const item = document.querySelector(`.site-item[data-site="${site}"]`);
      item?.classList.toggle("blocked", cb.checked);
    });

    this.renderCustomSites();

    // Time inputs
    const startInput = document.getElementById("startTime");
    const endInput = document.getElementById("endTime");
    startInput.value = settings.schedule.start;
    endInput.value = settings.schedule.end;

    // Days
    document.querySelectorAll(".day-btn[data-day]").forEach(btn => {
      const day = parseInt(btn.dataset.day);
      btn.classList.toggle("on", settings.schedule.days.includes(day));
    });

    this.updateStatusUI();
  }

  renderCustomSites() {
    const settings = this.settingsManager.getSettings();
    const list = document.getElementById("customSitesList");
    list.innerHTML = "";
    settings.customSites.forEach((domain, idx) => {
      const row = document.createElement("div");
      row.className = "custom-site-item";

      const label = document.createElement("span");
      label.textContent = domain;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "custom-site-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        settings.customSites.splice(idx, 1);
        this.settingsManager.save().then(() => this.renderAll());
      });

      row.append(label, remove);
      list.appendChild(row);
    });
  }

  updatePauseButton() {
    const settings = this.settingsManager.getSettings();
    const btn = document.getElementById("pauseBtn");
    const indicator = document.getElementById("pauseIndicator");
    const paused = this.isPaused();
    const now = Date.now();

    if (paused) {
      const remainingMs = settings.pauseUntil - now;
      const m = Math.floor((remainingMs % 3600000) / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      btn.textContent = `Paused (${m}m ${s}s left)`;
      btn.disabled = true;
      indicator.textContent = "Pauses left: 0 (paused)";
    } else {
      const today = new Date().getDay();
      const used = settings.pauseResetDay === today ? settings.pauseCount : 0;
      const left = Math.max(0, 2 - used);
      btn.textContent = `Pause 30m (${used}/2)`;
      btn.disabled = used >= 2;
      indicator.textContent = `Pauses left: ${left}`;
    }
  }

  isPaused() {
    const settings = this.settingsManager.getSettings();
    const now = Date.now();
    const today = new Date().getDay();

    if (settings.pauseResetDay !== today) {
      settings.pauseCount = 0;
      settings.pauseResetDay = today;
    }

    return settings.pauseUntil && settings.pauseUntil > now;
  }

  updateStatusUI() {
    const settings = this.settingsManager.getSettings();
    const now = new Date();
    const day = now.getDay();
    const [sh, sm] = settings.schedule.start.split(":").map(Number);
    const [eh, em] = settings.schedule.end.split(":").map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    const isDayMatch = settings.schedule.days.includes(day);
    const isWithin = (() => {
      if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      }
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    })();

    const paused = this.isPaused();
    const active = isDayMatch && isWithin && !paused;

    const badge = document.getElementById("statusBadge");
    const statusText = document.getElementById("statusText");
    const timeBlock = document.getElementById("timeBlock");
    const countdown = document.getElementById("countdown");

    badge.textContent = active ? "ACTIVE" : "OFF";
    badge.className = "status-badge " + (active ? "active" : "inactive");
    timeBlock.className = "time-block " + (active ? "is-active" : "");

    if (paused) {
      const remainingMs = settings.pauseUntil - Date.now();
      const h = Math.floor(remainingMs / 3600000);
      const m = Math.floor((remainingMs % 3600000) / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      const label = `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;

      statusText.innerHTML = `Paused <span>now</span>`;
      countdown.innerHTML = `<div class="count-label">Resumes in</div>${label}`;
      return;
    }

    if (!isDayMatch) {
      const dayName = DAY_NAMES[day];
      statusText.innerHTML = `<span style="color:var(--text-muted)">Rest day</span> (${dayName})`;
      countdown.innerHTML = "";
      return;
    }

    if (active) {
      const minsLeft = endMinutes - nowMinutes;
      const h = Math.floor(minsLeft / 60);
      const m = minsLeft % 60;
      statusText.innerHTML = `Focus mode <span>ON</span>`;
      countdown.innerHTML = `<div class="count-label">Ends in</div>${h}h ${m}m`;
      return;
    }

    // Not active but should be later
    const minsUntil = startMinutes - nowMinutes;
    if (minsUntil > 0) {
      const h = Math.floor(minsUntil / 60);
      const m = minsUntil % 60;
      statusText.innerHTML = `Work starts <span>soon</span>`;
      countdown.innerHTML = `<div class="count-label">Starts in</div>${h}h ${m}m`;
    } else {
      statusText.innerHTML = `Work hours <span>ended</span>`;
      countdown.innerHTML = "";
    }
  }

  showToast(message = "✓ Settings saved") {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }
}

class EventHandler {
  constructor(settingsManager, uiManager) {
    this.settingsManager = settingsManager;
    this.uiManager = uiManager;
  }

  init() {
    this.bindPauseButton();
    this.bindAddSite();
    this.bindSaveButton();
    this.bindDayButtons();
    this.bindSiteToggles();
  }

  bindPauseButton() {
    document.getElementById("pauseBtn").addEventListener("click", () => {
      const settings = this.settingsManager.getSettings();
      const now = Date.now();
      const today = new Date().getDay();

      if (settings.pauseResetDay !== today) {
        settings.pauseCount = 0;
        settings.pauseResetDay = today;
      }

      if (settings.pauseCount >= 2) return;
      settings.pauseCount += 1;
      settings.pauseUntil = now + 30 * 60 * 1000;

      this.settingsManager.save().then(() => this.uiManager.renderAll());
    });
  }

  bindAddSite() {
    document.getElementById("addSiteBtn").addEventListener("click", () => {
      const input = document.getElementById("newSiteInput");
      const value = input.value.trim();
      if (!value) return;
      this.addCustomSite(value);
      input.value = "";
    });
  }

  bindSaveButton() {
    document.getElementById("saveBtn").addEventListener("click", () => {
      const settings = this.settingsManager.getSettings();
      const start = document.getElementById("startTime").value;
      const end = document.getElementById("endTime").value;

      settings.schedule.start = start || settings.schedule.start;
      settings.schedule.end = end || settings.schedule.end;

      // Update blocked sites toggles
      document.querySelectorAll(".mini-switch input[data-site]").forEach(cb => {
        const site = cb.dataset.site;
        if (!settings.blockedSites) settings.blockedSites = {};
        settings.blockedSites[site] = cb.checked;
      });

      // Days
      settings.schedule.days = Array.from(document.querySelectorAll(".day-btn.on")).map(btn => parseInt(btn.dataset.day));

      this.settingsManager.save().then(() => this.uiManager.showToast());
    });
  }

  bindDayButtons() {
    document.querySelectorAll(".day-btn[data-day]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
      });
    });
  }

  bindSiteToggles() {
    document.querySelectorAll(".mini-switch input[data-site]").forEach(cb => {
      cb.addEventListener("change", e => {
        const site = e.target.dataset.site;
        const settings = this.settingsManager.getSettings();
        if (!settings.blockedSites) settings.blockedSites = {};
        settings.blockedSites[site] = e.target.checked;
        const item = document.querySelector(`.site-item[data-site="${site}"]`);
        item?.classList.toggle("blocked", e.target.checked);
      });
    });
  }

  bindTabNavigation() {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchToTab(tab.dataset.tab));
    });
  }

  switchToTab(tabName) {
    document.querySelectorAll(".tab").forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    document.querySelectorAll(".tab-content").forEach(content => {
      content.classList.toggle("active", content.dataset.tab === tabName);
    });
  }

  handleTabSwitch() {
    const activeTab = document.querySelector(".tab.active");
    const tabName = activeTab?.dataset.tab || "schedule";
    this.switchToTab(tabName);
  }

  addCustomSite(domain) {
    let normalized = domain.trim().toLowerCase();
    if (!normalized) return;

    // strip protocol and path
    normalized = normalized.replace(/^\w+:\/\//, "").replace(/\/.*$/, "");

    // basic validation
    if (!/^[a-z0-9.-]+(\.[a-z0-9.-]+)*$/.test(normalized)) return;

    if (!isDomainAllowed(normalized)) {
      this.uiManager.showToast("Not allowed by extension permissions");
      return;
    }

    const settings = this.settingsManager.getSettings();
    if (!settings.customSites.includes(normalized)) {
      settings.customSites.push(normalized);
      this.settingsManager.save().then(() => this.uiManager.renderAll());
    }
  }
}

// Main App
class App {
  constructor() {
    this.settingsManager = new SettingsManager();
    this.uiManager = new UIManager(this.settingsManager);
    this.eventHandler = new EventHandler(this.settingsManager, this.uiManager);
  }

  async init() {
    await this.settingsManager.load();
    this.uiManager.renderAll();
    this.eventHandler.init();

    // Wire up tab switching for narrow popups
    this.eventHandler.bindTabNavigation();
    this.eventHandler.handleTabSwitch();

    // Refresh UI periodically
    setInterval(() => {
      this.uiManager.updatePauseButton();
      this.uiManager.updateStatusUI();
    }, 1000);
  }
}

// Initialize
const app = new App();
document.addEventListener("DOMContentLoaded", () => app.init());
