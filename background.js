// FocusGuard – Background System (SOLID Refactor)

const DEFAULT_SETTINGS = {
  enabled: true,
  schedule: { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
  blockedSites: { instagram: true, facebook: true, twitter: true, reddit: false, tiktok: true },
  customSites: [],
  pauseUntil: 0,
  pauseCount: 0,
  pauseResetDay: null,
};

// ── SETTINGS MANAGER (Single Responsibility: Data persistence) ──
class SettingsManager {
  static async get() {
    const res = await chrome.storage.sync.get("settings");
    return this.normalize(res.settings);
  }

  static async set(partial) {
    const current = await this.get();
    const merged = { ...current, ...partial };
    await chrome.storage.sync.set({ settings: merged });
    return merged;
  }

  static normalize(settings = {}) {
    const base = { ...DEFAULT_SETTINGS, ...settings };
    // Migrate legacy
    if (settings.workDays || settings.startHour !== undefined) {
      base.schedule = {
        days: settings.workDays ?? base.schedule.days,
        start: settings.startHour !== undefined ? `${String(settings.startHour).padStart(2, "0")}:00` : base.schedule.start,
        end: settings.endHour !== undefined ? `${String(settings.endHour).padStart(2, "0")}:00` : base.schedule.end,
      };
    }
    base.enabled = true; // Security: Always enabled if installed
    return base;
  }
}

// ── SCHEDULE ENGINE (Single Responsibility: Time logic) ──
class ScheduleEngine {
  static isActive(settings) {
    if (!settings.enabled) return false;
    if (this.isPaused(settings)) return false;
    return this.isWithinTimeRange(settings.schedule);
  }

  static isPaused(settings) {
    const now = Date.now();
    const today = new Date().getDay();
    // Daily pause reset logic
    if (settings.pauseResetDay !== today) {
      settings.pauseCount = 0;
      settings.pauseResetDay = today;
    }
    return settings.pauseUntil && settings.pauseUntil > now;
  }

  static isWithinTimeRange(schedule) {
    const now = new Date();
    if (!schedule.days.includes(now.getDay())) return false;

    const [sh, sm] = schedule.start.split(":").map(Number);
    const [eh, em] = schedule.end.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    return startMins <= endMins 
      ? (nowMins >= startMins && nowMins < endMins)
      : (nowMins >= startMins || nowMins < endMins);
  }
}

// ── RULE MANAGER (Single Responsibility: declarativeNetRequest orchestration) ──
class RuleManager {
  static async update() {
    const settings = await SettingsManager.get();
    const active = ScheduleEngine.isActive(settings);
    const rules = active ? this.generateRules(settings) : [];

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(r => r.id),
      addRules: rules
    });

    this.notifyTabs(active);
  }

  static generateRules(settings) {
    const rules = [];
    const siteMap = { instagram: ["instagram.com"], facebook: ["facebook.com"], twitter: ["twitter.com", "x.com"], reddit: ["reddit.com"], tiktok: ["tiktok.com"] };
    let id = 100;

    for (const [key, domains] of Object.entries(siteMap)) {
      if (settings.blockedSites[key]) {
        domains.forEach(domain => rules.push(this.createRedirectRule(id++, domain)));
      }
    }
    settings.customSites.forEach(domain => {
      if (domain) rules.push(this.createRedirectRule(id++, domain));
    });
    return rules;
  }

  static createRedirectRule(id, domain) {
    return {
      id, priority: 2,
      action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
      condition: { urlFilter: `*${domain}*`, resourceTypes: ["main_frame"] }
    };
  }

  static async notifyTabs(active) {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: "FOCUS_STATE_CHANGED", active }).catch(() => {}));
  }
}

// ── EVENT HUB (Initialization & Listeners) ──
chrome.runtime.onInstalled.addListener(async () => {
  await SettingsManager.get();
  await RuleManager.update();
  chrome.alarms.create("focusCheck", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(RuleManager.update);
chrome.storage.onChanged.addListener(RuleManager.update);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_FOCUS_STATE") {
    SettingsManager.get().then(s => sendResponse({ active: ScheduleEngine.isActive(s) }));
    return true;
  }
  if (msg.type === "FORCE_UPDATE") {
    RuleManager.update().then(() => sendResponse({ ok: true }));
    return true;
  }
});
