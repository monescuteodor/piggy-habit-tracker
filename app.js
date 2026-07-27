// ── FIREBASE ──────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: ""
  appId: "",
  measurementId: ""
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── HELPERS ───────────────────────────────────────────────────
function fmtTime(sec) {
  if (sec <= 0) return '0min';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'min';
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}
function decayFrom(sec)  { return Math.min(sec / (12 * 3600), 1); }
function barColor(decay) { return decay < 0.33 ? '#6BAE3E' : decay < 0.66 ? '#D4920B' : '#E24B4A'; }
function todayKey()      { return new Date().toISOString().slice(0, 10); }

// ── SCREENS ───────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'dashboard') renderDash();
  if (id === 'history')   renderHistory();
}

// ── AUTH FORMS ────────────────────────────────────────────────
function showSignup() {
  document.getElementById('signup-form').style.display = 'block';
  document.getElementById('signin-form').style.display = 'none';
  document.getElementById('auth-sub').textContent      = 'Create your account';
  showScreen('auth');
}
function showSignin() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('signin-form').style.display = 'block';
  document.getElementById('auth-sub').textContent      = 'Welcome back';
  showScreen('auth');
}

// ── SIGN UP ───────────────────────────────────────────────────
async function handleSignup() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');
  const btn      = document.getElementById('signup-btn');

  errEl.textContent = '';
  if (!name)              { errEl.textContent = 'Please enter your name.'; return; }
  if (!email)             { errEl.textContent = 'Please enter your email.'; return; }
  if (password.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Creating account...';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, createdAt: new Date().toISOString(), streak: 0
    });
  } catch (e) {
    errEl.textContent = friendlyError(e.code);
    btn.disabled      = false;
    btn.textContent   = 'Create account';
  }
}

// ── SIGN IN ───────────────────────────────────────────────────
async function handleSignin() {
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl    = document.getElementById('signin-error');
  const btn      = document.getElementById('signin-btn');

  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Signing in...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = friendlyError(e.code);
    btn.disabled      = false;
    btn.textContent   = 'Sign in';
  }
}

// ── SIGN OUT ──────────────────────────────────────────────────
async function handleSignout() {
  await signOut(auth);
  showScreen('landing');
}

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'This email is already registered.';
    case 'auth/invalid-email':        return 'Invalid email address.';
    case 'auth/weak-password':        return 'Password is too weak.';
    case 'auth/user-not-found':       return 'No account found with this email.';
    case 'auth/wrong-password':       return 'Wrong password.';
    case 'auth/invalid-credential':   return 'Wrong email or password.';
    case 'auth/too-many-requests':    return 'Too many attempts. Try again later.';
    default:                          return 'Something went wrong. Try again.';
  }
}

// ── AUTH STATE ────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const name   = user.displayName || user.email.split('@')[0];
    const letter = name[0].toUpperCase();

    document.getElementById('user-avatar').textContent  = letter;
    document.getElementById('hist-avatar').textContent  = letter;
    document.getElementById('nav-name').textContent     = name;
    document.getElementById('dash-greeting').textContent = `Hey, ${name}!`;

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        document.getElementById('dash-streak').textContent = `🔥 ${data.streak || 0} day streak`;
      }
    } catch {}

    showScreen('dashboard');
  } else {
    showScreen('landing');
  }
});

// ── PIG ───────────────────────────────────────────────────────
function applyPig(decay) {
  const r = Math.round(244 - decay * 64);
  const g = Math.round(160 - decay * 60);
  const b = Math.round(181 - decay * 71);
  const col = `rgb(${r},${g},${b})`;

  ['dp-body','dp-head','dp-el','dp-er'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('fill', col);
  });

  const mouth = document.getElementById('dp-mouth');
  if (mouth) {
    if      (decay < 0.2)  mouth.setAttribute('d','M55 56 Q60 60 65 56');
    else if (decay < 0.5)  mouth.setAttribute('d','M55 58 Q60 58 65 58');
    else                   mouth.setAttribute('d','M55 61 Q60 57 65 61');
  }

  const dead = decay > 0.8 ? (decay - 0.8) / 0.2 : 0;
  ['dp-elw','dp-erw','dp-elp','dp-erp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.opacity = 1 - dead;
  });
  const xe = document.getElementById('dp-xeyes');
  if (xe) xe.style.opacity = dead;

  const wr = document.getElementById('dp-wrinkles');
  const bg = document.getElementById('dp-bags');
  if (wr) wr.style.opacity = decay > 0.3 ? Math.min((decay - 0.3) / 0.5, 1) : 0;
  if (bg) bg.style.opacity = decay > 0.4 ? Math.min((decay - 0.4) / 0.4, 1) : 0;

  const halo = document.getElementById('dp-halo');
  if (halo) halo.style.opacity = decay < 0.05 ? 1 : 0;

  const stages   = ['happy 🌸','tired 😐','sad 😔','broken 😩','dead inside 💀'];
  const verdicts = [
    '"The pig is proud of you. For now."',
    '"The pig noticed some things. He\'s not saying anything, but he knows."',
    '"The pig has dark circles. He stayed up thinking about you."',
    '"The pig looked in the mirror and cried."',
    '"The pig left a note. It just says: why?"'
  ];
  const stage = Math.min(Math.floor(decay * 5), 4);
  const stEl  = document.getElementById('dp-stage');
  const vEl   = document.getElementById('dash-verdict');
  if (stEl) stEl.textContent = stages[stage];
  if (vEl)  vEl.textContent  = verdicts[stage];

  const dots = document.querySelectorAll('#dp-dots .pig-dot');
  dots.forEach((d, i) => d.classList.toggle('on', i < stage));
}

