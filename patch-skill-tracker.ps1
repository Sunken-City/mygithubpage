param(
  [string]$Target = "apps/skill-tracker"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  Ensure-Dir (Split-Path $Path -Parent)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$root = (Get-Location).Path
$dir = Join-Path $root $Target
if (-not (Test-Path $dir)) {
  throw "Target folder not found: $Target"
}

$vendorDir  = Join-Path $dir "vendor"
$profileDir = Join-Path $dir "profile"
$avatarDir  = Join-Path $profileDir "avatars"
Ensure-Dir $vendorDir
Ensure-Dir $avatarDir

# Backup existing core files
$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$backupDir = Join-Path $dir ("_backup_" + $stamp)
Ensure-Dir $backupDir
$toBackup = @("index.html","app.js","app.css","sw.js","manifest.webmanifest","icon.svg")
foreach ($f in $toBackup) {
  $p = Join-Path $dir $f
  if (Test-Path $p) { Copy-Item $p (Join-Path $backupDir $f) -Force }
}

# pako fallback (gzip) - keep as-is if already there
$pakoPath = Join-Path $vendorDir "pako.min.js"
if (-not (Test-Path $pakoPath)) {
  try {
    Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js" -OutFile $pakoPath -UseBasicParsing | Out-Null
  } catch {
    Write-Utf8NoBom $pakoPath "/* pako download failed; sync code fallback unavailable. */"
  }
}

# Profile avatar list + default placeholder
$avatarsJson = Join-Path $profileDir "avatars.json"
if (-not (Test-Path $avatarsJson)) {
  Write-Utf8NoBom $avatarsJson @'
{
  "files": [
    "default.svg"
  ]
}
'@
}

$defaultAvatar = Join-Path $avatarDir "default.svg"
if (-not (Test-Path $defaultAvatar)) {
  Write-Utf8NoBom $defaultAvatar @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="#0b0f19"/>
  <circle cx="128" cy="118" r="54" fill="url(#g)"/>
  <rect x="54" y="160" width="148" height="60" rx="30" fill="url(#g)"/>
  <text x="128" y="128" text-anchor="middle" font-size="44" font-family="system-ui,Segoe UI,Arial" fill="#04160a" font-weight="900">P</text>
</svg>
'@
}

# icon.svg (no emoji to avoid encoding issues)
Write-Utf8NoBom (Join-Path $dir "icon.svg") @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#0b0f19"/>
  <rect x="52" y="52" width="152" height="152" rx="40" fill="#22c55e"/>
  <text x="128" y="152" text-anchor="middle" font-size="84" font-family="system-ui,Segoe UI,Arial" fill="#04160a" font-weight="900">XP</text>
</svg>
'@

# manifest (scope stays folder-local)
Write-Utf8NoBom (Join-Path $dir "manifest.webmanifest") @'
{
  "name": "Skill Tracker",
  "short_name": "Skills",
  "description": "Offline skill tracker (zero-backend).",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0b0f19",
  "theme_color": "#0b0f19",
  "icons": [
    { "src": "./icon.svg", "sizes": "256x256", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
'@

# app.css (add avatar styles; keep everything ASCII)
Write-Utf8NoBom (Join-Path $dir "app.css") @'
:root{
  --bg:#f6f7fb; --panel:#ffffff; --text:#0f172a; --muted:#475569; --border:rgba(15,23,42,.12);
  --shadow:0 10px 28px rgba(2,6,23,.08);
  --brand:#22c55e; --danger:#ef4444; --warn:#f59e0b;

  --r:16px; --pad:14px; --tap:48px; --navH:70px;
  color-scheme: light;
}
:root[data-theme="dark"]{
  --bg:#070a12; --panel:#0b1222; --text:#e5e7eb; --muted:#9aa4b2; --border:rgba(226,232,240,.12);
  --shadow:0 10px 30px rgba(0,0,0,.35);
  --brand:#3ddc84;
  color-scheme: dark;
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;
  background:var(--bg); color:var(--text);
}

button,input,select,textarea{font:inherit}
button{
  min-height:var(--tap);
  padding:10px 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:color-mix(in srgb, var(--panel) 88%, var(--bg));
  color:var(--text);
  font-weight:800;
  cursor:pointer;
}
button:active{transform:translateY(1px)}
button[disabled]{opacity:.55; cursor:not-allowed; transform:none}

.btn-primary{
  background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 80%, white), var(--brand));
  border-color:color-mix(in srgb, var(--brand) 55%, var(--border));
  color:#03120a;
}
.btn-danger{
  background:color-mix(in srgb, var(--danger) 18%, var(--panel));
  border-color:color-mix(in srgb, var(--danger) 35%, var(--border));
}
.iconbtn{width:var(--tap); min-width:var(--tap); padding:0; display:grid; place-items:center}

.input, select, textarea{
  width:100%;
  min-height:var(--tap);
  border-radius:14px;
  border:1px solid var(--border);
  background:var(--panel);
  color:var(--text);
  padding:10px 12px;
  outline:none;
}
textarea{min-height:110px; resize:vertical}

.shell{min-height:100vh; display:flex; flex-direction:column}
.header{
  position:sticky; top:0; z-index:10;
  background:color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);
  padding:10px 14px;
  display:flex; justify-content:space-between; align-items:center; gap:10px;
}

.brand{display:flex; align-items:center; gap:10px; user-select:none; cursor:pointer}
.brandStack{display:flex; flex-direction:column; line-height:1.1}
.brandName{font-weight:950; letter-spacing:.2px}
.brandSub{font-size:12px; color:var(--muted); font-weight:800}

.avatar{
  width:40px; height:40px;
  border-radius:14px;
  overflow:hidden;
  border:1px solid var(--border);
  background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 70%, white), var(--brand));
  box-shadow:var(--shadow);
  flex:0 0 auto;
}
.avatar img{width:100%; height:100%; object-fit:cover; display:block}

.chip{
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 10px;
  border:1px solid var(--border);
  border-radius:999px;
  background:color-mix(in srgb, var(--panel) 85%, var(--bg));
  color:var(--muted);
  font-size:12px;
  white-space:nowrap;
}

.main{
  width:min(980px, 100%);
  margin:0 auto;
  padding:14px 14px calc(var(--navH) + 90px);
}

.card{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:var(--r);
  padding:var(--pad);
  box-shadow:var(--shadow);
}
.stack{display:flex; flex-direction:column; gap:10px}
.row{display:flex; align-items:center; justify-content:space-between; gap:10px}
.grid{display:grid; gap:12px}
.grid2{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(min-width:740px){ .grid3{grid-template-columns:repeat(3,minmax(0,1fr))} }

.h1{font-size:22px; font-weight:950; margin:0}
.h2{font-size:16px; font-weight:900; margin:0}
.p{margin:0; color:var(--muted)}
.small{font-size:12px; color:var(--muted)}
.hr{height:1px; background:var(--border); margin:6px 0}

.progress{
  height:10px; border-radius:999px;
  background:color-mix(in srgb, var(--bg) 50%, var(--panel));
  border:1px solid var(--border);
  overflow:hidden;
}
.progress > div{
  height:100%;
  width:var(--w,0%);
  background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 70%, white), var(--brand));
}

.nav{
  position:fixed; left:0; right:0; bottom:0;
  height:var(--navH);
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:6px;
  padding:8px 10px max(8px, env(safe-area-inset-bottom));
  background:color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter:blur(12px);
  border-top:1px solid var(--border);
  z-index:30;
}
.navBtn{
  border:1px solid transparent;
  border-radius:16px;
  background:transparent;
  display:flex; flex-direction:column;
  justify-content:center; align-items:center;
  gap:4px;
  min-height:52px;
  color:var(--muted);
}
.navBtn.active{
  background:color-mix(in srgb, var(--panel) 78%, var(--bg));
  border-color:var(--border);
  color:var(--text);
}
.navEmoji{font-size:18px}
.navLabel{font-size:11px; font-weight:900}

