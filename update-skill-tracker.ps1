param(
  # If you KNOW the folder, set it, e.g. -TargetFolder "Games/skill-tracker"
  [string]$TargetFolder = ""
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

function Find-TrackerFolder([string]$Root) {
  $preferred = @("apps/skill-tracker", "Games/skill-tracker", "skill-tracker")
  foreach ($p in $preferred) {
    $full = Join-Path $Root $p
    if (Test-Path (Join-Path $full "index.html")) { return $full }
  }

  # Heuristic search: folder containing "manifest.webmanifest" and "sw.js"
  $candidates = Get-ChildItem -Path $Root -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
      Test-Path (Join-Path $_.FullName "manifest.webmanifest") -and
      Test-Path (Join-Path $_.FullName "sw.js") -and
      Test-Path (Join-Path $_.FullName "app.js")
    } |
    Select-Object -First 1

  if ($null -ne $candidates) { return $candidates.FullName }
  return ""
}

$root = (Get-Location).Path
$dir = ""

if ($TargetFolder -and $TargetFolder.Trim().Length -gt 0) {
  $dir = Join-Path $root $TargetFolder
  if (-not (Test-Path $dir)) { throw "TargetFolder not found: $TargetFolder" }
} else {
  $dir = Find-TrackerFolder $root
  if (-not $dir) { throw "Could not find your skill tracker folder. Re-run with -TargetFolder 'Games/skill-tracker' (or wherever it lives)." }
}

Write-Host "Using tracker folder: $dir" -ForegroundColor Cyan

# Backup
$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$backupDir = Join-Path $dir ("_backup_" + $stamp)
Ensure-Dir $backupDir
@("index.html","app.js","app.css","sw.js","manifest.webmanifest","icon.svg") | ForEach-Object {
  $p = Join-Path $dir $_
  if (Test-Path $p) { Copy-Item $p (Join-Path $backupDir $_) -Force }
}

# Ensure folders
Ensure-Dir (Join-Path $dir "vendor")
Ensure-Dir (Join-Path $dir "profile/avatars")
Ensure-Dir (Join-Path $dir "tools")

# Download pako if missing (for gzip fallback)
$pakoPath = Join-Path $dir "vendor/pako.min.js"
if (-not (Test-Path $pakoPath)) {
  try {
    Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js" -OutFile $pakoPath -UseBasicParsing | Out-Null
    Write-Host "Downloaded pako.min.js" -ForegroundColor DarkGray
  } catch {
    Write-Utf8NoBom $pakoPath "/* pako download failed; sync code will fallback to plain base64 JSON. */"
  }
}

# Default avatar SVG if missing
$defaultAvatar = Join-Path $dir "profile/avatars/default.svg"
if (-not (Test-Path $defaultAvatar)) {
  Write-Utf8NoBom $defaultAvatar @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#0b0f19"/>
  <circle cx="128" cy="110" r="54" fill="#22c55e"/>
  <rect x="54" y="160" width="148" height="60" rx="30" fill="#22c55e"/>
  <text x="128" y="128" text-anchor="middle" font-size="44" font-family="system-ui,Segoe UI,Arial" fill="#04160a" font-weight="900">P</text>
</svg>
'@
}

# Generate avatars.json by scanning folder (no manual JSON editing)
$avatarsDir = Join-Path $dir "profile/avatars"
$avatarsJson = Join-Path $dir "profile/avatars.json"
$files = Get-ChildItem -Path $avatarsDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch '^\.' } |
  Where-Object { $_.Extension -match '\.(png|jpg|jpeg|webp|gif|svg)$' } |
  Sort-Object Name |
  ForEach-Object { $_.Name }

# Ensure default.svg first
if ($files -notcontains "default.svg") { $files = @("default.svg") + $files } else {
  $files = @("default.svg") + ($files | Where-Object { $_ -ne "default.svg" })
}

$avatarsObj = @{ files = $files } | ConvertTo-Json -Depth 5
Write-Utf8NoBom $avatarsJson ($avatarsObj + "`n")

# icon + manifest
Write-Utf8NoBom (Join-Path $dir "icon.svg") @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#0b0f19"/>
  <rect x="52" y="52" width="152" height="152" rx="40" fill="#22c55e"/>
  <text x="128" y="152" text-anchor="middle" font-size="84" font-family="system-ui,Segoe UI,Arial" fill="#04160a" font-weight="900">XP</text>
</svg>
'@

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

# index.html (force pako before app)
Write-Utf8NoBom (Join-Path $dir "index.html") @'
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
  <script src="./vendor/pako.min.js" defer></script>
  <script src="./app.js" defer></script>
</body>
</html>
'@