function updateRing(decay) {
  const C    = 2 * Math.PI * 24;
  const fill = document.getElementById('ring-fill');
  const pct  = document.getElementById('ring-pct');
  if (fill) { fill.style.strokeDashoffset = C * (1 - decay); fill.setAttribute('stroke', barColor(decay)); }
  if (pct)  pct.textContent = Math.round(decay * 100) + '%';
}

// ── EXTENSION BRIDGE ─────────────────────────────────────────
function getExtData() {
  const raw = localStorage.getItem('piggy_ext_bridge');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDash() {
  const extData = getExtData();
  const today   = todayKey();
  let totalSec  = 0;
  let entries   = [];
  let hasExt    = false;

  if (extData && extData[today]) {
    hasExt   = true;
    entries  = Object.entries(extData[today]).sort((a, b) => b[1] - a[1]);
    totalSec = entries.reduce((s, [, v]) => s + v, 0);

    const user = auth.currentUser;
    if (user) {
      const decay = decayFrom(totalSec);
      setDoc(doc(db, 'users', user.uid, 'history', today), {
        date: today, totalSec, sites: entries.length,
        decay: Math.round(decay * 100) / 100,
        topSites: entries.slice(0, 5).map(([d, s]) => ({ domain: d, seconds: s }))
      }).catch(() => {});
    }
  }

  const decay = decayFrom(totalSec);
  applyPig(decay);
  updateRing(decay);

  document.getElementById('total-val').textContent     = fmtTime(totalSec);
  document.getElementById('total-sub').textContent     = `across ${entries.length} site${entries.length !== 1 ? 's' : ''}`;
  document.getElementById('ext-banner').style.display  = hasExt ? 'none' : 'block';

  const sl   = document.getElementById('sites-label');
  const sc   = document.getElementById('sites-card');
  const top5 = entries.slice(0, 5);

  if (top5.length > 0) {
    if (sl) sl.style.display = 'block';
    if (sc) {
      sc.style.display = 'block';
      sc.innerHTML = top5.map(([domain, sec]) => {
        const pct    = Math.round(sec / totalSec * 100);
        const barPct = Math.round(sec / entries[0][1] * 100);
        return `<div class="site-row">
          <div class="site-fav"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none'" alt=""/></div>
          <div class="site-name">${domain}</div>
          <div class="site-bar-col"><div class="site-bar-bg"><div class="site-bar-fill" style="width:${barPct}%;background:${barColor(decay)}"></div></div></div>
          <div class="site-time">${fmtTime(sec)}</div>
          <div class="site-pct">${pct}%</div>
        </div>`;
      }).join('');
    }
  } else {
    if (sl) sl.style.display = 'none';
    if (sc) sc.style.display = 'none';
  }

  renderChart();
}

// ── CHART ─────────────────────────────────────────────────────
async function renderChart() {
  const bars = document.getElementById('chart-bars');
  if (!bars) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snap = await getDocs(collection(db, 'users', user.uid, 'history'));
    const all  = [];
    snap.forEach(d => all.push(d.data()));
    all.sort((a, b) => a.date.localeCompare(b.date));
    const last7  = all.slice(-7);
    const maxSec = Math.max(...last7.map(e => e.totalSec), 1);
    const days   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    if (last7.length === 0) {
      bars.innerHTML = '<div style="color:#555;font-size:12px;width:100%;text-align:center">No data yet</div>';
      return;
    }

    bars.innerHTML = last7.map(e => {
      const d = new Date(e.date);
      const h = Math.round((e.totalSec / maxSec) * 72) + 4;
      return `<div class="chart-col">
        <div class="chart-bar" style="background:${barColor(e.decay)};height:${h}px"></div>
        <div class="chart-day">${days[d.getDay()]}</div>
      </div>`;
    }).join('');
  } catch {
    bars.innerHTML = '<div style="color:#555;font-size:12px;width:100%;text-align:center">No data yet</div>';
  }
}

