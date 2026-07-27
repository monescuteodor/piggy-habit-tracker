// ── PIGGY CONTENT SCRIPT ─────────────────────────────────────
// Runs on piggy-habit-tracker.edgeone.dev
// Bridges extension storage → site localStorage so the site
// can read real screen time data without any extra API calls.

(function () {
  chrome.runtime.sendMessage({ type: 'GET_TODAY' }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    localStorage.setItem('piggy_ext_bridge', JSON.stringify(response.allDays));
    localStorage.setItem('piggy_ext_connected', 'true');
    window.dispatchEvent(new CustomEvent('piggy_data', { detail: response }));
  });
})();