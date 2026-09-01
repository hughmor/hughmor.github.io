/* Photonic Computing Atlas — rendering engine (vanilla JS + Leaflet) */
(function () {
  "use strict";
  const DB = window.PHOTONIC_DB || { groups: [], people: [], papers: [], edges: [], meta: {} };

  // ---- palettes (mirror styles.css) ----
  const ARCH = {
    "mzi-mesh":       { label: "MZI mesh (coherent)",             color: "#f472b6" },
    "wdm-microring":  { label: "WDM microring (broadcast+weight)", color: "#38e1ff" },
    "phase-change":   { label: "Phase-change in-memory",          color: "#a78bfa" },
    "diffractive":    { label: "Diffractive (D2NN)",              color: "#fbbf24" },
    "reservoir":      { label: "Reservoir computing",             color: "#34d399" },
    "coherent-ising": { label: "Coherent Ising machine",          color: "#fb7185" },
    "frequency-comb": { label: "Frequency comb",                  color: "#60a5fa" },
    "foundational":   { label: "Foundational theory",             color: "#94a3b8" },
    "review":         { label: "Review / perspective",            color: "#94a3b8" },
    "other":          { label: "Other",                           color: "#94a3b8" },
  };
  const EDGE = {
    advisor:   { label: "Academic lineage", color: "#f5a524" },
    coauthor:  { label: "Co-authorship",    color: "#38e1ff" },
    founded:   { label: "Founded company",  color: "#c084fc" },
    colleague: { label: "Colleague",        color: "#64748b" },
  };
  const archColor = t => (ARCH[t] && ARCH[t].color) || "#94a3b8";

  // ---- indices ----
  const byId = arr => Object.fromEntries((arr || []).map(x => [x.id, x]));
  const groupsById = byId(DB.groups);
  const peopleById = byId(DB.people);
  const papersById = byId(DB.papers);

  const personGroup = {};
  (DB.people || []).forEach(p => { if (p.group_id) personGroup[p.id] = p.group_id; });
  (DB.groups || []).forEach(g => (g.pi_ids || []).forEach(pid => { if (!personGroup[pid]) personGroup[pid] = g.id; }));
  const endpointGroup = id => (groupsById[id] ? id : (personGroup[id] || null));

  function groupPeople(gid) {
    const set = new Set((DB.people || []).filter(p => p.group_id === gid).map(p => p.id));
    (groupsById[gid].pi_ids || []).forEach(id => set.add(id));
    return [...set].map(id => peopleById[id]).filter(Boolean);
  }
  function groupLead(g) {
    const ids = (g.pi_ids && g.pi_ids.length) ? g.pi_ids : groupPeople(g.id).map(p => p.id);
    const people = ids.map(id => peopleById[id]).filter(Boolean);
    return people.find(p => p.photo) || people[0] || null;
  }
  function initialsOf(str) {
    return (str || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // photo <img> with graceful fallback to initials
  function photoHTML(person, fallbackName) {
    const ini = esc(initialsOf(person ? person.name : fallbackName));
    if (person && person.photo) {
      return `<img src="${esc(person.photo)}" alt="" class="pinimg" data-ini="${ini}" ` +
        `onerror="this.outerHTML='&lt;div class=&quot;pin-initials&quot;&gt;'+this.dataset.ini+'&lt;/div&gt;'">`;
    }
    return `<div class="pin-initials">${ini}</div>`;
  }

  // ---- state ----
  const state = {
    arch: new Set(Object.keys(ARCH)),
    startups: true,
    quantum: false,
    lineageHover: true,
    tab: "papers",           // 'papers' | 'people'
    paperSort: "citations",  // 'citations' | 'year'
    peopleSort: "citations", // 'citations' | 'name'
    query: "",
    selection: null, // {kind:'group'|'person'|'paper', id}
  };

  function groupTags(g) { return (g.architecture_tags && g.architecture_tags.length) ? g.architecture_tags : ["other"]; }

  function groupMatchesQuery(g) {
    if (!state.query) return true;
    const q = state.query;
    if ((g.name || "").toLowerCase().includes(q)) return true;
    if ((g.institution || "").toLowerCase().includes(q)) return true;
    if ((g.city || "").toLowerCase().includes(q)) return true;
    return groupPeople(g.id).some(p => (p.name || "").toLowerCase().includes(q));
  }
  function groupVisible(g) {
    if (typeof g.lat !== "number" || typeof g.lng !== "number") return false;
    if (g.domain === "quantum" && !state.quantum) return false;
    if (g.type === "startup" && !state.startups) return false;
    if (!groupTags(g).some(t => state.arch.has(t))) return false;
    if (!groupMatchesQuery(g)) return false;
    return true;
  }

  // ---- map ----
  const map = L.map("map", { zoomControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 19 })
    .setView([38, -20], 3);
  // CARTO's free basemaps now stamp "API KEY REQUIRED" into every tile image, so
  // this uses Esri's dark canvas instead. No key, and note the {z}/{y}/{x} order.
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 20, maxNativeZoom: 20,
    attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const webLayer = L.layerGroup().addTo(map);
  // cluster overlapping pins; they split apart on zoom and spiderfy (pop out to a ring of faces) on click
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 46,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.9,
    removeOutsideVisibleBounds: false,
    spiderLegPolylineOptions: { weight: 1.2, color: "#38e1ff", opacity: 0.45 },
    iconCreateFunction: c => L.divIcon({ className: "", html: `<div class="cluster-pin">${c.getChildCount()}</div>`, iconSize: [42, 42], iconAnchor: [21, 21] }),
  }).addTo(map);

  // ---- pins ----
  const markers = {}; // gid -> L.marker
  const SIZE = 46;
  function makeIcon(g) {
    const lead = groupLead(g);
    const ring = archColor(groupTags(g)[0]);
    const cls = g.type === "startup" ? "pin startup" : "pin";
    const html = `<div class="${cls}" style="--ring:${ring}"><div class="pin-photo">${photoHTML(lead, g.institution)}</div></div>`;
    return L.divIcon({ className: "", html, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2] });
  }
  DB.groups.forEach(g => {
    if (typeof g.lat !== "number" || typeof g.lng !== "number") return;
    const m = L.marker([g.lat, g.lng], { icon: makeIcon(g), riseOnHover: true });
    m.groupId = g.id;
    m.on("click", () => selectGroup(g.id));
    m.on("mouseover", () => { if (state.lineageHover && !state.selection) applyWeb(computeWeb({ kind: "group", id: g.id })); });
    m.on("mouseout", () => { if (!state.selection) { clearWeb(); undim(); } });
    markers[g.id] = m;
  });

  function pinEl(gid) { const m = markers[gid]; return m && m.getElement() ? m.getElement().querySelector(".pin") : null; }
  function refreshPins() {
    const show = [], bounds = [];
    Object.values(markers).forEach(m => {
      if (groupVisible(groupsById[m.groupId])) { show.push(m); bounds.push(m.getLatLng()); }
    });
    cluster.clearLayers();
    cluster.addLayers(show);
    return bounds;
  }
  function undim() { Object.keys(markers).forEach(gid => { const el = pinEl(gid); if (el) el.classList.remove("dim", "selected"); }); }

  // ---- connection web ----
  function curve(a, b, bend) {
    const [y1, x1] = a, [y2, x2] = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / len) * bend * len, cy = my + (dx / len) * bend * len;
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
      const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
      pts.push([y, x]);
    }
    return pts;
  }
  function clearWeb() { webLayer.clearLayers(); }
  function drawLine(fromG, toG, color, bend) {
    const a = markers[fromG] && markers[fromG].getLatLng();
    const b = markers[toG] && markers[toG].getLatLng();
    if (!a || !b) return;
    const pts = curve([a.lat, a.lng], [b.lat, b.lng], bend);
    L.polyline(pts, { color, weight: 6, opacity: 0.16, interactive: false, lineCap: "round" }).addTo(webLayer);
    L.polyline(pts, { color, weight: 2, opacity: 0.92, interactive: false, lineCap: "round" }).addTo(webLayer);
  }

  // compute {activeGroups:Set, lines:[{from,to,color}]}
  function computeWeb(sel) {
    const activeGroups = new Set();
    const lines = [];
    const seenPair = {};
    const addLine = (from, to, color) => {
      if (!from || !to || from === to) return;
      const k = [from, to].sort().join("|") + "|" + color;
      const idx = seenPair[k] = (seenPair[k] || 0);
      seenPair[k] = idx + 1;
      const bend = 0.12 + idx * 0.08;
      lines.push({ from, to, color, bend });
    };

    if (sel.kind === "paper") {
      const p = papersById[sel.id];
      if (!p) return { activeGroups, lines };
      const gids = [...new Set((p.author_ids || []).map(endpointGroup).filter(Boolean))]
        .filter(gid => groupVisible(groupsById[gid]));
      gids.forEach(g => activeGroups.add(g));
      const color = archColor(p.architecture_tag);
      for (let i = 0; i < gids.length; i++)
        for (let j = i + 1; j < gids.length; j++) addLine(gids[i], gids[j], color);
      return { activeGroups, lines };
    }

    // group or person selection
    const selGroup = sel.kind === "group" ? sel.id : personGroup[sel.id];
    if (!selGroup) return { activeGroups, lines };
    activeGroups.add(selGroup);
    (DB.edges || []).forEach(e => {
      const ga = endpointGroup(e.source), gb = endpointGroup(e.target);
      if (!ga || !gb) return;
      let mine, other;
      if (sel.kind === "person") {
        if (e.source === sel.id) { mine = ga; other = gb; }
        else if (e.target === sel.id) { mine = gb; other = ga; }
        else return;
      } else {
        if (ga === selGroup) { mine = ga; other = gb; }
        else if (gb === selGroup) { mine = gb; other = ga; }
        else return;
      }
      if (!other || other === mine) return;
      if (!groupVisible(groupsById[other])) return; // respects quantum toggle
      activeGroups.add(other);
      addLine(mine, other, (EDGE[e.type] || EDGE.colleague).color);
    });
    return { activeGroups, lines };
  }

  function applyWeb(web) {
    clearWeb();
    web.lines.forEach(l => drawLine(l.from, l.to, l.color, l.bend));
    const doDim = web.activeGroups.size > 1; // a lone node shouldn't black out the whole map
    Object.keys(markers).forEach(gid => {
      const el = pinEl(gid); if (!el) return;
      if (web.activeGroups.has(gid)) { el.classList.add("selected"); el.classList.remove("dim"); }
      else if (doDim) { el.classList.add("dim"); el.classList.remove("selected"); }
      else { el.classList.remove("dim", "selected"); }
    });
  }

  // Camera on selection — only when the selection CHANGES (not on every filter/search render).
  // Papers fit all co-authors; a person/group zooms IN to their location and never zooms out.
  const NEAR_ZOOM = 7;
  let lastCamKey = null;
  function cameraForSelection(sel, web) {
    const key = sel.kind + ":" + sel.id;
    if (key === lastCamKey) return;
    lastCamKey = key;
    if (sel.kind === "paper") {
      if (web.activeGroups.size > 1) {
        const pts = [...web.activeGroups].map(g => markers[g] && markers[g].getLatLng()).filter(Boolean);
        if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 8, duration: 0.6 });
      }
      return;
    }
    const gid = sel.kind === "group" ? sel.id : personGroup[sel.id];
    const m = gid && markers[gid];
    if (m) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), NEAR_ZOOM), { duration: 0.6 });
  }

  // ---- selection ----
  let hashLock = false;
  function syncHash() { hashLock = true; const s = state.selection; location.hash = s ? `${s.kind}=${s.id}` : ""; setTimeout(() => hashLock = false, 0); }
  function selectGroup(gid) { state.selection = { kind: "group", id: gid }; render(); syncHash(); }
  function selectPerson(pid) { state.selection = { kind: "person", id: pid }; render(); syncHash(); }
  function selectPaper(pid) { state.selection = { kind: "paper", id: pid }; render(); syncHash(); }
  function clearSelection() { state.selection = null; render(); syncHash(); }
  function applyHash() {
    const m = /^#(group|person|paper)=(.+)$/.exec(location.hash);
    state.selection = m ? { kind: m[1], id: decodeURIComponent(m[2]) } : null;
    render();
  }
  window.addEventListener("hashchange", () => { if (!hashLock) applyHash(); });

  function render() {
    refreshPins();
    if (state.selection) {
      const web = computeWeb(state.selection);
      applyWeb(web);
      cameraForSelection(state.selection, web);
      renderDetail();
      renderBanner();
    } else {
      clearWeb(); undim();
      lastCamKey = null;
      hideDetail();
      renderBanner();
    }
    renderPapers();
    renderPeople();
    renderCompanies();
    const sel = state.selection;
    document.querySelectorAll("#paper-list .paper-item").forEach(el =>
      el.classList.toggle("active", sel && sel.kind === "paper" && el.dataset.id === sel.id));
    document.querySelectorAll("#people-list .person-item").forEach(el =>
      el.classList.toggle("active", sel && sel.kind === "person" && el.dataset.id === sel.id));
    document.querySelectorAll("#company-list .person-item").forEach(el =>
      el.classList.toggle("active", sel && sel.kind === "group" && el.dataset.group === sel.id));
  }

  // ---- detail panel ----
  const detail = document.getElementById("detail");
  const detailBody = document.getElementById("detail-body");
  function hideDetail() { detail.classList.add("hidden"); }
  function tagChips(tags) {
    return (tags || []).map(t => `<span class="chip" style="color:${archColor(t)}"><span class="dot" style="background:${archColor(t)}"></span>${esc((ARCH[t] || {}).label || t)}</span>`).join("");
  }
  function connectionRows(sel) {
    const web = computeWeb(sel);
    const rows = [];
    const selGroup = sel.kind === "group" ? sel.id : personGroup[sel.id];
    (DB.edges || []).forEach(e => {
      const ga = endpointGroup(e.source), gb = endpointGroup(e.target);
      let other = null, involves = false;
      if (sel.kind === "person") { if (e.source === sel.id) { other = gb; involves = true; } else if (e.target === sel.id) { other = ga; involves = true; } }
      else { if (ga === selGroup && gb !== selGroup) { other = gb; involves = true; } else if (gb === selGroup && ga !== selGroup) { other = ga; involves = true; } }
      if (!involves || !other || other === selGroup) return;
      const og = groupsById[other]; if (!og) return;
      if (og.domain === "quantum" && !state.quantum) return;
      const ec = (EDGE[e.type] || EDGE.colleague);
      const who = e.source === sel.id || e.target === sel.id
        ? (peopleById[e.source === sel.id ? e.target : e.source] || {}).name || og.name
        : og.name;
      rows.push(`<li class="conn-item" data-group="${esc(other)}"><span class="bar" style="background:${ec.color}"></span><span class="who">${esc(who || og.institution)}<div class="rel" style="color:${ec.color}">${esc(ec.label)}${e.notes ? " · " + esc(e.notes) : ""}</div></span></li>`);
    });
    return rows.join("") || `<li class="conn-item"><span class="who" style="color:var(--text-faint)">No mapped connections yet</span></li>`;
  }
  function renderDetail() {
    const sel = state.selection;
    if (sel.kind === "paper") { renderPaperDetail(papersById[sel.id]); return; }
    if (sel.kind === "person") { renderPersonDetail(peopleById[sel.id]); return; }
    const g = groupsById[sel.id]; if (!g) return hideDetail();
    const lead = groupLead(g);
    const ring = archColor(groupTags(g)[0]);
    const people = groupPeople(g.id);
    const peopleHTML = people.map(p =>
      `<div class="detail-person" data-person="${esc(p.id)}">${photoHTML(p, p.name)}<div><div class="dp-name">${esc(p.name)}</div><div class="dp-role">${esc(p.role || "")}${p.citations_total ? " · " + Number(p.citations_total).toLocaleString() + " cites" : ""}</div></div></div>`).join("");
    detailBody.innerHTML =
      `<div class="detail-hero" style="--ring:${ring}">${photoHTML(lead, g.institution)}
        <div><h2 class="detail-name">${esc(g.name)}</h2>
        <p class="detail-role">${g.type === "startup" ? "Company" : "Research group"}${g.city ? " · " + esc(g.city) : ""}${g.country ? ", " + esc(g.country) : ""}</p>
        <p class="detail-inst">${esc(g.institution)}</p></div></div>
      ${g.notes ? `<div class="detail-section"><p class="detail-note">${esc(g.notes)}</p></div>` : ""}
      <div class="detail-section"><h3>Architectures</h3><div class="detail-tags">${tagChips(groupTags(g))}</div></div>
      <div class="detail-section"><h3>People</h3><div class="detail-people">${peopleHTML || '<span class="detail-note">—</span>'}</div></div>
      <div class="detail-section"><h3>Connections</h3><ul class="conn-list">${connectionRows(sel)}</ul></div>
      ${g.url ? `<div class="detail-links"><a href="${esc(g.url)}" target="_blank" rel="noopener">Website ↗</a></div>` : ""}`;
    wireDetail();
    detail.classList.remove("hidden");
  }
  function renderPersonDetail(p) {
    if (!p) return hideDetail();
    const g = groupsById[personGroup[p.id]];
    const ring = archColor(g ? groupTags(g)[0] : "other");
    const advisors = (p.advisor_ids || []).map(id => (peopleById[id] || {}).name).filter(Boolean);
    detailBody.innerHTML =
      `<div class="detail-hero" style="--ring:${ring}">${photoHTML(p, p.name)}
        <div><h2 class="detail-name">${esc(p.name)}</h2>
        <p class="detail-role">${esc(p.role || "")}</p>
        <p class="detail-inst">${esc(p.institution || (g && g.institution) || "")}</p></div></div>
      ${p.citations_total ? `<div class="detail-section"><div class="detail-stat"><b>${Number(p.citations_total).toLocaleString()}</b> citations (Google Scholar, approx.)</div></div>` : ""}
      ${p.notes ? `<div class="detail-section"><p class="detail-note">${esc(p.notes)}</p></div>` : ""}
      ${(advisors.length || (p.prior_labs || []).length || p.phd_institution) ? `<div class="detail-section"><h3>Lineage</h3><p class="detail-note">${advisors.length ? "Advised by " + advisors.map(esc).join(", ") + ". " : ""}${p.phd_institution ? "PhD: " + esc(p.phd_institution) + ". " : ""}${(p.prior_labs || []).length ? "Prior: " + (p.prior_labs || []).map(esc).join("; ") + "." : ""}</p></div>` : ""}
      <div class="detail-section"><h3>Connections</h3><ul class="conn-list">${connectionRows({ kind: "person", id: p.id })}</ul></div>
      <div class="detail-links">${p.scholar_url ? `<a href="${esc(p.scholar_url)}" target="_blank" rel="noopener">Scholar ↗</a>` : ""}${p.homepage ? `<a href="${esc(p.homepage)}" target="_blank" rel="noopener">Homepage ↗</a>` : ""}${g ? `<a href="#" data-group="${esc(g.id)}">${esc(g.name)} ↗</a>` : ""}</div>`;
    wireDetail();
    detail.classList.remove("hidden");
  }
  function renderPaperDetail(p) {
    if (!p) return hideDetail();
    const color = archColor(p.architecture_tag);
    const authors = (p.author_names || []).map(n => {
      const pid = (p.author_ids || []).find(id => peopleById[id] && sameName(peopleById[id].name, n));
      return pid ? `<a href="#" data-person="${esc(pid)}" style="color:var(--accent);text-decoration:none">${esc(n)}</a>` : esc(n);
    }).join(", ");
    detailBody.innerHTML =
      `<div class="detail-section" style="padding-top:18px"><span class="chip" style="color:${color}"><span class="dot" style="background:${color}"></span>${esc((ARCH[p.architecture_tag] || {}).label || p.architecture_tag)}</span>
        <h2 class="detail-name" style="margin-top:10px">${esc(p.title)}</h2>
        <p class="detail-role">${esc(p.venue)} · ${esc(p.year)} · <b style="color:var(--text)">${Number(p.citations).toLocaleString()}</b> citations</p></div>
      ${p.notes ? `<div class="detail-section"><p class="detail-note">${esc(p.notes)}</p></div>` : ""}
      <div class="detail-section"><h3>Authors <span style="color:var(--text-faint);text-transform:none;letter-spacing:0">(mapped in blue)</span></h3><p class="detail-note">${authors}</p></div>
      ${p.doi_or_url ? `<div class="detail-links"><a href="${esc(p.doi_or_url)}" target="_blank" rel="noopener">Paper ↗</a></div>` : ""}`;
    wireDetail();
    detail.classList.remove("hidden");
  }
  function wireDetail() {
    detailBody.querySelectorAll("[data-person]").forEach(el => el.addEventListener("click", ev => { ev.preventDefault(); selectPerson(el.dataset.person); }));
    detailBody.querySelectorAll("[data-group]").forEach(el => el.addEventListener("click", ev => { ev.preventDefault(); selectGroup(el.dataset.group); }));
  }

  // ---- papers sidebar ----
  function sameName(a, b) {
    const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\-]/g, " ").split(/\s+/).filter(Boolean);
    const A = norm(a), B = norm(b);
    if (!A.length || !B.length) return false;
    const lastA = A[A.length - 1], lastB = B[B.length - 1];
    return lastA === lastB && A[0][0] === B[0][0];
  }
  function paperVisible(p) {
    if (p.domain === "quantum" && !state.quantum) return false;
    if (!state.arch.has(p.architecture_tag)) return false;
    if (state.query) {
      const q = state.query;
      if (!(p.title || "").toLowerCase().includes(q) && !(p.author_names || []).join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  }
  function renderPapers() {
    const list = document.getElementById("paper-list");
    const papers = (DB.papers || []).filter(paperVisible).sort((a, b) =>
      state.paperSort === "year" ? (b.year - a.year || b.citations - a.citations) : (b.citations - a.citations));
    list.innerHTML = papers.map(p => {
      const color = archColor(p.architecture_tag);
      return `<li class="paper-item" data-id="${esc(p.id)}">
        <div class="paper-title">${esc(p.title)}</div>
        <div class="paper-meta">
          <span class="arch-tag" style="color:${color}"><span class="dot" style="background:${color}"></span>${esc((ARCH[p.architecture_tag] || {}).label || p.architecture_tag)}</span>
          <span>· ${esc(p.year)}</span>
          <span class="paper-cite">${Number(p.citations).toLocaleString()}<small> cites</small></span>
        </div></li>`;
    }).join("");
    list.querySelectorAll(".paper-item").forEach(el => el.addEventListener("click", () => {
      if (state.selection && state.selection.kind === "paper" && state.selection.id === el.dataset.id) clearSelection();
      else selectPaper(el.dataset.id);
    }));
  }

  // ---- people list (sidebar "People" tab) ----
  function personVisible(p) {
    if (p.domain === "quantum" && !state.quantum) return false;
    if (state.query) {
      const q = state.query;
      if (!(p.name || "").toLowerCase().includes(q) && !(p.institution || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }
  function renderPeople() {
    const list = document.getElementById("people-list");
    const people = (DB.people || []).filter(personVisible).sort((a, b) =>
      state.peopleSort === "name"
        ? (a.name || "").localeCompare(b.name || "")
        : ((b.citations_total || 0) - (a.citations_total || 0) || (a.name || "").localeCompare(b.name || "")));
    list.innerHTML = people.map(p => {
      const g = groupsById[personGroup[p.id]];
      const ring = archColor(g ? groupTags(g)[0] : "other");
      return `<li class="person-item" data-id="${esc(p.id)}">
        <div class="pi-ph" style="--ring:${ring}">${photoHTML(p, p.name)}</div>
        <div class="pi-info"><div class="pi-name">${esc(p.name)}</div><div class="pi-sub">${esc(p.institution || (g && g.institution) || "—")}</div></div>
        ${p.citations_total ? `<div class="pi-cite">${Number(p.citations_total).toLocaleString()}</div>` : ""}
      </li>`;
    }).join("");
    list.querySelectorAll(".person-item").forEach(el => el.addEventListener("click", () => {
      if (state.selection && state.selection.kind === "person" && state.selection.id === el.dataset.id) clearSelection();
      else selectPerson(el.dataset.id);
    }));
  }

  // ---- companies list (sidebar "Companies" tab) ----
  function companyVisible(g) {
    if (g.type === "academic") return false; // startups + industry labs
    if (g.domain === "quantum" && !state.quantum) return false;
    if (state.query) {
      const q = state.query;
      if (!(g.name || "").toLowerCase().includes(q) && !(g.institution || "").toLowerCase().includes(q) && !(g.city || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }
  function renderCompanies() {
    const list = document.getElementById("company-list");
    const cos = (DB.groups || []).filter(companyVisible).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    list.innerHTML = cos.map(g => {
      const lead = groupLead(g), ring = archColor(groupTags(g)[0]);
      const loc = [g.city, g.country].filter(Boolean).join(", ");
      return `<li class="person-item" data-group="${esc(g.id)}">
        <div class="pi-ph" style="--ring:${ring}">${photoHTML(lead, g.name)}</div>
        <div class="pi-info"><div class="pi-name">${esc(g.name)}</div><div class="pi-sub">${esc(loc || g.institution)}</div></div>
        <span class="arch-tag" style="color:${ring}"><span class="dot" style="background:${ring}"></span></span>
      </li>`;
    }).join("");
    list.querySelectorAll(".person-item").forEach(el => el.addEventListener("click", () => {
      if (state.selection && state.selection.kind === "group" && state.selection.id === el.dataset.group) clearSelection();
      else selectGroup(el.dataset.group);
    }));
  }

  // ---- banner ----
  const banner = document.getElementById("selection-banner");
  const bannerText = document.getElementById("selection-text");
  function renderBanner() {
    if (!state.selection) { banner.classList.add("hidden"); return; }
    const s = state.selection;
    let label = "";
    if (s.kind === "group") label = "Network of " + (groupsById[s.id] || {}).name;
    else if (s.kind === "person") label = "Network of " + (peopleById[s.id] || {}).name;
    else if (s.kind === "paper") label = "Co-authors of “" + ((papersById[s.id] || {}).title || "").slice(0, 60) + "…”";
    bannerText.textContent = label;
    banner.classList.remove("hidden");
  }
  document.getElementById("clear-selection").addEventListener("click", clearSelection);
  document.getElementById("detail-close").addEventListener("click", clearSelection);
  map.on("click", clearSelection);

  // ---- filters / toggles / search ----
  function buildArchFilters() {
    const present = new Set();
    DB.groups.forEach(g => groupTags(g).forEach(t => present.add(t)));
    DB.papers.forEach(p => present.add(p.architecture_tag));
    const wrap = document.getElementById("arch-filters");
    wrap.innerHTML = Object.keys(ARCH).filter(t => present.has(t) && t !== "review" && t !== "other" && t !== "foundational")
      .map(t => `<span class="chip" data-arch="${t}" style="color:${ARCH[t].color}"><span class="dot" style="background:${ARCH[t].color}"></span>${esc(ARCH[t].label)}</span>`).join("");
    wrap.querySelectorAll("[data-arch]").forEach(el => el.addEventListener("click", () => {
      const t = el.dataset.arch;
      if (state.arch.has(t)) { state.arch.delete(t); el.classList.add("off"); }
      else { state.arch.add(t); el.classList.remove("off"); }
      render();
    }));
  }
  document.getElementById("toggle-startups").addEventListener("change", e => { state.startups = e.target.checked; render(); });
  document.getElementById("toggle-quantum").addEventListener("change", e => { state.quantum = e.target.checked; render(); });
  document.getElementById("toggle-lineage").addEventListener("change", e => { state.lineageHover = e.target.checked; });
  const sortPrimary = document.getElementById("sort-primary");
  const sortSecondary = document.getElementById("sort-secondary");
  function updateSortButtons() {
    if (state.tab === "companies") { // companies are A–Z only
      sortPrimary.textContent = "A–Z"; sortPrimary.classList.add("active");
      sortSecondary.classList.add("hidden");
      return;
    }
    sortSecondary.classList.remove("hidden");
    sortPrimary.textContent = "Most cited";
    sortSecondary.textContent = state.tab === "papers" ? "Newest" : "A–Z";
    const cur = state.tab === "papers" ? state.paperSort : state.peopleSort;
    sortPrimary.classList.toggle("active", cur === "citations");
    sortSecondary.classList.toggle("active", cur !== "citations");
  }
  function setSort(val) {
    if (state.tab === "companies") return; // companies are A–Z only
    if (state.tab === "papers") { state.paperSort = val; renderPapers(); }
    else { state.peopleSort = val; renderPeople(); }
    updateSortButtons();
  }
  sortPrimary.addEventListener("click", () => setSort("citations"));
  sortSecondary.addEventListener("click", () => setSort(state.tab === "papers" ? "year" : "name"));
  function activateTab(name) {
    state.tab = name;
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.tab === name));
    document.getElementById("paper-list").classList.toggle("hidden", name !== "papers");
    document.getElementById("people-list").classList.toggle("hidden", name !== "people");
    document.getElementById("company-list").classList.toggle("hidden", name !== "companies");
    updateSortButtons();
  }
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => activateTab(t.dataset.tab)));
  let searchTimer;
  document.getElementById("search").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value.trim().toLowerCase(); render(); }, 120);
  });

  // ---- legend ----
  function buildLegend() {
    const present = new Set();
    DB.groups.forEach(g => groupTags(g).forEach(t => present.add(t)));
    const archRows = Object.keys(ARCH).filter(t => present.has(t))
      .map(t => `<div class="legend-row"><span class="dot" style="color:${ARCH[t].color};background:${ARCH[t].color}"></span>${esc(ARCH[t].label)}</div>`).join("");
    const edgeRows = Object.keys(EDGE)
      .map(t => `<div class="legend-row"><span class="line" style="background:${EDGE[t].color}"></span>${esc(EDGE[t].label)}</div>`).join("");
    document.getElementById("legend-body").innerHTML =
      `<div class="legend-group"><h4>Architecture (pin ring)</h4>${archRows}</div>
       <div class="legend-group"><h4>Connections</h4>${edgeRows}</div>
       <div class="legend-group"><h4>Pin shape</h4><div class="legend-row"><span class="dot" style="background:#8aa;border-radius:50%"></span>Academic group</div><div class="legend-row"><span class="dot" style="background:#8aa;border-radius:3px"></span>Company</div></div>`;
    const body = document.getElementById("legend-body");
    document.getElementById("legend-toggle").addEventListener("click", () => body.classList.toggle("hidden"));
    body.classList.add("hidden");
  }

  // ---- footer ----
  function renderFooter() {
    const nG = DB.groups.filter(g => g.domain !== "quantum").length;
    const nP = DB.people.filter(p => p.domain !== "quantum").length;
    document.getElementById("stats").textContent = `${nG} groups · ${nP} people · ${DB.papers.length} papers`;
    document.getElementById("asof").textContent = DB.meta && DB.meta.updated ? "updated " + DB.meta.updated : "";
  }

  // ---- init ----
  buildArchFilters();
  buildLegend();
  renderFooter();
  render();
  // fit to visible groups on load
  const b = Object.values(markers).filter(m => groupVisible(groupsById[m.groupId])).map(m => m.getLatLng());
  if (b.length) map.fitBounds(L.latLngBounds(b).pad(0.15), { maxZoom: 5 });
  const view = new URLSearchParams(location.search).get("view"); // deep-link: ?view=people|companies
  activateTab(["people", "companies"].includes(view) ? view : "papers");
  if (location.hash) applyHash(); // deep-link: #group=… / #person=… / #paper=…

  window.ATLAS = { selectGroup, selectPerson, selectPaper, clearSelection, DB }; // debug hook
})();