# app.css (6-tab nav, minimal but solid)
Write-Utf8NoBom (Join-Path $dir "app.css") @'
:root{
  --bg:#070a12; --panel:#0b1222; --text:#e5e7eb; --muted:#9aa4b2; --border:rgba(226,232,240,.12);
  --shadow:0 10px 30px rgba(0,0,0,.35);
  --brand:#3ddc84; --danger:#ef4444; --warn:#f59e0b;
  --r:16px; --pad:14px; --tap:48px; --navH:74px;
  color-scheme: dark;
}
:root[data-theme="light"]{
  --bg:#f6f7fb; --panel:#ffffff; --text:#0f172a; --muted:#475569; --border:rgba(15,23,42,.12);
  --shadow:0 10px 28px rgba(2,6,23,.08);
  --brand:#22c55e;
  color-scheme: light;
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
  font-weight:900;
  cursor:pointer;
}
button:active{transform:translateY(1px)}
button[disabled]{opacity:.5; cursor:not-allowed; transform:none}
.btn-primary{
  background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 80%, white), var(--brand));
  border-color:color-mix(in srgb, var(--brand) 55%, var(--border));
  color:#03120a;
}
.btn-danger{
  background:color-mix(in srgb, var(--danger) 18%, var(--panel));
  border-color:color-mix(in srgb, var(--danger) 35%, var(--border));
}
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
.brandStack{display:flex; flex-direction:column; line-height:1.05}
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
  padding:14px 14px calc(var(--navH) + 28px);
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
.hr{height:1px; background:var(--border); margin:8px 0}
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
  grid-template-columns:repeat(6,1fr);
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

# sw.js bump cache name to force new assets
Write-Utf8NoBom (Join-Path $dir "sw.js") @'
const CACHE = "skill-tracker-v6";
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
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isAvatarList = url.pathname.endsWith("/profile/avatars.json");
  const isAvatarImg = url.pathname.includes("/profile/avatars/");
  if (isAvatarList || isAvatarImg) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await cache.match(req)) || (await caches.match("./"));
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch {
      return caches.match("./");
    }
  })());
});
'@

