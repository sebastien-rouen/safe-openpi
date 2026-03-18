// ============================================================
// PIPREP — Préparation PI Planning
// Données persistées dans data/piprep.json via le serveur
// ============================================================

// ----------- Helpers persistance JSON ----------------------
// piprep.json stores data per PI: { "_currentPI": "PI29", "PI29": { objectives, roam, deps, capacity }, "PI28": { ... } }
let _ppFile = null;            // cache mémoire du fichier complet (multi-PI)
let _ppLoaded = false;         // true après le 1er chargement

// Detect current PI identifier from sprint names (e.g. "Fuego - Ité. 28.3" → "PI28")
function _ppDetectPI() {
  const teams = Object.values(CONFIG.teams || {});
  for (const tc of teams) {
    const name = tc.sprintName || '';
    const m = name.match(/(\d+)\.\d+\s*$/);
    if (m) return 'PI' + m[1];
  }
  const label = CONFIG.sprint?.label || '';
  const m2 = label.match(/(\d+)\.\d+/);
  if (m2) return 'PI' + m2[1];
  return 'PI0';
}

function _ppCurrentPI() {
  if (!_ppFile) _ppFile = {};
  if (!_ppFile._currentPI) _ppFile._currentPI = _ppDetectPI();
  return _ppFile._currentPI;
}

function _ppSwitchPI(piId) {
  if (!_ppFile) _ppFile = {};
  _ppFile._currentPI = piId;
  _ppSave();
}

function _ppListPIs() {
  if (!_ppFile) return [];
  return Object.keys(_ppFile).filter(k => k !== '_currentPI').sort();
}

// Access the current PI's data
let _ppCache = null;

function _ppData() {
  const piId = _ppCurrentPI();
  if (!_ppFile[piId]) _ppFile[piId] = { objectives: [], roam: [], deps: [], capacity: {} };
  _ppCache = _ppFile[piId]; // keep compat with external refs
  return _ppFile[piId];
}

function _ppGet(key) { return _ppData()[key] ?? null; }

function _ppSet(key, v) {
  _ppData()[key] = v;
  _ppSave();
}

