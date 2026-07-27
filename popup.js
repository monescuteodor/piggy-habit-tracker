const PIGGY_URL = 'https://piggy-habit-tracker.edgeone.dev/';

function fmtTime(sec) {
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

function decayFrom(totalSec) {
  return Math.min(totalSec / (12 * 3600), 1);
}

function barColor(decay) {
  if (decay < 0.33) return '#6BAE3E';
  if (decay < 0.66) return '#D4920B';
  return '#E24B4A';
}

function renderPig(decay) {
  const r = Math.round(244 - decay * 64);
  const g = Math.round(160 - decay * 60);
  const b = Math.round(181 - decay * 71);
  const col = `rgb(${r},${g},${b})`;

  ['p-body','p-head','p-el','p-er'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('fill', col);
  });

  const mouth = document.getElementById('p-mouth');
  if (mouth) {
    if      (decay < 0.2)  mouth.setAttribute('d','M53 52 Q60 57 67 52');
    else if (decay < 0.5)  mouth.setAttribute('d','M53 54 Q60 54 67 54');
    else                   mouth.setAttribute('d','M53 57 Q60 52 67 57');
  }

  const dead = decay > 0.8 ? (decay - 0.8) / 0.2 : 0;
  ['p-eye-lw','p-eye-rw','p-eye-lp','p-eye-rp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.opacity = 1 - dead;
  });
  const xe = document.getElementById('p-xeyes');
  if (xe) xe.style.opacity = dead;

  const wr = document.getElementById('p-wrinkles');
  const bg = document.getElementById('p-bags');
  const dk = document.getElementById('p-dark');
  if (wr) wr.style.opacity = decay > 0.3 ? Math.min((decay - 0.3) / 0.5, 1) : 0;
  if (bg) bg.style.opacity = decay > 0.4 ? Math.min((decay - 0.4) / 0.4, 1) : 0;
  if (dk) dk.style.opacity = decay > 0.5 ? Math.min((decay - 0.5) / 0.4, 1) : 0;

  const halo = document.getElementById('p-halo');
  if (halo) halo.style.opacity = decay < 0.05 ? 1 : 0;

  const stages = ['happy 🌸', 'tired 😐', 'sad 😔', 'broken 😩', 'dead inside 💀'];
  const stage  = Math.min(Math.floor(decay * 5), 4);
  const lbl    = document.getElementById('pig-label');
  if (lbl) lbl.textContent = stages[stage];
}

function verdictFor(decay) {
  if (decay === 0)  return '"No activity yet today. The pig is on vacation."';
  if (decay < 0.15) return '"The pig is proud of you. Keep it up."';
  if (decay < 0.33) return '"The pig noticed some things. He\'s not saying anything, but he knows."';
  if (decay < 0.55) return '"The pig has dark circles. He stayed up thinking about you."';
  if (decay < 0.75) return '"The pig looked in the mirror and cried."';
  return '"The pig left a note. It just says: why?"';
}

function updateRing(decay) {
  const C    = 2 * Math.PI * 22;
  const fill = document.getElementById('ring-fill');
  const pct  = document.getElementById('ring-pct');
  if (fill) {
    fill.style.strokeDashoffset = C * (1 - decay);
    fill.setAttribute('stroke', barColor(decay));
  }
  if (pct) pct.textContent = Math.round(decay * 100) + '%';
}

function render({ today }) {
  const entries  = Object.entries(today || {}).sort((a, b) => b[1] - a[1]);
  const totalSec = entries.reduce((s, [, v]) => s + v, 0);
  const decay    = decayFrom(totalSec);
  const top5     = entries.slice(0, 5);
  const maxSec   = top5.length > 0 ? top5[0][1] : 1;

  renderPig(decay);

  const totalCard = document.getElementById('total-card');
  const totalVal  = document.getElementById('total-val');
  const totalSub  = document.getElementById('total-sub');
  if (totalCard) totalCard.style.display = 'flex';
  if (totalVal)  totalVal.textContent    = fmtTime(totalSec);
  if (totalSub)  totalSub.textContent    = `across ${entries.length} site${entries.length !== 1 ? 's' : ''}`;

  updateRing(decay);

  const sitesSection = document.getElementById('sites-section');
  const sitesList    = document.getElementById('sites-list');
  if (sitesSection) sitesSection.style.display = top5.length > 0 ? 'block' : 'none';

  if (sitesList) {
    if (top5.length === 0) {
      sitesList.innerHTML = '<div class="empty">No sites visited yet today.<br/>Come back after browsing a bit.</div>';
    } else {
      sitesList.innerHTML = top5.map(([domain, sec]) => {
        const pct    = Math.round((sec / totalSec) * 100);
        const barPct = Math.round((sec / maxSec) * 100);
        const col    = barColor(decay);
        return `
          <div class="site-row">
            <div class="site-fav">
              <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none'" alt=""/>
            </div>
            <div class="site-name">${domain}</div>
            <div class="site-time">${fmtTime(sec)}</div>
            <div class="site-pct">${pct}%</div>
          </div>
          <div class="bar-wrap">
            <div class="bar-fill" style="width:${barPct}%;background:${col}"></div>
          </div>`;
      }).join('');
    }
  }

  const verdictEl = document.getElementById('verdict');
  if (verdictEl) {
    verdictEl.style.display = 'block';
    verdictEl.textContent   = verdictFor(decay);
  }
}

// Date header
const now    = new Date();
const dateEl = document.getElementById('date-str');
if (dateEl) {
  dateEl.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

// Open Piggy button — no inline onclick, CSP safe
document.getElementById('open-btn').addEventListener('click', function () {
  chrome.tabs.create({ url: PIGGY_URL });
  window.close();
});

// Get data from background
chrome.runtime.sendMessage({ type: 'GET_TODAY' }, (response) => {
  if (chrome.runtime.lastError || !response) {
    const lbl = document.getElementById('pig-label');
    if (lbl) lbl.textContent = 'failed to load';
    return;
  }
  render(response);
});