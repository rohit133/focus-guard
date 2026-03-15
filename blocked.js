const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(value) {
  if (!value) return "09:00 AM";
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = (h % 12) || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function normalizeDays(days) {
  const unique = [...new Set((days || []).map(Number))].sort((a, b) => a - b);
  if (!unique.length) return [1, 2, 3, 4, 5, 6];
  return unique;
}

function formatDayRange(days) {
  const normalized = normalizeDays(days);
  if (normalized.length === 0) return "Mon–Fri";

  const isContinuous = (arr) => {
    if (arr.length <= 1) return true;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i-1] + 1) return false;
    }
    return true;
  };

  if (isContinuous(normalized) && normalized.length > 1) {
    return `${DAY_NAMES[normalized[0]]}–${DAY_NAMES[normalized[normalized.length - 1]]}`;
  }

  return normalized.map((d) => DAY_NAMES[d]).join(", ");
}

function updateDisplay(settings = {}) {
  const schedule = settings.schedule || { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" };
  const daysText = formatDayRange(schedule.days);
  const timeText = `${formatTime(schedule.start || "09:00")} – ${formatTime(schedule.end || "18:00")}`;
  
  const workHoursEl = document.getElementById("workHours");
  if (workHoursEl) workHoursEl.textContent = `${daysText}, ${timeText}`;

  const blockedDomainEl = document.getElementById("blockedDomain");
  if (blockedDomainEl) blockedDomainEl.textContent = location.hostname;
}

function formatPauseRemaining(untilMs) {
  const now = Date.now();
  const remaining = Math.max(0, untilMs - now);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

let pauseInterval = null;

function setPausedState(settings = {}) {
  const pauseUntil = settings.pauseUntil || 0;
  const pauseStateEl = document.getElementById("pauseState");
  const resumeBtn = document.getElementById("resumeBtn");

  if (!pauseStateEl || !resumeBtn) return;

  if (pauseUntil && pauseUntil > Date.now()) {
    resumeBtn.hidden = false;
    
    const updateCountdown = () => {
      const now = Date.now();
      if (pauseUntil <= now) {
        pauseStateEl.textContent = "";
        resumeBtn.hidden = true;
        clearInterval(pauseInterval);
        location.reload();
        return;
      }
      pauseStateEl.textContent = `Paused for ${formatPauseRemaining(pauseUntil)} (tap resume) `;
    };

    updateCountdown();
    clearInterval(pauseInterval);
    pauseInterval = setInterval(updateCountdown, 1000);

    resumeBtn.onclick = async () => {
      const updated = { ...settings, pauseUntil: 0, pauseCount: 0 };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ settings: updated }, () => {
          pauseStateEl.textContent = "Resuming…";
          resumeBtn.hidden = true;
          setTimeout(() => location.reload(), 500);
        });
      }
    };
  } else {
    pauseStateEl.textContent = "";
    resumeBtn.hidden = true;
    if (pauseInterval) clearInterval(pauseInterval);
  }
}

// Initialize
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get("settings", (res) => {
    const settings = res.settings || {};
    updateDisplay(settings);
    setPausedState(settings);
  });
} else {
  updateDisplay();
  setPausedState();
}
