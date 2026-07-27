// ── PIGGY POPUP ───────────────────────────────────────────────

const PIGGY_URL = 'https://piggy-habit-tracker.edgeone.dev/';

const FIREBASE_CONFIG = {
  apiKey:            "",
  authDomain:        "",
  projectId:         "",
  storageBucket:     "",
  messagingSenderId: "",
  appId:             ""
};

// ── HELPERS ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmtTime = s => {
  if (s <= 0) return '0min';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'min';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
};

const decayFrom = s => Math.min(s / (12 * 3600), 1);
const barColor  = d => d < 0.33 ? '#6BAE3E' : d < 0.66 ? '#D4920B' : '#E24B4A';
const todayKey  = () => new Date().toISOString().slice(0, 10);

const deviceName = () => {
  const ua = navigator.userAgent;
  if (/Macintosh/i.test(ua)) return 'MacBook';
  if (/Windows/i.test(ua))   return 'Windows PC';
  if (/Linux/i.test(ua))     return 'Linux';
  return 'laptop';
};

const friendlyError = code => ({
  'auth/email-already-in-use': 'Email already registered.',
  'auth/invalid-email':        'Invalid email address.',
  'auth/weak-password':        'Password must be at least 6 characters.',
  'auth/user-not-found':       'No account found with this email.',
  'auth/wrong-password':       'Wrong password.',
  'auth/invalid-credential':   'Wrong email or password.',
  'auth/too-many-requests':    'Too many attempts. Try again later.',
}[code] || 'Something went wrong. Try again.');

// ── AUTH PANELS ───────────────────────────────────────────────
function showSignin() {
  $('signin-panel').style.display = 'block';
  $('signup-panel').style.display = 'none';
}
function showSignup() {
  $('signin-panel').style.display = 'none';
  $('signup-panel').style.display = 'block';
}

// ── PIG ───────────────────────────────────────────────────────
function renderPig(decay) {
  const col = `rgb(${Math.round(244-decay*64)},${Math.round(160-decay*60)},${Math.round(181-decay*71)})`;
  ['p-body','p-head','p-el','p-er'].forEach(id => {
    const e = $(id); if (e) e.setAttribute('fill', col);
  });
  const m = $('p-mouth');
  if (m) m.setAttribute('d',
    decay < 0.2 ? 'M53 52 Q60 57 67 52' :
    decay < 0.5 ? 'M53 54 Q60 54 67 54' :
                  'M53 57 Q60 52 67 57');
  const dead = decay > 0.8 ? (decay - 0.8) / 0.2 : 0;
  ['p-elw','p-erw','p-elp','p-erp'].forEach(id => {
    const e = $(id); if (e) e.style.opacity = 1 - dead;
  });
  const xe = $('p-xeyes'); if (xe) xe.style.opacity = dead;
  const wr = $('p-wrinkles'); if (wr) wr.style.opacity = decay > 0.3 ? Math.min((decay-0.3)/0.5,1) : 0;
  const bg = $('p-bags');     if (bg) bg.style.opacity = decay > 0.4 ? Math.min((decay-0.4)/0.4,1) : 0;
  const hl = $('p-halo');     if (hl) hl.style.opacity = decay < 0.05 ? 1 : 0;

  const stages = ['happy 🌸','tired 😐','sad 😔','broken 😩','dead inside 💀'];
  const lbl = $('pig-label');
  if (lbl) lbl.textContent = stages[Math.min(Math.floor(decay*5), 4)];
}

function updateRing(decay) {
  const C = 2 * Math.PI * 20;
  const f = $('ring-fill');
  if (f) { f.style.strokeDashoffset = C*(1-decay); f.setAttribute('stroke', barColor(decay)); }
  const p = $('ring-pct');
  if (p) p.textContent = Math.round(decay*100) + '%';
}

function renderVerdict(decay) {
  const verdicts = [
    '"The pig is proud of you. For now."',
    '"The pig noticed some things. He knows."',
    '"Dark circles. He stayed up thinking about you."',
    '"He looked in the mirror and cried."',
    '"He left a note. It says: why?"'
  ];
  const v = $('verdict');
  if (v) v.textContent = verdicts[Math.min(Math.floor(decay*5), 4)];
}

