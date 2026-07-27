// ── PIGGY BACKGROUND SERVICE WORKER ──────────────────────────
// Tracks active tab time per domain, resets daily at midnight.

const STORAGE_KEY = 'piggy_time';
const ALARM_FLUSH = 'piggy_flush';
const ALARM_RESET = 'piggy_midnight_reset';

let activeTab  = null; // { domain, startMs }
let idleState  = 'active';

// ── HELPERS ───────────────────────────────────────────────────
function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function now()      { return Date.now(); }

async function getStore() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || {};
}
async function setStore(store) {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}
async function addTime(domain, seconds) {
  if (!domain || seconds <= 0) return;
  const store = await getStore();
  const today = todayKey();
  if (!store[today]) store[today] = {};
  store[today][domain] = (store[today][domain] || 0) + Math.round(seconds);
  await setStore(store);
}

// ── TRACKING ──────────────────────────────────────────────────
function pauseTracking() {
  if (!activeTab) return;
  const elapsed = (now() - activeTab.startMs) / 1000;
  addTime(activeTab.domain, elapsed);
  activeTab = null;
}
function startTracking(url) {
  pauseTracking();
  const domain = domainOf(url);
  if (domain) activeTab = { domain, startMs: now() };
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
    if (active && active.id === tabId && tab.url) startTracking(tab.url);
  } catch {}
});

chrome.tabs.onRemoved.addListener(() => pauseTracking());

chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseTracking();
  } else {
    try {
      const [active] = await chrome.tabs.query({ active: true, windowId });
      if (active && active.url) startTracking(active.url);
    } catch {}
  }
});

// ── IDLE ──────────────────────────────────────────────────────
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(state => {
  idleState = state;
  if (state === 'active') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && tabs[0].url) startTracking(tabs[0].url);
    });
  } else {
    pauseTracking();
  }
});

// ── ALARMS ────────────────────────────────────────────────────
async function scheduleMidnight() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(0, 0, 1, 0);
  await chrome.alarms.create(ALARM_RESET, { when: t.getTime(), periodInMinutes: 1440 });
}

chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === ALARM_FLUSH && activeTab && idleState === 'active') {
    const elapsed = (now() - activeTab.startMs) / 1000;
    await addTime(activeTab.domain, elapsed);
    activeTab.startMs = now();
  }
  if (alarm.name === ALARM_RESET) {
    pauseTracking();
    // Prune data older than 30 days
    const store = await getStore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const key of Object.keys(store)) {
      if (key < cutoffStr) delete store[key];
    }
    await setStore(store);
  }
});

// ── MESSAGES ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TODAY') {
    (async () => {
      if (activeTab && idleState === 'active') {
        const elapsed = (now() - activeTab.startMs) / 1000;
        await addTime(activeTab.domain, elapsed);
        activeTab.startMs = now();
      }
      const store = await getStore();
      const today = store[todayKey()] || {};
      sendResponse({ today, allDays: store });
    })();
    return true;
  }
});

// ── STARTUP ───────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(scheduleMidnight);
chrome.runtime.onStartup.addListener(async () => {
  scheduleMidnight();
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (active && active.url) startTracking(active.url);
});