.fab{
  position:fixed;
  right:16px;
  bottom:calc(var(--navH) + 14px);
  z-index:31;
  width:60px; height:60px;
  border-radius:20px;
  border:1px solid color-mix(in srgb, var(--brand) 45%, var(--border));
  background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 80%, white), var(--brand));
  color:#03120a; font-size:28px; font-weight:950;
  box-shadow:var(--shadow);
}

.toastHost{
  position:fixed;
  top:10px; left:50%;
  transform:translateX(-50%);
  width:min(560px, calc(100% - 22px));
  display:flex; flex-direction:column; gap:10px;
  z-index:60;
  pointer-events:none;
}
.toast{
  pointer-events:none;
  border-radius:18px;
  border:1px solid var(--border);
  background:color-mix(in srgb, var(--panel) 88%, var(--bg));
  box-shadow:var(--shadow);
  padding:12px 14px;
}
.toastTitle{font-weight:950; margin:0 0 2px}
.toastMsg{margin:0; color:var(--muted); font-weight:750}

.modalOverlay{
  position:fixed; inset:0;
  background:rgba(0,0,0,.45);
  display:grid; place-items:end center;
  padding:16px;
  z-index:80;
}
.modal{
  width:min(720px, 100%);
  background:var(--panel);
  border-radius:22px;
  border:1px solid var(--border);
  box-shadow:var(--shadow);
  overflow:hidden;
}
.modalHead{
  padding:14px 14px 8px;
  border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; gap:10px;
}
.modalTitle{font-weight:950; font-size:16px; margin:0}
.modalBody{padding:14px}
.modalActions{
  padding:14px;
  border-top:1px solid var(--border);
  display:flex; gap:10px;
  justify-content:flex-end;
}
'@

# sw.js (precache avatars.json + default avatar)
Write-Utf8NoBom (Join-Path $dir "sw.js") @'
const CACHE = "skill-tracker-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/pako.min.js",
  "./profile/avatars.json",
  "./profile/avatars/default.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch {
      return caches.match("./");
    }
  })());
});
'@