let _ppSaveTimer = null;
function _ppSave() {
  // Debounce : regrouper les écritures rapides (saisie clavier)
  clearTimeout(_ppSaveTimer);
  _ppSaveTimer = setTimeout(() => {
    const body = JSON.stringify(_ppFile, null, 2);
    fetch('/data/piprep.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(err => console.warn('[piprep] Sauvegarde échouée :', err));
  }, 300);
}

async function _ppLoad() {
  if (_ppLoaded) return;
  try {
    const res = await fetch('/data/piprep.json');
    if (res.ok) {
      const raw = await res.json();
      // Migration: if old format (flat {objectives, roam, ...}), wrap into current PI
      if (raw && !raw._currentPI && (raw.objectives || raw.roam || raw.deps || raw.capacity)) {
        const piId = _ppDetectPI();
        _ppFile = { _currentPI: piId, [piId]: raw };
        _ppSave(); // persist migrated structure
      } else {
        _ppFile = raw || {};
      }
    }
  } catch { /* pas de fichier existant, on part de zéro */ }
  if (!_ppFile) _ppFile = {};
  _ppLoaded = true;
}

function _ppId() { return 'pp' + Math.random().toString(36).slice(2, 9); }

function _ppExportJSON() {
  const blob = new Blob([JSON.stringify(_ppFile, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `piprep-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ Export PI Prep téléchargé !', 'success');
}

// PI selector — switch between PIs, create new PI
function _ppPISelector() {
  const current = _ppCurrentPI();
  const pis = _ppListPIs();
  const options = pis.map(pi =>
    `<option value="${pi}" ${pi === current ? 'selected' : ''}>${pi}</option>`
  ).join('');
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <span style="font-size:12px;font-weight:600;color:var(--text-muted)">PI :</span>
    <select onchange="_ppSwitchPI(this.value);renderPIPrep();" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:600;background:#fff;color:var(--text);cursor:pointer">
      ${options}
    </select>
    <button onclick="_ppCreatePI()" style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:var(--text)">+ Nouveau PI</button>
    ${pis.length > 1 ? `<span style="font-size:10px;color:var(--text-muted)">${pis.length} PIs en historique</span>` : ''}
  </div>`;
}

function _ppCreatePI() {
  const name = prompt('Identifiant du nouveau PI (ex: PI30) :');
  if (!name || !name.trim()) return;
  const piId = name.trim().toUpperCase().replace(/\s+/g, '');
  if (_ppFile[piId]) {
    _ppSwitchPI(piId);
  } else {
    _ppFile[piId] = { objectives: [], roam: [], deps: [], capacity: {} };
    _ppSwitchPI(piId);
  }
  renderPIPrep();
}

// ----------- PI Objectives ---------------------------------
function _ppObjList()              { return _ppGet('objectives') || []; }
function _ppObjDel(id)             { _ppSet('objectives', _ppObjList().filter(x => x.id !== id)); }
function _ppObjUpdate(id, f, val)  { _ppSet('objectives', _ppObjList().map(x => x.id === id ? { ...x, [f]: val } : x)); }
function _ppObjAdd() {
  const teams = getActiveTeams();
  const a = _ppObjList();
  const bv = Math.max(1, 10 - a.length);
  a.push({ id: _ppId(), title: 'Nouvel objectif', team: teams[0] || 'A', bv, type: 'committed', status: 'todo' });
  _ppSet('objectives', a);
  renderPIPrep();
}

// ----------- ROAM ------------------------------------------
function _ppRoamList()             { return _ppGet('roam') || []; }
function _ppRoamDel(id)            { _ppSet('roam', _ppRoamList().filter(x => x.id !== id)); }
function _ppRoamMove(id, cat)      { _ppSet('roam', _ppRoamList().map(x => x.id === id ? { ...x, cat } : x)); }
function _ppRoamAddCat(cat) {
  const teams = getActiveTeams();
  const a = _ppRoamList();
  a.push({ id: _ppId(), cat, team: teams[0] || 'A', title: 'Nouveau risque', note: '' });
  _ppSet('roam', a);
  renderPIPrep();
}
function _ppRoamImport(jiraId, title, team) {
  const a = _ppRoamList();
  if (a.some(r => r.jiraId === jiraId)) return;
  a.push({ id: _ppId(), cat: 'O', team, title: `${jiraId} — ${title}`, jiraId, note: '' });
  _ppSet('roam', a);
  renderPIPrep();
}
function _ppRoamField(id, f, val)  { _ppSet('roam', _ppRoamList().map(x => x.id === id ? { ...x, [f]: val } : x)); }

// ----------- Dependencies ----------------------------------
function _ppDepList()              { return _ppGet('deps') || []; }
function _ppDepDel(id)             { _ppSet('deps', _ppDepList().filter(x => x.id !== id)); }
function _ppDepField(id, f, val)   { _ppSet('deps', _ppDepList().map(x => x.id === id ? { ...x, [f]: val } : x)); }
function _ppDepAdd() {
  const a = _ppDepList();
  a.push({ id: _ppId(), fromTeam: '', toTeam: '', fromTitle: '', toTitle: '', note: '' });
  _ppSet('deps', a);
  renderPIPrep();
}

// ----------- Capacity --------------------------------------
function _ppCapGet()               { return _ppGet('capacity') || {}; }
function _ppCapSet(tid, si, member, days) {
  const c = _ppCapGet();
  if (!c[tid])     c[tid]     = {};
  if (!c[tid][si]) c[tid][si] = {};
  c[tid][si][member] = Math.max(0, parseInt(days, 10) || 0);
  _ppSet('capacity', c);
  _ppRefreshFromCapacity(tid);
}

// Membres exclus du comptage capacité
function _ppExcludedGet()           { return _ppGet('excluded') || {}; }
function _ppExcludedToggle(tid, member, checkbox) {
  const ex = _ppExcludedGet();
  if (!ex[tid]) ex[tid] = [];
  const idx = ex[tid].indexOf(member);
  if (idx >= 0) ex[tid].splice(idx, 1);
  else ex[tid].push(member);
  _ppSet('excluded', ex);
  // Gray out the row immediately
  const row = checkbox?.closest?.('tr');
  if (row) row.style.opacity = _ppIsExcluded(tid, member) ? '.4' : '1';
  _ppRefreshFromCapacity(tid);
}
function _ppIsExcluded(tid, member) {
  return (_ppExcludedGet()[tid] || []).includes(member);
}

// Rafraîchissement partiel des sections dépendantes de la capacité
// (sans re-render complet pour ne pas perdre le focus des inputs)
function _ppRefreshFromCapacity(changedTid) {
  const activeTeams  = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const cap          = _ppCapGet();
  const focusFactor  = 0.8;
  const featureSprints = sprintsPerPI - 1;

  // 1. Mettre à jour la ligne de totaux de l'équipe modifiée
  const totalsRow = document.getElementById('pp-cap-totals-' + changedTid);
  if (totalsRow) {
    const members = (_ppMembersByTeam(activeTeams)[changedTid] || []).filter(m => !_ppIsExcluded(changedTid, m));
    const cells = Array.from({ length: featureSprints }, (_, i) => {
      const total    = members.reduce((s, m) => s + (cap[changedTid]?.[i]?.[m] || 0), 0);
      const adjusted = Math.round(total * focusFactor);
      return `<td style="padding:6px 10px;text-align:center;font-weight:800;font-size:13px;color:var(--primary);">${adjusted}<span style="font-size:10px;color:var(--text-muted);font-weight:400;">j</span></td>`;
    }).join('');
    totalsRow.innerHTML = `<td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×${focusFactor})</td>${cells}`;
  }

  // 2. Mettre à jour la section Charge par équipe
  const loadWrap = document.getElementById('pp-load-wrap');
  if (loadWrap) {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const _bl    = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
    const _filter = t => t.type !== 'support' && t.type !== 'incident' && t.status !== 'done' &&
                         (!activeTeams.length || activeTeams.includes(t.team));
    const fromBL     = _bl.filter(_filter);
    const seenIds    = new Set(fromBL.map(t => t.id));
    const fromSprint = (typeof getTickets === 'function' ? getTickets() : []).filter(t =>
      (t.status === 'backlog' || !t.sprint || t.sprint === 0) && _filter(t) && !seenIds.has(t.id)
    );
    const allBacklog = [...fromBL, ...fromSprint]
      .sort((a, b) => ((pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2)) || ((b.points || 0) - (a.points || 0)));
    loadWrap.innerHTML = _ppLoadMatrix(activeTeams, sprintsPerPI, allBacklog);
  }

  // 3. Mettre à jour le score de readiness
  const readWrap = document.getElementById('pp-readiness-wrap');
  if (readWrap) {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const _bl    = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
    const _filter = t => t.type !== 'support' && t.type !== 'incident' && t.status !== 'done' &&
                         (!activeTeams.length || activeTeams.includes(t.team));
    const fromBL     = _bl.filter(_filter);
    const seenIds    = new Set(fromBL.map(t => t.id));
    const fromSprint = (typeof getTickets === 'function' ? getTickets() : []).filter(t =>
      (t.status === 'backlog' || !t.sprint || t.sprint === 0) && _filter(t) && !seenIds.has(t.id)
    );
    const allBacklog = [...fromBL, ...fromSprint]
      .sort((a, b) => ((pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2)) || ((b.points || 0) - (a.points || 0)));
    readWrap.innerHTML = _ppSectionHeader(_ppReadiness(allBacklog, activeTeams));
  }

  // 4. Mettre à jour le style de l'input modifié (bordure/fond)
  document.querySelectorAll('.pp-cap-input').forEach(inp => {
    const v = parseInt(inp.value, 10) || 0;
    inp.style.borderColor = v > 0 ? '#F59E0B' : 'var(--border)';
    inp.style.background  = v > 0 ? '#FFFBEB' : 'var(--card)';
    inp.style.color       = v > 0 ? '#92400E' : 'var(--text)';
  });
}

function _ppCapAutoAdvance(input) {
  const val = input.value.replace(/\D/g, '');
  if (val.length >= 2) {
    input.value = val.slice(0, 2);
    input.dispatchEvent(new Event('change'));
    const all = Array.from(document.querySelectorAll('.pp-cap-input'));
    const idx = all.indexOf(input);
    if (idx >= 0 && idx < all.length - 1) {
      all[idx + 1].focus();
    }
  }
}

// ----------- Fist of Five (stored in team-mood.json) ---------
function _ppFistGet() {
  const md = typeof _moodData === 'function' ? _moodData() : {};
  return md.fist || (md.fist = {});
}
function _ppFistSet(tid, val) {
  const f = _ppFistGet();
  if (!Array.isArray(f[tid])) f[tid] = f[tid] ? [f[tid]] : [];
  f[tid].push(Math.max(1, Math.min(5, parseInt(val, 10) || 3)));
  if (typeof _moodSave === 'function') _moodSave();
  renderPIPrep();
}
function _ppFistUndo(tid) {
  const f = _ppFistGet();
  if (Array.isArray(f[tid]) && f[tid].length) f[tid].pop();
  if (typeof _moodSave === 'function') _moodSave();
  renderPIPrep();
}
function _ppFistReset(tid) {
  const f = _ppFistGet();
  f[tid] = [];
  if (typeof _moodSave === 'function') _moodSave();
  renderPIPrep();
}

function _ppFistNotes() {
  const md = typeof _moodData === 'function' ? _moodData() : {};
  return md.fistNotes || (md.fistNotes = {});
}
function _ppFistNoteSet(tid, val) {
  const n = _ppFistNotes();
  n[tid] = val;
  if (typeof _moodSave === 'function') _moodSave();
}

// ============================================================
// Équipes par membre (dérivé des TICKETS)
// ============================================================
function _ppMembersByTeam(activeTeams) {
  const map = {};
  activeTeams.forEach(t => { map[t] = new Set(); });
  (typeof TICKETS !== 'undefined' ? TICKETS : []).forEach(t => {
    if (t.assignee && map[t.team]) map[t.team].add(t.assignee);
  });
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  _bl.forEach(t => {
    if (t.assignee && map[t.team]) map[t.team].add(t.assignee);
  });
  const result = {};
  activeTeams.forEach(t => { result[t] = [...map[t]].sort(); });
  return result;
}

// ============================================================
// Score de readiness (0-100)
// ============================================================
function _ppReadiness(allBacklog, activeTeams) {
  const objs  = _ppObjList();
  const roam  = _ppRoamList();
  const fist  = _ppFistGet();

  // 1. Stories pointées (40%)
  const ptsPct = allBacklog.length
    ? Math.round(allBacklog.filter(t => t.points > 0).length / allBacklog.length * 100)
    : 100;

  // 2. Objectifs PI définis (20%) — au moins 1 par équipe active
  const objCoverage = activeTeams.length
    ? Math.min(1, objs.length / activeTeams.length)
    : (objs.length > 0 ? 1 : 0);

  // 3. Fist of Five voté (20%)
  const fistCoverage = activeTeams.length
    ? activeTeams.filter(t => fist[t]).length / activeTeams.length
    : 0;

  // 4. ROAM initialisé (20%)
  const roamResolved  = roam.filter(r => r.cat === 'R' || r.cat === 'M').length;
  const roamOk        = roam.length > 0 && roamResolved === roam.length;
  const roamScore     = roam.length === 0 ? 0 : Math.round(roamResolved / roam.length * 100);

  const score = Math.round(
    ptsPct      * 0.40 +
    objCoverage * 100  * 0.20 +
    fistCoverage* 100  * 0.20 +
    roamScore          * 0.20
  );

  const checks = [
    { label: `${ptsPct}% du backlog pointé`,          ok: ptsPct >= 80,                       pct: Math.min(ptsPct, 100), target: 'pp-unpointed' },
    { label: `${objs.length} objectif(s) PI définis`, ok: objCoverage >= 1,                   pct: Math.round(objCoverage * 100), target: 'pp-objectives' },
    { label: `Fist of Five : ${activeTeams.filter(t => fist[t]).length}/${activeTeams.length} équipes`, ok: fistCoverage >= 1 && activeTeams.length > 0, pct: Math.round(fistCoverage * 100), target: 'pp-fist' },
  ];
  if (roam.length > 0) {
    checks.push({ label: `ROAM : ${roamResolved}/${roam.length} risques traités`, ok: roamOk, pct: roamScore, target: 'pp-roam' });
  }

  return { score: Math.min(score, 100), checks };
}

// ============================================================
// Point d'entrée principal
// ============================================================
async function renderPIPrep() {
  const el = document.getElementById('view-piprep');
  if (!el) return;

  await _ppLoad();

  const activeTeams  = getActiveTeams();
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;

  // Backlog (même logique que roadmap)
  const pOrder      = { critical: 0, high: 1, medium: 2, low: 3 };
  const _bl         = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const _filter     = t => t.type !== 'support' && t.type !== 'incident' && t.status !== 'done' &&
                           (!activeTeams.length || activeTeams.includes(t.team));
  const fromBL      = _bl.filter(_filter);
  const seenIds     = new Set(fromBL.map(t => t.id));
  const fromSprint  = getTickets().filter(t =>
    (t.status === 'backlog' || !t.sprint || t.sprint === 0) && _filter(t) && !seenIds.has(t.id)
  );
  const allBacklog  = [...fromBL, ...fromSprint]
    .sort((a, b) => ((pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2)) || ((b.points || 0) - (a.points || 0)));
  const unpointed   = allBacklog.filter(t => !t.points);
  const readiness   = _ppReadiness(allBacklog, activeTeams);
  const membersByTeam = _ppMembersByTeam(activeTeams);

  // cap80 pour le calendrier PI (même calcul que roadmap)
  const velArr = activeTeams.map(tid => CONFIG.teams[tid]?.velocity || 0).filter(v => v > 0);
  const avgVel = velArr.length ? velArr.reduce((s, v) => s + v, 0) / velArr.length : 0;
  const cap80  = Math.round(avgVel * 0.8);
  const piCalendar = typeof _roadmapPICalendar === 'function' ? _roadmapPICalendar(cap80) : '';

  el.innerHTML = `
    ${_ppPISelector()}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-bottom:16px;">
      <div id="pp-readiness-wrap">${_ppSectionHeader(readiness)}</div>
      <div id="pp-unpointed">${_ppUnpointedBanner(unpointed)}</div>
    </div>
    ${piCalendar}
    ${_ppObjectivesSection(activeTeams)}
    <div id="pp-load-wrap">${_ppLoadMatrix(activeTeams, sprintsPerPI, allBacklog)}</div>
    ${_ppCapacitySection(activeTeams, sprintsPerPI, membersByTeam)}
    ${_ppROAMSection(activeTeams)}
    ${_ppDepsSection(activeTeams)}
    ${_ppFistSection(activeTeams)}
    ${_ppMultiPICapacity(activeTeams, sprintsPerPI)}
  `;
}

// ============================================================
// En-tête — Score de readiness
// ============================================================
function _ppSectionHeader(readiness) {
  const { score, checks } = readiness;
  const color  = score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';
  const bg     = score >= 80 ? '#F0FDF4' : score >= 50 ? '#FFFBEB' : '#FEF2F2';
  const border = score >= 80 ? '#86EFAC' : score >= 50 ? '#FCD34D' : '#FECACA';
  const label  = score >= 80 ? 'Prêt ✓' : score >= 50 ? 'En cours' : 'À compléter';

  const checkRows = checks.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid ${border}40;cursor:pointer;border-radius:4px;transition:background .15s;"
         onclick="document.getElementById('${c.target}')?.scrollIntoView({behavior:'smooth',block:'start'})"
         onmouseenter="this.style.background='${border}30'" onmouseleave="this.style.background='transparent'">
      <span>${c.ok ? '✅' : '⚠️'}</span>
      <span style="flex:1;font-size:12px;color:var(--text);">${c.label}</span>
      <div style="width:80px;height:5px;background:#0001;border-radius:3px;overflow:hidden;">
        <div style="width:${c.pct}%;height:100%;background:${c.ok ? '#16A34A' : '#D97706'};border-radius:3px;"></div>
      </div>
    </div>`).join('');

  return `
    <div class="card" style="background:${bg};border:1.5px solid ${border};height:100%;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <div style="text-align:center;min-width:72px;">
          <div style="font-size:40px;font-weight:900;color:${color};line-height:1;">${score}<span style="font-size:16px;">%</span></div>
          <div style="font-size:12px;font-weight:700;color:${color};">${label}</div>
        </div>
        <div style="flex:1;min-width:220px;">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px;">📋 Readiness PI Planning</div>
          ${checkRows}
        </div>
      </div>
    </div>`;
}

// ============================================================
// Alerte stories non pointées
// ============================================================
function _ppUnpointedBanner(unpointed) {
  if (!unpointed.length) return `
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:8px;font-size:13px;color:#15803D;font-weight:600;height:100%;box-sizing:border-box;">
      ✅ Tout le backlog est pointé — simulation précise
    </div>`;

  const chips = unpointed.slice(0, 10).map(t => {
    const c = CONFIG.typeColors[t.type] || '#475569';
    return `<span onclick="openModal('${t.id}')" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;background:${c}18;border:1px solid ${c}40;font-size:11px;font-weight:600;color:${c};cursor:pointer;margin:2px;">${t.id}</span>`;
  }).join('');
  const more = unpointed.length > 10 ? `<span style="font-size:11px;color:var(--text-muted);margin:2px 4px;">+${unpointed.length - 10} autres</span>` : '';

  return `
    <div style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:10px;padding:12px 16px;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:8px;">⚠️ ${unpointed.length} storie${unpointed.length > 1 ? 's' : ''} sans story points — cliquer pour renseigner</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;">${chips}${more}</div>
    </div>`;
}

// ============================================================
// PI Objectives Board
// ============================================================
function _ppObjectivesSection(activeTeams) {
  const objs  = _ppObjList();
  const totalBV = objs.filter(o => o.type === 'committed').reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);

  const ST = [
    { v: 'todo',   l: '🔲 À faire',  bg: '#F1F5F9', c: '#475569' },
    { v: 'inprog', l: '🔵 En cours', bg: '#DBEAFE', c: '#1D4ED8' },
    { v: 'done',   l: '✅ Atteint',  bg: '#DCFCE7', c: '#15803D' },
    { v: 'atrisk', l: '🔴 À risque', bg: '#FEE2E2', c: '#DC2626' },
  ];
  const TY = [
    { v: 'committed', l: '🎯 Committed' },
    { v: 'stretch',   l: '⭐ Stretch' },
  ];

  const rows = objs.map(o => {
    const st   = ST.find(s => s.v === o.status) || ST[0];
    const tc   = CONFIG.teams[o.team]?.color || '#475569';
    const teamSel = activeTeams.map(t =>
      `<option value="${t}" ${o.team === t ? 'selected' : ''}>${CONFIG.teams[t]?.name || t}</option>`
    ).join('');
    const typeSel = TY.map(t =>
      `<option value="${t.v}" ${o.type === t.v ? 'selected' : ''}>${t.l}</option>`
    ).join('');
    const stSel = ST.map(s =>
      `<option value="${s.v}" style="background:${s.bg};color:${s.c};" ${o.status === s.v ? 'selected' : ''}>${s.l}</option>`
    ).join('');
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:7px 10px;max-width:280px;">
          <input value="${(o.title || '').replace(/"/g,'&quot;')}"
            style="width:100%;border:none;background:transparent;font-size:13px;color:var(--text);outline:none;padding:2px 4px;border-radius:4px;"
            onchange="_ppObjUpdate('${o.id}','title',this.value)">
        </td>
        <td style="padding:7px 10px;white-space:nowrap;">
          <select onchange="_ppObjUpdate('${o.id}','team',this.value);renderPIPrep();"
            style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:12px;background:${tc}22;color:${tc};font-weight:600;">${teamSel}</select>
        </td>
        <td style="padding:7px 10px;white-space:nowrap;">
          <select onchange="_ppObjUpdate('${o.id}','type',this.value);renderPIPrep();"
            style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:12px;">${typeSel}</select>
        </td>
        <td style="padding:7px 10px;text-align:center;">
          <input type="number" min="1" max="10" value="${o.bv || 5}"
            style="width:48px;border:1.5px solid var(--border);border-radius:6px;padding:3px;font-size:13px;font-weight:700;text-align:center;"
            onchange="_ppObjUpdate('${o.id}','bv',parseInt(this.value)||5)">
        </td>
        <td style="padding:7px 10px;white-space:nowrap;">
          <select onchange="_ppObjUpdate('${o.id}','status',this.value);renderPIPrep();"
            style="border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:12px;background:${st.bg};color:${st.c};font-weight:600;">${stSel}</select>
        </td>
        <td style="padding:7px 6px;text-align:center;">
          <button onclick="_ppObjDel('${o.id}');renderPIPrep();" title="Supprimer"
            style="border:none;background:none;color:#DC2626;cursor:pointer;font-size:15px;padding:0 3px;">🗑</button>
        </td>
      </tr>`;
  }).join('');

  const thStyle = 'padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);white-space:nowrap;';

  return `
    <div id="pp-objectives" style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">🎯 Objectifs PI</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:12px;color:var(--text-muted);">${objs.length} objectif${objs.length !== 1 ? 's' : ''} · BV committed : <strong>${totalBV}</strong></span>
          <button onclick="_ppObjAdd();" style="font-size:12px;padding:4px 12px;border:1.5px solid var(--primary);border-radius:6px;background:transparent;color:var(--primary);cursor:pointer;font-weight:600;">+ Ajouter</button>
        </div>
      </div>
      <div class="card" style="padding:0;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#F8FAFC;">
            <th style="${thStyle}">Objectif</th>
            <th style="${thStyle}">Équipe</th>
            <th style="${thStyle}">Type</th>
            <th style="${thStyle};text-align:center;">BV</th>
            <th style="${thStyle}">Statut</th>
            <th style="${thStyle};width:32px;"></th>
          </tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Aucun objectif — cliquez sur "+ Ajouter"</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
// Charge par équipe × sprint simulé
// ============================================================
function _ppLoadMatrix(activeTeams, sprintsPerPI, allBacklog) {
  if (!activeTeams.length) return '';
  const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  // Dates des sprints PI (réutilise la même logique que roadmap)
  const sprintStartDay = CONFIG.sprint?.sprintStartDay ?? 5;
  const durationDays   = CONFIG.sprint?.durationDays   || 14;
  const storedStart    = localStorage.getItem('rm_pi_start') || '';
  const today          = new Date(); today.setHours(0,0,0,0);
  const def            = new Date(today);
  def.setDate(today.getDate() + (sprintStartDay - today.getDay() + 7) % 7);
  let piStart = def;
  if (storedStart) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(storedStart) ? storedStart + 'T00:00:00' : storedStart);
    if (!isNaN(d.getTime())) piStart = d;
  }

  const sprintDates = Array.from({ length: sprintsPerPI }, (_, i) => {
    const s = new Date(piStart); s.setDate(s.getDate() + i * durationDays);
    const e = new Date(s);       e.setDate(e.getDate() + durationDays - 1);
    return { s, e, isIP: i === sprintsPerPI - 1 };
  });

  const thStyle = 'padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);white-space:nowrap;';
  const headerCells = sprintDates.map((sd, i) =>
    `<th style="${thStyle}">${sd.isIP ? '🍃 IP' : `S${i+1}`}${typeof _fmtD === 'function' ? `<br><span style="font-weight:400;font-size:10px;">${_fmtD(sd.s)}</span>` : ''}</th>`
  ).join('');

  const cap         = _ppCapGet();
  const focusFactor = 0.8;

  const rows = activeTeams.map(tid => {
    const tc       = CONFIG.teams[tid];
    const color    = tc?.color || '#475569';
    const defaultCap = Math.round((tc?.velocity || 0) * 0.8);

    // Capacité par sprint : somme des jours membres (non exclus) × focus factor, sinon fallback vélocité 80%
    const excluded = _ppExcludedGet()[tid] || [];
    const sprintCaps = sprintDates.map((_, i) => {
      if (i === sprintsPerPI - 1) return 0; // IP sprint
      const sprintCap = cap[tid]?.[i];
      if (sprintCap && Object.keys(sprintCap).length) {
        const totalDays = Object.entries(sprintCap)
          .filter(([m]) => !excluded.includes(m))
          .reduce((s, [, d]) => s + (d || 0), 0);
        return Math.round(totalDays * focusFactor);
      }
      return defaultCap;
    });

    // Greedy fill des backlog tickets de cette équipe
    const teamBL   = allBacklog.filter(t => t.team === tid);
    const teamSprints = sprintDates.map(() => ({ pts: 0 }));
    let si = 0;
    teamBL.forEach(t => {
      const sCap = sprintCaps[si] || defaultCap;
      while (si < sprintsPerPI - 1 && teamSprints[si].pts + (t.points || 0) > sCap) si++;
      if (si < sprintsPerPI - 1) teamSprints[si].pts += (t.points || 0);
    });

    const cells = teamSprints.map((s, i) => {
      if (sprintDates[i].isIP) return `<td style="padding:8px 10px;text-align:center;background:#F0FDF4;font-size:11px;color:#15803D;font-weight:600;">IP</td>`;
      const sCap = sprintCaps[i] || defaultCap;
      const pct = sCap ? Math.min(100, Math.round(s.pts / sCap * 100)) : 0;
      const bc  = pct >= 95 ? '#DC2626' : pct >= 80 ? '#D97706' : '#16A34A';
      return `<td style="padding:8px 10px;text-align:center;">
        <div style="font-weight:700;font-size:13px;color:${bc};">${s.pts}<span style="font-size:10px;font-weight:400;color:var(--text-muted);">/${sCap}</span></div>
        <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${bc};border-radius:2px;"></div>
        </div>
      </td>`;
    }).join('');

    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px 12px;white-space:nowrap;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          ${tc?.name || tid}
        </span>
      </td>${cells}
    </tr>`;
  }).join('');

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📊 Charge par équipe — PI simulé</div>
        <span style="font-size:12px;color:var(--text-muted);">Répartition greedy du backlog sur les sprints feature (cap. 80%)</span>
      </div>
      <div class="card" style="padding:0;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#F8FAFC;">
            <th style="${thStyle};text-align:left;">Équipe</th>${headerCells}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
// Capacité individuelle par sprint
// ============================================================
function _ppCapacitySection(activeTeams, sprintsPerPI, membersByTeam) {
  const cap          = _ppCapGet();
  const focusFactor  = 0.8;
  const featureSprints = sprintsPerPI - 1;
  const sprintCols   = Array.from({ length: featureSprints }, (_, i) => i);

  const sections = activeTeams.map(tid => {
    const tc      = CONFIG.teams[tid];
    const color   = tc?.color || '#475569';
    const rawMembers = membersByTeam[tid] || [];
    if (!rawMembers.length) return '';
    // Sort: active members first, excluded (inactive) members at the bottom
    const members = [...rawMembers].sort((a, b) => {
      const exA = _ppIsExcluded(tid, a) ? 1 : 0;
      const exB = _ppIsExcluded(tid, b) ? 1 : 0;
      return exA - exB;
    });

    const colHeaders = sprintCols.map(i =>
      `<th style="padding:6px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Sprint ${i+1}<br><span style="font-weight:400;font-size:9px;">j dispos</span></th>`
    ).join('');

    const memberRows = members.map(m => {
      const mc = (typeof MEMBER_COLORS !== 'undefined' && MEMBER_COLORS?.[m]) || '#64748B';
      const excluded = _ppIsExcluded(tid, m);
      const rowOpacity = excluded ? 'opacity:.4;' : '';
      const cells = sprintCols.map(i => {
        const v = cap[tid]?.[i]?.[m] || 0;
        return `<td style="padding:5px 10px;text-align:center;">
          <input type="number" min="0" max="99" value="${v}"
            class="pp-cap-input" data-tid="${tid}" data-si="${i}" data-member="${m}"
            style="width:48px;padding:3px 4px;border:1.5px solid ${v > 0 ? '#F59E0B' : 'var(--border)'};border-radius:6px;font-size:13px;font-weight:700;background:${v > 0 ? '#FFFBEB' : 'var(--card)'};color:${v > 0 ? '#92400E' : 'var(--text)'};text-align:center;"
            onchange="_ppCapSet('${tid}',${i},'${m}',this.value)"
            onfocus="this.select()"
            oninput="_ppCapAutoAdvance(this)">
        </td>`;
      }).join('');
      return `<tr style="border-bottom:1px solid var(--border);${rowOpacity}">
        <td style="padding:6px 12px;font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:6px;">
          <input type="checkbox" ${excluded ? '' : 'checked'} onchange="_ppExcludedToggle('${tid}','${m}',this)" title="${excluded ? 'Inclure dans le calcul' : 'Exclure du calcul'}" style="cursor:pointer;accent-color:var(--primary);margin:0;">
          <span class="avatar" style="background:${mc};font-size:9px;width:20px;height:20px;min-width:20px;line-height:20px;">${initials(m)}</span>
          ${m}
        </td>${cells}
      </tr>`;
    }).join('');

    const includedMembers = members.filter(m => !_ppIsExcluded(tid, m));
    const totalRow = sprintCols.map(i => {
      const total    = includedMembers.reduce((s, m) => s + (cap[tid]?.[i]?.[m] || 0), 0);
      const adjusted = Math.round(total * focusFactor);
      return `<td style="padding:6px 10px;text-align:center;font-weight:800;font-size:13px;color:var(--primary);">${adjusted}<span style="font-size:10px;color:var(--text-muted);font-weight:400;">j</span></td>`;
    }).join('');

    return `
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;color:${color};margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;"></span>
          ${tc?.name || tid}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#F8FAFC;">
            <th style="padding:6px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Membre</th>
            ${colHeaders}
          </tr></thead>
          <tbody>
            ${memberRows}
            <tr id="pp-cap-totals-${tid}" style="background:#F8FAFC;border-top:2px solid var(--border);">
              <td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×${focusFactor})</td>
              ${totalRow}
            </tr>
          </tbody>
        </table>
      </div>`;
  }).filter(Boolean).join('');

  if (!sections) return '';

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">👥 Capacité individuelle par sprint</div>
        <span style="font-size:12px;color:var(--text-muted);">Jours disponibles par membre · facteur focus ${Math.round(focusFactor * 100)}%</span>
      </div>
      <div class="card">${sections}</div>
    </div>`;
}

// ============================================================
// ROAM Board
// ============================================================
function _ppROAMSection(activeTeams) {
  const roam = _ppRoamList();
  const CATS = [
    { k: 'R', label: 'Resolved',  emoji: '✅', bg: '#F0FDF4', border: '#86EFAC', tc: '#15803D' },
    { k: 'O', label: 'Owned',     emoji: '👤', bg: '#EFF6FF', border: '#93C5FD', tc: '#1D4ED8' },
    { k: 'A', label: 'Accepted',  emoji: '🤝', bg: '#FFFBEB', border: '#FCD34D', tc: '#92400E' },
    { k: 'M', label: 'Mitigated', emoji: '🛡️', bg: '#F5F3FF', border: '#C4B5FD', tc: '#5B21B6' },
  ];

  // Suggestions depuis tickets bloqués JIRA
  const existingJira  = new Set(roam.filter(r => r.jiraId).map(r => r.jiraId));
  const suggestions   = getTickets().filter(t => t.status === 'blocked' && !existingJira.has(t.id)).slice(0, 5);

  const suggestBanner = suggestions.length ? `
    <div style="margin-bottom:12px;padding:10px 14px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:6px;">💡 Tickets bloqués JIRA — importer comme risque "Owned"</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${suggestions.map(t => `
          <button onclick="_ppRoamImport('${t.id}','${(t.title || '').replace(/'/g,"\\'")}','${t.team || activeTeams[0] || 'A'}');"
            style="border:1px solid #FED7AA;border-radius:6px;background:#FFFBEB;padding:3px 10px;font-size:11px;color:#92400E;cursor:pointer;font-weight:600;">
            ➕ ${t.id}
          </button>`).join('')}
      </div>
    </div>` : '';

  const cols = CATS.map(cat => {
    const items = roam.filter(r => r.cat === cat.k);
    const moveBtns = (id) => CATS.filter(c => c.k !== cat.k).map(c =>
      `<button onclick="_ppRoamMove('${id}','${c.k}');renderPIPrep();"
        style="font-size:10px;padding:1px 6px;border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;margin:1px;">${c.emoji}</button>`
    ).join('');

    const cards = items.map(r => {
      const tc2 = CONFIG.teams[r.team]?.color || '#475569';
      return `
        <div style="background:var(--card);border:1px solid ${cat.border};border-radius:8px;padding:10px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4px;margin-bottom:4px;">
            <textarea rows="2" style="flex:1;border:none;background:transparent;font-size:12px;font-weight:600;color:var(--text);outline:none;resize:none;line-height:1.4;"
              onchange="_ppRoamField('${r.id}','title',this.value)">${r.title || ''}</textarea>
            <button onclick="_ppRoamDel('${r.id}');renderPIPrep();"
              style="border:none;background:none;color:#94A3B8;cursor:pointer;font-size:13px;padding:0 2px;flex-shrink:0;">✕</button>
          </div>
          <input placeholder="Note / plan d'action…" value="${(r.note || '').replace(/"/g,'&quot;')}"
            style="width:100%;border:none;background:transparent;font-size:11px;color:var(--text-muted);font-style:italic;outline:none;margin-bottom:5px;"
            onchange="_ppRoamField('${r.id}','note',this.value)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;">
            <select onchange="_ppRoamField('${r.id}','team',this.value);renderPIPrep();"
              style="border:1px solid var(--border);border-radius:5px;padding:2px 5px;font-size:10px;font-weight:700;color:${tc2};background:${tc2}18;">
              ${activeTeams.map(t => `<option value="${t}" ${r.team === t ? 'selected' : ''}>${CONFIG.teams[t]?.name || t}</option>`).join('')}
            </select>
            <div>${moveBtns(r.id)}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="background:${cat.bg};border:1.5px solid ${cat.border};border-radius:10px;padding:12px;min-height:100px;">
        <div style="font-size:13px;font-weight:700;color:${cat.tc};margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
          <span>${cat.emoji} ${cat.label}</span>
          <span style="font-size:11px;background:var(--card);padding:1px 8px;border-radius:99px;border:1px solid ${cat.border};">${items.length}</span>
        </div>
        ${cards}
        <button onclick="_ppRoamAddCat('${cat.k}');"
          style="width:100%;border:1.5px dashed ${cat.border};border-radius:6px;background:transparent;padding:5px;font-size:11px;color:${cat.tc};cursor:pointer;font-weight:600;margin-top:2px;">
          + Ajouter
        </button>
      </div>`;
  }).join('');

  return `
    <div id="pp-roam" style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">⚡ ROAM Board — Risques</div>
        <span style="font-size:12px;color:var(--text-muted);">${roam.length} risque${roam.length !== 1 ? 's' : ''} · ${roam.filter(r => r.cat === 'R' || r.cat === 'M').length} traités</span>
      </div>
      ${suggestBanner}
      <div class="pp-roam-grid">${cols}</div>
    </div>`;
}

// ============================================================
// Dépendances inter-équipes
// ============================================================
function _ppDepsSection(activeTeams) {
  const deps = _ppDepList();
  const thStyle = 'padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);';

  // Toutes les équipes connues (tickets + config) — pas seulement le filtre actif
  const ticketTeams = typeof _allTeams === 'function' ? _allTeams() : [];
  const allTeams = (ticketTeams.length ? ticketTeams : Object.keys(CONFIG.teams || {})).sort();
  const teamSel = (id, field, cur) =>
    `<option value="" ${!cur ? 'selected' : ''} disabled>— Équipe —</option>` +
    allTeams.map(t =>
      `<option value="${t}" ${cur === t ? 'selected' : ''}>${CONFIG.teams[t]?.name || t}</option>`
    ).join('');

  const rows = deps.map(d => {
    const fc = CONFIG.teams[d.fromTeam]?.color || '#475569';
    const tc = CONFIG.teams[d.toTeam]?.color   || '#475569';
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:7px 10px;max-width:200px;">
          <input value="${(d.fromTitle || '').replace(/"/g,'&quot;')}" placeholder="Feature / livrable…"
            style="width:100%;border:none;background:transparent;font-size:12px;color:var(--text);outline:none;"
            onchange="_ppDepField('${d.id}','fromTitle',this.value)">
        </td>
        <td style="padding:7px 8px;white-space:nowrap;">
          <select onchange="_ppDepField('${d.id}','fromTeam',this.value);renderPIPrep();"
            style="border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:11px;background:${fc}22;color:${fc};font-weight:600;">
            ${teamSel(d.id,'fromTeam',d.fromTeam)}
          </select>
        </td>
        <td style="padding:7px 6px;text-align:center;font-size:14px;color:var(--text-muted);">→</td>
        <td style="padding:7px 8px;white-space:nowrap;">
          <select onchange="_ppDepField('${d.id}','toTeam',this.value);renderPIPrep();"
            style="border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:11px;background:${tc}22;color:${tc};font-weight:600;">
            ${teamSel(d.id,'toTeam',d.toTeam)}
          </select>
        </td>
        <td style="padding:7px 10px;max-width:200px;">
          <input value="${(d.toTitle || '').replace(/"/g,'&quot;')}" placeholder="Attend…"
            style="width:100%;border:none;background:transparent;font-size:12px;color:var(--text);outline:none;"
            onchange="_ppDepField('${d.id}','toTitle',this.value)">
        </td>
        <td style="padding:7px 10px;">
          <input value="${(d.note || '').replace(/"/g,'&quot;')}" placeholder="Note…"
            style="width:100%;border:none;background:transparent;font-size:11px;color:var(--text-muted);font-style:italic;outline:none;"
            onchange="_ppDepField('${d.id}','note',this.value)">
        </td>
        <td style="padding:7px 6px;text-align:center;">
          <button onclick="_ppDepDel('${d.id}');renderPIPrep();" title="Supprimer"
            style="border:none;background:none;color:#DC2626;cursor:pointer;font-size:15px;padding:0 3px;">🗑</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">🔗 Dépendances inter-équipes</div>
        <button onclick="_ppDepAdd();"
          style="font-size:12px;padding:4px 12px;border:1.5px solid var(--primary);border-radius:6px;background:transparent;color:var(--primary);cursor:pointer;font-weight:600;">
          + Ajouter
        </button>
      </div>
      ${!deps.length
        ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;background:var(--card);border-radius:10px;border:1.5px dashed var(--border);">Aucune dépendance — cliquez sur "+ Ajouter" pour en déclarer</div>`
        : `<div class="card" style="padding:0;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:#F8FAFC;">
                <th style="${thStyle}">Livrable</th>
                <th style="${thStyle}">De</th>
                <th style="${thStyle};padding:0;"></th>
                <th style="${thStyle}">Vers</th>
                <th style="${thStyle}">Besoin</th>
                <th style="${thStyle}">Note</th>
                <th style="${thStyle};width:32px;"></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
      ${deps.length >= 2 ? _ppDepsHeatmap(deps, allTeams) : ''}
    </div>`;
}

