(() => {
  const STORAGE_KEY = "skill_tracker_save_v2";
  const LEGACY_KEY = "skill_tracker_save_v1";
  const MAX_LOG = 5000;

  // Base URL for this subfolder (works on GitHub Pages subpaths)
  const BASE = new URL("./", window.location.href);
  const rel = (p) => new URL(p, BASE).toString();

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

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const now = () => Date.now();
  const fmtInt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n) || 0);
  const fmtXp = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n) || 0);
  const createId = () => (crypto?.randomUUID?.() ?? ("id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16)));

  // --- Mojibake repair (fixes ðŸ’ª style garbage if it made it into storage) ---
  function looksMojibake(s) {
    if (typeof s !== "string") return false;
    return s.includes("Ã") || s.includes("â") || s.includes("ð") || s.includes("Ÿ");
  }
  function fixMojibake(s) {
    if (typeof s !== "string") return s;
    if (!looksMojibake(s)) return s;
    try {
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
      const out = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return out || s;
    } catch {
      return s;
    }
  }

  // --- Leveling: triangular XP ---
  // Total XP required to reach Level L is L*(L+1)/2.
  // So Level 81 -> 82 costs 82 XP.
  function xpForLevel(L) {
    const n = Math.max(0, Math.floor(Number(L) || 0));
    return (n * (n + 1)) / 2;
  }
  function levelFromXp(xp) {
    const x = Math.max(0, Number(xp) || 0);
    return Math.floor((Math.sqrt(8 * x + 1) - 1) / 2);
  }
  function xpToNext(xp) {
    const x = Math.max(0, Number(xp) || 0);
    const L = levelFromXp(x);
    return Math.max(0, xpForLevel(L + 1) - x);
  }
  function levelProgress01(xp) {
    const x = Math.max(0, Number(xp) || 0);
    const L = levelFromXp(x);
    const start = xpForLevel(L);
    const span = (L + 1);
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, (x - start) / span));
  }

  function defaultSave() {
    const t = now();
    const skills = [
      { name: "Upper Front Strength", icon: "\u{1F4AA}", color: "#f97316" },
      { name: "Upper Back Strength", icon: "\u{1F9F1}", color: "#60a5fa" },
      { name: "Lower Front Strength", icon: "\u{1F9B5}", color: "#22c55e" },
      { name: "Lower Back Strength", icon: "\u{1F3CB}\u{FE0F}", color: "#a78bfa" },
      { name: "Walking", icon: "\u{1F6B6}", color: "#38bdf8" },
      { name: "Nutrition", icon: "\u{1F957}", color: "#84cc16" },
      { name: "Portion Control", icon: "\u{1F37D}\u{FE0F}", color: "#f59e0b" },
      { name: "Sleep", icon: "\u{1F634}", color: "#94a3b8" },
      { name: "Mobility", icon: "\u{1F9D8}", color: "#fb7185" },
      { name: "Hydration", icon: "\u{1F4A7}", color: "#0ea5e9" }
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
        defaultXpButtons: [1, 5, 10],
        backupReminder: true,
        profile: {
          name: "Pico",
          avatar: "" // chosen from manifest
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
        name: fixMojibake(String(profileIn.name ?? base.settings.profile.name)),
        avatar: String(profileIn.avatar ?? "")
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
    })).sort((p, q) => p.order - q.order).map((x, i) => ({ ...x, order: i }));

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
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  let state = load() || defaultSave();
  let saveTimer = null;

  function hardSave() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      hardSave();
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

  function haptic(ms = 10) {
    if (!state.settings.haptics) return;
    try { navigator.vibrate?.(ms); } catch {}
  }
  function beep(freq = 520, dur = 70) {
    if (!state.settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur / 1000);
      setTimeout(() => ctx.close().catch(() => {}), dur + 50);
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

  function addXp(skillId, amount, note = null) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) return;
    const s = state.skills.find(x => x.id === skillId);
    if (!s) return;

    commit(() => {
      s.xp = Math.max(0, (Number(s.xp) || 0) + amt);
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
        const amt = Number(g.amount) || 0;
        if (amt === 0) continue;
        s.xp = Math.max(0, (Number(s.xp) || 0) + amt);
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
        s.xp = Math.max(0, (Number(s.xp) || 0) - (Number(d.delta) || 0));
        s.updatedAt = now();
      }
      e.revertedAt = now();
    });
    tick();
  }

  // --- Sync code (reliable) ---
  // Prefer gzip->base64url with prefix "z:".
  // Fallback plain JSON->base64url with prefix "j:" (longer, but always works).
  function bytesToB64Url(bytes) {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function b64UrlToBytes(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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
    if (window.pako?.ungzip) return window.pako.ungzip(bytes, { to: "string" });
    throw new Error("No ungzip support");
  }

  async function makeSyncCode(obj) {
    const json = JSON.stringify(obj);
    try {
      const gz = await gzipString(json);
      return "z:" + bytesToB64Url(gz);
    } catch {
      // fallback
      const te = new TextEncoder();
      return "j:" + bytesToB64Url(te.encode(json));
    }
  }

  async function decodeSyncCode(code) {
    const raw = code.trim();
    const payload = raw.startsWith("z:") || raw.startsWith("j:") ? raw.slice(2) : raw;

    // try gzip first if explicitly z:, otherwise attempt both
    const isZ = raw.startsWith("z:");
    const isJ = raw.startsWith("j:");

    if (isJ) {
      const bytes = b64UrlToBytes(payload);
      const json = new TextDecoder().decode(bytes);
      return sanitizeSave(JSON.parse(json));
    }

    // gzip path
    try {
      const bytes = b64UrlToBytes(payload);
      const json = await ungzipToString(bytes);
      return sanitizeSave(JSON.parse(json));
    } catch (e) {
      if (isZ) throw e;
      // fallback to plain
      const bytes = b64UrlToBytes(payload);
      const json = new TextDecoder().decode(bytes);
      return sanitizeSave(JSON.parse(json));
    }
  }

  // --- Routing ---
  function route() {
    const h = location.hash || "#/home";
    if (h.startsWith("#save=")) return { page: "save", code: decodeURIComponent(h.slice(6)) };
    const cleaned = h.startsWith("#/") ? h.slice(2) : "home";
    const parts = cleaned.split("/").filter(Boolean);
    const page = parts[0] || "home";
    if (page === "skill") return { page: "skill", id: parts[1] || "" };
    if (page === "action") return { page: "action", id: parts[1] || "" };
    if (["home", "skills", "actions", "log", "settings"].includes(page)) return { page };
    return { page: "home" };
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
          ${actions.map((a, i) => `<button data-modal-act="${i}" class="${a.primary ? "btn-primary" : ""} ${a.danger ? "btn-danger" : ""}">${esc(a.label)}</button>`).join("")}
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
    window.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape") { el.remove(); window.removeEventListener("keydown", onKey); }
    });
  }

  // --- Avatars ---
  // Cannot auto-enumerate a folder on GitHub Pages.
  // We use profile/avatars.json generated by tools/gen-avatars.ps1
  async function loadAvatarList() {
    try {
      const res = await fetch(rel("./profile/avatars.json"), { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files.filter(x => typeof x === "string" && x.trim()) : [];
      return files;
    } catch {
      return [];
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
    if (!files.length) return;
    const pick = files[Math.floor(Math.random() * files.length)];
    commit(() => { state.settings.profile.avatar = pick; });
  }

  async function randomizeAvatar() {
    const files = await loadAvatarList();
    if (!files.length) {
      toast("Avatar list empty", "Run tools/gen-avatars.ps1 after adding images.");
      return;
    }
    const pick = files[Math.floor(Math.random() * files.length)];
    commit(() => { state.settings.profile.avatar = pick; });
    toast("Avatar", "Randomized.");
  }

  // --- Views ---
  function skillCard(s) {
    const L = levelFromXp(s.xp);
    const pct = Math.round(levelProgress01(s.xp) * 100);
    return `
      <div class="card" style="${s.color ? `border-color:${esc(s.color)}55` : ``}">
        <div class="row">
          <div class="row" style="justify-content:flex-start; gap:10px">
            <div class="avatar" style="${s.color ? `background:${esc(s.color)}` : ``}; width:40px; height:40px; border-radius:14px; display:grid; place-items:center; box-shadow:none">
              <span style="font-size:18px">${esc(s.icon || EM.star)}</span>
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
            <span class="small">Next: ${fmtInt(L + 1)}</span>
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
    const skills = state.skills.filter(s => !s.archived).sort((a, b) => a.order - b.order);
    const totalXp = skills.reduce((sum, s) => sum + (Number(s.xp) || 0), 0);
    const totalLevel = skills.reduce((sum, s) => sum + levelFromXp(s.xp), 0);

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

        <div class="card">
          <div class="row">
            <h2 class="h2">Quick Actions</h2>
            <button data-nav="actions">Manage</button>
          </div>
          ${qa.length === 0 ? `<p class="small" style="margin-top:10px">Create an action like "Gym session" -> +10 Upper Front Strength, +5 Walking.</p>` : `
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

  function settingsView() {
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "-";
    const lastBackup = state.meta.lastBackupAt ? new Date(state.meta.lastBackupAt).toLocaleString() : "-";

    const avatarFolderHint = rel("./profile/avatars/");

    return `
      <div class="stack">
        <div class="card">
          <h1 class="h1">Settings</h1>
          <p class="p">Backup, sync, testing tools.</p>

          <div class="hr"></div>
          <div class="row" style="flex-wrap:wrap; gap:8px; justify-content:flex-start">
            <span class="chip">Last saved: ${esc(lastSaved)}</span>
            <span class="chip">Last backup: ${esc(lastBackup)}</span>
          </div>
        </div>

        <div class="card">
          <h2 class="h2">Profile</h2>
          <p class="small">Random avatar uses profile/avatars.json generated by tools/gen-avatars.ps1</p>
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
          <div class="hr"></div>
          <div class="small">Put square images in: ${esc(avatarFolderHint)}</div>
          <div class="small">Then run: <b>apps/skill-tracker/tools/gen-avatars.ps1</b></div>
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
          <p class="small">Now reliable. Uses gzip if available, otherwise falls back to plain base64 JSON.</p>

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
          <p class="small">Use these to fix broken unicode saves and wipe for testing.</p>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button data-repair-save>Repair Unicode + Resave</button>
            <button class="btn-danger" data-reset-xp>Reset XP + Clear Log</button>
            <button class="btn-danger" data-factory-reset>Factory Reset (wipe everything)</button>
          </div>
        </div>
      </div>
    `;
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
          <div class="chip">Last saved: ${esc(lastSaved)}</div>
        </header>

        <main class="main">${content}</main>

        <nav class="nav" aria-label="Bottom navigation">
          <button class="navBtn ${activeTab === "home" ? "active" : ""}" data-nav="home"><div class="navEmoji">${EM.home}</div><div class="navLabel">Home</div></button>
          <button class="navBtn ${activeTab === "skills" ? "active" : ""}" data-nav="skills"><div class="navEmoji">${EM.scroll}</div><div class="navLabel">Skills</div></button>
          <button class="navBtn ${activeTab === "actions" ? "active" : ""}" data-nav="actions"><div class="navEmoji">${EM.bolt}</div><div class="navLabel">Actions</div></button>
          <button class="navBtn ${activeTab === "log" ? "active" : ""}" data-nav="log"><div class="navEmoji">${EM.clock}</div><div class="navLabel">Log</div></button>
          <button class="navBtn ${activeTab === "settings" ? "active" : ""}" data-nav="settings"><div class="navEmoji">${EM.gear}</div><div class="navLabel">Settings</div></button>
        </nav>
      </div>
    `;
  }

  function render() {
    setTheme(state.settings.theme);
    const r = route();
    let content = "";
    let activeTab = r.page;

    if (r.page === "home") content = homeView();
    else if (r.page === "settings") content = settingsView();
    else content = homeView(), activeTab = "home";

    $("#app").innerHTML = appShell(content, activeTab);

    // If share link save is present: prompt import
    if (r.page === "save") {
      setTimeout(() => {
        modal("Import shared save?", `<p>This link contains a full save snapshot. Importing will replace your current save.</p>`, [
          { label: "Cancel", onClick: (close) => { close(); nav("home"); } },
          {
            label: "Import", primary: true, onClick: async (close) => {
              try {
                const incoming = await decodeSyncCode(r.code);
                commit(() => { state = incoming; state.meta.lastBackupAt = now(); });
                toast("Imported", "Shared save loaded.");
              } catch (e) {
                toast("Invalid save", String(e));
              } finally {
                close();
                nav("home");
              }
            }
          }
        ]);
      }, 0);
    }
  }

  // --- Settings actions + delegation ---
  document.addEventListener("click", async (e) => {
    const navBtnEl = e.target.closest("[data-nav]");
    if (navBtnEl) { nav(navBtnEl.getAttribute("data-nav")); return; }

    const exportBtn = e.target.closest("[data-export]");
    if (exportBtn) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skill-tracker-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      commit(() => { state.meta.lastBackupAt = now(); });
      toast("Exported", "JSON downloaded.");
      return;
    }

    const importBtn = e.target.closest("[data-import]");
    if (importBtn) { $("#fileInput")?.click(); return; }

    if (e.target.closest("[data-random-avatar]")) {
      await randomizeAvatar();
      render();
      return;
    }

    if (e.target.closest("[data-repair-save]")) {
      commit(() => { state = sanitizeSave(state); });
      toast("Repaired", "Unicode fixed + resaved.");
      return;
    }

    if (e.target.closest("[data-reset-xp]")) {
      modal("Reset XP + clear log?", `<p>This sets all skill XP to 0 and clears the log. Skills & actions remain.</p>`, [
        { label: "Cancel", onClick: (close) => close() },
        {
          label: "Reset", danger: true, onClick: (close) => {
            commit(() => {
              const t = now();
              state.skills.forEach(s => { s.xp = 0; s.updatedAt = t; });
              state.log = [];
            });
            toast("Reset", "XP and log cleared.");
            close();
          }
        }
      ]);
      return;
    }

    if (e.target.closest("[data-factory-reset]")) {
      modal("Factory reset?", `<p>This wipes everything (skills, actions, log, profile).</p>`, [
        { label: "Cancel", onClick: (close) => close() },
        {
          label: "Wipe", danger: true, onClick: (close) => {
            try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); } catch {}
            state = defaultSave();
            hardSave();
            toast("Wiped", "Fresh save created.");
            close();
            render();
          }
        }
      ]);
      return;
    }

    const makeSyncBtn = e.target.closest("[data-make-sync]");
    if (makeSyncBtn) {
      try {
        const code = await makeSyncCode(state);
        const sync = $("#syncCode");
        const link = $("#shareLink");
        if (sync) sync.value = code;

        const base = window.location.href.split("#")[0];
        if (link) link.value = `${base}#save=${encodeURIComponent(code)}`;

        $("#copySyncBtn")?.removeAttribute("disabled");
        $("#copyLinkBtn")?.removeAttribute("disabled");

        commit(() => { state.meta.lastBackupAt = now(); });
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
  });

  document.addEventListener("change", (e) => {
    const pn = e.target.closest("[data-profile-name]");
    if (pn) { commit(() => { state.settings.profile.name = (pn.value || "Pico").trim() || "Pico"; }); return; }
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

  // PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(rel("./sw.js")).catch(() => {});
  }

  window.addEventListener("hashchange", render);

  // Ensure avatar exists on first load
  ensureAvatarPicked().finally(() => render());
})();