# app.js (ASCII-only; emojis are runtime escapes; triangular leveling; Pico profile + random avatar; mojibake repair)
Write-Utf8NoBom (Join-Path $dir "app.js") @'
(() => {
  const STORAGE_KEY = "skill_tracker_save_v2";
  const MAX_LOG = 5000;

  const EM = {
    home: "\u{1F3E0}",
    scroll: "\u{1F4DC}",
    bolt: "\u{26A1}",
    clock: "\u{1F552}",
    gear: "\u{2699}",
    star: "\u{2B50}",
    plus: "\u{2795}",
    x: "\u{2715}",
    up: "\u{2B06}",
    down: "\u{2B07}",
    trophy: "\u{1F3C6}"
  };

  const $ = (sel, el=document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const now = () => Date.now();
  const fmtInt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n)||0);
  const fmtXp = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n)||0);
  const createId = () => (crypto?.randomUUID?.() ?? ("id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16)));

  function looksMojibake(s) {
    if (typeof s !== "string") return false;
    return s.includes("Ã") || s.includes("â") || s.includes("ð") || s.includes("Ÿ");
  }
  function fixMojibake(s) {
    if (typeof s !== "string") return s;
    if (!looksMojibake(s)) return s;
    try {
      const bytes = new Uint8Array(s.length);
      for (let i=0;i<s.length;i++) bytes[i] = s.charCodeAt(i) & 0xFF;
      const out = new TextDecoder("utf-8", { fatal:false }).decode(bytes);
      return out || s;
    } catch {
      return s;
    }
  }

  // Leveling: triangular XP.
  // Total XP required to reach Level L is L*(L+1)/2.
  // So Level 81 -> 82 costs 82 XP.
  function xpForLevel(L) {
    const n = Math.max(0, Math.floor(Number(L)||0));
    return (n * (n + 1)) / 2;
  }
  function levelFromXp(xp) {
    const x = Math.max(0, Number(xp)||0);
    return Math.floor((Math.sqrt(8*x + 1) - 1) / 2);
  }
  function xpToNext(xp) {
    const x = Math.max(0, Number(xp)||0);
    const L = levelFromXp(x);
    return Math.max(0, xpForLevel(L + 1) - x);
  }
  function levelProgress01(xp) {
    const x = Math.max(0, Number(xp)||0);
    const L = levelFromXp(x);
    const start = xpForLevel(L);
    const span = (L + 1);
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, (x - start) / span));
  }

  function defaultSave() {
    const t = now();
    const skills = [
      { name:"Upper Front Strength", icon:"\u{1F4AA}", color:"#f97316" },
      { name:"Upper Back Strength",  icon:"\u{1F9F1}", color:"#60a5fa" },
      { name:"Lower Front Strength", icon:"\u{1F9B5}", color:"#22c55e" },
      { name:"Lower Back Strength",  icon:"\u{1F3CB}\u{FE0F}", color:"#a78bfa" },
      { name:"Walking",              icon:"\u{1F6B6}", color:"#38bdf8" },
      { name:"Nutrition",            icon:"\u{1F957}", color:"#84cc16" },
      { name:"Portion Control",      icon:"\u{1F37D}\u{FE0F}", color:"#f59e0b" },
      { name:"Sleep",                icon:"\u{1F634}", color:"#94a3b8" },
      { name:"Mobility",             icon:"\u{1F9D8}", color:"#fb7185" },
      { name:"Hydration",            icon:"\u{1F4A7}", color:"#0ea5e9" }
    ].map((s, i) => ({
      id: createId(),
      name: s.name,
      icon: s.icon,
      color: s.color,
      xp: 0,
      createdAt: t,
      updatedAt: t,
      archived: false,
      order: i
    }));

    return {
      version: 2,
      createdAt: t,
      updatedAt: t,
      meta: { lastSavedAt: t, lastBackupAt: null },
      skills,
      actions: [],
      log: [],
      settings: {
        theme: "system",
        haptics: false,
        sound: false,
        defaultXpButtons: [1,5,10],
        backupReminder: true,
        profile: {
          name: "Pico",
          avatar: ""  // picked from ./profile/avatars.json
        }
      }
    };
  }

  function sanitizeSave(obj) {
    if (!obj || typeof obj !== "object") return defaultSave();
    const base = defaultSave();
    const t = now();

    const settingsIn = (obj.settings && typeof obj.settings === "object") ? obj.settings : {};
    const profileIn = (settingsIn.profile && typeof settingsIn.profile === "object") ? settingsIn.profile : {};
    const settings = {
      ...base.settings,
      ...settingsIn,
      profile: {
        ...base.settings.profile,
        ...profileIn,
        name: fixMojibake(String(profileIn.name ?? settingsIn.profile?.name ?? base.settings.profile.name)),
        avatar: String(profileIn.avatar ?? settingsIn.profile?.avatar ?? "")
      }
    };

    const skillsIn = Array.isArray(obj.skills) ? obj.skills : base.skills;
    const actionsIn = Array.isArray(obj.actions) ? obj.actions : [];
    const logIn = Array.isArray(obj.log) ? obj.log : [];

    const skills = skillsIn.map((x, idx) => ({
      id: String(x.id || createId()),
      name: fixMojibake(String(x.name || "Skill")),
      icon: fixMojibake(String(x.icon || EM.star)),
      color: x.color ? String(x.color) : null,
      xp: Math.max(0, Number(x.xp) || 0),
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || t,
      archived: !!x.archived,
      order: Number.isFinite(Number(x.order)) ? Number(x.order) : idx
    })).sort((p,q)=>p.order-q.order).map((x,i)=>({ ...x, order:i }));

    const actions = actionsIn.map((x) => ({
      id: String(x.id || createId()),
      name: fixMojibake(String(x.name || "Action")),
      icon: fixMojibake(x.icon ? String(x.icon) : ""),
      grants: Array.isArray(x.grants) ? x.grants.map(g => ({
        skillId: String(g.skillId || ""),
        amount: Number(g.amount) || 0
      })).filter(g => g.skillId && g.amount !== 0) : [],
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || t
    }));

    const log = logIn.map((e) => ({
      id: String(e.id || createId()),
      timestamp: Number(e.timestamp) || t,
      type: e.type === "action" ? "action" : "skill_xp",
      skillId: e.skillId ? String(e.skillId) : null,
      actionId: e.actionId ? String(e.actionId) : null,
      deltas: Array.isArray(e.deltas) ? e.deltas.map(d => ({
        skillId: String(d.skillId || ""),
        delta: Number(d.delta) || 0
      })).filter(d => d.skillId && d.delta !== 0) : [],
      note: e.note ? fixMojibake(String(e.note)) : null,
      revertedAt: e.revertedAt ? Number(e.revertedAt) : null
    }));

    const metaIn = (obj.meta && typeof obj.meta === "object") ? obj.meta : {};
    const meta = { ...base.meta, ...metaIn };

    return {
      version: 2,
      createdAt: Number(obj.createdAt) || base.createdAt,
      updatedAt: Number(obj.updatedAt) || t,
      meta,
      skills,
      actions,
      log: log.slice(-MAX_LOG),
      settings
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("skill_tracker_save_v1");
      if (!raw) return null;
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  let state = load() || defaultSave();
  let saveTimer = null;

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }, 120);
  }

  function setTheme(theme) {
    const root = document.documentElement;
    const pref = theme || "system";
    const systemDark = matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    const dark = pref === "dark" || (pref === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
  }

  function toast(title, message) {
    const host = $(".toastHost");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<p class="toastTitle">${esc(title)}</p><p class="toastMsg">${esc(message)}</p>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function haptic(ms=10) {
    if (!state.settings.haptics) return;
    try { navigator.vibrate?.(ms); } catch {}
  }
  function beep(freq=520, dur=70) {
    if (!state.settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur/1000);
      setTimeout(() => ctx.close().catch(()=>{}), dur + 50);
    } catch {}
  }
  function tick() { haptic(10); beep(520, 60); }
  function levelUp() { haptic(20); beep(880, 100); }

  function commit(mutator) {
    const beforeLevels = new Map(state.skills.map(s => [s.id, levelFromXp(s.xp)]));
    mutator();
    const t = now();
    state.updatedAt = t;
    state.meta.lastSavedAt = t;
    scheduleSave();

    for (const s of state.skills) {
      const prev = beforeLevels.get(s.id) ?? 0;
      const cur = levelFromXp(s.xp);
      if (cur > prev) {
        toast("Level up!", `${s.icon ? s.icon + " " : ""}${s.name} -> Level ${cur}`);
        levelUp();
      }
    }
    render();
  }

  function appendLog(entry) {
    state.log.push(entry);
    if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
  }

  function addXp(skillId, amount, note=null) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) return;
    const s = state.skills.find(x => x.id === skillId);
    if (!s) return;

    commit(() => {
      s.xp = Math.max(0, (Number(s.xp)||0) + amt);
      s.updatedAt = now();
      appendLog({
        id: createId(),
        timestamp: now(),
        type: "skill_xp",
        skillId,
        actionId: null,
        deltas: [{ skillId, delta: amt }],
        note,
        revertedAt: null
      });
    });
    tick();
  }

  function runAction(actionId) {
    const a = state.actions.find(x => x.id === actionId);
    if (!a) return;
    const deltas = [];
    commit(() => {
      for (const g of a.grants) {
        const s = state.skills.find(x => x.id === g.skillId);
        if (!s) continue;
        const amt = Number(g.amount)||0;
        if (amt === 0) continue;
        s.xp = Math.max(0, (Number(s.xp)||0) + amt);
        s.updatedAt = now();
        deltas.push({ skillId: s.id, delta: amt });
      }
      if (deltas.length) {
        appendLog({
          id: createId(),
          timestamp: now(),
          type: "action",
          skillId: null,
          actionId: a.id,
          deltas,
          note: null,
          revertedAt: null
        });
      }
    });
    if (deltas.length) tick();
  }

  function undoEvent(eventId) {
    const e = state.log.find(x => x.id === eventId);
    if (!e || e.revertedAt) return;
    commit(() => {
      for (const d of e.deltas) {
        const s = state.skills.find(x => x.id === d.skillId);
        if (!s) continue;
        s.xp = Math.max(0, (Number(s.xp)||0) - (Number(d.delta)||0));
        s.updatedAt = now();
      }
      e.revertedAt = now();
    });
    tick();
  }

  // gzip + base64url
  function bytesToB64Url(bytes) {
    let bin = "";
    const chunk = 0x8000;
    for (let i=0;i<bytes.length;i+=chunk) bin += String.fromCharCode(...bytes.subarray(i,i+chunk));
    return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function b64UrlToBytes(b64url) {
    const b64 = b64url.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((b64url.length+3)%4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  async function gzipString(str) {
    if ("CompressionStream" in window) {
      const cs = new CompressionStream("gzip");
      const stream = new Blob([str]).stream().pipeThrough(cs);
      const ab = await new Response(stream).arrayBuffer();
      return new Uint8Array(ab);
    }
    if (window.pako?.gzip) return window.pako.gzip(str);
    throw new Error("No gzip support.");
  }
  async function ungzipToString(bytes) {
    if ("DecompressionStream" in window) {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    if (window.pako?.ungzip) return window.pako.ungzip(bytes, { to: "string" });
    throw new Error("No ungzip support.");
  }
  async function makeSyncCode(obj) {
    const json = JSON.stringify(obj);
    const gz = await gzipString(json);
    return bytesToB64Url(gz);
  }
  async function decodeSyncCode(code) {
    const bytes = b64UrlToBytes(code.trim());
    const json = await ungzipToString(bytes);
    return sanitizeSave(JSON.parse(json));
  }

  function route() {
    const h = location.hash || "#/home";
    if (h.startsWith("#save=")) return { page: "save", code: decodeURIComponent(h.slice(6)) };
    const cleaned = h.startsWith("#/") ? h.slice(2) : "home";
    const parts = cleaned.split("/").filter(Boolean);
    const page = parts[0] || "home";
    if (page === "skill") return { page:"skill", id: parts[1] || "" };
    if (page === "action") return { page:"action", id: parts[1] || "" };
    if (["home","skills","actions","log","settings"].includes(page)) return { page };
    return { page:"home" };
  }
  function nav(to) { location.hash = "#/" + to; }

  function modal(title, bodyHtml, actions) {
    const existing = $("#modal");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "modal";
    el.className = "modalOverlay";
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modalHead">
          <h3 class="modalTitle">${esc(title)}</h3>
          <button class="iconbtn" data-modal-close aria-label="Close">${EM.x}</button>
        </div>
        <div class="modalBody">${bodyHtml}</div>
        <div class="modalActions">
          ${actions.map((a,i)=>`<button data-modal-act="${i}" class="${a.primary?"btn-primary":""} ${a.danger?"btn-danger":""}">${esc(a.label)}</button>`).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-modal-close]")) el.remove();
      const act = e.target.closest("[data-modal-act]");
      if (act) {
        const idx = Number(act.getAttribute("data-modal-act"));
        actions[idx]?.onClick?.(() => el.remove());
      }
    });
    window.addEventListener("keydown", function onKey(ev){
      if (ev.key === "Escape") { el.remove(); window.removeEventListener("keydown", onKey); }
    });
  }

  function skillCard(s) {
    const L = levelFromXp(s.xp);
    const pct = Math.round(levelProgress01(s.xp)*100);
    return `
      <div class="card" style="${s.color?`border-color:${esc(s.color)}55`:``}">
        <div class="row">
          <div class="row" style="justify-content:flex-start; gap:10px">
            <div class="avatar" style="${s.color?`background:${esc(s.color)}`:``}; width:40px; height:40px; border-radius:14px; display:grid; place-items:center; box-shadow:none">
              <span style="font-size:18px">${esc(s.icon||EM.star)}</span>
            </div>
            <div class="stack" style="gap:2px">
              <div class="h2">${esc(s.name)}</div>
              <div class="small">Level ${fmtInt(L)} | XP ${fmtXp(s.xp)}</div>
            </div>
          </div>
          <button data-open-skill="${esc(s.id)}">Open</button>
        </div>

        <div class="stack" style="margin-top:10px">
          <div class="progress"><div style="--w:${pct}%"></div></div>
          <div class="row">
            <span class="small">To next: ${fmtXp(xpToNext(s.xp))}</span>
            <span class="small">Next: ${fmtInt(L+1)}</span>
          </div>

          <div class="grid grid2" style="margin-top:6px">
            <button class="btn-primary" data-add-xp="${esc(s.id)}" data-amt="1">+1 XP</button>
            <button data-add-xp="${esc(s.id)}" data-amt="5">+5</button>
            <button data-add-xp="${esc(s.id)}" data-amt="10">+10</button>
            <div class="row" style="gap:8px">
              <input class="input" inputmode="decimal" placeholder="Custom" data-custom-xp="${esc(s.id)}" />
              <button data-add-custom="${esc(s.id)}">Add</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function homeView() {
    const skills = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
    const totalXp = skills.reduce((sum,s)=>sum+(Number(s.xp)||0),0);
    const totalLevel = skills.reduce((sum,s)=>sum+levelFromXp(s.xp),0);

    const reminder = (() => {
      if (!state.settings.backupReminder) return "";
      const last = state.meta.lastBackupAt;
      if (!last) return `<div class="card" style="border-color:color-mix(in srgb, var(--warn) 55%, var(--border)); box-shadow:none">
        <div class="row"><div class="stack" style="gap:4px">
          <div class="h2">Backup reminder</div>
          <div class="small">You haven't backed up yet. Export JSON or generate a sync code.</div>
        </div>
        <button class="btn-primary" data-nav="settings">Backup</button></div>
      </div>`;
      const days = Math.floor((Date.now()-last)/(1000*60*60*24));
      if (days < 7) return "";
      return `<div class="card" style="border-color:color-mix(in srgb, var(--warn) 55%, var(--border)); box-shadow:none">
        <div class="row"><div class="stack" style="gap:4px">
          <div class="h2">Backup reminder</div>
          <div class="small">It has been ${days} days since your last backup.</div>
        </div>
        <button class="btn-primary" data-nav="settings">Backup</button></div>
      </div>`;
    })();

    const qa = state.actions.slice(0, 6);

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:6px">
              <h1 class="h1">${esc(state.settings.profile.name)}'s Dashboard</h1>
              <p class="p">Tap skills for quick XP. Use Actions for multi-skill gains.</p>
            </div>
            <button data-nav="settings">Settings</button>
          </div>

          <div class="grid grid2" style="margin-top:12px">
            <div class="card" style="box-shadow:none">
              <div class="row"><div class="small">Total Level</div><div style="font-weight:950">${fmtInt(totalLevel)}</div></div>
              <div class="row"><div class="small">Total XP</div><div style="font-weight:950">${fmtXp(totalXp)}</div></div>
            </div>
            <div class="card" style="box-shadow:none">
              <div class="row"><div class="small">Active skills</div><div style="font-weight:950">${fmtInt(skills.length)}</div></div>
              <div class="row"><div class="small">Actions</div><div style="font-weight:950">${fmtInt(state.actions.length)}</div></div>
            </div>
          </div>
        </div>

        ${reminder}

        <div class="card">
          <div class="row">
            <h2 class="h2">Quick Actions</h2>
            <button data-nav="actions">Manage</button>
          </div>
          ${qa.length === 0 ? `<p class="small" style="margin-top:10px">Create an action like "Gym session" -> +10 Strength, +5 Walking.</p>` : `
            <div class="stack" style="margin-top:10px">
              ${qa.map(a => `
                <div class="card" style="box-shadow:none">
                  <div class="row">
                    <div class="stack" style="gap:2px">
                      <div class="h2">${esc((a.icon && a.icon.trim()) ? a.icon : EM.bolt)} ${esc(a.name)}</div>
                      <div class="small">${a.grants.slice(0,3).map(g=>{
                        const sn = state.skills.find(s=>s.id===g.skillId)?.name ?? "Unknown";
                        return `${esc(sn)} +${fmtXp(g.amount)}`;
                      }).join(" | ")}${a.grants.length>3?" | ...":""}</div>
                    </div>
                    <button class="btn-primary" data-run-action="${esc(a.id)}">Run</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <div class="row">
          <h2 class="h2">Skills</h2>
          <button data-nav="skills">All Skills</button>
        </div>

        <div class="grid grid2 grid3">
          ${skills.map(s => skillCard(s)).join("")}
        </div>
      </div>
    `;
  }

  function skillsView() {
    const active = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
    const archived = state.skills.filter(s=>s.archived).sort((a,b)=>a.order-b.order);

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">Skills</h1>
              <p class="p">Search, reorder, archive. Tap a skill to edit details.</p>
            </div>
            <button class="btn-primary" data-add-skill>${EM.plus} Skill</button>
          </div>
          <div class="row" style="margin-top:10px; gap:10px">
            <input class="input" placeholder="Search..." data-skill-search />
            <button data-toggle-reorder>Reorder</button>
          </div>
          <p class="small" style="margin:8px 0 0">Desktop: drag cards when reorder is on. Mobile: use up/down.</p>
        </div>

        <div id="skillsList" class="grid grid2 grid3">
          ${active.map(s => `<div class="skillWrap" draggable="false" data-skill-wrap="${esc(s.id)}">${skillCard(s)}</div>`).join("")}
        </div>

        ${archived.length ? `
          <div class="stack" style="margin-top:12px">
            <h2 class="h2">Archived</h2>
            <div class="grid grid2 grid3">
              ${archived.map(s => skillCard(s)).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  function skillDetailView(id) {
    const s = state.skills.find(x=>x.id===id);
    if (!s) return `<div class="card"><h1 class="h1">Skill not found</h1><button data-nav="skills">Back</button></div>`;

    const L = levelFromXp(s.xp);
    const pct = Math.round(levelProgress01(s.xp)*100);
    const recent = [...state.log].slice().reverse().filter(e => !e.revertedAt && e.deltas.some(d=>d.skillId===id)).slice(0, 12);

    return `
      <div class="stack">
        <div class="card" style="${s.color?`border-color:${esc(s.color)}55`:``}">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">${esc(s.icon||EM.star)} ${esc(s.name)}</h1>
              <div class="row" style="justify-content:flex-start; flex-wrap:wrap; gap:8px">
                <span class="chip">Level ${fmtInt(L)}</span>
                <span class="chip">XP ${fmtXp(s.xp)}</span>
                <span class="chip">To next ${fmtXp(xpToNext(s.xp))}</span>
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button data-edit-skill="${esc(s.id)}">Edit</button>
              <button data-nav="skills">Back</button>
            </div>
          </div>

          <div class="stack" style="margin-top:10px">
            <div class="progress"><div style="--w:${pct}%"></div></div>
            <div class="row">
              <span class="small">Next: ${fmtInt(L+1)}</span>
              <span class="small">${pct}%</span>
            </div>
          </div>

          <div class="grid grid2" style="margin-top:12px">
            <button class="btn-primary" data-add-xp="${esc(s.id)}" data-amt="1">+1 XP</button>
            <button data-add-xp="${esc(s.id)}" data-amt="5">+5</button>
            <button data-add-xp="${esc(s.id)}" data-amt="10">+10</button>
            <div class="row" style="gap:8px">
              <input class="input" inputmode="decimal" placeholder="Custom XP" data-custom-xp="${esc(s.id)}" />
              <button data-add-custom="${esc(s.id)}">Add</button>
            </div>
          </div>

          <div class="row" style="margin-top:12px">
            <h2 class="h2">Recent</h2>
            <button class="btn-danger" data-undo-skill="${esc(s.id)}">Undo last</button>
          </div>

          ${recent.length === 0 ? `<p class="small" style="margin-top:10px">No recent events.</p>` : `
            <div class="stack" style="margin-top:10px">
              ${recent.map(e => {
                const d = e.deltas.find(x=>x.skillId===id);
                return `
                  <div class="card" style="box-shadow:none">
                    <div class="row">
                      <div class="stack" style="gap:2px">
                        <div class="h2">${e.type === "action" ? (EM.bolt + " Action") : (EM.star + " Skill XP")} | ${(d?.delta>=0?"+":"")}${fmtXp(d?.delta||0)}</div>
                        <div class="small">${new Date(e.timestamp).toLocaleString()}</div>
                      </div>
                      <button data-undo-event="${esc(e.id)}">Undo</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
      </div>
    `;
  }

  function actionsView() {
    const actions = [...state.actions].sort((a,b)=>b.updatedAt-a.updatedAt);
    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">Actions</h1>
              <p class="p">Reusable multi-skill XP grants. One tap to run.</p>
            </div>
            <button class="btn-primary" data-new-action>${EM.plus} Action</button>
          </div>
        </div>

        ${actions.length === 0 ? `
          <div class="card"><p class="small">Create an action like "Gym session" -> +10 Upper Front Strength, +5 Walking.</p></div>
        ` : `
          <div class="stack">
            ${actions.map(a => `
              <div class="card">
                <div class="row">
                  <div class="stack" style="gap:2px">
                    <div class="h2">${esc((a.icon && a.icon.trim()) ? a.icon : EM.bolt)} ${esc(a.name)}</div>
                    <div class="small">${a.grants.slice(0,3).map(g=>{
                      const sn = state.skills.find(s=>s.id===g.skillId)?.name ?? "Unknown";
                      return `${esc(sn)} +${fmtXp(g.amount)}`;
                    }).join(" | ")}${a.grants.length>3?" | ...":""}</div>
                  </div>
                  <div class="row" style="gap:8px">
                    <button data-open-action="${esc(a.id)}">Edit</button>
                    <button class="btn-primary" data-run-action="${esc(a.id)}">Run</button>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      </div>
    `;
  }

  // Draft action storage (session-only)
  const DRAFT_KEY = "__skill_tracker_action_draft__";
  function getDraftAction(id, existing) {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY + id);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      name: existing?.name || "",
      icon: existing?.icon || "",
      grants: (existing?.grants || []).map(g => ({ skillId:g.skillId, amount:g.amount }))
    };
  }
  function setDraftAction(id, draft) {
    try { sessionStorage.setItem(DRAFT_KEY + id, JSON.stringify(draft)); } catch {}
  }
  function clearDraftAction(id) {
    try { sessionStorage.removeItem(DRAFT_KEY + id); } catch {}
  }

  function actionDetailView(id) {
    const isNew = (id === "new");
    const a = isNew ? null : state.actions.find(x=>x.id===id);
    if (!isNew && !a) return `<div class="card"><h1 class="h1">Action not found</h1><button data-nav="actions">Back</button></div>`;

    const existing = a;
    const draft = getDraftAction(id, existing);

    const skills = state.skills.filter(s=>!s.archived).sort((p,q)=>p.order-q.order);

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">${isNew ? "New Action" : "Edit Action"}</h1>
              <p class="p">Define XP grants across one or more skills.</p>
            </div>
            <div class="row" style="gap:8px">
              ${(!isNew) ? `<button class="btn-danger" data-del-action="${esc(a.id)}">Delete</button>` : ""}
              <button data-nav="actions">Back</button>
            </div>
          </div>

          <div class="grid grid2" style="margin-top:12px">
            <div class="stack" style="gap:6px">
              <div class="small">Name</div>
              <input class="input" data-action-name value="${esc(draft.name || "")}" placeholder="Gym session" />
            </div>
            <div class="stack" style="gap:6px">
              <div class="small">Icon (optional)</div>
              <input class="input" data-action-icon value="${esc(draft.icon || "")}" placeholder="${EM.bolt}" />
            </div>
          </div>

          <div class="row" style="margin-top:12px">
            <h2 class="h2">Grants</h2>
            <button data-add-grant>Add grant</button>
          </div>

          <div id="grantList" class="stack" style="margin-top:10px">
            ${draft.grants.length === 0 ? `<p class="small">No grants yet.</p>` : draft.grants.map((g, idx) => `
              <div class="card" style="box-shadow:none">
                <div class="grid grid2" style="gap:10px">
                  <div class="stack" style="gap:6px">
                    <div class="small">Skill</div>
                    <select class="input" data-grant-skill="${idx}">
                      ${skills.map(s => `<option value="${esc(s.id)}" ${s.id===g.skillId?"selected":""}>${esc(s.icon||EM.star)} ${esc(s.name)}</option>`).join("")}
                    </select>
                  </div>
                  <div class="stack" style="gap:6px">
                    <div class="small">Amount</div>
                    <input class="input" inputmode="decimal" data-grant-amt="${idx}" value="${esc(String(g.amount))}" />
                  </div>
                </div>
                <div class="row" style="margin-top:10px">
                  <span class="small">Amounts can be negative.</span>
                  <button class="btn-danger" data-remove-grant="${idx}">Remove</button>
                </div>
              </div>
            `).join("")}
          </div>

          <div class="row" style="margin-top:12px">
            <button class="btn-primary" data-save-action="${esc(id)}">Save</button>
            ${(!isNew) ? `<button data-run-action="${esc(a.id)}">Run</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function logView() {
    const events = [...state.log].slice().reverse().slice(0, 200);
    const last = [...state.log].slice().reverse().find(e => !e.revertedAt);

    const skillName = (id) => state.skills.find(s=>s.id===id)?.name ?? "Unknown";
    const actionName = (id) => state.actions.find(a=>a.id===id)?.name ?? "Unknown action";

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">Log</h1>
              <p class="p">Recent events. Undo is always available for unreverted entries.</p>
            </div>
            <button class="${last ? "btn-danger" : ""}" ${last?"":"disabled"} data-undo-event="${esc(last?.id||"")}">Undo last</button>
          </div>
        </div>

        ${events.length === 0 ? `<div class="card"><p class="small">No events yet.</p></div>` : `
          <div class="stack">
            ${events.map(e => `
              <div class="card">
                <div class="row">
                  <div class="stack" style="gap:4px">
                    <div class="h2">
                      ${e.type === "action" ? `${EM.bolt} ${esc(actionName(e.actionId))}` : `${EM.star} ${esc(skillName(e.skillId))}`}
                      ${e.revertedAt ? `<span class="small"> (undone)</span>` : ``}
                    </div>
                    <div class="small">${new Date(e.timestamp).toLocaleString()}</div>
                    <div class="small">
                      ${e.deltas.map(d => `${esc(skillName(d.skillId))} ${(d.delta>=0?"+":"")}${fmtXp(d.delta)}`).join(" | ")}
                    </div>
                  </div>
                  ${e.revertedAt ? `` : `<button data-undo-event="${esc(e.id)}">Undo</button>`}
                </div>
              </div>
            `).join("")}
          </div>
        `}
        <p class="small">Log is capped at ${MAX_LOG} entries for localStorage reliability.</p>
      </div>
    `;
  }

  function settingsView() {
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "-";
    const lastBackup = state.meta.lastBackupAt ? new Date(state.meta.lastBackupAt).toLocaleString() : "-";

    return `
      <div class="stack">
        <div class="card">
          <h1 class="h1">Settings</h1>
          <p class="p">Backup, sync, and preferences.</p>

          <div class="grid grid2" style="margin-top:12px">
            <div class="stack" style="gap:6px">
              <div class="small">Theme</div>
              <select class="input" data-theme>
                ${["system","light","dark"].map(v => `<option value="${v}" ${state.settings.theme===v?"selected":""}>${v}</option>`).join("")}
              </select>
            </div>

            <div class="stack" style="gap:6px">
              <div class="small">Backup reminder</div>
              <select class="input" data-backup-reminder>
                <option value="on" ${state.settings.backupReminder?"selected":""}>on</option>
                <option value="off" ${!state.settings.backupReminder?"selected":""}>off</option>
              </select>
            </div>
          </div>

          <div class="grid grid2" style="margin-top:12px">
            <div class="stack" style="gap:6px">
              <div class="small">Haptics</div>
              <select class="input" data-haptics>
                <option value="off" ${!state.settings.haptics?"selected":""}>off (default)</option>
                <option value="on" ${state.settings.haptics?"selected":""}>on</option>
              </select>
            </div>

            <div class="stack" style="gap:6px">
              <div class="small">Sound</div>
              <select class="input" data-sound>
                <option value="off" ${!state.settings.sound?"selected":""}>off (default)</option>
                <option value="on" ${state.settings.sound?"selected":""}>on</option>
              </select>
            </div>
          </div>

          <div class="hr"></div>
          <div class="row" style="flex-wrap:wrap; gap:8px; justify-content:flex-start">
            <span class="chip">Last saved: ${esc(lastSaved)}</span>
            <span class="chip">Last backup: ${esc(lastBackup)}</span>
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Profile</h2>
          <p class="small">Avatar is chosen randomly from profile/avatars.json and then saved.</p>
          <div class="grid grid2" style="margin-top:12px; align-items:center">
            <div class="row" style="justify-content:flex-start; gap:12px">
              <div class="avatar" style="width:64px; height:64px; border-radius:18px">
                <img src="${esc(getAvatarUrl())}" alt="Avatar" onerror="this.src='./profile/avatars/default.svg'">
              </div>
              <div class="stack" style="gap:6px; width:100%">
                <div class="small">Name</div>
                <input class="input" data-profile-name value="${esc(state.settings.profile.name)}" />
              </div>
            </div>
            <div class="row" style="justify-content:flex-end; gap:10px">
              <button data-random-avatar>Randomize avatar</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Export / Import (JSON)</h2>
          <p class="small">Export is the most durable backup. Import replaces your current save.</p>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button class="btn-primary" data-export>Export JSON</button>
            <button data-import>Import JSON</button>
            <input type="file" accept="application/json" id="fileInput" style="display:none" />
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Sync Code + Share Link</h2>
          <p class="small">Sync Code = gzip + base64url. Share link embeds it into the URL hash.</p>

          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button class="btn-primary" data-make-sync>Generate sync code</button>
            <button data-copy-sync disabled id="copySyncBtn">Copy code</button>
          </div>

          <textarea class="input" id="syncCode" placeholder="Generate a sync code..." style="margin-top:10px"></textarea>

          <div class="hr"></div>

          <div class="row" style="gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button data-copy-link disabled id="copyLinkBtn">Copy share link</button>
          </div>
          <textarea class="input" id="shareLink" placeholder="Share link appears here..." style="margin-top:10px" readonly></textarea>

          <div class="hr"></div>

          <h2 class="h2">Import from Sync Code</h2>
          <textarea class="input" id="importCode" placeholder="Paste sync code..." style="margin-top:10px"></textarea>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button class="btn-danger" data-import-sync>Import code</button>
            <button data-clear-import>Clear</button>
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Add your avatar images</h2>
          <p class="small">
            Put square images in: ${esc("${location.pathname.split("/").slice(0,-1).join("/")}/profile/avatars/")}
            <br/>
            Then add filenames to: profile/avatars.json
          </p>
        </div>
      </div>
    `;
  }

  function navBtn(id, emoji, label, active) {
    const cls = "navBtn" + (active === id ? " active" : "");
    return `<button class="${cls}" data-nav="${id}">
      <div class="navEmoji" aria-hidden="true">${emoji}</div>
      <div class="navLabel">${label}</div>
    </button>`;
  }

  function getAvatarUrl() {
    const a = state.settings.profile.avatar || "";
    if (!a) return "./profile/avatars/default.svg";
    return "./profile/avatars/" + a;
  }

  function appShell(content, activeTab) {
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "-";
    return `
      <div class="shell">
        <div class="toastHost"></div>

        <header class="header">
          <div class="brand" data-nav="home">
            <div class="avatar" title="${esc(state.settings.profile.name)}">
              <img src="${esc(getAvatarUrl())}" alt="Avatar" onerror="this.src='./profile/avatars/default.svg'">
            </div>
            <div class="brandStack">
              <div class="brandName">${esc(state.settings.profile.name)}</div>
              <div class="brandSub">Skill Tracker</div>
            </div>
          </div>
          <div class="chip">Last saved: ${esc(lastSaved)}</div>
        </header>

        <main class="main">${content}</main>

        <button class="fab" id="fab" aria-label="Add">+</button>

        <nav class="nav" aria-label="Bottom navigation">
          ${navBtn("home",EM.home,"Home",activeTab)}
          ${navBtn("skills",EM.scroll,"Skills",activeTab)}
          ${navBtn("actions",EM.bolt,"Actions",activeTab)}
          ${navBtn("log",EM.clock,"Log",activeTab)}
          ${navBtn("settings",EM.gear,"Settings",activeTab)}
        </nav>
      </div>
    `;
  }

  function setupReorderHandlers() {
    let reorderOn = false;
    const listEl = $("#skillsList");
    const toggleBtn = $("[data-toggle-reorder]");
    const searchEl = $("[data-skill-search]");

    function applyReorderUi() {
      if (!listEl) return;
      listEl.querySelectorAll(".skillWrap").forEach(w => {
        w.setAttribute("draggable", reorderOn ? "true" : "false");
        w.style.outline = reorderOn ? "1px dashed color-mix(in srgb, var(--brand) 45%, var(--border))" : "none";
      });
      if (toggleBtn) toggleBtn.textContent = reorderOn ? "Done" : "Reorder";

      listEl.querySelectorAll("[data-reorder-controls]").forEach(x => x.remove());
      if (reorderOn) {
        listEl.querySelectorAll(".skillWrap").forEach(w => {
          const id = w.getAttribute("data-skill-wrap");
          const bar = document.createElement("div");
          bar.setAttribute("data-reorder-controls", "1");
          bar.className = "row";
          bar.style.marginBottom = "8px";
          bar.innerHTML = `
            <button class="iconbtn" data-move-up="${esc(id)}" aria-label="Move up">${EM.up}</button>
            <button class="iconbtn" data-move-down="${esc(id)}" aria-label="Move down">${EM.down}</button>
            <span class="chip">Reorder</span>
          `;
          w.prepend(bar);
        });
      }
    }

    toggleBtn?.addEventListener("click", () => {
      reorderOn = !reorderOn;
      applyReorderUi();
    });

    searchEl?.addEventListener("input", () => {
      const q = (searchEl.value || "").trim().toLowerCase();
      listEl?.querySelectorAll(".skillWrap").forEach(w => {
        const name = w.querySelector(".h2")?.textContent?.toLowerCase() ?? "";
        w.style.display = (!q || name.includes(q)) ? "" : "none";
      });
    });

    let dragId = null;
    listEl?.addEventListener("dragstart", (e) => {
      if (!reorderOn) return;
      const wrap = e.target.closest(".skillWrap");
      if (!wrap) return;
      dragId = wrap.getAttribute("data-skill-wrap");
      e.dataTransfer.effectAllowed = "move";
    });
    listEl?.addEventListener("dragover", (e) => { if (reorderOn) e.preventDefault(); });
    listEl?.addEventListener("drop", (e) => {
      if (!reorderOn) return;
      e.preventDefault();
      const targetWrap = e.target.closest(".skillWrap");
      if (!targetWrap || !dragId) return;
      const targetId = targetWrap.getAttribute("data-skill-wrap");
      if (!targetId || targetId === dragId) return;

      commit(() => {
        const active = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
        const ids = active.map(s=>s.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);

        const idToOrder = new Map(ids.map((id,i)=>[id,i]));
        for (const s of state.skills) {
          if (!s.archived && idToOrder.has(s.id)) s.order = idToOrder.get(s.id);
        }
        state.skills = state.skills.sort((a,b)=>a.order-b.order).map((s,i)=>({ ...s, order:i }));
      });

      dragId = null;
      applyReorderUi();
    });

    applyReorderUi();
  }

  function openAddSkillModal() {
    modal("Add Skill", `
      <div class="stack">
        <div class="stack" style="gap:6px">
          <div class="small">Name</div>
          <input class="input" id="newSkillName" placeholder="e.g., Portion Control" autofocus />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Icon (emoji)</div>
          <input class="input" id="newSkillIcon" placeholder="${EM.star}" />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Color</div>
          <input class="input" id="newSkillColor" type="color" value="#22c55e" />
        </div>
      </div>
    `, [
      { label:"Cancel", onClick:(close)=>close() },
      { label:"Add", primary:true, onClick:(close)=> {
        const name = ($("#newSkillName")?.value || "").trim() || "New Skill";
        const icon = ($("#newSkillIcon")?.value || "").trim() || EM.star;
        const color = ($("#newSkillColor")?.value || "").trim() || null;

        commit(() => {
          const t = now();
          const maxOrder = state.skills.reduce((m,s)=>Math.max(m, Number(s.order)||0), -1);
          state.skills.push({
            id: createId(),
            name,
            icon,
            color,
            xp: 0,
            createdAt: t,
            updatedAt: t,
            archived: false,
            order: maxOrder + 1
          });
        });
        toast("Added", name);
        close();
        nav("skills");
      }}
    ]);
  }

  function openEditSkillModal(skillId) {
    const s = state.skills.find(x=>x.id===skillId);
    if (!s) return;
    modal("Edit Skill", `
      <div class="stack">
        <div class="stack" style="gap:6px">
          <div class="small">Name</div>
          <input class="input" id="editSkillName" value="${esc(s.name)}" />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Icon (emoji)</div>
          <input class="input" id="editSkillIcon" value="${esc(s.icon||"")}" />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Color</div>
          <input class="input" id="editSkillColor" type="color" value="${esc(s.color||"#22c55e")}" />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Status</div>
          <select class="input" id="editSkillArchived">
            <option value="active" ${!s.archived?"selected":""}>Active</option>
            <option value="archived" ${s.archived?"selected":""}>Archived</option>
          </select>
        </div>
      </div>
    `, [
      { label:"Cancel", onClick:(close)=>close() },
      { label:"Save", primary:true, onClick:(close)=> {
        const name = ($("#editSkillName")?.value || "").trim() || s.name;
        const icon = ($("#editSkillIcon")?.value || "").trim() || EM.star;
        const color = ($("#editSkillColor")?.value || "").trim() || null;
        const archived = ($("#editSkillArchived")?.value === "archived");

        commit(() => {
          s.name = name;
          s.icon = icon;
          s.color = color;
          s.archived = archived;
          s.updatedAt = now();
        });

        toast("Saved", name);
        close();
        render();
      }}
    ]);
  }

  async function loadAvatarListAndPickIfNeeded() {
    try {
      const res = await fetch("./profile/avatars.json", { cache:"no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files.filter(x => typeof x === "string" && x.trim()) : [];
      if (!files.length) return;

      if (!state.settings.profile.avatar) {
        const pick = files[Math.floor(Math.random() * files.length)];
        commit(() => { state.settings.profile.avatar = pick; });
      }
    } catch {}
  }

  function render() {
    const r = route();
    setTheme(state.settings.theme);

    let content = "";
    let activeTab = r.page;

    if (r.page === "home") content = homeView();
    else if (r.page === "skills") content = skillsView();
    else if (r.page === "skill") { content = skillDetailView(r.id); activeTab = "skills"; }
    else if (r.page === "actions") content = actionsView();
    else if (r.page === "action") { content = actionDetailView(r.id); activeTab = "actions"; }
    else if (r.page === "log") content = logView();
    else if (r.page === "settings") content = settingsView();
    else if (r.page === "save") {
      content = homeView();
      activeTab = "home";
      setTimeout(() => {
        modal("Import shared save?", `<p>This link contains a full save snapshot. Importing will replace your current save.</p>
          <p class="small">Tip: export JSON first if you want a safe backup.</p>`, [
          { label:"Cancel", onClick:(close)=>{ close(); nav("home"); } },
          { label:"Import", primary:true, onClick: async (close) => {
            try {
              const incoming = await decodeSyncCode(r.code);
              commit(() => { state = incoming; state.meta.lastBackupAt = now(); });
              toast("Imported", "Shared save loaded.");
              close();
              nav("home");
            } catch (e) {
              toast("Invalid save", String(e));
              close();
              nav("home");
            }
          }}
        ]);
      }, 0);
    } else {
      content = homeView();
      activeTab = "home";
    }

    $("#app").innerHTML = appShell(content, activeTab);

    const fab = $("#fab");
    if (fab) {
      fab.onclick = () => {
        const rr = route();
        if (rr.page === "skills" || rr.page === "skill") openAddSkillModal();
        else if (rr.page === "actions" || rr.page === "action") nav("action/new");
        else {
          modal("Quick add", `<p>What do you want to add?</p>`, [
            { label:"Cancel", onClick:(close)=>close() },
            { label:"+ Skill", primary:true, onClick:(close)=>{ close(); openAddSkillModal(); } },
            { label:"+ Action", onClick:(close)=>{ close(); nav("action/new"); } }
          ]);
        }
      };
    }

    if (route().page === "skills") setupReorderHandlers();
  }

  // Global click handling
  document.addEventListener("click", async (e) => {
    const navBtnEl = e.target.closest("[data-nav]");
    if (navBtnEl) { nav(navBtnEl.getAttribute("data-nav")); return; }

    const openSkill = e.target.closest("[data-open-skill]");
    if (openSkill) { nav("skill/" + openSkill.getAttribute("data-open-skill")); return; }

    const openAction = e.target.closest("[data-open-action]");
    if (openAction) { nav("action/" + openAction.getAttribute("data-open-action")); return; }

    const addBtn = e.target.closest("[data-add-xp]");
    if (addBtn) { addXp(addBtn.getAttribute("data-add-xp"), Number(addBtn.getAttribute("data-amt"))); return; }

    const addCustom = e.target.closest("[data-add-custom]");
    if (addCustom) {
      const id = addCustom.getAttribute("data-add-custom");
      const inp = document.querySelector(`[data-custom-xp="${CSS.escape(id)}"]`);
      const v = Number(inp?.value);
      if (Number.isFinite(v) && v !== 0) { addXp(id, v); if (inp) inp.value = ""; }
      return;
    }

    const run = e.target.closest("[data-run-action]");
    if (run) { runAction(run.getAttribute("data-run-action")); return; }

    const undo = e.target.closest("[data-undo-event]");
    if (undo) { undoEvent(undo.getAttribute("data-undo-event")); return; }

    const undoSkill = e.target.closest("[data-undo-skill]");
    if (undoSkill) {
      const id = undoSkill.getAttribute("data-undo-skill");
      const ev = [...state.log].slice().reverse().find(x => !x.revertedAt && x.deltas.some(d=>d.skillId===id));
      if (ev) undoEvent(ev.id);
      return;
    }

    const editSkill = e.target.closest("[data-edit-skill]");
    if (editSkill) { openEditSkillModal(editSkill.getAttribute("data-edit-skill")); return; }

    const addSkill = e.target.closest("[data-add-skill]");
    if (addSkill) { openAddSkillModal(); return; }

    const up = e.target.closest("[data-move-up]");
    if (up) {
      const id = up.getAttribute("data-move-up");
      commit(() => {
        const active = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
        const i = active.findIndex(s=>s.id===id);
        if (i<=0) return;
        const a = active[i-1], b = active[i];
        const tmp = a.order; a.order = b.order; b.order = tmp;
        state.skills = state.skills.sort((p,q)=>p.order-q.order).map((s,i)=>({ ...s, order:i }));
      });
      return;
    }
    const down = e.target.closest("[data-move-down]");
    if (down) {
      const id = down.getAttribute("data-move-down");
      commit(() => {
        const active = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
        const i = active.findIndex(s=>s.id===id);
        if (i<0 || i>=active.length-1) return;
        const a = active[i], b = active[i+1];
        const tmp = a.order; a.order = b.order; b.order = tmp;
        state.skills = state.skills.sort((p,q)=>p.order-q.order).map((s,i)=>({ ...s, order:i }));
      });
      return;
    }

    const newAction = e.target.closest("[data-new-action]");
    if (newAction) { nav("action/new"); return; }

    const addGrant = e.target.closest("[data-add-grant]");
    if (addGrant) {
      const r = route();
      if (r.page !== "action") return;
      const existing = r.id === "new" ? null : state.actions.find(x=>x.id===r.id);
      const draft = getDraftAction(r.id, existing);
      const firstSkill = state.skills.find(s=>!s.archived)?.id;
      if (!firstSkill) return;
      draft.grants.push({ skillId:firstSkill, amount:1 });
      setDraftAction(r.id, draft);
      render();
      return;
    }

    const removeGrant = e.target.closest("[data-remove-grant]");
    if (removeGrant) {
      const idx = Number(removeGrant.getAttribute("data-remove-grant"));
      const r = route();
      const existing = r.id === "new" ? null : state.actions.find(x=>x.id===r.id);
      const draft = getDraftAction(r.id, existing);
      draft.grants.splice(idx, 1);
      setDraftAction(r.id, draft);
      render();
      return;
    }

    const saveAction = e.target.closest("[data-save-action]");
    if (saveAction) {
      const r = route();
      const isNew = (r.id === "new");
      const existing = isNew ? null : state.actions.find(x=>x.id===r.id);
      const draft = getDraftAction(r.id, existing);

      const name = ($("[data-action-name]")?.value || "").trim() || "Action";
      const icon = ($("[data-action-icon]")?.value || "").trim() || "";

      const grants = draft.grants.map((g, idx) => {
        const skillId = ($(`[data-grant-skill="${idx}"]`)?.value || g.skillId);
        const amt = Number($(`[data-grant-amt="${idx}"]`)?.value ?? g.amount);
        return { skillId, amount: Number.isFinite(amt) ? amt : 0 };
      }).filter(g => g.skillId && g.amount !== 0);

      commit(() => {
        const t = now();
        if (isNew) {
          state.actions.push({ id: createId(), name, icon, grants, createdAt: t, updatedAt: t });
        } else if (existing) {
          existing.name = name; existing.icon = icon; existing.grants = grants; existing.updatedAt = t;
        }
      });

      clearDraftAction(r.id);
      toast("Saved", name);
      nav("actions");
      return;
    }

    const delAction = e.target.closest("[data-del-action]");
    if (delAction) {
      const id = delAction.getAttribute("data-del-action");
      const a = state.actions.find(x=>x.id===id);
      modal("Delete action?", `<p>This removes the reusable action. Past log entries stay.</p>`, [
        { label:"Cancel", onClick:(close)=>close() },
        { label:"Delete", danger:true, onClick:(close)=> {
          commit(() => { state.actions = state.actions.filter(x=>x.id!==id); });
          toast("Deleted", a?.name || "Action");
          close();
          nav("actions");
        }}
      ]);
      return;
    }

    const exportBtn = e.target.closest("[data-export]");
    if (exportBtn) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skill-tracker-save-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      commit(() => { state.meta.lastBackupAt = now(); });
      toast("Exported", "JSON downloaded.");
      return;
    }

    const importBtn = e.target.closest("[data-import]");
    if (importBtn) { $("#fileInput")?.click(); return; }

    const makeSyncBtn = e.target.closest("[data-make-sync]");
    if (makeSyncBtn) {
      try {
        const code = await makeSyncCode(state);
        const sync = $("#syncCode"); const link = $("#shareLink");
        if (sync) sync.value = code;
        const base = location.href.split("#")[0];
        if (link) link.value = `${base}#save=${code}`;
        $("#copySyncBtn")?.removeAttribute("disabled");
        $("#copyLinkBtn")?.removeAttribute("disabled");
        commit(() => { state.meta.lastBackupAt = now(); });
        toast("Sync code", "Generated.");
      } catch (err) {
        toast("Sync unavailable", String(err));
      }
      return;
    }

    if (e.target.closest("#copySyncBtn")) {
      const code = $("#syncCode")?.value?.trim();
      if (!code) return;
      try { await navigator.clipboard.writeText(code); toast("Copied", "Sync code copied."); commit(()=>{state.meta.lastBackupAt=now();}); }
      catch { toast("Copy failed", "Clipboard blocked by browser."); }
      return;
    }

    if (e.target.closest("#copyLinkBtn")) {
      const link = $("#shareLink")?.value?.trim();
      if (!link) return;
      try { await navigator.clipboard.writeText(link); toast("Copied", "Share link copied."); commit(()=>{state.meta.lastBackupAt=now();}); }
      catch { toast("Copy failed", "Clipboard blocked by browser."); }
      return;
    }

    const importSyncBtn = e.target.closest("[data-import-sync]");
    if (importSyncBtn) {
      const code = $("#importCode")?.value?.trim();
      if (!code) return;
      try {
        const incoming = await decodeSyncCode(code);
        commit(() => { state = incoming; state.meta.lastBackupAt = now(); });
        toast("Imported", "Sync code loaded.");
        nav("home");
      } catch (err) {
        toast("Invalid code", String(err));
      }
      return;
    }

    const clearImport = e.target.closest("[data-clear-import]");
    if (clearImport) { const el = $("#importCode"); if (el) el.value = ""; return; }

    const randAvatar = e.target.closest("[data-random-avatar]");
    if (randAvatar) {
      commit(() => { state.settings.profile.avatar = ""; });
      await loadAvatarListAndPickIfNeeded();
      toast("Avatar", "Randomized.");
      render();
      return;
    }
  });

  document.addEventListener("change", (e) => {
    const theme = e.target.closest("[data-theme]");
    if (theme) { commit(() => { state.settings.theme = theme.value; }); return; }

    const br = e.target.closest("[data-backup-reminder]");
    if (br) { commit(() => { state.settings.backupReminder = (br.value === "on"); }); return; }

    const h = e.target.closest("[data-haptics]");
    if (h) { commit(() => { state.settings.haptics = (h.value === "on"); }); return; }

    const s = e.target.closest("[data-sound]");
    if (s) { commit(() => { state.settings.sound = (s.value === "on"); }); return; }

    const pn = e.target.closest("[data-profile-name]");
    if (pn) { commit(() => { state.settings.profile.name = (pn.value || "Pico").trim() || "Pico"; }); return; }

    const gs = e.target.closest("[data-grant-skill]");
    const ga = e.target.closest("[data-grant-amt]");
    if (gs || ga) {
      const r = route();
      if (r.page !== "action") return;
      const existing = r.id === "new" ? null : state.actions.find(x=>x.id===r.id);
      const draft = getDraftAction(r.id, existing);

      if (gs) {
        const idx = Number(gs.getAttribute("data-grant-skill"));
        draft.grants[idx].skillId = gs.value;
      }
      if (ga) {
        const idx = Number(ga.getAttribute("data-grant-amt"));
        const v = Number(ga.value);
        draft.grants[idx].amount = Number.isFinite(v) ? v : 0;
      }
      setDraftAction(r.id, draft);
      return;
    }
  });

  document.addEventListener("change", async (e) => {
    const fi = e.target?.id === "fileInput" ? e.target : null;
    if (!fi) return;
    const file = fi.files?.[0];
    fi.value = "";
    if (!file) return;
    try {
      const txt = await file.text();
      const incoming = sanitizeSave(JSON.parse(txt));
      commit(() => { state = incoming; state.meta.lastBackupAt = now(); });
      toast("Imported", "Save file loaded.");
      nav("home");
    } catch (err) {
      toast("Import failed", String(err));
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  window.addEventListener("hashchange", render);

  // pick avatar (once) and render
  loadAvatarListAndPickIfNeeded().finally(() => render());
})();
'@

# index.html (leave yours alone if you customized; only ensure UTF-8 + scripts)
# If you want, you can keep your existing index.html. We'll avoid overwriting it unless it doesn't exist.
$indexPath = Join-Path $dir "index.html"
if (-not (Test-Path $indexPath)) {
  Write-Utf8NoBom $indexPath @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#0b0f19" />
  <title>Skill Tracker</title>

  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="icon" href="./icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="./app.css" />
</head>
<body>
  <div id="app"></div>
  <script defer src="./vendor/pako.min.js"></script>
  <script defer src="./app.js"></script>
</body>
</html>
'@
}

Write-Host ""
Write-Host "Done. Patched: $Target" -ForegroundColor Green
Write-Host "Backup of old files: $backupDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Avatar folder: $Target/profile/avatars/" -ForegroundColor Cyan
Write-Host "Avatar list:   $Target/profile/avatars.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: git add -A ; git commit -m ""Patch skill-tracker"" ; git push" -ForegroundColor Yellow