// ── HISTORY ───────────────────────────────────────────────────
async function renderHistory() {
  const list = document.getElementById('hist-list');
  if (!list) return;
  const user = auth.currentUser;
  if (!user) return;

  list.innerHTML = '<div style="color:#555;font-size:13px;text-align:center;padding:2rem">Loading...</div>';

  try {
    const snap    = await getDocs(collection(db, 'users', user.uid, 'history'));
    const entries = [];
    snap.forEach(d => entries.push(d.data()));
    entries.sort((a, b) => b.date.localeCompare(a.date));

    if (entries.length === 0) {
      list.innerHTML = '<div style="color:#555;font-size:14px;text-align:center;padding:2rem">No days logged yet.<br/>Install the extension to start tracking.</div>';
      return;
    }

    const stages = ['happy','tired','sad','broken','💀'];
    list.innerHTML = entries.map(e => {
      const stage = Math.min(Math.floor(e.decay * 5), 4);
      const cls   = e.decay < 0.33 ? 'score-ok' : e.decay < 0.66 ? 'score-bad' : 'score-rip';
      return `<div class="hist-entry">
        ${miniPigSVG(e.decay)}
        <div class="hist-info">
          <div class="hist-date">${e.date}</div>
          <div class="hist-vals">${fmtTime(e.totalSec)} across ${e.sites} sites</div>
        </div>
        <div class="hist-score ${cls}">${stages[stage]}</div>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<div style="color:#555;font-size:13px;text-align:center;padding:2rem">Failed to load history.</div>';
  }
}

function miniPigSVG(decay) {
  const r = Math.round(244 - decay * 64), g = Math.round(160 - decay * 60), b = Math.round(181 - decay * 71);
  const col = `rgb(${r},${g},${b})`;
  const m   = decay < 0.25 ? 'M19 20 Q23 23 27 20' : decay < 0.55 ? 'M19 21 Q23 21 27 21' : 'M19 23 Q23 20 27 23';
  return `<svg viewBox="0 0 46 40" width="44" height="38" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <ellipse cx="23" cy="30" rx="17" ry="10" fill="${col}"/>
    <ellipse cx="23" cy="19" rx="12" ry="11" fill="${col}"/>
    <ellipse cx="14" cy="11" rx="5" ry="4" fill="${col}"/>
    <ellipse cx="32" cy="11" rx="5" ry="4" fill="${col}"/>
    <ellipse cx="23" cy="24" rx="6" ry="4" fill="#F4C5D3"/>
    <circle cx="20" cy="16" r="2.5" fill="white"/><circle cx="20" cy="16" r="1.2" fill="#2A1A1F"/>
    <circle cx="26" cy="16" r="2.5" fill="white"/><circle cx="26" cy="16" r="1.2" fill="#2A1A1F"/>
    <path d="${m}" stroke="#D47090" stroke-width="1" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// ── EVENT LISTENERS ───────────────────────────────────────────
document.getElementById('landing-signup-btn').addEventListener('click', showSignup);
document.getElementById('landing-login-btn').addEventListener('click', showSignin);
document.getElementById('go-login').addEventListener('click', showSignin);
document.getElementById('go-signup').addEventListener('click', showSignup);
document.getElementById('auth-back').addEventListener('click', () => showScreen('landing'));
document.getElementById('signup-btn').addEventListener('click', handleSignup);
document.getElementById('signin-btn').addEventListener('click', handleSignin);
document.getElementById('logout-btn').addEventListener('click', handleSignout);
document.getElementById('hist-logout-btn').addEventListener('click', handleSignout);

document.getElementById('bnav-today').addEventListener('click', () => {
  showScreen('dashboard');
  document.querySelectorAll('#dashboard .bnav').forEach(b => b.classList.remove('active'));
  document.getElementById('bnav-today').classList.add('active');
});
document.getElementById('bnav-history').addEventListener('click', () => showScreen('history'));
document.getElementById('bnav-today-2').addEventListener('click', () => showScreen('dashboard'));
document.getElementById('bnav-history-2').addEventListener('click', () => {
  showScreen('history');
  document.querySelectorAll('#history .bnav').forEach(b => b.classList.remove('active'));
  document.getElementById('bnav-history-2').classList.add('active');
});

// Auto-refresh every 30s
setInterval(() => {
  if (document.getElementById('dashboard').classList.contains('active')) renderDash();
}, 30000);