// Dependency heatmap matrix + timeline
function _ppDepsHeatmap(deps, allTeams) {
  // Build team-pair counts
  const pairs = {};
  const teamsInDeps = new Set();
  deps.forEach(d => {
    if (!d.fromTeam || !d.toTeam) return;
    teamsInDeps.add(d.fromTeam);
    teamsInDeps.add(d.toTeam);
    const k = `${d.fromTeam}→${d.toTeam}`;
    pairs[k] = (pairs[k] || 0) + 1;
  });
  const dTeams = [...teamsInDeps].sort();
  if (dTeams.length < 2) return '';

  const maxCount = Math.max(...Object.values(pairs), 1);

  const headerCells = dTeams.map(t => {
    const c = CONFIG.teams[t]?.color || '#475569';
    const n = CONFIG.teams[t]?.name || t;
    return `<th style="padding:4px 6px;font-size:10px;font-weight:700;color:${c};text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:60px;border-bottom:1px solid var(--border);">${n}</th>`;
  }).join('');

  const matrixRows = dTeams.map(from => {
    const fc = CONFIG.teams[from]?.color || '#475569';
    const fn = CONFIG.teams[from]?.name || from;
    const cells = dTeams.map(to => {
      if (from === to) return '<td style="padding:4px;text-align:center;background:var(--surface);"><span style="color:var(--text-muted);font-size:10px;">—</span></td>';
      const k = `${from}→${to}`;
      const cnt = pairs[k] || 0;
      if (!cnt) return '<td style="padding:4px;text-align:center;"></td>';
      const intensity = Math.round((cnt / maxCount) * 100);
      const bg = `rgba(239,68,68,${(intensity / 100 * 0.6 + 0.1).toFixed(2)})`;
      return `<td style="padding:4px;text-align:center;background:${bg};border-radius:4px;" title="${fn} → ${CONFIG.teams[to]?.name || to}: ${cnt} dép.">
        <span style="font-size:12px;font-weight:700;color:#7F1D1D;">${cnt}</span>
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:4px 8px;font-size:11px;font-weight:700;color:${fc};white-space:nowrap;border-right:1px solid var(--border);">${fn}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:16px;">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;">🗺️ Matrice des dépendances</div>
        <div class="card" style="padding:8px;overflow-x:auto;">
          <table style="border-collapse:collapse;">
            <thead><tr><th style="border-bottom:1px solid var(--border);border-right:1px solid var(--border);"></th>${headerCells}</tr></thead>
            <tbody>${matrixRows}</tbody>
          </table>
        </div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:4px;">Ligne = équipe source · Colonne = équipe cible · Intensité = nombre de dépendances</div>
      </div>
    </div>`;
}

// ============================================================
// Fist of Five — Vote de confiance
// ============================================================
function _ppFistSection(activeTeams) {
  if (!activeTeams.length) return '';
  const fist    = _ppFistGet();
  const fingers = ['☝️','✌️','🤟','🖖','🖐️'];
  const labels  = ['', 'Stop', 'Inquiet', 'Incertain', 'Favorable', 'Enthousiaste'];

  const fistNotes = _ppFistNotes();

  const cards = activeTeams.map(tid => {
    const tc    = CONFIG.teams[tid];
    const color = tc?.color || '#475569';
    const votes = Array.isArray(fist[tid]) ? fist[tid] : (fist[tid] ? [fist[tid]] : []);
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor= !count ? '#94A3B8' : avg < 3 ? '#DC2626' : avg < 4 ? '#D97706' : '#16A34A';
    const borderColor = !count ? 'var(--border)' : avg >= 4 ? '#86EFAC' : avg >= 3 ? '#FCD34D' : '#FECACA';
    const note = fistNotes[tid] || '';

    // Histogramme horizontal
    const distrib = [1,2,3,4,5].map(n => votes.filter(v => v === n).length);
    const maxD = Math.max(...distrib, 1);
    const distribHtml = count ? `<div style="display:flex;align-items:flex-end;gap:4px;height:40px;">
      ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:20px;height:${Math.max(4, Math.round(d / maxD * 32))}px;background:${d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:3px;"></div>
        <span style="font-size:9px;color:var(--text-muted);">${d || ''}</span>
      </div>`).join('')}
    </div>` : '<div style="width:110px;"></div>';

    const btns = [1,2,3,4,5].map(n => `
      <button onclick="_ppFistSet('${tid}',${n});"
        style="border:1.5px solid var(--border);border-radius:10px;background:var(--card);padding:10px 14px;font-size:26px;cursor:pointer;transition:all .15s;"
        title="${n} — ${labels[n]}">${fingers[n-1]}</button>`
    ).join('');

    const voteCountBadge = count
      ? `<span style="font-size:12px;color:var(--text-muted);font-weight:600;white-space:nowrap;">${count} vote${count > 1 ? 's' : ''}</span>`
      : '';

    const actions = count ? `
      <button onclick="_ppFistUndo('${tid}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Annuler le dernier vote">↩</button>
      <button onclick="_ppFistReset('${tid}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Réinitialiser">✕</button>` : '';

    const noteEscaped = note.replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    return `
      <div style="background:var(--card);border:1.5px solid ${borderColor};border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:18px;">
          <div style="font-weight:700;font-size:15px;color:${color};min-width:120px;display:flex;align-items:center;gap:8px;">
            <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            ${tc?.name || tid}
          </div>
          <div style="display:flex;align-items:center;gap:5px;min-width:75px;">
            <span style="font-size:32px;font-weight:900;color:${vColor};line-height:1;">${count ? avg : '?'}</span>
            <span style="font-size:12px;color:${vColor};font-weight:600;">/5</span>
          </div>
          ${distribHtml}
          <div style="display:flex;gap:5px;align-items:center;">${btns}</div>
          ${voteCountBadge}
          <div style="display:flex;gap:5px;margin-left:auto;">${actions}</div>
        </div>
        <input type="text" value="${noteEscaped}" placeholder="Ajouter une note…"
          onchange="_ppFistNoteSet('${tid}',this.value)"
          style="width:100%;border:none;border-top:1px solid var(--border);background:transparent;padding:6px 0 0;font-size:12px;color:var(--text-muted);font-style:italic;outline:none;">
      </div>`;
  }).join('');

  // Moyenne globale
  const allVotes = activeTeams.flatMap(t => Array.isArray(fist[t]) ? fist[t] : (fist[t] ? [fist[t]] : []));
  const totalVotes = allVotes.length;
  const globalAvg  = totalVotes ? Math.round(allVotes.reduce((s, v) => s + v, 0) / totalVotes * 10) / 10 : null;
  const teamsVoted = activeTeams.filter(t => (Array.isArray(fist[t]) ? fist[t].length : fist[t]) > 0).length;
  const avgColor   = globalAvg === null ? 'var(--text-muted)' : globalAvg < 3 ? '#DC2626' : globalAvg < 4 ? '#D97706' : '#16A34A';
  const avgBg      = globalAvg === null ? '#F1F5F9' : globalAvg < 3 ? '#FEF2F2' : globalAvg < 4 ? '#FFFBEB' : '#F0FDF4';
  const avgBorder  = globalAvg === null ? 'var(--border)' : globalAvg < 3 ? '#FECACA' : globalAvg < 4 ? '#FDE68A' : '#86EFAC';

  const avgBadge = globalAvg !== null
    ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:10px;background:${avgBg};border:1.5px solid ${avgBorder};">
        <span style="font-size:20px;font-weight:900;color:${avgColor};">${globalAvg}</span>
        <span style="font-size:11px;color:${avgColor};font-weight:600;">/5</span>
        <span style="font-size:11px;color:var(--text-muted);">${totalVotes} vote${totalVotes > 1 ? 's' : ''} · ${teamsVoted}/${activeTeams.length} équipe${activeTeams.length > 1 ? 's' : ''}</span>
      </div>`
    : `<span style="font-size:12px;color:var(--text-muted);">Aucun vote</span>`;

  return `
    <div id="pp-fist" style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">✋ Fist of Five — Vote de confiance</div>
        ${avgBadge}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">${cards}</div>
    </div>`;
}

// ============================================================
// Multi-PI Capacity Planning — simulation what-if sur 2-3 PIs
// ============================================================
function _ppMultiPICapacity(activeTeams, sprintsPerPI) {
  if (!activeTeams.length) return '';

  const piCount = 3; // Number of PIs to show

  // Build team data
  const teamData = activeTeams.map(tid => {
    const tc = CONFIG.teams[tid] || {};
    const vel = tc.velocity || 0;
    const vh = tc.velocityHistory || [];
    const nonZero = vh.map(v => v.velocity || 0).filter(v => v > 0);
    const avgVel = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : vel;

    // Estimate team size from MEMBERS
    const members = typeof MEMBERS !== 'undefined' ? Object.values(MEMBERS).filter(m => m.team === tid || m.teams?.includes(tid)) : [];
    const teamSize = members.length || Math.round(avgVel / 15); // fallback: ~15 pts/dev

    return {
      tid, name: tc.name || tid, color: tc.color || '#475569',
      velocity: avgVel, teamSize,
      velPerDev: teamSize > 0 ? Math.round(avgVel / teamSize) : 0,
    };
  });

  // What-if simulation
  const scenarios = [
    { label: 'Actuel', delta: 0 },
    { label: '−1 dev/équipe', delta: -1 },
    { label: '+1 dev/équipe', delta: +1 },
  ];

  const thStyle = 'padding:6px 10px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--border);text-align:center;';

  const piLabels = Array.from({ length: piCount }, (_, i) => `PI+${i}`);

  const headerCols = scenarios.map(s =>
    `<th colspan="${piCount}" style="${thStyle}background:${s.delta === 0 ? '#F0F9FF' : s.delta < 0 ? '#FEF2F2' : '#F0FDF4'};">${s.label}</th>`
  ).join('');

  const subHeaderCols = scenarios.flatMap(() =>
    piLabels.map(l => `<th style="${thStyle}font-size:9px;">${l}</th>`)
  ).join('');

  const rows = teamData.map(t => {
    const cells = scenarios.flatMap(s => {
      const newSize = Math.max(0, t.teamSize + s.delta);
      const newVel = newSize * t.velPerDev;
      const totalCap = newVel * sprintsPerPI;
      return piLabels.map(() => {
        const cap = totalCap; // same capacity per PI (simplified)
        const color = s.delta === 0 ? t.color : s.delta < 0 ? '#DC2626' : '#16A34A';
        const diff = cap - (t.velocity * sprintsPerPI);
        const diffStr = s.delta !== 0 ? `<div style="font-size:9px;color:${diff >= 0 ? '#16A34A' : '#DC2626'}">${diff >= 0 ? '+' : ''}${diff} pts</div>` : '';
        return `<td style="padding:6px 8px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:13px;font-weight:700;color:${color}">${cap}</div>
          <div style="font-size:9px;color:var(--text-muted)">${newSize} dev · ${newVel}/sprint</div>
          ${diffStr}
        </td>`;
      });
    }).join('');

    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:6px 10px;font-size:12px;font-weight:700;color:${t.color};white-space:nowrap;border-right:1px solid var(--border);">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:4px;"></span>
        ${t.name}
        <div style="font-size:9px;color:var(--text-muted);font-weight:400;">${t.teamSize} dev · ${t.velocity} pts/sprint</div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  // Totals row
  const totalCells = scenarios.flatMap(s => {
    return piLabels.map(() => {
      const total = teamData.reduce((sum, t) => {
        const newSize = Math.max(0, t.teamSize + s.delta);
        return sum + newSize * t.velPerDev * sprintsPerPI;
      }, 0);
      return `<td style="padding:6px 8px;text-align:center;font-size:13px;font-weight:800;color:var(--text);border-right:1px solid var(--border);">${total}</td>`;
    });
  }).join('');

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📊 Capacité multi-PI — Simulation what-if</div>
        <span style="font-size:11px;color:var(--text-muted);">Impact sur ${piCount} PIs · ${sprintsPerPI} sprints/PI</span>
      </div>
      <div class="card" style="padding:0;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr><th style="${thStyle}border-right:1px solid var(--border);">Équipe</th>${headerCols}</tr>
            <tr><th style="${thStyle}border-right:1px solid var(--border);"></th>${subHeaderCols}</tr>
          </thead>
          <tbody>${rows}
            <tr style="background:#F8FAFC;"><td style="padding:6px 10px;font-size:12px;font-weight:800;border-right:1px solid var(--border);">Total</td>${totalCells}</tr>
          </tbody>
        </table>
      </div>
    </div>`;
}
