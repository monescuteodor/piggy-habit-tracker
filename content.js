// ── PIGGY CONTENT SCRIPT ─────────────────────────────────────
// Runs on the Piggy site — bridges extension storage to the page.

(function () {
  // Ask background for today's data
  chrome.runtime.sendMessage({ type: 'GET_TODAY' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    // Write to localStorage so index.html can read it
    localStorage.setItem('piggy_ext_bridge', JSON.stringify(response.allDays));
    localStorage.setItem('piggy_ext_connected', 'true');

    // Tell the page data arrived
    window.dispatchEvent(new CustomEvent('piggy_data', {
      detail: response
    }));
  });
})();