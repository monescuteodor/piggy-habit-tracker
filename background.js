// ── PIGGY BACKGROUND SERVICE WORKER ──────────────────────────
// Tracks active tab time per domain, resets daily at midnight.

const STORAGE_KEY = 'piggy_time';
const ALARM_NAME  = 'piggy_midnight_reset';

let activeTab    = null;   // { domain, startMs }
let idleState    = 'active';

// ── HELPERS ───────────────────────────────────────────────────

function domainOf(url) {
  try {
    const u = new URL(url);
    // strip www.
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-07-27"
}

async function getStore() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function setStore(store) {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

// Add `seconds` to today's entry for `domain`
async function addTime(domain, seconds) {
  if (!domain || seconds <= 0) return;
  const store = await getStore();
  const today = todayKey();
  if (!store[today]) store[today] = {};
  store[today][domain] = (store[today][domain] || 0) + Math.round(seconds);
  await setStore(store);
}

// ── TRACKING ──────────────────────────────────────────────────

function now() { return Date.now(); }

function pauseTracking() {
  if (!activeTab) return;
  const elapsed = (now() - activeTab.startMs) / 1000;
  addTime(activeTab.domain, elapsed);
  activeTab = null;
}

function startTracking(url) {
  pauseTracking();
  const domain = domainOf(url);
  if (domain) {
    activeTab = { domain, startMs: now() };
  }
}

// ── TAB EVENTS ────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (idleState !== 'active') return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) startTracking(tab.url);
  } catch {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (idleState !== 'active') return;
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active && active.id === tabId && tab.url) {
      startTracking(tab.url);
    }
  } catch {}
});

chrome.tabs.onRemoved.addListener(() => {
  pauseTracking();
});

// ── WINDOW FOCUS ──────────────────────────────────────────────

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseTracking();
  } else {
    try {
      const [active] = await chrome.tabs.query({ active: true, windowId });
      if (active && active.url) startTracking(active.url);
    } catch {}
  }
});

// ── IDLE DETECTION ────────────────────────────────────────────

chrome.idle.setDetectionInterval(60); // 60s of inactivity = idle

chrome.idle.onStateChanged.addListener((state) => {
  idleState = state;
  if (state === 'active') {
    // Resume tracking current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) startTracking(tabs[0].url);
    });
  } else {
    // Locked or idle — stop counting
    pauseTracking();
  }
});

// ── MIDNIGHT RESET ALARM ──────────────────────────────────────

async function scheduleMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 1, 0); // 00:00:01 next day
  await chrome.alarms.create(ALARM_NAME, { when: tomorrow.getTime(), periodInMinutes: 1440 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pauseTracking();
    // Keep last 30 days, drop older
    pruneOldData();
  }
});

async function pruneOldData() {
  const store = await getStore();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(store)) {
    if (key < cutoffStr) delete store[key];
  }
  await setStore(store);
}

// ── FLUSH ON INTERVAL ─────────────────────────────────────────
// Every 30s, flush current active tab time so data isn't lost
// if the browser crashes or the SW is killed.

chrome.alarms.create('piggy_flush', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'piggy_flush' && activeTab && idleState === 'active') {
    const elapsed = (now() - activeTab.startMs) / 1000;
    addTime(activeTab.domain, elapsed);
    activeTab.startMs = now(); // reset start so we don't double count
  }
});

// ── STARTUP ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(scheduleMidnight);
chrome.runtime.onStartup.addListener(async () => {
  scheduleMidnight();
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (active && active.url) startTracking(active.url);
});

// ── MESSAGE API (for popup) ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TODAY') {
    (async () => {
      // Flush current active tab first
      if (activeTab && idleState === 'active') {
        const elapsed = (now() - activeTab.startMs) / 1000;
        await addTime(activeTab.domain, elapsed);
        activeTab.startMs = now();
      }
      const store = await getStore();
      const today = store[todayKey()] || {};
      sendResponse({ today, allDays: store });
    })();
    return true; // async response
  }
});