# app.js (coins + rewards + testing + momentum lvl84 + fixed sync)
Write-Utf8NoBom (Join-Path $dir "app.js") @'
(() => {
  const STORAGE_KEY = "skill_tracker_save_v3";
  const LEGACY_KEYS = ["skill_tracker_save_v2","skill_tracker_save_v1","skill_tracker_save_v0"];
  const MAX_LOG = 5000;

  const BASE = new URL("./", window.location.href);
  const rel = (p) => new URL(p, BASE).toString();

  const EM = {
    home: "\u{1F3E0}",
    scroll: "\u{1F4DC}",
    bolt: "\u{26A1}",
    gift: "\u{1F381}",
    clock: "\u{1F552}",
    gear: "\u{2699}",
    star: "\u{2B50}",
    coin: "\u{1FA99}",
    check: "\u{2705}",
    x: "\u{2715}"
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
    } catch { return s; }
  }

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

    const momentumXp = xpForLevel(84); // Level 84 exactly = 3570 XP
    const skillsRaw = [
      { name:"Momentum", icon:EM.check, color:"#22c55e", xp: momentumXp },
      { name:"Upper Front Strength", icon:"\u{1F4AA}", color:"#f97316", xp:0 },
      { name:"Upper Back Strength",  icon:"\u{1F9F1}", color:"#60a5fa", xp:0 },
      { name:"Lower Front Strength", icon:"\u{1F9B5}", color:"#22c55e", xp:0 },
      { name:"Lower Back Strength",  icon:"\u{1F3CB}\u{FE0F}", color:"#a78bfa", xp:0 },
      { name:"Walking",              icon:"\u{1F6B6}", color:"#38bdf8", xp:0 },
      { name:"Nutrition",            icon:"\u{1F957}", color:"#84cc16", xp:0 },
      { name:"Portion Control",      icon:"\u{1F37D}\u{FE0F}", color:"#f59e0b", xp:0 },
      { name:"Sleep",                icon:"\u{1F634}", color:"#94a3b8", xp:0 },
      { name:"Mobility",             icon:"\u{1F9D8}", color:"#fb7185", xp:0 },
      { name:"Hydration",            icon:"\u{1F4A7}", color:"#0ea5e9", xp:0 }
    ];

    const skills = skillsRaw.map((s, i) => ({
      id: createId(),
      name: s.name,
      icon: s.icon,
      color: s.color,
      xp: s.xp,
      createdAt: t,
      updatedAt: t,
      archived: false,
      order: i
    }));

    return {
      version: 3,
      createdAt: t,
      updatedAt: t,
      meta: { lastSavedAt: t, lastBackupAt: null },
      skills,
      actions: [],
      rewards: [],
      purchases: [],
      log: [],
      wallet: { spentCoins: 0 },
      settings: {
        theme: "system",
        haptics: false,
        sound: false,
        backupReminder: true,
        profile: { name: "Pico", avatar: "" }
      }
    };
  }

  function sanitizeSave(obj) {
    if (!obj || typeof obj !== "object") return defaultSave();
    const base = defaultSave();
    const t = now();

    const settingsIn = (obj.settings && typeof obj.settings === "object") ? obj.settings : {};
    const profileIn = (settingsIn.profile && typeof settingsIn.profile === "object") ? settingsIn.profile : {};

    const skillsIn = Array.isArray(obj.skills) ? obj.skills : base.skills;
    const actionsIn = Array.isArray(obj.actions) ? obj.actions : [];
    const rewardsIn = Array.isArray(obj.rewards) ? obj.rewards : [];
    const purchasesIn = Array.isArray(obj.purchases) ? obj.purchases : [];
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
    })).sort((a,b)=>a.order-b.order).map((s,i)=>({ ...s, order:i }));

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

    const rewards = rewardsIn.map((x) => ({
      id: String(x.id || createId()),
      name: fixMojibake(String(x.name || "Reward")),
      costCoins: Math.max(0, Number(x.costCoins) || 0),
      requirements: Array.isArray(x.requirements) ? x.requirements.map(r => ({
        skillId: String(r.skillId || ""),
        level: Math.max(0, Number(r.level) || 0)
      })).filter(r => r.skillId) : [],
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || t,
      archived: !!x.archived
    }));

    const purchases = purchasesIn.map((p)=>({
      id: String(p.id || createId()),
      rewardId: String(p.rewardId || ""),
      timestamp: Number(p.timestamp) || t,
      costCoins: Math.max(0, Number(p.costCoins) || 0),
      revertedAt: p.revertedAt ? Number(p.revertedAt) : null
    }));

    const log = logIn.map((e) => ({
      id: String(e.id || createId()),
      timestamp: Number(e.timestamp) || t,
      type: (e.type === "action" || e.type === "purchase") ? e.type : "skill_xp",
      skillId: e.skillId ? String(e.skillId) : null,
      actionId: e.actionId ? String(e.actionId) : null,
      rewardId: e.rewardId ? String(e.rewardId) : null,
      costCoins: Math.max(0, Number(e.costCoins) || 0),
      deltas: Array.isArray(e.deltas) ? e.deltas.map(d => ({
        skillId: String(d.skillId || ""),
        delta: Number(d.delta) || 0
      })).filter(d => d.skillId && d.delta !== 0) : [],
      note: e.note ? fixMojibake(String(e.note)) : null,
      revertedAt: e.revertedAt ? Number(e.revertedAt) : null
    }));

    const metaIn = (obj.meta && typeof obj.meta === "object") ? obj.meta : {};
    const walletIn = (obj.wallet && typeof obj.wallet === "object") ? obj.wallet : {};
    const settings = {
      ...base.settings,
      ...settingsIn,
      profile: {
        ...base.settings.profile,
        ...profileIn,
        name: fixMojibake(String(profileIn.name ?? base.settings.profile.name)),
        avatar: String(profileIn.avatar ?? "")
      }
    };

    const out = {
      version: 3,
      createdAt: Number(obj.createdAt) || base.createdAt,
      updatedAt: Number(obj.updatedAt) || t,
      meta: { ...base.meta, ...metaIn },
      skills,
      actions,
      rewards,
      purchases,
      log: log.slice(-MAX_LOG),
      wallet: { spentCoins: Math.max(0, Number(walletIn.spentCoins) || 0) },
      settings
    };

    return ensureMomentumSkill(out);
  }

  function ensureMomentumSkill(s) {
    const exists = s.skills.some(x => (x.name || "").toLowerCase() === "momentum");
    if (exists) return s;

    const t = now();
    const momentum = {
      id: createId(),
      name: "Momentum",
      icon: EM.check,
      color: "#22c55e",
      xp: xpForLevel(84),
      createdAt: t,
      updatedAt: t,
      archived: false,
      order: 0
    };
    s.skills = [momentum, ...s.skills].map((x,i)=>({ ...x, order:i }));
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeSave(JSON.parse(raw));
    } catch {}

    for (const k of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) return sanitizeSave(JSON.parse(raw));
      } catch {}
    }
    return null;
  }

  let state = load() || defaultSave();
  let saveTimer = null;

  function hardSave() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; hardSave(); }, 120);
  }

  function setTheme(theme) {
    const root = document.documentElement;
    const pref = theme || "system";
    const systemDark = matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
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

  function commit(mutator) {
    mutator();
    const t = now();
    state.updatedAt = t;
    state.meta.lastSavedAt = t;
    scheduleSave();
    render();
  }

  function totalLevel() {
    return state.skills.filter(s=>!s.archived).reduce((sum,s)=>sum + levelFromXp(s.xp), 0);
  }
  function totalXp() {
    return state.skills.filter(s=>!s.archived).reduce((sum,s)=>sum + (Number(s.xp)||0), 0);
  }
  function coinsEarned() {
    return totalLevel() * 10;
  }
  function coinsSpent() {
    return Math.max(0, Number(state.wallet?.spentCoins)||0);
  }
  function coinsBalance() {
    return coinsEarned() - coinsSpent();
  }

  function canBuyReward(reward) {
    if (reward.archived) return { ok:false, reason:"Archived" };
    if (coinsBalance() < reward.costCoins) return { ok:false, reason:"Not enough coins" };

    for (const r of reward.requirements || []) {
      const s = state.skills.find(x=>x.id === r.skillId);
      const lvl = s ? levelFromXp(s.xp) : 0;
      if (lvl < r.level) return { ok:false, reason:"Requirements not met" };
    }
    return { ok:true, reason:"" };
  }

  async function loadAvatarList() {
    try {
      const res = await fetch(rel("./profile/avatars.json"), { cache:"no-store" });
      if (!res.ok) return ["default.svg"];
      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files.filter(x => typeof x === "string" && x.trim()) : ["default.svg"];
      return files.length ? files : ["default.svg"];
    } catch {
      return ["default.svg"];
    }
  }
  function getAvatarUrl() {
    const a = state.settings.profile.avatar || "";
    if (!a) return rel("./profile/avatars/default.svg");
    return rel("./profile/avatars/" + a);
  }
  async function ensureAvatarPicked() {
    if (state.settings.profile.avatar) return;
    const files = await loadAvatarList();
    const pick = files[Math.floor(Math.random() * files.length)];
    commit(()=>{ state.settings.profile.avatar = pick; });
  }
  async function randomizeAvatar() {
    const files = await loadAvatarList();
    const pick = files[Math.floor(Math.random() * files.length)];
    commit(()=>{ state.settings.profile.avatar = pick; });
    toast("Avatar", "Randomized.");
  }

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
    throw new Error("No gzip support");
  }
  async function ungzipToString(bytes) {
    if ("DecompressionStream" in window) {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    if (window.pako?.ungzip) return window.pako.ungzip(bytes, { to:"string" });
    throw new Error("No ungzip support");
  }
  async function makeSyncCode(obj) {
    const json = JSON.stringify(obj);
    try {
      const gz = await gzipString(json);
      return "z:" + bytesToB64Url(gz);
    } catch {
      const te = new TextEncoder();
      return "j:" + bytesToB64Url(te.encode(json));
    }
  }
  async function decodeSyncCode(code) {
    const raw = code.trim();
    const payload = (raw.startsWith("z:") || raw.startsWith("j:")) ? raw.slice(2) : raw;

    if (raw.startsWith("j:")) {
      const bytes = b64UrlToBytes(payload);
      const json = new TextDecoder().decode(bytes);
      return sanitizeSave(JSON.parse(json));
    }

    try {
      const bytes = b64UrlToBytes(payload);
      const json = await ungzipToString(bytes);
      return sanitizeSave(JSON.parse(json));
    } catch (e) {
      if (raw.startsWith("z:")) throw e;
      const bytes = b64UrlToBytes(payload);
      const json = new TextDecoder().decode(bytes);
      return sanitizeSave(JSON.parse(json));
    }
  }

  function route() {
    const h = location.hash || "#/home";
    if (h.startsWith("#save=")) return { page:"save", code: decodeURIComponent(h.slice(6)) };
    const cleaned = h.startsWith("#/") ? h.slice(2) : "home";
    const parts = cleaned.split("/").filter(Boolean);
    const page = parts[0] || "home";
    return { page };
  }
  function nav(p) { location.hash = "#/" + p; }

  function modal(title, bodyHtml, actions) {
    $("#modal")?.remove();
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
  }

  function homeView() {
    const skills = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
    const lvl = totalLevel();
    const xp = totalXp();
    const earned = coinsEarned();
    const spent = coinsSpent();
    const bal = coinsBalance();

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:6px">
              <h1 class="h1">${esc(state.settings.profile.name)}'s Dashboard</h1>
              <p class="p">Momentum is your main "get it done" bar. Coins come from levels.</p>
            </div>
            <button data-nav="settings">Settings</button>
          </div>

          <div class="grid grid2" style="margin-top:12px">
            <div class="card" style="box-shadow:none">
              <div class="row"><div class="small">Total Level</div><div style="font-weight:950">${fmtInt(lvl)}</div></div>
              <div class="row"><div class="small">Total XP</div><div style="font-weight:950">${fmtXp(xp)}</div></div>
            </div>
            <div class="card" style="box-shadow:none">
              <div class="row"><div class="small">Coins earned</div><div style="font-weight:950">${fmtInt(earned)}</div></div>
              <div class="row"><div class="small">Coins balance</div><div style="font-weight:950">${fmtInt(bal)}</div></div>
              <div class="small">Spent: ${fmtInt(spent)}</div>
            </div>
          </div>
        </div>

        <div class="row">
          <h2 class="h2">Top Skills</h2>
          <button data-nav="skills">Skills</button>
        </div>

        <div class="grid grid2 grid3">
          ${skills.slice(0,6).map(skillCard).join("")}
        </div>

        <div class="row">
          <h2 class="h2">Rewards</h2>
          <button data-nav="rewards">Open</button>
        </div>
      </div>
    `;
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
          <button data-add-xp="${esc(s.id)}" data-amt="1">+1</button>
        </div>

        <div class="stack" style="margin-top:10px">
          <div class="progress"><div style="--w:${pct}%"></div></div>
          <div class="row">
            <span class="small">To next: ${fmtXp(xpToNext(s.xp))}</span>
            <span class="small">Next: ${fmtInt(L+1)}</span>
          </div>
          <div class="row" style="gap:8px">
            <button data-add-xp="${esc(s.id)}" data-amt="5">+5</button>
            <button data-add-xp="${esc(s.id)}" data-amt="10">+10</button>
            <input class="input" style="min-height:44px" inputmode="decimal" placeholder="Custom" data-custom-xp="${esc(s.id)}" />
            <button data-add-custom="${esc(s.id)}">Add</button>
          </div>
        </div>
      </div>
    `;
  }

  function skillsView() {
    const skills = state.skills.sort((a,b)=>a.order-b.order);
    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <h1 class="h1">Skills</h1>
            <button data-add-skill class="btn-primary">Add Skill</button>
          </div>
          <p class="small">Tip: Momentum starts at Level 84. Level 84 equals 3570 total XP.</p>
        </div>
        <div class="grid grid2 grid3">
          ${skills.map(skillCard).join("")}
        </div>
      </div>
    `;
  }

  function rewardsView() {
    const rewards = state.rewards.filter(r=>!r.archived).sort((a,b)=>b.updatedAt-a.updatedAt);
    const bal = coinsBalance();

    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">Rewards</h1>
              <p class="p">Each level gives 10 coins. Buy rewards to spend coins.</p>
            </div>
            <button data-new-reward class="btn-primary">Add Reward</button>
          </div>
          <div class="row" style="margin-top:10px; justify-content:flex-start; flex-wrap:wrap; gap:8px">
            <span class="chip">${EM.coin} Balance: ${fmtInt(bal)}</span>
            <span class="chip">Earned: ${fmtInt(coinsEarned())}</span>
            <span class="chip">Spent: ${fmtInt(coinsSpent())}</span>
          </div>
          ${bal < 0 ? `<div class="small" style="margin-top:8px; color:color-mix(in srgb, var(--danger) 70%, var(--text));">Balance is negative (usually from lowering levels after purchases).</div>` : ``}
        </div>

        ${rewards.length===0 ? `<div class="card"><p class="small">Add a reward (e.g. "Buy a game" for 500 coins, requires Momentum 80).</p></div>` : `
          <div class="stack">
            ${rewards.map(r => {
              const chk = canBuyReward(r);
              const reqs = (r.requirements||[]).map(req => {
                const s = state.skills.find(x=>x.id===req.skillId);
                const name = s ? s.name : "Unknown";
                return `${esc(name)} ${fmtInt(req.level)}`;
              }).join(" | ");
              return `
                <div class="card">
                  <div class="row">
                    <div class="stack" style="gap:6px">
                      <div class="h2">${esc(r.name)}</div>
                      <div class="small">Cost: ${fmtInt(r.costCoins)} coins</div>
                      ${reqs ? `<div class="small">Requires: ${reqs}</div>` : `<div class="small">Requires: none</div>`}
                    </div>
                    <div class="stack" style="gap:8px; align-items:flex-end">
                      <button data-edit-reward="${esc(r.id)}">Edit</button>
                      <button class="btn-primary" ${chk.ok ? "" : "disabled"} data-buy-reward="${esc(r.id)}">Buy</button>
                      ${chk.ok ? "" : `<div class="small">${esc(chk.reason)}</div>`}
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;
  }

  function logView() {
    const events = [...state.log].slice().reverse().slice(0,200);
    return `
      <div class="stack">
        <div class="card">
          <div class="row">
            <h1 class="h1">Log</h1>
            <button data-clear-log class="btn-danger">Clear Log</button>
          </div>
          <p class="small">XP, actions, and purchases appear here.</p>
        </div>
        ${events.length===0 ? `<div class="card"><p class="small">No events yet.</p></div>` : `
          <div class="stack">
            ${events.map(e => {
              const when = new Date(e.timestamp).toLocaleString();
              if (e.type === "purchase") {
                const r = state.rewards.find(x=>x.id===e.rewardId);
                return `
                  <div class="card">
                    <div class="row">
                      <div class="stack" style="gap:2px">
                        <div class="h2">${EM.gift} Bought: ${esc(r?.name || "Reward")}</div>
                        <div class="small">${when}</div>
                        <div class="small">Cost: ${fmtInt(e.costCoins)} coins</div>
                      </div>
                      ${e.revertedAt ? `<span class="chip">undone</span>` : `<button data-undo="${esc(e.id)}">Undo</button>`}
                    </div>
                  </div>
                `;
              }
              const parts = e.deltas.map(d => {
                const s = state.skills.find(x=>x.id===d.skillId);
                return `${esc(s?.name || "Skill")} ${(d.delta>=0?"+":"")}${fmtXp(d.delta)}`;
              }).join(" | ");
              return `
                <div class="card">
                  <div class="row">
                    <div class="stack" style="gap:2px">
                      <div class="h2">${e.type==="action"?EM.bolt:EM.star} ${esc(e.type==="action"?"Action":"XP")}</div>
                      <div class="small">${when}</div>
                      <div class="small">${parts}</div>
                    </div>
                    ${e.revertedAt ? `<span class="chip">undone</span>` : `<button data-undo="${esc(e.id)}">Undo</button>`}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
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
          <div class="row" style="margin-top:10px; justify-content:flex-start; flex-wrap:wrap; gap:8px">
            <span class="chip">Last saved: ${esc(lastSaved)}</span>
            <span class="chip">Last backup: ${esc(lastBackup)}</span>
            <span class="chip">${EM.coin} Balance: ${fmtInt(coinsBalance())}</span>
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Profile</h2>
          <div class="grid grid2" style="margin-top:12px; align-items:center">
            <div class="row" style="justify-content:flex-start; gap:12px">
              <div class="avatar" style="width:64px; height:64px; border-radius:18px">
                <img src="${esc(getAvatarUrl())}" alt="Avatar" onerror="this.src='${esc(rel("./profile/avatars/default.svg"))}'">
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
          <div class="small" style="margin-top:10px">Add images to: profile/avatars/ then re-run the update script.</div>
        </div>

        <div class="card">
          <h2 class="h2">Export / Import (JSON)</h2>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button class="btn-primary" data-export>Export JSON</button>
            <button data-import>Import JSON</button>
            <input type="file" accept="application/json" id="fileInput" style="display:none" />
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Sync Code + Share Link</h2>
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
          <h2 class="h2">Testing / Repair</h2>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button data-repair>Repair Unicode + Resave</button>
            <button data-reset-xp class="btn-danger">Reset XP + Clear Log</button>
            <button data-set-momentum class="btn-primary">Set Momentum to Level 84</button>
            <button data-factory class="btn-danger">Factory Reset</button>
          </div>
        </div>
      </div>
    `;
  }

  function navBtn(id, emoji, label, active) {
    const cls = "navBtn" + (active===id ? " active" : "");
    return `<button class="${cls}" data-nav="${id}"><div class="navEmoji">${emoji}</div><div class="navLabel">${label}</div></button>`;
  }

  function appShell(content, activeTab) {
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "-";
    return `
      <div class="shell">
        <div class="toastHost"></div>
        <header class="header">
          <div class="brand" data-nav="home">
            <div class="avatar" title="${esc(state.settings.profile.name)}">
              <img src="${esc(getAvatarUrl())}" alt="Avatar" onerror="this.src='${esc(rel("./profile/avatars/default.svg"))}'">
            </div>
            <div class="brandStack">
              <div class="brandName">${esc(state.settings.profile.name)}</div>
              <div class="brandSub">Skill Tracker</div>
            </div>
          </div>
          <div class="chip">Coins: ${fmtInt(coinsBalance())} | Saved: ${esc(lastSaved)}</div>
        </header>

        <main class="main">${content}</main>

        <nav class="nav" aria-label="Bottom navigation">
          ${navBtn("home",EM.home,"Home",activeTab)}
          ${navBtn("skills",EM.scroll,"Skills",activeTab)}
          ${navBtn("actions",EM.bolt,"Actions",activeTab)}
          ${navBtn("rewards",EM.gift,"Rewards",activeTab)}
          ${navBtn("log",EM.clock,"Log",activeTab)}
          ${navBtn("settings",EM.gear,"Settings",activeTab)}
        </nav>
      </div>
    `;
  }

  function render() {
    const r = route();
    setTheme(state.settings.theme);

    let content = "";
    let tab = r.page;

    if (r.page === "home") content = homeView();
    else if (r.page === "skills") content = skillsView();
    else if (r.page === "rewards") content = rewardsView();
    else if (r.page === "log") content = logView();
    else if (r.page === "settings") content = settingsView();
    else content = homeView(), tab="home";

    $("#app").innerHTML = appShell(content, tab);

    if (r.page === "save") {
      setTimeout(() => {
        modal("Import shared save?", `<p>This link contains a save snapshot. Import replaces your current save.</p>`, [
          { label:"Cancel", onClick:(close)=>{ close(); nav("home"); } },
          { label:"Import", primary:true, onClick: async (close) => {
            try {
              const incoming = await decodeSyncCode(r.code);
              commit(()=>{ state = incoming; state.meta.lastBackupAt = now(); });
              toast("Imported", "Shared save loaded.");
            } catch (e) {
              toast("Invalid save", String(e));
            } finally {
              close(); nav("home");
            }
          } }
        ]);
      }, 0);
    }
  }

  function openNewRewardModal(existing=null) {
    const isNew = !existing;
    const id = existing?.id || createId();
    const name = existing?.name || "";
    const cost = existing?.costCoins ?? 0;
    const reqs = (existing?.requirements || []).map(r => ({ ...r }));

    const skills = state.skills.filter(s=>!s.archived).sort((a,b)=>a.order-b.order);
    const reqRows = () => reqs.map((r,i)=>`
      <div class="card" style="box-shadow:none">
        <div class="grid grid2" style="gap:10px">
          <div class="stack" style="gap:6px">
            <div class="small">Skill</div>
            <select class="input" data-req-skill="${i}">
              ${skills.map(s=>`<option value="${esc(s.id)}" ${s.id===r.skillId?"selected":""}>${esc(s.name)}</option>`).join("")}
            </select>
          </div>
          <div class="stack" style="gap:6px">
            <div class="small">Level</div>
            <input class="input" inputmode="numeric" data-req-level="${i}" value="${esc(String(r.level||0))}" />
          </div>
        </div>
        <div class="row" style="margin-top:10px">
          <span class="small">Requirement</span>
          <button class="btn-danger" data-req-remove="${i}">Remove</button>
        </div>
      </div>
    `).join("");

    modal(isNew ? "Add Reward" : "Edit Reward", `
      <div class="stack">
        <div class="stack" style="gap:6px">
          <div class="small">Name</div>
          <input class="input" id="rwName" value="${esc(name)}" placeholder="e.g. New game night" />
        </div>
        <div class="stack" style="gap:6px">
          <div class="small">Cost (coins)</div>
          <input class="input" inputmode="numeric" id="rwCost" value="${esc(String(cost))}" />
        </div>
        <div class="row">
          <h2 class="h2">Requirements</h2>
          <button data-req-add>Add</button>
        </div>
        <div id="reqList" class="stack">${reqRows() || `<p class="small">None</p>`}</div>
      </div>
    `, [
      { label:"Cancel", onClick:(close)=>close() },
      { label:isNew ? "Create" : "Save", primary:true, onClick:(close)=> {
        const newName = ($("#rwName")?.value || "").trim() || "Reward";
        const newCost = Math.max(0, Number($("#rwCost")?.value || 0) || 0);

        const reqOut = reqs.map((r,i)=> {
          const sid = ($(`[data-req-skill="${i}"]`)?.value || r.skillId);
          const lvl = Math.max(0, Number($(`[data-req-level="${i}"]`)?.value || r.level) || 0);
          return { skillId:sid, level:lvl };
        }).filter(r => r.skillId);

        commit(()=> {
          const t = now();
          if (isNew) {
            state.rewards.push({ id, name:newName, costCoins:newCost, requirements:reqOut, createdAt:t, updatedAt:t, archived:false });
          } else {
            const rr = state.rewards.find(x=>x.id===existing.id);
            if (rr) { rr.name=newName; rr.costCoins=newCost; rr.requirements=reqOut; rr.updatedAt=t; }
          }
        });

        toast("Saved", newName);
        close();
      } }
    ]);

    // lightweight modal-internal handlers
    const overlay = $("#modal");
    overlay?.addEventListener("click", (e) => {
      const add = e.target.closest("[data-req-add]");
      if (add) {
        const firstSkill = skills[0]?.id || "";
        reqs.push({ skillId:firstSkill, level:1 });
        $("#reqList").innerHTML = reqRows();
      }
      const rem = e.target.closest("[data-req-remove]");
      if (rem) {
        const i = Number(rem.getAttribute("data-req-remove"));
        reqs.splice(i,1);
        $("#reqList").innerHTML = reqRows() || `<p class="small">None</p>`;
      }
    });
  }

  function buyReward(id) {
    const r = state.rewards.find(x=>x.id===id);
    if (!r) return;
    const chk = canBuyReward(r);
    if (!chk.ok) { toast("Can't buy", chk.reason); return; }

    commit(()=> {
      state.wallet.spentCoins = coinsSpent() + r.costCoins;
      const entry = { id:createId(), timestamp:now(), type:"purchase", rewardId:r.id, costCoins:r.costCoins, deltas:[], revertedAt:null };
      state.log.push(entry);
      if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
    });
    toast("Purchased", r.name);
  }

  function undoEvent(id) {
    const e = state.log.find(x=>x.id===id);
    if (!e || e.revertedAt) return;

    commit(()=> {
      if (e.type === "purchase") {
        state.wallet.spentCoins = Math.max(0, coinsSpent() - (e.costCoins||0));
      } else {
        for (const d of e.deltas || []) {
          const s = state.skills.find(x=>x.id===d.skillId);
          if (!s) continue;
          s.xp = Math.max(0, (Number(s.xp)||0) - (Number(d.delta)||0));
          s.updatedAt = now();
        }
      }
      e.revertedAt = now();
    });
    toast("Undone", "Event reverted.");
  }

  function addXp(skillId, amount) {
    const s = state.skills.find(x=>x.id===skillId);
    const amt = Number(amount);
    if (!s || !Number.isFinite(amt) || amt===0) return;

    commit(()=> {
      s.xp = Math.max(0, (Number(s.xp)||0) + amt);
      s.updatedAt = now();
      state.log.push({ id:createId(), timestamp:now(), type:"skill_xp", skillId:s.id, deltas:[{skillId:s.id, delta:amt}], revertedAt:null, costCoins:0 });
      if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
    });
  }

  document.addEventListener("click", async (e) => {
    const n = e.target.closest("[data-nav]");
    if (n) { nav(n.getAttribute("data-nav")); return; }

    const ax = e.target.closest("[data-add-xp]");
    if (ax) { addXp(ax.getAttribute("data-add-xp"), Number(ax.getAttribute("data-amt"))); return; }

    const ac = e.target.closest("[data-add-custom]");
    if (ac) {
      const id = ac.getAttribute("data-add-custom");
      const inp = document.querySelector(`[data-custom-xp="${CSS.escape(id)}"]`);
      const v = Number(inp?.value);
      if (Number.isFinite(v) && v !== 0) { addXp(id, v); if (inp) inp.value = ""; }
      return;
    }

    if (e.target.closest("[data-random-avatar]")) { await randomizeAvatar(); render(); return; }

    if (e.target.closest("[data-export]")) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skill-tracker-save-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      commit(()=>{ state.meta.lastBackupAt = now(); });
      toast("Exported", "JSON downloaded.");
      return;
    }

    if (e.target.closest("[data-import]")) { $("#fileInput")?.click(); return; }

    if (e.target.closest("[data-make-sync]")) {
      try {
        const code = await makeSyncCode(state);
        $("#syncCode").value = code;
        const base = window.location.href.split("#")[0];
        $("#shareLink").value = `${base}#save=${encodeURIComponent(code)}`;
        $("#copySyncBtn")?.removeAttribute("disabled");
        $("#copyLinkBtn")?.removeAttribute("disabled");
        commit(()=>{ state.meta.lastBackupAt = now(); });
        toast("Sync code", "Generated.");
      } catch (err) {
        toast("Sync failed", String(err));
      }
      return;
    }

    if (e.target.closest("#copySyncBtn")) {
      const code = $("#syncCode")?.value?.trim();
      if (!code) return;
      try { await navigator.clipboard.writeText(code); toast("Copied", "Sync code copied."); }
      catch { toast("Copy failed", "Clipboard blocked."); }
      return;
    }

    if (e.target.closest("#copyLinkBtn")) {
      const link = $("#shareLink")?.value?.trim();
      if (!link) return;
      try { await navigator.clipboard.writeText(link); toast("Copied", "Share link copied."); }
      catch { toast("Copy failed", "Clipboard blocked."); }
      return;
    }

    if (e.target.closest("[data-import-sync]")) {
      const code = $("#importCode")?.value?.trim();
      if (!code) return;
      try {
        const incoming = await decodeSyncCode(code);
        commit(()=>{ state = incoming; state.meta.lastBackupAt = now(); });
        toast("Imported", "Sync code loaded.");
        nav("home");
      } catch (err) {
        toast("Invalid code", String(err));
      }
      return;
    }

    if (e.target.closest("[data-clear-import]")) { $("#importCode").value = ""; return; }

    if (e.target.closest("[data-repair]")) {
      commit(()=>{ state = sanitizeSave(state); });
      toast("Repaired", "Unicode fixed + resaved.");
      return;
    }

    if (e.target.closest("[data-reset-xp]")) {
      modal("Reset XP + clear log?", `<p>Sets all XP to 0 and clears the log. Keeps rewards/actions.</p>`, [
        { label:"Cancel", onClick:(close)=>close() },
        { label:"Reset", danger:true, onClick:(close)=> {
          commit(()=> {
            const t = now();
            state.skills.forEach(s=>{ s.xp = 0; s.updatedAt = t; });
            state.log = [];
            state.wallet.spentCoins = 0;
          });
          toast("Reset", "XP cleared.");
          close();
        } }
      ]);
      return;
    }

    if (e.target.closest("[data-set-momentum]")) {
      commit(()=> {
        const m = state.skills.find(s => (s.name||"").toLowerCase() === "momentum");
        if (m) { m.xp = xpForLevel(84); m.updatedAt = now(); }
      });
      toast("Momentum", "Set to Level 84 (3570 XP).");
      return;
    }

    if (e.target.closest("[data-factory]")) {
      modal("Factory reset?", `<p>Wipes everything (save data). This cannot be undone.</p>`, [
        { label:"Cancel", onClick:(close)=>close() },
        { label:"Wipe", danger:true, onClick:(close)=> {
          try {
            localStorage.removeItem(STORAGE_KEY);
            for (const k of LEGACY_KEYS) localStorage.removeItem(k);
          } catch {}
          state = defaultSave();
          hardSave();
          toast("Wiped", "Fresh save created.");
          close(); render();
        } }
      ]);
      return;
    }

    if (e.target.closest("[data-new-reward]")) { openNewRewardModal(null); return; }
    const er = e.target.closest("[data-edit-reward]");
    if (er) {
      const r = state.rewards.find(x=>x.id===er.getAttribute("data-edit-reward"));
      if (r) openNewRewardModal(r);
      return;
    }
    const br = e.target.closest("[data-buy-reward]");
    if (br) { buyReward(br.getAttribute("data-buy-reward")); return; }

    const un = e.target.closest("[data-undo]");
    if (un) { undoEvent(un.getAttribute("data-undo")); return; }

    if (e.target.closest("[data-clear-log]")) {
      modal("Clear log?", `<p>This clears the log only.</p>`, [
        { label:"Cancel", onClick:(close)=>close() },
        { label:"Clear", danger:true, onClick:(close)=>{ commit(()=>{ state.log = []; }); toast("Cleared", "Log cleared."); close(); } }
      ]);
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
      commit(()=>{ state = incoming; state.meta.lastBackupAt = now(); });
      toast("Imported", "Save file loaded.");
      nav("home");
    } catch (err) {
      toast("Import failed", String(err));
    }
  });

  document.addEventListener("input", (e) => {
    const pn = e.target.closest("[data-profile-name]");
    if (pn) commit(()=>{ state.settings.profile.name = (pn.value || "Pico").trim() || "Pico"; });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(rel("./sw.js"), { scope: rel("./") }).catch(()=>{});
  }
  window.addEventListener("hashchange", render);

  ensureAvatarPicked().finally(() => render());
})();
'@

Write-Host ""
Write-Host "Update complete." -ForegroundColor Green
Write-Host "Backup saved to: $backupDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Yellow
Write-Host "1) git add -A" -ForegroundColor Yellow
Write-Host "2) git commit -m ""Update skill-tracker (coins+rewards+testing)""" -ForegroundColor Yellow
Write-Host "3) git push" -ForegroundColor Yellow
Write-Host ""
Write-Host "If the site still looks old: hard refresh (Ctrl+F5) or unregister the Service Worker in DevTools." -ForegroundColor Cyan