function renderSites(entries, totalSec, decay) {
  const top5 = entries.slice(0, 5);
  const sec  = $('sites-section');
  const list = $('sites-list');
  if (!top5.length) { if (sec) sec.style.display = 'none'; return; }
  if (sec) sec.style.display = 'block';
  if (list) list.innerHTML = top5.map(([domain, s]) => {
    const pct = Math.round(s / totalSec * 100);
    const bp  = Math.round(s / entries[0][1] * 100);
    return `<div class="site-row">
      <div class="site-fav"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none'" alt=""/></div>
      <div class="site-name">${domain}</div>
      <div class="site-time">${fmtTime(s)}</div>
      <div class="site-pct">${pct}%</div>
    </div>
    <div class="bar-wrap"><div class="bar-fill" style="width:${bp}%;background:${barColor(decay)}"></div></div>`;
  }).join('');
}

// ── MAIN RENDER ───────────────────────────────────────────────
function renderMain(db, userId) {
  chrome.runtime.sendMessage({ type: 'GET_TODAY' }, async response => {
    if (chrome.runtime.lastError || !response) return;

    const today    = response.today || {};
    const entries  = Object.entries(today).sort((a, b) => b[1] - a[1]);
    const totalSec = entries.reduce((s, [, v]) => s + v, 0);
    const decay    = decayFrom(totalSec);

    renderPig(decay);
    updateRing(decay);
    renderVerdict(decay);
    renderSites(entries, totalSec, decay);

    $('total-val').textContent = fmtTime(totalSec);
    $('total-sub').textContent = `across ${entries.length} site${entries.length !== 1 ? 's' : ''}`;
    $('device-label').textContent = `${deviceName()} · syncing...`;

    // Bridge for site
    localStorage.setItem('piggy_ext_bridge', JSON.stringify(response.allDays));

    // Sync to Firestore
    if (userId && db) {
      try {
        const { doc, setDoc } = FirebaseBundle;
        await setDoc(doc(db, 'users', userId, 'history', todayKey()), {
          date:      todayKey(),
          totalSec,
          sites:     entries.length,
          decay:     Math.round(decay * 100) / 100,
          device:    deviceName(),
          topSites:  entries.slice(0, 5).map(([d, s]) => ({ domain: d, seconds: s })),
          updatedAt: new Date().toISOString()
        });
        $('device-label').textContent = `${deviceName()} · synced ✓`;
      } catch {
        $('device-label').textContent = `${deviceName()} · sync failed`;
      }
    }
  });
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const {
    initializeApp,
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, updateProfile,
    getFirestore, doc, setDoc
  } = FirebaseBundle;

  const fbApp = initializeApp(FIREBASE_CONFIG);
  const auth  = getAuth(fbApp);
  const db    = getFirestore(fbApp);

  // Auth state
  onAuthStateChanged(auth, async user => {
    if (user) {
      $('auth-screen').style.display = 'none';
      $('main-screen').style.display = 'block';
      $('user-info').style.display   = 'flex';

      const name = user.displayName || user.email.split('@')[0];
      $('hdr-avatar').textContent = name[0].toUpperCase();
      $('hdr-name').textContent   = name;

      renderMain(db, user.uid);
    } else {
      $('auth-screen').style.display = 'block';
      $('main-screen').style.display = 'none';
      $('user-info').style.display   = 'none';
      showSignin();
    }
  });

  // Sign in
  $('si-btn').addEventListener('click', async () => {
    const email = $('si-email').value.trim();
    const pass  = $('si-pass').value;
    const err   = $('si-error');
    const btn   = $('si-btn');
    err.textContent = '';
    if (!email || !pass) { err.textContent = 'Please fill in all fields.'; return; }
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      err.textContent = friendlyError(e.code);
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  // Sign up
  $('su-btn').addEventListener('click', async () => {
    const name  = $('su-name').value.trim();
    const email = $('su-email').value.trim();
    const pass  = $('su-pass').value;
    const err   = $('su-error');
    const btn   = $('su-btn');
    err.textContent = '';
    if (!name)          { err.textContent = 'Please enter your name.'; return; }
    if (!email)         { err.textContent = 'Please enter your email.'; return; }
    if (pass.length < 6){ err.textContent = 'Password must be at least 6 characters.'; return; }
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name, email, createdAt: new Date().toISOString(), streak: 0
      });
    } catch (e) {
      err.textContent = friendlyError(e.code);
      btn.disabled = false; btn.textContent = 'Create account';
    }
  });

  // Sign out
  $('btn-signout').addEventListener('click', () => signOut(auth));

  // Toggle panels
  $('go-signup').addEventListener('click', showSignup);
  $('go-signin').addEventListener('click', showSignin);

  // Open site
  $('open-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: PIGGY_URL });
    window.close();
  });
});