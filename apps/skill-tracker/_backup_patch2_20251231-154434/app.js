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
    return s.includes("Ãƒ") || s.includes("Ã¢") || s.includes("Ã°") || s.includes("Å¸");
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