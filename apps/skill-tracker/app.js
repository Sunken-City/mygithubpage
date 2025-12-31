(() => {
  const STORAGE_KEY = "skill_tracker_save_v1";
  const MAX_LOG = 5000;

  const $ = (sel, el=document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const now = () => Date.now();
  const fmtInt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n)||0);
  const fmtXp = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n)||0);
  const levelFromXp = (xp) => Math.floor(Math.max(0, Number(xp)||0));
  const toNext = (xp) => Math.max(0, (levelFromXp(xp)+1) - (Number(xp)||0));
  const progress = (xp) => {
    const x = Math.max(0, Number(xp)||0);
    return Math.max(0, Math.min(1, x - Math.floor(x)));
  };
  const createId = () => (crypto?.randomUUID?.() ?? ("id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16)));

  function defaultSave() {
    const t = now();
    const skills = [
      { name:"Upper Front Strength", icon:"ðŸ’ª", color:"#f97316" },
      { name:"Upper Back Strength", icon:"ðŸ§±", color:"#60a5fa" },
      { name:"Lower Front Strength", icon:"ðŸ¦µ", color:"#22c55e" },
      { name:"Lower Back Strength", icon:"ðŸ‹ï¸", color:"#a78bfa" },
      { name:"Walking", icon:"ðŸš¶", color:"#38bdf8" },
      { name:"Nutrition", icon:"ðŸ¥—", color:"#84cc16" },
      { name:"Portion Control", icon:"ðŸ½ï¸", color:"#f59e0b" },
      { name:"Sleep", icon:"ðŸ˜´", color:"#94a3b8" },
      { name:"Mobility", icon:"ðŸ§˜", color:"#fb7185" },
      { name:"Hydration", icon:"ðŸ’§", color:"#0ea5e9" }
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
      version: 1,
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
        backupReminder: true
      }
    };
  }

  function sanitizeSave(obj) {
    if (!obj || typeof obj !== "object") return defaultSave();
    const base = defaultSave();
    const s = Array.isArray(obj.skills) ? obj.skills : base.skills;
    const a = Array.isArray(obj.actions) ? obj.actions : [];
    const l = Array.isArray(obj.log) ? obj.log : [];
    const t = now();

    const skills = s.map((x, idx) => ({
      id: String(x.id || createId()),
      name: String(x.name || "Skill"),
      icon: x.icon ? String(x.icon) : "â­",
      color: x.color ? String(x.color) : null,
      xp: Math.max(0, Number(x.xp) || 0),
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || t,
      archived: !!x.archived,
      order: Number.isFinite(Number(x.order)) ? Number(x.order) : idx
    })).sort((p,q)=>p.order-q.order).map((x,i)=>({ ...x, order:i }));

    const actions = a.map((x) => ({
      id: String(x.id || createId()),
      name: String(x.name || "Action"),
      icon: x.icon ? String(x.icon) : null,
      grants: Array.isArray(x.grants) ? x.grants.map(g => ({
        skillId: String(g.skillId || ""),
        amount: Number(g.amount) || 0
      })).filter(g => g.skillId && g.amount !== 0) : [],
      createdAt: Number(x.createdAt) || t,
      updatedAt: Number(x.updatedAt) || t
    }));

    const log = l.map((e) => ({
      id: String(e.id || createId()),
      timestamp: Number(e.timestamp) || t,
      type: e.type === "action" ? "action" : "skill_xp",
      skillId: e.skillId ? String(e.skillId) : null,
      actionId: e.actionId ? String(e.actionId) : null,
      deltas: Array.isArray(e.deltas) ? e.deltas.map(d => ({
        skillId: String(d.skillId || ""),
        delta: Number(d.delta) || 0
      })).filter(d => d.skillId && d.delta !== 0) : [],
      note: e.note ? String(e.note) : null,
      revertedAt: e.revertedAt ? Number(e.revertedAt) : null
    }));

    const settings = { ...base.settings, ...(obj.settings && typeof obj.settings === "object" ? obj.settings : {}) };
    const meta = { ...base.meta, ...(obj.meta && typeof obj.meta === "object" ? obj.meta : {}) };

    return {
      version: 1,
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }

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

    // level-up detection
    for (const s of state.skills) {
      const prev = beforeLevels.get(s.id) ?? 0;
      const cur = levelFromXp(s.xp);
      if (cur > prev) {
        toast("Level up!", `${s.icon ? s.icon+" " : ""}${s.name} â†’ Level ${cur}`);
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
    throw new Error("No gzip support (CompressionStream missing and pako not available).");
  }
  async function ungzipToString(bytes) {
    if ("DecompressionStream" in window) {
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    if (window.pako?.ungzip) return window.pako.ungzip(bytes, { to: "string" });
    throw new Error("No ungzip support (DecompressionStream missing and pako not available).");
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
          <button class="iconbtn" data-modal-close aria-label="Close">âœ•</button>
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
          <div class="small">You havenâ€™t backed up yet. Export JSON or generate a sync code.</div>
        </div>
        <button class="btn-primary" data-nav="settings">Backup</button></div>
      </div>`;
      const days = Math.floor((Date.now()-last)/(1000*60*60*24));
      if (days < 7) return "";
      return `<div class="card" style="border-color:color-mix(in srgb, var(--warn) 55%, var(--border)); box-shadow:none">
        <div class="row"><div class="stack" style="gap:4px">
          <div class="h2">Backup reminder</div>
          <div class="small">Itâ€™s been ${days} days since your last backup.</div>
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
              <h1 class="h1">Dashboard</h1>
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
          ${qa.length === 0 ? `<p class="small" style="margin-top:10px">Create actions like â€œGym sessionâ€ â†’ +10 Upper Front Strength, +5 Walking.</p>` : `
            <div class="stack" style="margin-top:10px">
              ${qa.map(a => `
                <div class="card" style="box-shadow:none">
                  <div class="row">
                    <div class="stack" style="gap:2px">
                      <div class="h2">${esc(a.icon||"âš¡")} ${esc(a.name)}</div>
                      <div class="small">${a.grants.slice(0,3).map(g=>{
                        const sn = state.skills.find(s=>s.id===g.skillId)?.name ?? "Unknown";
                        return `${esc(sn)} +${fmtXp(g.amount)}`;
                      }).join(" â€¢ ")}${a.grants.length>3?" â€¢ â€¦":""}</div>
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

  function skillCard(s) {
    return `
      <div class="card" style="${s.color?`border-color:${esc(s.color)}55`:``}">
        <div class="row">
          <div class="row" style="justify-content:flex-start; gap:10px">
            <div class="brandMark" style="${s.color?`background:linear-gradient(135deg, ${esc(s.color)}, color-mix(in srgb, ${esc(s.color)} 55%, white))`:``}">
              <span style="font-size:18px">${esc(s.icon||"â­")}</span>
            </div>
            <div class="stack" style="gap:2px">
              <div class="h2">${esc(s.name)}</div>
              <div class="small">Level ${fmtInt(levelFromXp(s.xp))} â€¢ XP ${fmtXp(s.xp)}</div>
            </div>
          </div>
          <button data-open-skill="${esc(s.id)}">Open</button>
        </div>

        <div class="stack" style="margin-top:10px">
          <div class="progress"><div style="--w:${Math.round(progress(s.xp)*100)}%"></div></div>
          <div class="row">
            <span class="small">To next: ${fmtXp(toNext(s.xp))}</span>
            <span class="small">Next: ${fmtInt(levelFromXp(s.xp)+1)}</span>
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
            <button class="btn-primary" data-add-skill>+ Skill</button>
          </div>
          <div class="row" style="margin-top:10px; gap:10px">
            <input class="input" placeholder="Searchâ€¦" data-skill-search />
            <button data-toggle-reorder>Reorder</button>
          </div>
          <p class="small" style="margin:8px 0 0">Desktop: drag cards when reorder is on. Mobile: use â†‘/â†“ on each card.</p>
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

    const recent = [...state.log].slice().reverse().filter(e => !e.revertedAt && e.deltas.some(d=>d.skillId===id)).slice(0, 12);

    return `
      <div class="stack">
        <div class="card" style="${s.color?`border-color:${esc(s.color)}55`:``}">
          <div class="row">
            <div class="stack" style="gap:4px">
              <h1 class="h1">${esc(s.icon||"â­")} ${esc(s.name)}</h1>
              <div class="row" style="justify-content:flex-start; flex-wrap:wrap; gap:8px">
                <span class="chip">Level ${fmtInt(levelFromXp(s.xp))}</span>
                <span class="chip">XP ${fmtXp(s.xp)}</span>
                <span class="chip">To next ${fmtXp(toNext(s.xp))}</span>
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button data-edit-skill="${esc(s.id)}">Edit</button>
              <button data-nav="skills">Back</button>
            </div>
          </div>

          <div class="stack" style="margin-top:10px">
            <div class="progress"><div style="--w:${Math.round(progress(s.xp)*100)}%"></div></div>
            <div class="row">
              <span class="small">Next: ${fmtInt(levelFromXp(s.xp)+1)}</span>
              <span class="small">${Math.round(progress(s.xp)*100)}%</span>
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
                        <div class="h2">${e.type === "action" ? "âš¡ Action" : "â­ Skill XP"} â€¢ ${d?.delta>=0?"+":""}${fmtXp(d?.delta||0)}</div>
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
            <button class="btn-primary" data-new-action>+ Action</button>
          </div>
        </div>

        ${actions.length === 0 ? `
          <div class="card"><p class="small">Create an action like â€œGym sessionâ€ â†’ +10 Upper Front Strength, +5 Walking.</p></div>
        ` : `
          <div class="stack">
            ${actions.map(a => `
              <div class="card">
                <div class="row">
                  <div class="stack" style="gap:2px">
                    <div class="h2">${esc(a.icon||"âš¡")} ${esc(a.name)}</div>
                    <div class="small">${a.grants.slice(0,3).map(g=>{
                      const sn = state.skills.find(s=>s.id===g.skillId)?.name ?? "Unknown";
                      return `${esc(sn)} +${fmtXp(g.amount)}`;
                    }).join(" â€¢ ")}${a.grants.length>3?" â€¢ â€¦":""}</div>
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

  function actionDetailView(id) {
    const isNew = (id === "new");
    const a = isNew ? null : state.actions.find(x=>x.id===id);
    if (!isNew && !a) return `<div class="card"><h1 class="h1">Action not found</h1><button data-nav="actions">Back</button></div>`;

    const name = esc(a?.name || "");
    const icon = esc(a?.icon || "");
    const grants = a?.grants || [];

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
              <input class="input" data-action-name value="${name}" placeholder="Gym session" />
            </div>
            <div class="stack" style="gap:6px">
              <div class="small">Icon (optional)</div>
              <input class="input" data-action-icon value="${icon}" placeholder="ðŸ‹ï¸" />
            </div>
          </div>

          <div class="row" style="margin-top:12px">
            <h2 class="h2">Grants</h2>
            <button data-add-grant>Add grant</button>
          </div>

          <div id="grantList" class="stack" style="margin-top:10px">
            ${grants.length === 0 ? `<p class="small">No grants yet.</p>` : grants.map((g, idx) => `
              <div class="card" style="box-shadow:none">
                <div class="grid grid2" style="gap:10px">
                  <div class="stack" style="gap:6px">
                    <div class="small">Skill</div>
                    <select class="input" data-grant-skill="${idx}">
                      ${skills.map(s => `<option value="${esc(s.id)}" ${s.id===g.skillId?"selected":""}>${esc(s.icon||"â­")} ${esc(s.name)}</option>`).join("")}
                    </select>
                  </div>
                  <div class="stack" style="gap:6px">
                    <div class="small">Amount</div>
                    <input class="input" inputmode="decimal" data-grant-amt="${idx}" value="${esc(String(g.amount))}" />
                  </div>
                </div>
                <div class="row" style="margin-top:10px">
                  <span class="small">Tip: amounts can be negative.</span>
                  <button class="btn-danger" data-remove-grant="${idx}">Remove</button>
                </div>
              </div>
            `).join("")}
          </div>

          <div class="row" style="margin-top:12px">
            <button class="btn-primary" data-save-action="${esc(isNew ? "new" : a.id)}">Save</button>
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
                      ${e.type === "action" ? `âš¡ ${esc(actionName(e.actionId))}` : `â­ ${esc(skillName(e.skillId))}`}
                      ${e.revertedAt ? `<span class="small"> (undone)</span>` : ``}
                    </div>
                    <div class="small">${new Date(e.timestamp).toLocaleString()}</div>
                    <div class="small">
                      ${e.deltas.map(d => `${esc(skillName(d.skillId))} ${d.delta>=0?"+":""}${fmtXp(d.delta)}`).join(" â€¢ ")}
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
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "â€”";
    const lastBackup = state.meta.lastBackupAt ? new Date(state.meta.lastBackupAt).toLocaleString() : "â€”";

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

          <textarea class="input" id="syncCode" placeholder="Generate a sync codeâ€¦" style="margin-top:10px"></textarea>

          <div class="hr"></div>

          <div class="row" style="gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button data-copy-link disabled id="copyLinkBtn">Copy share link</button>
          </div>
          <textarea class="input" id="shareLink" placeholder="Share link appears hereâ€¦" style="margin-top:10px" readonly></textarea>

          <div class="hr"></div>

          <h2 class="h2">Import from Sync Code</h2>
          <textarea class="input" id="importCode" placeholder="Paste sync codeâ€¦" style="margin-top:10px"></textarea>
          <div class="row" style="margin-top:10px; gap:10px; justify-content:flex-start; flex-wrap:wrap">
            <button class="btn-danger" data-import-sync>Import code</button>
            <button data-clear-import>Clear</button>
          </div>
        </div>
      </div>
    `;
  }

  function appShell(content, activeTab) {
    const lastSaved = state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleString() : "â€”";
    return `
      <div class="shell">
        <div class="toastHost"></div>

        <header class="header">
          <div class="brand" data-nav="home">
            <div class="brandMark">XP</div>
            <div class="brandName">Skill Tracker</div>
          </div>
          <div class="chip">Last saved: ${esc(lastSaved)}</div>
        </header>

        <main class="main">${content}</main>

        <button class="fab" id="fab" aria-label="Add">+</button>

        <nav class="nav" aria-label="Bottom navigation">
          ${navBtn("home","ðŸ ","Home",activeTab)}
          ${navBtn("skills","ðŸ“œ","Skills",activeTab)}
          ${navBtn("actions","âš¡","Actions",activeTab)}
          ${navBtn("log","ðŸ•’","Log",activeTab)}
          ${navBtn("settings","âš™ï¸","Settings",activeTab)}
        </nav>
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
      // show import prompt after shell is in DOM
      setTimeout(() => {
        modal("Import shared save?", `<p>This link contains a full save snapshot. Importing will replace your current save.</p>
          <p class="small">Tip: export JSON first if you want a safe backup.</p>`, [
          { label:"Cancel", onClick:(close)=>{ close(); nav("home"); } },
          { label:"Import", primary:true, onClick: async (close) => {
            try {
              const incoming = await decodeSyncCode(r.code);
              commit(() => { state = incoming; state.meta.lastBackupAt = state.meta.lastBackupAt ?? null; });
              state.meta.lastBackupAt = now();
              scheduleSave();
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

    // FAB behavior (thumb-zone)
    const fab = $("#fab");
    if (fab) {
      fab.onclick = () => {
        const rr = route();
        if (rr.page === "skills" || rr.page === "skill") {
          openAddSkillModal();
        } else if (rr.page === "actions" || rr.page === "action") {
          nav("action/new");
        } else {
          modal("Quick add", `<p>What do you want to add?</p>`, [
            { label:"Cancel", onClick:(close)=>close() },
            { label:"+ Skill", primary:true, onClick:(close)=>{ close(); openAddSkillModal(); } },
            { label:"+ Action", onClick:(close)=>{ close(); nav("action/new"); } }
          ]);
        }
      };
    }

    // Skills reorder mode state (DOM-only)
    if (route().page === "skills") setupReorderHandlers();
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
          <input class="input" id="newSkillIcon" placeholder="â­" />
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
        const icon = ($("#newSkillIcon")?.value || "").trim() || "â­";
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
        const icon = ($("#editSkillIcon")?.value || "").trim() || "â­";
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

      // add up/down buttons only when reorderOn
      listEl.querySelectorAll("[data-reorder-controls]").forEach(x => x.remove());
      if (reorderOn) {
        listEl.querySelectorAll(".skillWrap").forEach(w => {
          const id = w.getAttribute("data-skill-wrap");
          const bar = document.createElement("div");
          bar.setAttribute("data-reorder-controls", "1");
          bar.className = "row";
          bar.style.marginBottom = "8px";
          bar.innerHTML = `
            <button class="iconbtn" data-move-up="${esc(id)}" aria-label="Move up">â†‘</button>
            <button class="iconbtn" data-move-down="${esc(id)}" aria-label="Move down">â†“</button>
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

    // search filters by hiding wrappers (doesn't mutate order)
    searchEl?.addEventListener("input", () => {
      const q = (searchEl.value || "").trim().toLowerCase();
      listEl?.querySelectorAll(".skillWrap").forEach(w => {
        const name = w.querySelector(".h2")?.textContent?.toLowerCase() ?? "";
        w.style.display = (!q || name.includes(q)) ? "" : "none";
      });
    });

    // drag/drop reorder
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
        // normalize
        state.skills = state.skills.sort((a,b)=>a.order-b.order).map((s,i)=>({ ...s, order:i }));
      });

      dragId = null;
      applyReorderUi();
    });

    applyReorderUi();
  }

  // Global click handling
  document.addEventListener("click", async (e) => {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) { nav(navBtn.getAttribute("data-nav")); return; }

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

    // reorder up/down
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

    // Actions detail
    const newAction = e.target.closest("[data-new-action]");
    if (newAction) { nav("action/new"); return; }

    const addGrant = e.target.closest("[data-add-grant]");
    if (addGrant) {
      const r = route();
      if (r.page !== "action") return;
      const isNew = (r.id === "new");
      const a = isNew ? null : state.actions.find(x=>x.id===r.id);
      // We'll store unsaved grants in DOM until save; easiest is rerender with a temporary draft.
      // So: keep a draft in session storage.
      const draft = getDraftAction(r.id, a);
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
      const a = r.id === "new" ? null : state.actions.find(x=>x.id===r.id);
      const draft = getDraftAction(r.id, a);
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
      const icon = ($("[data-action-icon]")?.value || "").trim() || null;

      // pull current grant fields from DOM
      const grants = draft.grants.map((g, idx) => {
        const skillId = ($(`[data-grant-skill="${idx}"]`)?.value || g.skillId);
        const amt = Number($(`[data-grant-amt="${idx}"]`)?.value ?? g.amount);
        return { skillId, amount: Number.isFinite(amt) ? amt : 0 };
      }).filter(g => g.skillId && g.amount !== 0);

      commit(() => {
        const t = now();
        if (isNew) {
          state.actions.push({
            id: createId(),
            name,
            icon,
            grants,
            createdAt: t,
            updatedAt: t
          });
        } else if (existing) {
          existing.name = name;
          existing.icon = icon;
          existing.grants = grants;
          existing.updatedAt = t;
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

    // Settings actions
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
  });

  // Draft action storage (kept only in-session)
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

  // input change handling for settings
  document.addEventListener("change", (e) => {
    const theme = e.target.closest("[data-theme]");
    if (theme) { commit(() => { state.settings.theme = theme.value; }); return; }

    const br = e.target.closest("[data-backup-reminder]");
    if (br) { commit(() => { state.settings.backupReminder = (br.value === "on"); }); return; }

    const h = e.target.closest("[data-haptics]");
    if (h) { commit(() => { state.settings.haptics = (h.value === "on"); }); return; }

    const s = e.target.closest("[data-sound]");
    if (s) { commit(() => { state.settings.sound = (s.value === "on"); }); return; }

    // action grant edits update draft
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

  // JSON import
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

  // service worker (scoped to this folder)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  // init
  let state = load() || defaultSave();

  window.addEventListener("hashchange", render);
  render();
})();