// ============================================================
// PIPREP - Préparation PI Planning
// Données persistées dans data/pi-data.json via le serveur
// ============================================================

// Status options pour objectives et dépendances (réutilisé dans 4 blocs)
const PP_STATUS_OPTS = [
  { v: 'todo',    l: '🔲 À faire',  bg: 'var(--info-bg)', c: 'var(--text-muted)' },
  { v: 'inprog',  l: '🔵 En cours', bg: 'var(--warning-bg)', c: 'var(--warning-fg)' },
  { v: 'done',    l: '✅ Atteint',  bg: 'var(--success-bg)', c: 'var(--success-fg)' },
  { v: 'atrisk',  l: '🔴 À risque', bg: 'var(--danger-bg)', c: 'var(--danger-fg)' },
];
const PP_STATUS_OPTS_DEP = [
  { v: 'todo',    l: '🔲 À faire',  bg: 'var(--info-bg)', c: 'var(--text-muted)' },
  { v: 'inprog',  l: '🔵 En cours', bg: 'var(--warning-bg)', c: 'var(--warning-fg)' },
  { v: 'blocked', l: '🚧 Bloqué',   bg: 'var(--danger-bg)', c: 'var(--danger-fg)' },
  { v: 'done',    l: '✅ Terminé',  bg: 'var(--success-bg)', c: 'var(--success-fg)' },
];

// ----------- Helpers persistance JSON ----------------------
// pi-data.json stores data per PI: { "_currentPI": "PI29", "PI29": { objectives, roam, deps, capacity }, "PI28": { ... } }
let _ppFile = null;            // cache mémoire du fichier complet (multi-PI)
let _ppLoaded = false;         // true après le 1er chargement
let _ppAbsTeams = {};          // piprep-local: member → team (from absences for selected PI)
let _ppAbsDayCounts = {};      // piprep-local: member → {weekIdx: days} (for selected PI)

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

function _ppSwitchAndKeepHash(piId) {
  // Préserver la section active avant le re-render
  const activeTab = document.querySelector('#pi-tabs-bar .rm-tab.active');
  const activeSec = activeTab?.dataset.sec || null;
  const activeRmTab = document.querySelector('.rm-tabs .rm-tab.active');
  const activeRmSec = activeRmTab?.dataset.sec || null;
  _ppSwitchPI(piId);
  _ppRefresh();
  // Restaurer le tab actif et scroller vers la section après le re-render complet
  // Double rAF pour attendre que le DOM soit peint et le scroll spy initialisé
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const sec = activeSec || activeRmSec;
    if (sec) {
      // Forcer le tab actif (le scroll spy a pu le changer)
      const bar = document.getElementById('pi-tabs-bar') || document.querySelector('.rm-tabs');
      if (bar) bar.querySelectorAll('.rm-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === sec));
      // Scroller vers la section
      const prefix = currentView === 'pi' ? 'pi-sec-' : 'rm-sec-';
      const secEl = document.getElementById(prefix + sec);
      if (secEl) {
        const container = document.getElementById('content') || document.documentElement;
        const rect = secEl.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const tabsH = document.getElementById('pi-tabs')?.offsetHeight || document.querySelector('.rm-tabs')?.offsetHeight || 0;
        const topbarH = document.querySelector('.topbar')?.offsetHeight || 0;
        const offset = tabsH + topbarH + 16;
        container.scrollTo({ top: container.scrollTop + rect.top - contRect.top - offset });
      }
    }
    if (typeof _pushHash === 'function') _pushHash();
  }));
}

function _ppSwitchPI(piId) {
  if (!_ppFile) _ppFile = {};
  _ppFile._currentPI = piId;
  _ppSave();
  _ppLoadAbsData();
}

// Compute rotation PI offset for the currently selected piprep PI
// e.g. if current rotation PI is 28 and piprep has PI29 selected → offset = 1
function _ppPIOffset() {
  const detected = _ppDetectPI(); // e.g. "PI28"
  const current  = _ppCurrentPI(); // e.g. "PI29"
  const baseNum = parseInt((detected.match(/\d+/) || [])[0]) || 0;
  const selNum  = parseInt((current.match(/\d+/) || [])[0]) || 0;
  return selNum - baseNum;
}

// Get weekInfos for the selected piprep PI (delegates to _rotWeekInfos with correct offset)
function _ppWeekInfos() {
  return typeof _rotWeekInfos === 'function' ? _rotWeekInfos(_ppPIOffset()) : [];
}

// Load absences data for the piprep-selected PI into local variables
// (does NOT modify the global _rotAbsTeams / _rotAbsDayCounts used by settings)
function _ppLoadAbsData() {
  const ppPiNum = (_ppCurrentPI() || '').replace(/^PI/i, '');
  const rotPiNum = typeof _rotWeekInfos === 'function' ? _rotWeekInfos()._piNum : null;
  // Same PI as rotation → just reference the globals
  if (!ppPiNum || ppPiNum === rotPiNum) {
    _ppAbsTeams = typeof _rotAbsTeams !== 'undefined' ? _rotAbsTeams : {};
    _ppAbsDayCounts = typeof _rotAbsDayCounts !== 'undefined' ? _rotAbsDayCounts : {};
    return;
  }
  const raw = typeof _supAbsRaw === 'function' ? _supAbsRaw(ppPiNum) : null;
  if (!raw) { _ppAbsTeams = {}; _ppAbsDayCounts = {}; return; }
  // Save globals, parse for this PI, capture results, restore globals
  const savedTeams = typeof _rotAbsTeams !== 'undefined' ? _rotAbsTeams : {};
  const savedDays  = typeof _rotAbsDayCounts !== 'undefined' ? _rotAbsDayCounts : {};
  const offset = parseInt(ppPiNum) - parseInt(rotPiNum || '0');
  if (typeof _parseAbsences === 'function') _parseAbsences(raw, offset);
  _ppAbsTeams = _rotAbsTeams;
  _ppAbsDayCounts = _rotAbsDayCounts;
  // Restore globals for settings/rotation
  _rotAbsTeams = savedTeams;
  _rotAbsDayCounts = savedDays;
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
    fetch('/data/pi-data.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(err => console.warn('[piprep] Sauvegarde échouée :', err));
  }, 300);
}

async function _ppLoad() {
  if (_ppLoaded) return;
  try {
    const res = await fetch('/data/pi-data.json');
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

// PI selector - switch between PIs, create new PI
function _ppPISelector() {
  const current = _ppCurrentPI(); // ex: "PI28"
  const currentNum = (current.match(/\d+/) || [''])[0];
  // Utiliser _piListAll() comme source centralisée
  const allPIs = typeof _piListAll === 'function' ? _piListAll() : [];
  // Merge avec les PI du fichier piprep (peuvent avoir des données sans tickets JIRA)
  const ppPIs = _ppListPIs(); // ex: ["PI28", "PI29"]
  ppPIs.forEach(pi => {
    const n = (pi.match(/\d+/) || [''])[0];
    if (n && !allPIs.some(p => p.num === n)) allPIs.push({ num: n, label: `PI ${n}`, isCurrent: false, isFuture: false });
  });
  allPIs.sort((a, b) => parseInt(b.num) - parseInt(a.num));
  const options = allPIs.map(p =>
    `<option value="PI${p.num}" ${`PI${p.num}` === current ? 'selected' : ''}>PI${p.num}</option>`
  ).join('');
  return `<div class="rm-pi-selector">
    <select onchange="_ppSwitchAndKeepHash(this.value)" class="rm-pi-select">
      ${options}
    </select>
    <button onclick="_ppCreatePI()" class="rm-pi-add" title="Ajouter un PI">+</button>
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
  _ppRefresh();
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
  _ppRefreshObj();
}

// ----------- Refresh -----------------------------------------------
// Les sections piprep sont intégrées dans la vue Roadmap.
// Rafraîchissements ciblés par section (évite le re-render complet).
// _ppRefresh() = fallback full re-render (changement PI, dates, etc.)

function _ppRefresh() {
  if (typeof currentView !== 'undefined' && currentView === 'pi' && typeof renderPI === 'function') renderPI();
  else if (typeof renderRoadmap === 'function') renderRoadmap();
}

function _ppRefreshROAM() {
  const el = document.getElementById('pp-roam');
  if (!el) return _ppRefresh();
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  el.outerHTML = _ppROAMSection(activeTeams);
}

function _ppRefreshDeps() {
  const el = document.getElementById('pp-deps');
  if (!el) return _ppRefresh();
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  el.outerHTML = _ppDepsSection(activeTeams);
}

function _ppRefreshObj() {
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  // Refresh in PI Planning view (primary location)
  const piEl = document.getElementById('pp-objectives');
  if (piEl) { piEl.outerHTML = _ppObjectivesSection(activeTeams); return; }
  // Fallback: check if inside pi-pp-objectives container
  const piWrap = document.getElementById('pi-pp-objectives');
  if (piWrap) {
    const inner = piWrap.querySelector('#pp-objectives');
    if (inner) { inner.outerHTML = _ppObjectivesSection(activeTeams); return; }
  }
  _ppRefresh();
}

function _ppRefreshFist() {
  const el = document.getElementById('pp-fist');
  if (!el) return _ppRefresh();
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const piNum = (_ppCurrentPI() || '').replace(/^PI/i, '') || null;
  el.outerHTML = _ppFistSection(activeTeams, piNum);
  // Re-render all Fist of Five evolution charts (Roadmap, PI, Scrum)
  if (typeof _renderFistChart === 'function') {
    ['fistChartRoadmap', 'fistChartPI', 'fistChartScrum'].forEach(id => {
      if (document.getElementById(id)) _renderFistChart(id, activeTeams);
    });
  }
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
  _ppRefreshROAM();
}
function _ppRoamImport(jiraId, title, team) {
  const a = _ppRoamList();
  if (a.some(r => r.jiraId === jiraId)) return;
  a.push({ id: _ppId(), cat: 'O', team, title: `${jiraId} - ${title}`, jiraId, note: '' });
  _ppSet('roam', a);
  _ppRefreshROAM();
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
  _ppRefreshDeps();
}
function _ppDepAddIntra() {
  const a = _ppDepList();
  // Pre-fill with current team if selected, or first team
  const team = (typeof currentTeam !== 'undefined' && currentTeam && currentTeam !== 'all') ? currentTeam : Object.keys(CONFIG.teams || {})[0] || '';
  a.push({ id: _ppId(), fromTeam: team, toTeam: team, fromTitle: '', toTitle: '', note: '' });
  _ppSet('deps', a);
  _ppRefreshDeps();
}

// ----------- Capacity --------------------------------------
function _ppCapGet()               { return _ppGet('capacity') || {}; }

// Recalculate all capacity values from absences data (overwrite existing)
function _ppCapRecalcFromAbs() {
  const weekInfos = _ppWeekInfos();
  const absDays   = _ppAbsDayCounts;
  if (!weekInfos.length) { showToast('Pas de données de semaines PI disponibles', 'info'); return; }
  const sprintWeeks = {};
  weekInfos.forEach((w, wi) => { const si = w.sprintIdx; if (si != null) (sprintWeeks[si] = sprintWeeks[si] || []).push(wi); });
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  const sprintsPerPI = (CONFIG.sprint?.sprintsPerPI) || 5;
  const featureSprints = sprintsPerPI - 1;
  const membersByTeam = typeof _ppMembersByTeam === 'function' ? _ppMembersByTeam(activeTeams) : {};
  const cap = {};
  activeTeams.forEach(tid => {
    const members = membersByTeam[tid] || [];
    cap[tid] = {};
    for (let si = 0; si < featureSprints; si++) {
      cap[tid][si] = {};
      members.forEach(m => {
        const weeks = sprintWeeks[si] || [];
        let total = 0;
        weeks.forEach(wi => {
          const wd = weekInfos[wi]?.workDays ?? 5;
          const abs = absDays[m]?.[wi] || 0;
          total += Math.max(0, wd - abs);
        });
        cap[tid][si][m] = total;
      });
    }
  });
  _ppSet('capacity', cap);
  if (typeof _ppRefresh === 'function') _ppRefresh();
  showToast('Capacité recalculée depuis les absences', 'success');
}
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
      return `<td class="pp-total-cell">${adjusted}<span class="pp-total-unit">j</span></td>`;
    }).join('');
    totalsRow.innerHTML = `<td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×${focusFactor})</td>${cells}`;
  }
  // Update raw totals row (×1)
  const rawRow = document.getElementById('pp-cap-raw-' + changedTid);
  if (rawRow) {
    const members = (_ppMembersByTeam(activeTeams)[changedTid] || []).filter(m => !_ppIsExcluded(changedTid, m));
    const rawCells = Array.from({ length: featureSprints }, (_, i) => {
      const total = members.reduce((s, m) => s + (cap[changedTid]?.[i]?.[m] || 0), 0);
      return `<td class="pp-total-cell" style="opacity:.6;">${total}<span class="pp-total-unit">j</span></td>`;
    }).join('');
    rawRow.innerHTML = `<td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×1)</td>${rawCells}`;
  }

  // 2. Mettre à jour la section Charge par équipe
  const loadWrap = document.getElementById('pp-load-wrap');
  if (loadWrap) {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const _bl    = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
    const _filter = t => t.type !== 'support' && t.type !== 'incident' && !isDone(t.status) &&
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
    const _filter = t => t.type !== 'support' && t.type !== 'incident' && !isDone(t.status) &&
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
    inp.style.background  = v > 0 ? 'var(--warning-bg)' : 'var(--card)';
    inp.style.color       = v > 0 ? 'var(--warning-fg)' : 'var(--text)';
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
// Sprint-scoped key: "teamId__sprintLabel" (same pattern as _moodKey)
function _fistKey(teamId) {
  const tc = CONFIG.teams[teamId];
  const label = tc?.sprintName || CONFIG.sprint.label || 'sprint';
  return `${teamId}__${label}`;
}

function _ppFistGet() {
  const md = typeof _moodData === 'function' ? _moodData() : {};
  return md.fist || (md.fist = {});
}
function _ppFistSet(tid, val) {
  const f = _ppFistGet();
  const key = _fistKey(tid);
  if (!Array.isArray(f[key])) f[key] = f[key] ? [f[key]] : [];
  f[key].push(Math.max(1, Math.min(5, parseInt(val, 10) || 3)));
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}
function _ppFistUndo(tid) {
  const f = _ppFistGet();
  const key = _fistKey(tid);
  if (Array.isArray(f[key]) && f[key].length) f[key].pop();
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}
function _ppFistReset(tid) {
  const f = _ppFistGet();
  f[_fistKey(tid)] = [];
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}

function _ppFistNotes() {
  const md = typeof _moodData === 'function' ? _moodData() : {};
  return md.fistNotes || (md.fistNotes = {});
}
function _ppFistNoteSet(tid, val) {
  const n = _ppFistNotes();
  n[_fistKey(tid)] = val;
  if (typeof _moodSave === 'function') _moodSave();
}

// Vote/undo/reset for a specific sprint key (for past sprint catch-up)
function _ppFistSetFor(tid, val, sprintKey) {
  const f = _ppFistGet();
  if (!Array.isArray(f[sprintKey])) f[sprintKey] = f[sprintKey] ? [f[sprintKey]] : [];
  f[sprintKey].push(Math.max(1, Math.min(5, parseInt(val, 10) || 3)));
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}
function _ppFistUndoFor(sprintKey) {
  const f = _ppFistGet();
  if (Array.isArray(f[sprintKey]) && f[sprintKey].length) f[sprintKey].pop();
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}
function _ppFistResetFor(sprintKey) {
  const f = _ppFistGet();
  f[sprintKey] = [];
  if (typeof _moodSave === 'function') _moodSave();
  _ppRefreshFist();
}
function _ppFistNoteSetFor(val, sprintKey) {
  const n = _ppFistNotes();
  n[sprintKey] = val;
  if (typeof _moodSave === 'function') _moodSave();
}

// Collect all sprint labels within the current PI for a team
function _fistPISprints(tid, piNum) {
  if (!piNum) return [];
  const piRe = new RegExp(`(^|\\D)${piNum}\\.\\d+`);
  const tc = CONFIG.teams[tid];
  const sprintSet = new Map(); // label → order
  // From velocity history (closed sprints)
  (tc?.velocityHistory || []).forEach(vh => {
    if (piRe.test(vh.name || '')) {
      const m = (vh.name || '').match(new RegExp(`${piNum}\\.(\\d+)`));
      sprintSet.set(vh.name, m ? parseInt(m[1], 10) : 0);
    }
  });
  // Active sprint
  const activeSprint = tc?.sprintName || CONFIG.sprint.label || '';
  if (piRe.test(activeSprint)) {
    const m = activeSprint.match(new RegExp(`${piNum}\\.(\\d+)`));
    sprintSet.set(activeSprint, m ? parseInt(m[1], 10) : 99);
  }
  // For future PIs with no sprints found: generate expected sprint labels
  if (!sprintSet.size) {
    const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
    const teamName = tc?.name || tid;
    for (let i = 1; i <= sprintsPerPI; i++) {
      sprintSet.set(`${teamName} - Ité ${piNum}.${i}`, i);
    }
  }
  // Sort by iteration number
  return [...sprintSet.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label);
}

// Collect all sprint votes for a team (for sparkline / evolution)
function _fistHistory(teamId, piNum) {
  const fist = _ppFistGet();
  const prefix = teamId + '__';
  const sprints = [];
  Object.entries(fist).forEach(([k, votes]) => {
    if (!k.startsWith(prefix) || !Array.isArray(votes) || !votes.length) return;
    const spLabel = k.slice(prefix.length);
    // Filter by PI if specified
    if (piNum) {
      const m = spLabel.match(/(\d+)\.\d+/);
      if (!m || m[1] !== piNum) return;
    }
    const avg = Math.round(votes.reduce((s, v) => s + v, 0) / votes.length * 10) / 10;
    sprints.push({ label: spLabel, avg, count: votes.length });
  });
  sprints.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return sprints;
}

// SVG sparkline for fist evolution across sprints (per team)
function _fistSparkline(teamId, piNum) {
  const sprints = _fistHistory(teamId, piNum);
  if (sprints.length < 2) return '';

  const last6 = sprints.slice(-6);
  const w = 130, h = 32, pad = 4;
  const stepX = (w - pad * 2) / Math.max(last6.length - 1, 1);
  const range = 4; // 1..5

  const points = last6.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p.avg - 1) / range) * (h - pad * 2),
    ...p,
  }));

  const lastAvg = points[points.length - 1].avg;
  const color = lastAvg < 3 ? '#DC2626' : lastAvg < 4 ? '#D97706' : '#16A34A';
  const pathD = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const dots = points.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}" stroke="white" stroke-width="1"><title>${p.label}: ${p.avg}/5 (${p.count}v)</title></circle>`
  ).join('');

  return `<svg width="${w}" height="${h}" style="display:block;flex-shrink:0;" title="Évolution confiance">
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
    ${dots}
  </svg>`;
}

// Global sparkline across all teams (for summary)
function _fistGlobalSparkline(activeTeams, piNum) {
  const fist = _ppFistGet();
  const sprintMap = new Map(); // sprintLabel → [votes...]
  Object.entries(fist).forEach(([k, votes]) => {
    if (!k.includes('__') || !Array.isArray(votes) || !votes.length) return;
    const [tid, spLabel] = k.split('__');
    if (!spLabel || !activeTeams.includes(tid)) return;
    // Filter by PI if specified
    if (piNum) {
      const m = spLabel.match(/(\d+)\.\d+/);
      if (!m || m[1] !== piNum) return;
    }
    if (!sprintMap.has(spLabel)) sprintMap.set(spLabel, []);
    sprintMap.get(spLabel).push(...votes);
  });

  if (sprintMap.size < 2) return '';

  const sorted = [...sprintMap.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const last6 = sorted.slice(-6);
  const points = last6.map(([label, votes]) => ({
    label,
    avg: Math.round(votes.reduce((s, v) => s + v, 0) / votes.length * 10) / 10,
    count: votes.length,
  }));

  const w = 160, h = 36, pad = 4;
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);
  const range = 4;

  const pts = points.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p.avg - 1) / range) * (h - pad * 2),
    ...p,
  }));

  const lastAvg = pts[pts.length - 1].avg;
  const color = lastAvg < 3 ? '#DC2626' : lastAvg < 4 ? '#D97706' : '#16A34A';
  const pathD = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1"><title>${p.label}: ${p.avg}/5 (${p.count}v)</title></circle>`
  ).join('');

  return `<div style="display:flex;align-items:center;gap:6px;">
    <span style="font-size:10px;color:var(--text-muted);">Évolution</span>
    <svg width="${w}" height="${h}" style="display:block;">
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
      ${dots}
    </svg>
  </div>`;
}

// ============================================================
// Équipes par membre (support > absences > JIRA tickets)
// ============================================================
function _ppMembersByTeam(activeTeams) {
  const result = {};
  // Use piprep PI number for hidden members key (not rotation PI)
  const ppPiNum = (_ppCurrentPI() || '').replace(/^PI/i, '') || (_ppWeekInfos()._piNum);
  activeTeams.forEach(t => {
    // Gather base members: JIRA MEMBERS + extra + absences
    const base = typeof MEMBERS !== 'undefined' ? (MEMBERS[t] || []) : [];
    const extra = typeof _rotExtraMembers !== 'undefined' ? (_rotExtraMembers[t] || []) : [];
    const fromAbs = Object.entries(_ppAbsTeams).filter(([, team]) => team === t).map(([m]) => m);
    // Hidden key uses piprep PI number
    const hk = ppPiNum ? `${t}__pi${ppPiNum}` : t;
    const hidden = typeof _rotHiddenMembers !== 'undefined'
      ? new Set(_rotHiddenMembers[hk] || [])
      : new Set();
    const all = [...new Set([...base, ...extra, ...fromAbs])].filter(m => !hidden.has(m));
    all.sort((a, b) => a.localeCompare(b, 'fr'));
    result[t] = all;
  });
  return result;
}

// ============================================================
// Score de readiness (0-100)
// ============================================================
function _ppReadiness(allBacklog, activeTeams) {
  const allObjs = _ppObjList();
  const objs = activeTeams.length ? allObjs.filter(o => activeTeams.includes(o.team)) : allObjs;
  const roam  = _ppRoamList();
  const fist  = _ppFistGet();

  // 1. Stories pointées (40%)
  const ptsPct = allBacklog.length
    ? Math.round(allBacklog.filter(t => t.points > 0).length / allBacklog.length * 100)
    : 100;

  // 2. Objectifs PI définis (20%) - au moins 1 par équipe active
  const objCoverage = activeTeams.length
    ? Math.min(1, objs.length / activeTeams.length)
    : (objs.length > 0 ? 1 : 0);

  // 3. Fist of Five voté (20%) - sprint-scoped
  const fistCoverage = activeTeams.length
    ? activeTeams.filter(t => { const k = _fistKey(t); const v = fist[k]; return Array.isArray(v) ? v.length > 0 : !!v; }).length / activeTeams.length
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
    { label: `Fist of Five : ${activeTeams.filter(t => { const k = _fistKey(t); const v = fist[k]; return Array.isArray(v) ? v.length > 0 : !!v; }).length}/${activeTeams.length} équipes`, ok: fistCoverage >= 1 && activeTeams.length > 0, pct: Math.round(fistCoverage * 100), target: 'pp-fist' },
  ];
  if (roam.length > 0) {
    checks.push({ label: `ROAM : ${roamResolved}/${roam.length} risques traités`, ok: roamOk, pct: roamScore, target: 'pp-roam' });
  }

  return { score: Math.min(score, 100), checks };
}

// renderPIPrep() supprimée — code mort (view-piprep n'existe pas).
// Les sections piprep sont intégrées dans roadmap.js via les fonctions _pp*Section().

// ============================================================
// En-tête - Score de readiness
// ============================================================
function _ppSectionHeader(readiness) {
  const { score, checks } = readiness;
  const color  = thresholdColor(score, 80, 50);
  const bg     = score >= 80 ? 'var(--success-bg)' : score >= 50 ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const border = score >= 80 ? '#86EFAC' : score >= 50 ? '#FCD34D' : '#FECACA';
  const label  = score >= 80 ? 'Prêt ✓' : score >= 50 ? 'En cours' : 'À compléter';

  const checkRows = checks.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid ${border}40;cursor:pointer;border-radius:4px;transition:background .15s;"
         onclick="(function(){var el=document.getElementById('${c.target}');if(!el)return;var c=document.getElementById('content')||document.documentElement;var r=el.getBoundingClientRect();var cr=c.getBoundingClientRect();var o=(document.querySelector('.rm-tabs-bar')?.offsetHeight||0)+(document.getElementById('topbar')?.offsetHeight||0)+16;c.scrollBy({top:r.top-cr.top-o,behavior:'smooth'});})()"
         onmouseenter="this.style.background='${border}30'" onmouseleave="this.style.background='transparent'">
      <span>${c.ok ? '✅' : '⚠️'}</span>
      <span style="flex:1;font-size:12px;color:var(--text);">${c.label}</span>
      <div style="width:80px;height:5px;background:#0001;border-radius:3px;overflow:hidden;">
        <div style="width:${c.pct}%;height:100%;background:${c.ok ? CLR.darkGrn : CLR.darkAmber};border-radius:3px;"></div>
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
    <div style="background:var(--success-bg);border:1.5px solid #86EFAC;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--success-fg);font-weight:600;height:100%;box-sizing:border-box;">
      ✅ Tout le backlog est pointé - simulation précise
    </div>`;

  const chips = unpointed.slice(0, 10).map(t => {
    const c = CONFIG.typeColors[t.type] || CLR.dark;
    return `<span onclick="openModal('${t.id}')" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;background:${c}18;border:1px solid ${c}40;font-size:11px;font-weight:600;color:${c};cursor:pointer;margin:2px;">${t.id}</span>`;
  }).join('');
  const more = unpointed.length > 10 ? `<span style="font-size:11px;color:var(--text-muted);margin:2px 4px;">+${unpointed.length - 10} autres</span>` : '';

  return `
    <div style="background:var(--warning-bg);border:1.5px solid #FCD34D;border-radius:10px;padding:12px 16px;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;font-weight:700;color:var(--warning-fg);margin-bottom:8px;">⚠️ ${unpointed.length} storie${unpointed.length > 1 ? 's' : ''} sans story points - cliquer pour renseigner</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;">${chips}${more}</div>
    </div>`;
}

// ============================================================
// PI Objectives Board
// ============================================================
function _ppObjectivesSection(activeTeams) {
  const allObjs = _ppObjList();
  const objs = activeTeams.length ? allObjs.filter(o => activeTeams.includes(o.team)) : allObjs;
  const totalBV = objs.filter(o => o.type === 'committed').reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);

  const ST = PP_STATUS_OPTS;
  const TY = [
    { v: 'committed', l: '🎯 Committed' },
    { v: 'stretch',   l: '⭐ Stretch' },
  ];

  const rows = objs.map(o => {
    const st   = ST.find(s => s.v === o.status) || ST[0];
    const tc   = _teamColor(o.team);
    const teamSel = activeTeams.map(t =>
      `<option value="${t}" ${o.team === t ? 'selected' : ''}>${escapeHtml(CONFIG.teams[t]?.name || t)}</option>`
    ).join('');
    const typeSel = TY.map(t =>
      `<option value="${t.v}" ${o.type === t.v ? 'selected' : ''}>${t.l}</option>`
    ).join('');
    const stSel = ST.map(s =>
      `<option value="${s.v}" style="background:${s.bg};color:${s.c};" ${o.status === s.v ? 'selected' : ''}>${s.l}</option>`
    ).join('');
    return `
      <tr class="pp-tr">
        <td class="pp-td" style="max-width:280px;">
          <input value="${(o.title || '').replace(/"/g,'&quot;')}" class="pp-input-title"
            onchange="_ppObjUpdate('${o.id}','title',this.value)">
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppObjUpdate('${o.id}','team',this.value);_ppRefreshObj();"
            class="pp-select pp-select-team" style="background:${tc}22;color:${tc};">${teamSel}</select>
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppObjUpdate('${o.id}','type',this.value);_ppRefreshObj();"
            class="pp-select">${typeSel}</select>
        </td>
        <td class="pp-td-center">
          <input type="number" min="1" max="10" value="${o.bv || 5}" class="pp-input-bv"
            onchange="_ppObjUpdate('${o.id}','bv',parseInt(this.value)||5)">
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppObjUpdate('${o.id}','status',this.value);_ppRefreshObj();"
            class="pp-select pp-select-team" style="background:${st.bg};color:${st.c};">${stSel}</select>
        </td>
        <td class="pp-td-center">
          <button onclick="_ppObjDel('${o.id}');_ppRefreshObj();" title="Supprimer" class="pp-btn-del">🗑</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div id="pp-objectives" class="pp-section">
      <div class="section-header">
        <div class="section-title">🎯 Objectifs PI</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="pp-sub">${objs.length} objectif${objs.length !== 1 ? 's' : ''} · BV committed : <strong>${totalBV}</strong></span>
          <button onclick="_ppObjAdd();" class="pp-btn-add">+ Ajouter</button>
        </div>
      </div>
      <div class="card pp-table-wrap">
        <table class="pp-table">
          <thead><tr class="pp-thead">
            <th class="pp-th">Objectif</th>
            <th class="pp-th">Équipe</th>
            <th class="pp-th">Type</th>
            <th class="pp-th pp-th-center">BV</th>
            <th class="pp-th">Statut</th>
            <th class="pp-th" style="width:32px;"></th>
          </tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="pp-empty-row" style="text-align:center;padding:32px 16px;">
              <div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text-muted);">
                <span style="font-size:28px;">🎯</span>
                <span style="font-size:13px;font-weight:600;">Aucun objectif défini pour ce PI</span>
                <span style="font-size:11px;">Commencez la préparation en ajoutant des objectifs Committed et Stretch via le bouton <strong>+ Ajouter</strong> ci-dessus.</span>
              </div>
            </td></tr>`}
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

  // Use _ppWeekInfos() to get correct dates for the selected PI
  const weekInfos    = _ppWeekInfos();
  const durationDays = CONFIG.sprint?.durationDays || 14;
  const weeksPerSprint = durationDays / 7;
  const piLabel = (_ppCurrentPI() || '').replace(/^PI/i, '') || weekInfos._piNum || '';

  // Build sprint dates from weekInfos (groups of weeksPerSprint weeks)
  const sprintDates = Array.from({ length: sprintsPerPI }, (_, i) => {
    const wIdx = i * weeksPerSprint;
    const wi = weekInfos[wIdx];
    const wiEnd = weekInfos[wIdx + weeksPerSprint - 1];
    const s = wi ? wi._start : new Date();
    const e = wiEnd ? wiEnd._end : new Date();
    return { s, e, isIP: i === sprintsPerPI - 1 };
  });

  const headerCells = sprintDates.map((sd, i) =>
    `<th class="pp-th pp-th-center">${sd.isIP ? '🍃 IP' : `${piLabel ? `${piLabel}.${i+1}` : `S${i+1}`}`}${typeof _fmtD === 'function' ? `<br><span style="font-weight:400;font-size:10px;">${_fmtD(sd.s)}</span>` : ''}</th>`
  ).join('');

  const cap         = _ppCapGet();
  const focusFactor = 0.8;

  const rows = activeTeams.map(tid => {
    const tc       = CONFIG.teams[tid];
    const color    = tc?.color || CLR.dark;
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
      if (sprintDates[i].isIP) return `<td class="pp-cell-ip">IP</td>`;
      const sCap = sprintCaps[i] || defaultCap;
      const pct = sCap ? Math.min(100, Math.round(s.pts / sCap * 100)) : 0;
      const bc  = pct >= 95 ? '#DC2626' : pct >= 80 ? '#D97706' : '#16A34A';
      return `<td style="padding:8px 10px;text-align:center;">
        <div style="font-weight:700;font-size:13px;color:${bc};">${s.pts}<span class="pp-total-unit">/${sCap}</span></div>
        <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${bc};border-radius:2px;"></div>
        </div>
      </td>`;
    }).join('');

    return `<tr class="pp-tr">
      <td class="pp-td-lg">
        <span class="pp-team-label">
          <span class="pp-team-dot" style="background:${color};"></span>
          ${tc?.name || tid}
        </span>
      </td>${cells}
    </tr>`;
  }).join('');

  return `
    <div class="pp-section">
      <div class="card pp-table-wrap">
        <table class="pp-table">
          <thead><tr class="pp-thead">
            <th class="pp-th" style="text-align:left;">Équipe</th>${headerCells}
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

  // Pre-compute available days per member per sprint from absences (for selected PI)
  const weekInfos = _ppWeekInfos();
  const absDays   = _ppAbsDayCounts;
  // Build sprintIdx → [weekIdx, ...] mapping
  const sprintWeeks = {};
  weekInfos.forEach((w, wi) => {
    const si = w.sprintIdx;
    if (si == null) return;
    (sprintWeeks[si] = sprintWeeks[si] || []).push(wi);
  });
  // Compute default available days for a member in a sprint
  function _defaultDays(member, si) {
    const weeks = sprintWeeks[si];
    if (!weeks || !weeks.length) return 0;
    let total = 0;
    weeks.forEach(wi => {
      const wd = weekInfos[wi]?.workDays ?? 5;
      const abs = absDays[member]?.[wi] || 0;
      total += Math.max(0, wd - abs);
    });
    return total;
  }

  // Auto-fill capacity from absences if no manual values saved for any team
  let autoFilled = false;
  activeTeams.forEach(tid => {
    const members = membersByTeam[tid] || [];
    if (!members.length) return;
    sprintCols.forEach(si => {
      members.forEach(m => {
        // Only auto-fill if no value has been manually set
        if (cap[tid]?.[si]?.[m] != null) return;
        const days = _defaultDays(m, si);
        if (!cap[tid])     cap[tid]     = {};
        if (!cap[tid][si]) cap[tid][si] = {};
        cap[tid][si][m] = days;
        autoFilled = true;
      });
    });
  });
  if (autoFilled) _ppSet('capacity', cap);

  const sections = activeTeams.map(tid => {
    const tc      = CONFIG.teams[tid];
    const color   = tc?.color || CLR.dark;
    const rawMembers = membersByTeam[tid] || [];
    if (!rawMembers.length) return '';
    // Sort: active members first, excluded (inactive) members at the bottom
    const members = [...rawMembers].sort((a, b) => {
      const exA = _ppIsExcluded(tid, a) ? 1 : 0;
      const exB = _ppIsExcluded(tid, b) ? 1 : 0;
      return exA - exB;
    });

    const piLabel = (_ppCurrentPI() || '').replace(/^PI/i, '') || weekInfos._piNum || '';
    const colHeaders = sprintCols.map(i => {
      const weeks = sprintWeeks[i] || [];
      const hols = weeks.flatMap(wi => weekInfos[wi]?.holidays || []);
      const holTip = hols.length ? ` title="${hols.join(', ')}"` : '';
      const holBadge = hols.length ? `<br><span style="font-weight:600;font-size:8px;color:#DC2626;cursor:default;"${holTip}>🔴 ${hols.length}j férié${hols.length > 1 ? 's' : ''}</span>` : '';
      return `<th class="pp-th-sm">${piLabel ? `${piLabel}.${i+1}` : `Sprint ${i+1}`}<br><span style="font-weight:400;font-size:9px;">j dispos</span>${holBadge}</th>`;
    }).join('');

    const memberRows = members.map(m => {
      const mc = (typeof MEMBER_COLORS !== 'undefined' && MEMBER_COLORS?.[m]) || CLR.slate;
      const excluded = _ppIsExcluded(tid, m);
      const rowOpacity = excluded ? 'opacity:.4;' : '';
      const cells = sprintCols.map(i => {
        const v = cap[tid]?.[i]?.[m] || 0;
        const spWeeks = sprintWeeks[i] || [];
        const maxDays = spWeeks.reduce((s, wi) => s + (weekInfos[wi]?.workDays ?? 5), 0);
        const pct = maxDays ? v / maxDays : 0;
        // 3 colors: green (>=75%), orange (>=40%), red (<40%)
        const cBorder = v === 0 ? 'var(--border)' : thresholdColor(pct * 100, 75, 40);
        const cBg     = v === 0 ? 'var(--card)' : pct >= 0.75 ? 'var(--success-bg)' : pct >= 0.4 ? 'var(--warning-bg)' : 'var(--danger-bg)';
        const cText   = v === 0 ? 'var(--text)' : pct >= 0.75 ? 'var(--success-fg)' : pct >= 0.4 ? 'var(--warning-fg)' : 'var(--danger-fg)';
        return `<td style="padding:5px 10px;text-align:center;">
          <input type="number" min="0" max="99" value="${v}"
            class="pp-cap-input" data-tid="${tid}" data-si="${i}" data-member="${m}"
            style="width:48px;padding:3px 4px;border:1.5px solid ${cBorder};border-radius:6px;font-size:13px;font-weight:700;background:${cBg};color:${cText};text-align:center;"
            onchange="_ppCapSet('${tid}',${i},'${m}',this.value)"
            onfocus="this.select()"
            oninput="_ppCapAutoAdvance(this)">
        </td>`;
      }).join('');
      return `<tr class="pp-tr" style="${rowOpacity}">
        <td style="padding:6px 12px;font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:6px;">
          <input type="checkbox" ${excluded ? '' : 'checked'} onchange="_ppExcludedToggle('${tid}','${m}',this)" title="${excluded ? 'Inclure dans le calcul' : 'Exclure du calcul'}" style="cursor:pointer;accent-color:var(--primary);margin:0;">
          ${avatarBadge(m, mc, {w:20, fs:'9px'})}
          ${m}
        </td>${cells}
      </tr>`;
    }).join('');

    const includedMembers = members.filter(m => !_ppIsExcluded(tid, m));
    // Working days per sprint (sum of workDays across weeks in the sprint)
    const workDaysRow = sprintCols.map(i => {
      const weeks = sprintWeeks[i] || [];
      const wd = weeks.reduce((s, wi) => s + (weekInfos[wi]?.workDays ?? 5), 0);
      return `<td class="pp-total-cell" style="opacity:.45;font-size:11px;">${wd}<span class="pp-total-unit">j</span></td>`;
    }).join('');
    const totalRowRaw = sprintCols.map(i => {
      const total = includedMembers.reduce((s, m) => s + (cap[tid]?.[i]?.[m] || 0), 0);
      return `<td class="pp-total-cell" style="opacity:.6;">${total}<span class="pp-total-unit">j</span></td>`;
    }).join('');
    const totalRowFocus = sprintCols.map(i => {
      const total    = includedMembers.reduce((s, m) => s + (cap[tid]?.[i]?.[m] || 0), 0);
      const adjusted = Math.round(total * focusFactor);
      return `<td class="pp-total-cell">${adjusted}<span class="pp-total-unit">j</span></td>`;
    }).join('');

    return `
      <div style="margin-bottom:16px;">
        <div class="pp-team-label" style="color:${color};margin-bottom:8px;">
          <span class="pp-team-dot" style="background:${color};"></span>
          ${tc?.name || tid}
        </div>
        <table class="pp-table-sm">
          <thead><tr class="pp-thead">
            <th class="pp-th-sm" style="text-align:left;padding-left:12px;">Membre</th>
            ${colHeaders}
          </tr></thead>
          <tbody>
            ${memberRows}
            <tr class="pp-totals" style="opacity:.45;">
              <td style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);">Jours ouvrés</td>
              ${workDaysRow}
            </tr>
            <tr id="pp-cap-raw-${tid}" class="pp-totals" style="opacity:.55;">
              <td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×1)</td>
              ${totalRowRaw}
            </tr>
            <tr id="pp-cap-totals-${tid}" class="pp-totals">
              <td style="padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);">Total effectif (×${focusFactor})</td>
              ${totalRowFocus}
            </tr>
          </tbody>
        </table>
      </div>`;
  }).filter(Boolean).join('');

  if (!sections) return '';

  return `
    <div class="pp-section">
      <div class="section-header">
        <div class="section-title">👥 Capacité individuelle par sprint</div>
        <span class="pp-sub">Jours disponibles par membre · facteur focus ${Math.round(focusFactor * 100)}%</span>
        <button class="btn btn-secondary btn-sm" onclick="_ppCapRecalcFromAbs()" title="Recalculer les jours disponibles depuis les congés/absences">🔄 Recalculer depuis absences</button>
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
    { k: 'R', label: 'Resolved',  emoji: '✅', bg: 'var(--success-bg)', border: '#86EFAC', tc: 'var(--success-fg)' },
    { k: 'O', label: 'Owned',     emoji: '👤', bg: '#EFF6FF', border: '#93C5FD', tc: '#1D4ED8' },
    { k: 'A', label: 'Accepted',  emoji: '🤝', bg: 'var(--warning-bg)', border: '#FCD34D', tc: 'var(--warning-fg)' },
    { k: 'M', label: 'Mitigated', emoji: '🛡️', bg: '#F5F3FF', border: '#C4B5FD', tc: '#5B21B6' },
  ];

  // Suggestions depuis tickets bloqués JIRA
  const existingJira  = new Set(roam.filter(r => r.jiraId).map(r => r.jiraId));
  const suggestions   = getTickets().filter(t => t.status === 'blocked' && !existingJira.has(t.id)).slice(0, 5);

  const suggestBanner = suggestions.length ? `
    <div class="pp-roam-suggest">
      <div class="pp-roam-suggest-title">💡 Tickets bloqués JIRA - importer comme risque "Owned"</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${suggestions.map(t => `
          <button onclick="_ppRoamImport('${t.id}','${escapeHtml((t.title || '').replace(/'/g,"\\'"))}','${t.team || activeTeams[0] || 'A'}');"
            class="pp-roam-suggest-btn">
            ➕ ${t.id}
          </button>`).join('')}
      </div>
    </div>` : '';

  const cols = CATS.map(cat => {
    const items = roam.filter(r => r.cat === cat.k);
    const moveBtns = (id) => CATS.filter(c => c.k !== cat.k).map(c =>
      `<button onclick="_ppRoamMove('${id}','${c.k}');_ppRefreshROAM();" class="pp-btn-move">${c.emoji}</button>`
    ).join('');

    const cards = items.map(r => {
      const tc2 = _teamColor(r.team);
      return `
        <div class="pp-roam-card" style="border-color:${cat.border};">
          <div class="pp-roam-card-top">
            <textarea rows="2" class="pp-roam-textarea"
              onchange="_ppRoamField('${r.id}','title',this.value)">${r.title || ''}</textarea>
            <button onclick="_ppRoamDel('${r.id}');_ppRefreshROAM();" class="pp-roam-close">✕</button>
          </div>
          <input placeholder="Note / plan d'action…" value="${(r.note || '').replace(/"/g,'&quot;')}"
            class="pp-input-note" style="margin-bottom:5px;"
            onchange="_ppRoamField('${r.id}','note',this.value)">
          <div class="pp-roam-footer">
            <select onchange="_ppRoamField('${r.id}','team',this.value);_ppRefreshROAM();"
              style="border:1px solid var(--border);border-radius:5px;padding:2px 5px;font-size:10px;font-weight:700;color:${tc2};background:${tc2}18;">
              ${activeTeams.map(t => `<option value="${t}" ${r.team === t ? 'selected' : ''}>${escapeHtml(CONFIG.teams[t]?.name || t)}</option>`).join('')}
            </select>
            <div>${moveBtns(r.id)}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="pp-roam-col" style="background:${cat.bg};border-color:${cat.border};">
        <div class="pp-roam-head" style="color:${cat.tc};">
          <span>${cat.emoji} ${cat.label}</span>
          <span class="pp-roam-count" style="border-color:${cat.border};">${items.length}</span>
        </div>
        ${cards}
        <button onclick="_ppRoamAddCat('${cat.k}');" class="pp-roam-add" style="border-color:${cat.border};color:${cat.tc};">
          + Ajouter
        </button>
      </div>`;
  }).join('');

  return `
    <div id="pp-roam" class="pp-section">
      <div class="section-header">
        <div class="section-title">⚡ ROAM Board - Risques</div>
        <span class="pp-sub">${roam.length} risque${roam.length !== 1 ? 's' : ''} · ${roam.filter(r => r.cat === 'R' || r.cat === 'M').length} traités</span>
      </div>
      ${suggestBanner}
      <div class="pp-roam-grid">${cols}</div>
    </div>`;
}

// ============================================================
// Dépendances inter-équipes
// ============================================================
function _ppDepsSection(_activeTeams) {
  const allDeps = _ppDepList();
  // Filter by active teams if a team filter is set
  const _hasFilter = _activeTeams && _activeTeams.length && _activeTeams.length < Object.keys(CONFIG.teams || {}).length;
  const _teamSet = _hasFilter ? new Set(_activeTeams) : null;
  const deps = _teamSet
    ? allDeps.filter(d => _teamSet.has(d.fromTeam) || _teamSet.has(d.toTeam) || (!d.fromTeam && !d.toTeam))
    : allDeps;
  const interDeps = deps.filter(d => d.fromTeam !== d.toTeam || !d.fromTeam || !d.toTeam);
  const intraDeps = deps.filter(d => d.fromTeam && d.toTeam && d.fromTeam === d.toTeam);

  // Toutes les équipes connues (tickets + config) - pas seulement le filtre actif
  const ticketTeams = typeof _allTeams === 'function' ? _allTeams() : [];
  const allTeams = (ticketTeams.length ? ticketTeams : Object.keys(CONFIG.teams || {})).sort();
  const teamSel = (_id, _field, cur) =>
    `<option value="" ${!cur ? 'selected' : ''} disabled>- Équipe -</option>` +
    allTeams.map(t =>
      `<option value="${t}" ${cur === t ? 'selected' : ''}>${CONFIG.teams[t]?.name || t}</option>`
    ).join('');

  // Build sprint options for current PI and next PI
  const sprintsPerPI = (CONFIG.sprint?.sprintsPerPI) || 5;
  const piStr = _ppCurrentPI().replace(/^PI/i, '');
  const piNum = parseInt(piStr, 10) || 0;
  const sprintOptions = [];
  [piNum, piNum + 1].forEach(pi => {
    for (let s = 1; s <= sprintsPerPI; s++) {
      sprintOptions.push({ value: `${pi}.${s}`, label: `Ité ${pi}.${s}` });
    }
  });
  const sprintSel = (cur) =>
    `<option value="" ${!cur ? 'selected' : ''}>-</option>` +
    sprintOptions.map(s =>
      `<option value="${s.value}" ${cur === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('');

  const DEP_ST = PP_STATUS_OPTS_DEP;
  const depStatusSel = (cur) => DEP_ST.map(s =>
    `<option value="${s.v}" style="background:${s.bg};color:${s.c};" ${cur === s.v ? 'selected' : ''}>${s.l}</option>`
  ).join('');

  const _depRow = d => {
    const fc = _teamColor(d.fromTeam);
    const tc = _teamColor(d.toTeam);
    const st = DEP_ST.find(s => s.v === (d.status || 'todo')) || DEP_ST[0];
    return `
      <tr class="pp-tr">
        <td class="pp-td" style="max-width:200px;">
          <input value="${(d.fromTitle || '').replace(/"/g,'&quot;')}" placeholder="Feature / livrable…"
            class="pp-input" onchange="_ppDepField('${d.id}','fromTitle',this.value)">
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','fromTeam',this.value);_ppRefreshDeps();"
            class="pp-select-sm pp-select-team" style="background:${fc}22;color:${fc};">
            ${teamSel(d.id,'fromTeam',d.fromTeam)}
          </select>
        </td>
        <td class="pp-dep-arrow">→</td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','toTeam',this.value);_ppRefreshDeps();"
            class="pp-select-sm pp-select-team" style="background:${tc}22;color:${tc};">
            ${teamSel(d.id,'toTeam',d.toTeam)}
          </select>
        </td>
        <td class="pp-td" style="max-width:200px;">
          <input value="${(d.toTitle || '').replace(/"/g,'&quot;')}" placeholder="Attend…"
            class="pp-input" onchange="_ppDepField('${d.id}','toTitle',this.value)">
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','sprint',this.value);"
            class="pp-select-sm" style="font-size:11px;">
            ${sprintSel(d.sprint)}
          </select>
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','status',this.value);_ppRefreshDeps();"
            class="pp-select-sm pp-select-team" style="background:${st.bg};color:${st.c};font-size:11px;">
            ${depStatusSel(d.status || 'todo')}
          </select>
        </td>
        <td class="pp-td">
          <input value="${(d.note || '').replace(/"/g,'&quot;')}" placeholder="Note…"
            class="pp-input-note" onchange="_ppDepField('${d.id}','note',this.value)">
        </td>
        <td class="pp-td-center">
          <button onclick="_ppDepDel('${d.id}');_ppRefreshDeps();" title="Supprimer" class="pp-btn-del">🗑</button>
        </td>
      </tr>`;
  };

  const _depTable = (items) => `<div class="card pp-table-wrap">
    <table class="pp-table">
      <thead><tr class="pp-thead">
        <th class="pp-th">Livrable</th>
        <th class="pp-th">De</th>
        <th class="pp-th" style="padding:0;"></th>
        <th class="pp-th">Vers</th>
        <th class="pp-th">Besoin</th>
        <th class="pp-th">Sprint</th>
        <th class="pp-th">Statut</th>
        <th class="pp-th">Note</th>
        <th class="pp-th" style="width:32px;"></th>
      </tr></thead>
      <tbody>${items.map(_depRow).join('')}</tbody>
    </table>
  </div>`;

  const _intraRow = d => {
    const tc = _teamColor(d.fromTeam);
    const st = DEP_ST.find(s => s.v === (d.status || 'todo')) || DEP_ST[0];
    return `
      <tr class="pp-tr">
        <td class="pp-td" style="max-width:280px;">
          <input value="${(d.fromTitle || '').replace(/"/g,'&quot;')}" placeholder="Description du risque…"
            class="pp-input" onchange="_ppDepField('${d.id}','fromTitle',this.value)">
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','fromTeam',this.value);_ppDepField('${d.id}','toTeam',this.value);_ppRefreshDeps();"
            class="pp-select-sm pp-select-team" style="background:${tc}22;color:${tc};">
            ${teamSel(d.id,'fromTeam',d.fromTeam)}
          </select>
        </td>
        <td class="pp-td-nw">
          <select onchange="_ppDepField('${d.id}','status',this.value);_ppRefreshDeps();"
            class="pp-select-sm pp-select-team" style="background:${st.bg};color:${st.c};font-size:11px;">
            ${depStatusSel(d.status || 'todo')}
          </select>
        </td>
        <td class="pp-td">
          <input value="${(d.note || '').replace(/"/g,'&quot;')}" placeholder="Note / action…"
            class="pp-input-note" onchange="_ppDepField('${d.id}','note',this.value)">
        </td>
        <td class="pp-td-center">
          <button onclick="_ppDepDel('${d.id}');_ppRefreshDeps();" title="Supprimer" class="pp-btn-del">🗑</button>
        </td>
      </tr>`;
  };

  const _intraTable = (items) => `<div class="card pp-table-wrap">
    <table class="pp-table">
      <thead><tr class="pp-thead">
        <th class="pp-th">Risque</th>
        <th class="pp-th">Équipe</th>
        <th class="pp-th">Statut</th>
        <th class="pp-th">Note / Action</th>
        <th class="pp-th" style="width:32px;"></th>
      </tr></thead>
      <tbody>${items.map(_intraRow).join('')}</tbody>
    </table>
  </div>`;

  return `
    <div id="pp-deps" class="pp-section">
      <div class="section-header">
        <div class="section-title">🔗 Dépendances inter-équipes</div>
        <button onclick="_ppDepAdd();" class="pp-btn-add">+ Ajouter</button>
      </div>
      ${!interDeps.length
        ? `<div class="pp-empty">Aucune dépendance inter-équipes</div>`
        : _depTable(interDeps)}
      ${interDeps.length >= 2 ? _ppDepsHeatmap(interDeps, allTeams) : ''}

      <div class="section-header" style="margin-top:16px;">
        <div class="section-title" style="font-size:14px;">🔁 Risques intra-équipe</div>
        <button onclick="_ppDepAddIntra();" class="pp-btn-add">+ Ajouter</button>
      </div>
      ${intraDeps.length
        ? _intraTable(intraDeps)
        : `<div class="pp-empty">Aucun risque intra-équipe</div>`}
    </div>`;
}

// Dependency heatmap matrix + sprint timeline view
let _ppDepViewMode = 'matrix'; // 'matrix' or 'timeline'
function _ppToggleDepView(mode) {
  _ppDepViewMode = mode;
  _ppRefreshDeps();
}
function _ppDepsHeatmap(deps, _allTeams) {
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

  // View toggle
  const isTimeline = _ppDepViewMode === 'timeline';
  const toggleHtml = `<div style="display:flex;gap:4px;margin-bottom:8px;">
    <button onclick="_ppToggleDepView('matrix')" class="btn" style="font-size:10px;padding:3px 10px;${!isTimeline ? 'background:var(--primary);color:#fff;' : 'background:var(--surface);color:var(--text-muted);'}">🗺️ Matrice</button>
    <button onclick="_ppToggleDepView('timeline')" class="btn" style="font-size:10px;padding:3px 10px;${isTimeline ? 'background:var(--primary);color:#fff;' : 'background:var(--surface);color:var(--text-muted);'}">📅 Par sprint</button>
  </div>`;

  if (isTimeline) {
    return `<div style="margin-top:14px;">${toggleHtml}${_ppDepsTimeline(deps)}</div>`;
  }

  const maxCount = Math.max(...Object.values(pairs), 1);

  const headerCells = dTeams.map(t => {
    const c = _teamColor(t);
    const n = CONFIG.teams[t]?.name || t;
    return `<th style="padding:4px 6px;font-size:10px;font-weight:700;color:${c};text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:60px;border-bottom:1px solid var(--border);">${n}</th>`;
  }).join('');

  const matrixRows = dTeams.map(from => {
    const fc = _teamColor(from);
    const fn = CONFIG.teams[from]?.name || from;
    const cells = dTeams.map(to => {
      if (from === to) return '<td style="padding:4px;text-align:center;background:var(--surface);"><span style="color:var(--text-muted);font-size:10px;">-</span></td>';
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
    <div style="margin-top:14px;">
      ${toggleHtml}
      <div>
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

// Timeline view: deps grouped by sprint
function _ppDepsTimeline(deps) {
  const DEP_ST = [
    { v: 'todo',    icon: '🔲', bg: 'var(--info-bg)', c: 'var(--text-muted)' },
    { v: 'inprog',  icon: '🔵', bg: 'var(--warning-bg)', c: 'var(--warning-fg)' },
    { v: 'blocked', icon: '🚧', bg: 'var(--danger-bg)', c: 'var(--danger-fg)' },
    { v: 'done',    icon: '✅', bg: 'var(--success-bg)', c: 'var(--success-fg)' },
  ];

  // Group by sprint
  const bySprint = {};
  const noSprint = [];
  deps.forEach(d => {
    if (d.sprint) {
      if (!bySprint[d.sprint]) bySprint[d.sprint] = [];
      bySprint[d.sprint].push(d);
    } else {
      noSprint.push(d);
    }
  });

  // Sort sprint keys numerically
  const sprintKeys = Object.keys(bySprint).sort((a, b) => parseFloat(a) - parseFloat(b));

  const _depCard = d => {
    const fc = _teamColor(d.fromTeam);
    const tc = _teamColor(d.toTeam);
    const fn = CONFIG.teams[d.fromTeam]?.name || d.fromTeam || '?';
    const tn = CONFIG.teams[d.toTeam]?.name || d.toTeam || '?';
    const st = DEP_ST.find(s => s.v === (d.status || 'todo')) || DEP_ST[0];
    const noteText = (d.note || '').length > 50 ? (d.note || '').slice(0, 50) + '…' : (d.note || '');
    const fullDetail = `${d.fromTitle || '(livrable)'}\\n${fn} → ${tn}\\n${d.toTitle || '(besoin)'}\\n${d.note || ''}`;
    return `<div class="pp-dep-card" style="border-left:3px solid ${fc};" title="${fullDetail.replace(/"/g, '&quot;')}"
        onclick="_ppDepDetailPopin('${d.id}')">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-size:12px;">${st.icon}</span>
        <span style="font-size:11px;font-weight:700;color:${fc};">${fn}</span>
        <span style="font-size:10px;color:var(--text-muted);">→</span>
        <span style="font-size:11px;font-weight:700;color:${tc};">${tn}</span>
      </div>
      <div style="font-size:11px;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.fromTitle || '<em style="color:var(--text-muted)">livrable</em>'}</div>
      ${d.toTitle ? `<div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↳ ${d.toTitle}</div>` : ''}
      ${noteText ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">💬 ${noteText}</div>` : ''}
    </div>`;
  };

  const sections = sprintKeys.map(sp => {
    const items = bySprint[sp];
    const doneCount = items.filter(d => d.status === 'done').length;
    const blockedCount = items.filter(d => d.status === 'blocked').length;
    const pct = items.length ? Math.round(doneCount / items.length * 100) : 0;
    const pctClr = thresholdColor(pct, 70, 30);
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:var(--text);">Ité ${sp}</span>
        <span style="font-size:10px;color:var(--text-muted);">${items.length} dep.</span>
        ${blockedCount ? `<span style="font-size:10px;color:#DC2626;font-weight:600;">🚧 ${blockedCount}</span>` : ''}
        <div style="width:60px;height:4px;background:var(--border);border-radius:2px;"><div style="height:100%;width:${pct}%;background:${pctClr};border-radius:2px;"></div></div>
        <span style="font-size:10px;color:${pctClr};font-weight:600;">${pct}%</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">
        ${items.map(_depCard).join('')}
      </div>
    </div>`;
  }).join('');

  const noSprintHtml = noSprint.length ? `<div style="margin-bottom:12px;">
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">Sans sprint</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">
      ${noSprint.map(_depCard).join('')}
    </div>
  </div>` : '';

  return `<div class="card" style="padding:12px;">${sections}${noSprintHtml}</div>`;
}

// Detail popin for a dependency
function _ppDepDetailPopin(depId) {
  const deps = _ppDepList();
  const d = deps.find(x => x.id === depId);
  if (!d) return;
  const DEP_ST = PP_STATUS_OPTS_DEP;
  const st = DEP_ST.find(s => s.v === (d.status || 'todo')) || DEP_ST[0];
  const fc = _teamColor(d.fromTeam);
  const tc = _teamColor(d.toTeam);
  const fn = CONFIG.teams[d.fromTeam]?.name || d.fromTeam || '?';
  const tn = CONFIG.teams[d.toTeam]?.name || d.toTeam || '?';

  document.getElementById('modal-title').innerHTML = `🔗 Dépendance ${d.sprint ? `<span style="font-size:14px;font-weight:400;color:#94A3B8;">· Ité ${d.sprint}</span>` : ''}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="max-width:460px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;background:${st.bg};color:${st.c};">${st.l}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="padding:5px 12px;border-radius:6px;font-size:13px;font-weight:700;background:${fc}22;color:${fc};">${fn}</span>
        <span style="font-size:16px;color:var(--text-muted);">→</span>
        <span style="padding:5px 12px;border-radius:6px;font-size:13px;font-weight:700;background:${tc}22;color:${tc};">${tn}</span>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:3px;">Livrable</div>
        <div style="font-size:14px;color:var(--text);">${d.fromTitle || '<em style="color:var(--text-muted)">Non renseigné</em>'}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:3px;">Besoin</div>
        <div style="font-size:14px;color:var(--text);">${d.toTitle || '<em style="color:var(--text-muted)">Non renseigné</em>'}</div>
      </div>
      ${d.note ? `<div>
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:3px;">Note</div>
        <div style="font-size:13px;color:var(--text);white-space:pre-wrap;background:var(--surface);padding:10px 12px;border-radius:8px;border:1px solid var(--border);">${d.note}</div>
      </div>` : ''}
    </div>`;
  window._modalTicketList = [];
  window._modalCurrentIdx = 0;
  if (typeof _updateModalNavButtons === 'function') _updateModalNavButtons();
  { const _dlg = document.getElementById('modal-overlay'); if (!_dlg.open) _dlg.showModal(); }
}

// ============================================================
// Animation PIP - Trame de l'animation PI Planning
// Persisté dans pi-data.json : pip = { _global: [...], teamX: [...] }
// ============================================================

const _PIP_GLOBAL_TEMPLATE = [
  { text: 'Présentation des objectifs PI et des priorités business', done: false },
  { text: 'Revue de la capacité de l\'équipe (absences, montées en compétence)', done: false },
  { text: 'Tour des équipes : identifier les sujets transverses et dépendances', done: false },
  { text: 'Organiser concrètement les actions suite à la planification du PI', done: false },
  { text: 'Validation du plan et vote de confiance (Fist of Five)', done: false },
];

const _PIP_TEAM_TEMPLATES = {
  // Clé = team ID (ex: "Fuego", "A"...). Fusionne avec le template global.
  'Fuego': [
    { text: 'Validation des personnes dans le rôle des "émissaires"', done: false, info: 'L\'émissaire OPS facilite la communication entre les équipes. Il est le point d\'entrée privilégié pour les échanges sur #erpc-ops. Les émissaires sont organisés en binômes par ligne de produit et par incrément.' },
    { text: 'Validation de la rotation de l\'équipe pour le support', done: false },
    { text: 'Tour des équipes : s\'assurer qu\'il n\'y a pas d\'autres sujets à traiter', done: false },
    { text: 'Organiser concrètement les choses suite à la planification du PI', done: false },
    { text: 'Bonus : à définir si besoin', done: false },
  ],
};

function _ppPipGet() {
  return _ppGet('pip') || {};
}

function _ppPipItems(teamId) {
  const pip = _ppPipGet();
  // Priorité : données persistées pour cette équipe > template équipe > template global
  if (pip[teamId]) return pip[teamId];
  if (_PIP_TEAM_TEMPLATES[teamId]) return JSON.parse(JSON.stringify(_PIP_TEAM_TEMPLATES[teamId]));
  if (pip._global) return JSON.parse(JSON.stringify(pip._global));
  return JSON.parse(JSON.stringify(_PIP_GLOBAL_TEMPLATE));
}

function _ppPipSave(teamId, items) {
  const pip = _ppPipGet();
  pip[teamId] = items;
  _ppSet('pip', pip);
}

// Illustration SVG dynamique selon progression + thème équipe
function _ppPipIllustration(color, pct, teamId) {
  // Arc de progression (commun à toutes les variantes)
  const arc = `
    <circle cx="60" cy="156" r="20" stroke="${color}18" stroke-width="4" fill="none"/>
    <circle cx="60" cy="156" r="20" stroke="${color}" stroke-width="4" fill="none" stroke-dasharray="${pct * 1.257} 126" stroke-dashoffset="0" stroke-linecap="round" opacity=".6" transform="rotate(-90 60 156)"/>
    <text x="60" y="160" text-anchor="middle" font-size="12" font-weight="800" fill="${color}" opacity=".75">${pct}%</text>`;

  // Thème OPS/Support : headset, binômes émissaires, canal
  const isOps = _PIP_TEAM_TEMPLATES[teamId] && /émissaire|support|ops/i.test(JSON.stringify(_PIP_TEAM_TEMPLATES[teamId]));
  if (isOps) {
    return `<svg viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="pip-illust">
      <!-- Headset -->
      <path d="M42 38c0-10 8-18 18-18s18 8 18 18" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
      <rect x="36" y="34" width="8" height="14" rx="4" fill="${color}40"/>
      <rect x="76" y="34" width="8" height="14" rx="4" fill="${color}40"/>
      <path d="M44 48c0 6-4 8-4 8" stroke="${color}40" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Émissaire binôme gauche -->
      <circle cx="35" cy="78" r="9" fill="${color}25"/>
      <circle cx="35" cy="71" r="5.5" fill="${color}35"/>
      <!-- Émissaire binôme droit -->
      <circle cx="55" cy="78" r="9" fill="${color}20"/>
      <circle cx="55" cy="71" r="5.5" fill="${color}30"/>
      <!-- Lien binôme -->
      <path d="M42 72h6" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 2" opacity=".3"/>
      <!-- Flèche vers équipe -->
      <path d="M62 75l8-2m0 0l-2 3m2-3l-3-1" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/>
      <!-- Équipe distante -->
      <circle cx="82" cy="73" r="7" fill="${color}12"/>
      <circle cx="82" cy="67.5" r="4" fill="${color}18"/>
      <circle cx="95" cy="78" r="6" fill="${color}10"/>
      <circle cx="95" cy="73" r="3.5" fill="${color}15"/>
      <!-- Canal Slack -->
      <rect x="22" y="95" width="76" height="16" rx="5" fill="${color}10" stroke="${color}30" stroke-width="1"/>
      <text x="60" y="106" text-anchor="middle" font-size="7" font-weight="600" fill="${color}" opacity=".5">#erpc-ops</text>
      <!-- Tickets -->
      <rect x="26" y="116" width="18" height="10" rx="2" fill="${color}18"/>
      <rect x="48" y="116" width="18" height="10" rx="2" fill="${color}14"/>
      <rect x="70" y="116" width="18" height="10" rx="2" fill="${color}10"/>
      <path d="M30 120l2 2 4-4" stroke="${color}" stroke-width="1" stroke-linecap="round" opacity=".4"/>
      ${arc}
    </svg>`;
  }

  // Par défaut : variantes selon la progression
  if (pct === 0) {
    // Kickoff : board vide, personnes debout, points d'interrogation
    return `<svg viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="pip-illust">
      <!-- Board vide -->
      <rect x="15" y="12" width="90" height="55" rx="6" fill="${color}08" stroke="${color}30" stroke-width="1.5" stroke-dasharray="4 3"/>
      <rect x="24" y="22" width="22" height="6" rx="2" fill="${color}12"/>
      <rect x="50" y="22" width="22" height="6" rx="2" fill="${color}08"/>
      <rect x="76" y="22" width="22" height="6" rx="2" fill="${color}08"/>
      <!-- Question marks -->
      <text x="36" y="50" text-anchor="middle" font-size="14" fill="${color}" opacity=".2">?</text>
      <text x="60" y="48" text-anchor="middle" font-size="10" fill="${color}" opacity=".15">?</text>
      <text x="84" y="52" text-anchor="middle" font-size="12" fill="${color}" opacity=".18">?</text>
      <!-- People standing -->
      <circle cx="30" cy="90" r="9" fill="${color}18"/>
      <circle cx="30" cy="82.5" r="5.5" fill="${color}25"/>
      <circle cx="55" cy="90" r="9" fill="${color}14"/>
      <circle cx="55" cy="82.5" r="5.5" fill="${color}20"/>
      <circle cx="80" cy="90" r="9" fill="${color}10"/>
      <circle cx="80" cy="82.5" r="5.5" fill="${color}15"/>
      <!-- Clipboard -->
      <rect x="42" y="104" width="36" height="22" rx="3" fill="${color}12" stroke="${color}25" stroke-width="1"/>
      <rect x="46" y="108" width="12" height="2" rx="1" fill="${color}20"/>
      <rect x="46" y="113" width="20" height="2" rx="1" fill="${color}15"/>
      <rect x="46" y="118" width="16" height="2" rx="1" fill="${color}10"/>
      ${arc}
    </svg>`;
  }

  if (pct < 50) {
    // En cours : board avec quelques post-its, discussion active
    return `<svg viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="pip-illust">
      <!-- Board partiellement rempli -->
      <rect x="15" y="12" width="90" height="55" rx="6" fill="${color}0A" stroke="${color}40" stroke-width="1.5"/>
      <rect x="22" y="20" width="22" height="7" rx="2" fill="${color}30"/>
      <rect x="48" y="20" width="22" height="7" rx="2" fill="${color}20"/>
      <rect x="74" y="20" width="22" height="7" rx="2" fill="${color}15"/>
      <rect x="22" y="31" width="22" height="12" rx="2" fill="${color}20"/>
      <rect x="48" y="31" width="22" height="9" rx="2" fill="${color}12"/>
      <rect x="22" y="47" width="22" height="10" rx="2" fill="${color}10"/>
      <!-- People discussing -->
      <circle cx="32" cy="88" r="9" fill="${color}25"/>
      <circle cx="32" cy="80.5" r="5.5" fill="${color}35"/>
      <circle cx="58" cy="88" r="9" fill="${color}18"/>
      <circle cx="58" cy="80.5" r="5.5" fill="${color}25"/>
      <circle cx="84" cy="92" r="8" fill="${color}12"/>
      <circle cx="84" cy="85.5" r="5" fill="${color}18"/>
      <!-- Speech bubbles -->
      <rect x="16" y="100" width="28" height="10" rx="5" fill="${color}18"/>
      <rect x="48" y="104" width="22" height="8" rx="4" fill="${color}12"/>
      <!-- Arrows connecting -->
      <path d="M45 86h8" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity=".25"/>
      <path d="M70 88h8" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity=".2"/>
      <!-- Pen writing -->
      <path d="M80 108l6-8 3 2-6 8z" fill="${color}25"/>
      <path d="M80 108l-1 3 3-1z" fill="${color}35"/>
      ${arc}
    </svg>`;
  }

  if (pct < 100) {
    // Bonne dynamique : board bien rempli, checkmarks, énergie
    return `<svg viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="pip-illust">
      <!-- Board bien rempli -->
      <rect x="15" y="12" width="90" height="55" rx="6" fill="${color}0D" stroke="${color}50" stroke-width="1.5"/>
      <rect x="22" y="20" width="22" height="7" rx="2" fill="${color}35"/>
      <rect x="48" y="20" width="22" height="7" rx="2" fill="${color}30"/>
      <rect x="74" y="20" width="22" height="7" rx="2" fill="${color}25"/>
      <rect x="22" y="31" width="22" height="12" rx="2" fill="${color}25"/>
      <rect x="48" y="31" width="22" height="10" rx="2" fill="${color}20"/>
      <rect x="74" y="31" width="22" height="14" rx="2" fill="${color}18"/>
      <rect x="22" y="47" width="22" height="10" rx="2" fill="${color}15"/>
      <rect x="48" y="45" width="22" height="12" rx="2" fill="${color}15"/>
      <rect x="74" y="49" width="22" height="8" rx="2" fill="${color}12"/>
      <!-- Checkmarks on board -->
      <path d="M28 35l2 2 5-5" stroke="${color}" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
      <path d="M54 34l2 2 5-5" stroke="${color}" stroke-width="1.2" stroke-linecap="round" opacity=".4"/>
      <path d="M80 38l2 2 5-5" stroke="${color}" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>
      <!-- People focused -->
      <circle cx="35" cy="88" r="9" fill="${color}30"/>
      <circle cx="35" cy="80.5" r="5.5" fill="${color}40"/>
      <circle cx="60" cy="86" r="10" fill="${color}22"/>
      <circle cx="60" cy="78" r="6" fill="${color}30"/>
      <circle cx="85" cy="88" r="9" fill="${color}18"/>
      <circle cx="85" cy="80.5" r="5.5" fill="${color}25"/>
      <!-- Thumbs up -->
      <path d="M22 100c2-4 5-4 6-1l1 6h-6c-2 0-3-2-1-5z" fill="${color}25"/>
      <!-- Lightning bolts (energy) -->
      <path d="M76 98l3-5h3l-3 5h3l-5 7z" fill="${color}" opacity=".2"/>
      <path d="M90 95l2-4h2l-2 4h2l-4 5z" fill="${color}" opacity=".15"/>
      ${arc}
    </svg>`;
  }

  // 100% : célébration, confettis, trophée
  return `<svg viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="pip-illust">
    <!-- Trophée -->
    <rect x="48" y="38" width="24" height="6" rx="2" fill="${color}30"/>
    <path d="M50 18h20v20c0 6-4 10-10 10s-10-4-10-10z" fill="${color}25" stroke="${color}50" stroke-width="1.5"/>
    <path d="M50 24c-6 0-10 2-10 6s4 6 10 6" stroke="${color}35" stroke-width="1.5" fill="none"/>
    <path d="M70 24c6 0 10 2 10 6s-4 6-10 6" stroke="${color}35" stroke-width="1.5" fill="none"/>
    <text x="60" y="33" text-anchor="middle" font-size="10" fill="${color}" opacity=".5">★</text>
    <!-- Confettis -->
    <rect x="20" y="10" width="4" height="4" rx="1" fill="${color}40" transform="rotate(25 22 12)"/>
    <rect x="92" y="14" width="5" height="3" rx="1" fill="${color}30" transform="rotate(-15 95 16)"/>
    <rect x="30" y="48" width="3" height="5" rx="1" fill="${color}25" transform="rotate(40 32 50)"/>
    <rect x="86" y="42" width="4" height="3" rx="1" fill="${color}35" transform="rotate(-30 88 44)"/>
    <circle cx="25" cy="30" r="2" fill="${color}20"/>
    <circle cx="96" cy="32" r="2.5" fill="${color}18"/>
    <circle cx="40" cy="14" r="1.5" fill="${color}30"/>
    <circle cx="80" cy="8" r="2" fill="${color}25"/>
    <!-- Star bursts -->
    <path d="M15 20l2-1 1 2 1-2 2 1-1-2 2-1-2-1 1-2-2 1-1-2-1 2z" fill="${color}22"/>
    <path d="M100 48l2-1 1 2 1-2 2 1-1-2 2-1-2-1 1-2-2 1-1-2-1 2z" fill="${color}18"/>
    <!-- People celebrating -->
    <circle cx="30" cy="82" r="10" fill="${color}30"/>
    <circle cx="30" cy="74" r="6" fill="${color}40"/>
    <path d="M22 72l-5-8" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".35"/>
    <path d="M38 72l5-8" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".35"/>
    <circle cx="60" cy="80" r="11" fill="${color}25"/>
    <circle cx="60" cy="71.5" r="6.5" fill="${color}35"/>
    <path d="M51 69l-6-7" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".3"/>
    <path d="M69 69l6-7" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".3"/>
    <circle cx="90" cy="82" r="10" fill="${color}20"/>
    <circle cx="90" cy="74" r="6" fill="${color}30"/>
    <path d="M82 72l-5-8" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".25"/>
    <path d="M98 72l5-8" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".25"/>
    <!-- Banner -->
    <rect x="25" y="100" width="70" height="18" rx="4" fill="${color}18" stroke="${color}35" stroke-width="1"/>
    <text x="60" y="112" text-anchor="middle" font-size="8" font-weight="700" fill="${color}" opacity=".6">PI READY!</text>
    ${arc}
  </svg>`;
}

function _ppPipSection(activeTeams, piNum) {
  const teams = activeTeams.length ? activeTeams : Object.keys(CONFIG.teams || {});
  if (!teams.length) return '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Aucune équipe sélectionnée</div>';

  const cards = teams.map(tid => {
    const tc = CONFIG.teams[tid] || {};
    const color = tc.color || 'var(--primary)';
    const teamName = tc.name || tid;
    const items = _ppPipItems(tid);

    const doneCount = items.filter(i => i.done).length;
    const pct = items.length ? Math.round(doneCount / items.length * 100) : 0;
    const pctColor = pct === 100 ? CLR.green : pct >= 50 ? CLR.amber : 'var(--text-muted)';

    const rows = items.map((item, idx) => {
      const infoBtn = item.info ? ` <span class="pip-info-btn" title="${item.info.replace(/"/g, '&quot;')}" onclick="event.stopPropagation();_ppPipShowInfo(this)">ℹ️</span>` : '';
      return `<div class="pip-item${item.done ? ' pip-done' : ''}" data-team="${tid}" data-idx="${idx}">
        <label class="pip-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="_ppPipToggle('${tid}',${idx},this.checked)">
          <span class="pip-checkmark"></span>
        </label>
        <span class="pip-text" contenteditable="true" spellcheck="false" onblur="_ppPipEdit('${tid}',${idx},this.textContent)">${item.text}</span>${infoBtn}
        <button class="pip-del" onclick="_ppPipDel('${tid}',${idx})" title="Supprimer">×</button>
      </div>`;
    }).join('');

    const svgIllustration = _ppPipIllustration(color, pct, tid);

    return `<div class="pip-card">
      <div class="pip-card-body">
        <div class="pip-card-main">
          <div class="pip-card-header">
            <span class="pip-team-dot" style="background:${color}"></span>
            <span class="pip-team-name">${teamName}</span>
            <span class="pip-progress" style="color:${pctColor}">${doneCount}/${items.length}</span>
            <button class="pip-add-btn" onclick="_ppPipAdd('${tid}')" title="Ajouter un item">+</button>
            <button class="pip-reset-btn" onclick="_ppPipReset('${tid}')" title="Réinitialiser depuis le template">↻</button>
          </div>
          <div class="pip-items">${rows}</div>
          ${pct === 100 ? '<div class="pip-complete">✓ Tous les points ont été couverts</div>' : ''}
        </div>
        <div class="pip-card-side">${svgIllustration}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="pip-grid">${cards}</div>`;
}

// ---- Actions PIP ----
function _ppPipToggle(teamId, idx, checked) {
  const items = _ppPipItems(teamId);
  if (items[idx]) { items[idx].done = checked; _ppPipSave(teamId, items); }
  _ppPipRefresh();
}
function _ppPipEdit(teamId, idx, text) {
  const items = _ppPipItems(teamId);
  if (items[idx] && text.trim()) { items[idx].text = text.trim(); _ppPipSave(teamId, items); }
}
function _ppPipDel(teamId, idx) {
  const items = _ppPipItems(teamId);
  items.splice(idx, 1);
  _ppPipSave(teamId, items);
  _ppPipRefresh();
}
function _ppPipAdd(teamId) {
  const items = _ppPipItems(teamId);
  items.push({ text: 'Nouveau point', done: false });
  _ppPipSave(teamId, items);
  _ppPipRefresh();
}
function _ppPipReset(teamId) {
  const pip = _ppPipGet();
  delete pip[teamId];
  _ppSet('pip', pip);
  _ppPipRefresh();
}
function _ppPipShowInfo(el) {
  const tip = el.getAttribute('title');
  if (!tip) return;
  if (typeof showToast === 'function') showToast(tip, 'success', 5000);
}
function _ppPipRefresh() {
  const el = document.getElementById('pi-pip');
  if (!el) return;
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  el.innerHTML = _ppPipSection(activeTeams);
}

// ============================================================
// Fist of Five - Vote de confiance
// ============================================================
function _ppFistSection(activeTeams, overridePiNum) {
  if (!activeTeams.length) return '';
  const fist    = _ppFistGet();
  const fingers = ['☝️','✌️','🤟','🖖','🖐️'];
  const vLabels = ['', 'Stop', 'Inquiet', 'Incertain', 'Favorable', 'Enthousiaste'];

  const fistNotes = _ppFistNotes();
  const sprintLabel = CONFIG.sprint.label || 'Sprint actif';
  // Detect the REAL current PI from active sprint (not the selected one)
  const _detPI = typeof _ppDetectPI === 'function' ? _ppDetectPI() : null;
  const realPiNum = _detPI ? (_detPI.match(/\d+/) || [])[0] || '' : '';
  const piNum = overridePiNum || _piDetect().piNum;
  const isFuturePI = piNum && realPiNum && parseInt(piNum) > parseInt(realPiNum);

  // Helper: build a vote row for a given sprint key
  function _fistRow(tid, spKey, spLabel, isCurrent) {
    const votes = Array.isArray(fist[spKey]) ? fist[spKey] : (fist[spKey] ? [fist[spKey]] : []);
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor= !count ? '#94A3B8' : avg < 3 ? '#DC2626' : avg < 4 ? '#D97706' : '#16A34A';
    const note  = fistNotes[spKey] || '';
    const noteEscaped = note.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const esc = spKey.replace(/'/g, "\\'");

    if (isCurrent) {
      // Full-size voting row for the current sprint
      const distrib = [1,2,3,4,5].map(n => votes.filter(v => v === n).length);
      const maxD = Math.max(...distrib, 1);
      const distribHtml = count ? `<div style="display:flex;align-items:flex-end;gap:4px;height:40px;">
        ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="width:20px;height:${Math.max(4, Math.round(d / maxD * 32))}px;background:${d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:3px;"></div>
          <span style="font-size:9px;color:var(--text-muted);">${d || ''}</span>
        </div>`).join('')}
      </div>` : '<div style="width:110px;"></div>';

      // Use _ppFistSetFor with explicit key for future PIs, _ppFistSet for current PI
      const useExplicitKey = isFuturePI;
      const btns = [1,2,3,4,5].map(n => useExplicitKey
        ? `<button onclick="_ppFistSetFor('${tid}',${n},'${esc}');"
          style="border:1.5px solid var(--border);border-radius:10px;background:var(--card);padding:10px 14px;font-size:26px;cursor:pointer;transition:all .15s;"
          title="${n} - ${vLabels[n]}">${fingers[n-1]}</button>`
        : `<button onclick="_ppFistSet('${tid}',${n});"
          style="border:1.5px solid var(--border);border-radius:10px;background:var(--card);padding:10px 14px;font-size:26px;cursor:pointer;transition:all .15s;"
          title="${n} - ${vLabels[n]}">${fingers[n-1]}</button>`
      ).join('');

      const voteCountBadge = count
        ? `<span style="font-size:12px;color:var(--text-muted);font-weight:600;white-space:nowrap;">${count} vote${count > 1 ? 's' : ''}</span>`
        : '';
      const actions = count ? (useExplicitKey
        ? `<button onclick="_ppFistUndoFor('${esc}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Annuler le dernier vote">↩</button>
        <button onclick="_ppFistResetFor('${esc}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Réinitialiser">✕</button>`
        : `<button onclick="_ppFistUndo('${tid}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Annuler le dernier vote">↩</button>
        <button onclick="_ppFistReset('${tid}')" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Réinitialiser">✕</button>`) : '';

      return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
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
        onchange="${useExplicitKey ? `_ppFistNoteSetFor(this.value,'${esc}')` : `_ppFistNoteSet('${tid}',this.value)`}"
        style="width:100%;border:none;border-top:1px solid var(--border);background:transparent;padding:6px 0 0;font-size:12px;color:var(--text-muted);font-style:italic;outline:none;">`;
    }

    // Compact row for past sprints (voted or not)
    const distrib = [1,2,3,4,5].map(n => votes.filter(v => v === n).length);
    const maxD = Math.max(...distrib, 1);
    const distribHtml = `<div style="display:flex;align-items:flex-end;gap:3px;height:32px;">
      ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <div style="width:16px;height:${Math.max(4, Math.round(d / maxD * 26))}px;background:${d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:2px;"></div>
        <span style="font-size:8px;color:var(--text-muted);">${d || ''}</span>
      </div>`).join('')}
    </div>`;

    const btns = [1,2,3,4,5].map(n => `
      <button onclick="_ppFistSetFor('${tid}',${n},'${esc}');"
        style="border:1px solid var(--border);border-radius:8px;background:var(--card);padding:5px 8px;font-size:18px;cursor:pointer;transition:all .15s;"
        title="${n} - ${vLabels[n]}">${fingers[n-1]}</button>`
    ).join('');

    const actions = count ? `
      <button onclick="_ppFistUndoFor('${esc}')" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Annuler le dernier vote">↩</button>
      <button onclick="_ppFistResetFor('${esc}')" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Réinitialiser">✕</button>` : '';

    const avgHtml = count
      ? `<span style="font-size:18px;font-weight:800;color:${vColor};">${avg}</span><span style="font-size:10px;color:${vColor};font-weight:600;">/5</span><span style="font-size:10px;color:var(--text-muted);">${count}v</span>`
      : `<span style="font-size:14px;color:#94A3B8;">—</span>`;

    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border:1px dashed var(--border);border-radius:8px;flex-wrap:wrap;">
      <span style="font-size:11px;font-weight:600;color:var(--text-muted);min-width:90px;white-space:nowrap;">⏪ ${spLabel}</span>
      <div style="display:flex;align-items:center;gap:4px;min-width:60px;">${avgHtml}</div>
      ${distribHtml}
      <div style="display:flex;gap:3px;align-items:center;">${btns}</div>
      <div style="display:flex;gap:3px;margin-left:auto;">${actions}</div>
      <input type="text" value="${noteEscaped}" placeholder="Note…"
        onchange="_ppFistNoteSetFor(this.value,'${esc}')"
        style="flex:1;min-width:100px;border:none;background:transparent;font-size:11px;color:var(--text-muted);font-style:italic;outline:none;">
    </div>`;
  }

  const cards = activeTeams.map(tid => {
    const tc    = CONFIG.teams[tid];
    const color = tc?.color || CLR.dark;
    const piSprints = _fistPISprints(tid, piNum);

    // For future PI: show first sprint of that PI as "current" votable sprint
    // For current PI: use the team's active sprint
    let currentKey, currentLabel;
    if (isFuturePI && piSprints.length) {
      currentLabel = piSprints[0];
      currentKey = `${tid}__${currentLabel}`;
    } else {
      currentKey = _fistKey(tid);
      currentLabel = tc?.sprintName || sprintLabel;
    }

    const votes = Array.isArray(fist[currentKey]) ? fist[currentKey] : (fist[currentKey] ? [fist[currentKey]] : []);
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor= !count ? '#94A3B8' : avg < 3 ? '#DC2626' : avg < 4 ? '#D97706' : '#16A34A';
    const borderColor = !count ? 'var(--border)' : avg >= 4 ? '#86EFAC' : avg >= 3 ? '#FCD34D' : '#FECACA';

    // Sparkline évolution des sprints (filtered by PI)
    const sparkline = _fistSparkline(tid, piNum);

    // Current sprint row (full-size voting)
    const currentRow = _fistRow(tid, currentKey, currentLabel, true);

    // Other sprints within this PI (all except current — user can add votes anytime)
    // Hide for future PIs: no previous/other sprints to show
    const otherRows = isFuturePI ? [] : piSprints
      .filter(sp => `${tid}__${sp}` !== currentKey)
      .map(sp => _fistRow(tid, `${tid}__${sp}`, sp, false));
    const otherLabel = 'Sprints précédents :';

    return `
      <div style="background:var(--card);border:1.5px solid ${borderColor};border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-weight:700;font-size:15px;color:${color};display:flex;align-items:center;gap:8px;">
            <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            ${tc?.name || tid}
          </div>
          <span style="font-size:11px;font-weight:600;color:var(--primary);background:var(--bg);padding:2px 8px;border-radius:4px;">${currentLabel}</span>
          ${sparkline ? `<div style="display:flex;align-items:center;gap:4px;margin-left:auto;">${sparkline}<span style="font-size:9px;color:var(--text-muted);">évolution</span></div>` : ''}
        </div>
        ${currentRow}
        ${otherRows.length ? `<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;">${otherLabel}</div>
          ${otherRows.join('')}
        </div>` : ''}
      </div>`;
  }).join('');

  // Moyenne globale (sprint affiché — courant ou premier sprint du PI futur)
  const _currentKeyForTeam = (t) => {
    if (isFuturePI) {
      const sp = _fistPISprints(t, piNum);
      return sp.length ? `${t}__${sp[0]}` : _fistKey(t);
    }
    return _fistKey(t);
  };
  const allVotes = activeTeams.flatMap(t => { const k = _currentKeyForTeam(t); return Array.isArray(fist[k]) ? fist[k] : (fist[k] ? [fist[k]] : []); });
  const totalVotes = allVotes.length;
  const globalAvg  = totalVotes ? Math.round(allVotes.reduce((s, v) => s + v, 0) / totalVotes * 10) / 10 : null;
  const teamsVoted = activeTeams.filter(t => { const k = _currentKeyForTeam(t); return Array.isArray(fist[k]) ? fist[k].length > 0 : !!fist[k]; }).length;
  const avgColor   = globalAvg === null ? 'var(--text-muted)' : globalAvg < 3 ? '#DC2626' : globalAvg < 4 ? '#D97706' : '#16A34A';
  const avgBg      = globalAvg === null ? 'var(--info-bg)' : globalAvg < 3 ? 'var(--danger-bg)' : globalAvg < 4 ? 'var(--warning-bg)' : 'var(--success-bg)';
  const avgBorder  = globalAvg === null ? 'var(--border)' : globalAvg < 3 ? '#FECACA' : globalAvg < 4 ? '#FDE68A' : '#86EFAC';

  const avgBadge = globalAvg !== null
    ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:10px;background:${avgBg};border:1.5px solid ${avgBorder};">
        <span style="font-size:20px;font-weight:900;color:${avgColor};">${globalAvg}</span>
        <span style="font-size:11px;color:${avgColor};font-weight:600;">/5</span>
        <span style="font-size:11px;color:var(--text-muted);">${totalVotes} vote${totalVotes > 1 ? 's' : ''} · ${teamsVoted}/${activeTeams.length} équipe${activeTeams.length > 1 ? 's' : ''}</span>
      </div>`
    : `<span style="font-size:12px;color:var(--text-muted);">Aucun vote pour ce sprint</span>`;

  // Global sparkline (filtered by PI)
  const globalSparkline = _fistGlobalSparkline(activeTeams, piNum);

  return `
    <div id="pp-fist" class="pp-section">
      <div class="section-header">
        <div class="section-title">✋ Fist of Five - Vote de confiance</div>
        ${avgBadge}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin:-4px 0 6px;padding:0 2px;">Vote par sprint — évaluez la confiance d'atteinte des PI Objectifs à chaque sprint</div>
      ${globalSparkline}
      <div style="display:flex;flex-direction:column;gap:6px;">${cards}</div>
    </div>`;
}

// Fist of Five — Summary (read-only, for Roadmap view)
function _ppFistSummarySection(activeTeams) {
  if (!activeTeams.length) return '';
  const fist    = _ppFistGet();
  const fistNotes = _ppFistNotes();
  const allVotes = activeTeams.flatMap(t => { const k = _fistKey(t); return Array.isArray(fist[k]) ? fist[k] : (fist[k] ? [fist[k]] : []); });
  if (!allVotes.length) return '';

  const totalVotes = allVotes.length;
  const globalAvg  = Math.round(allVotes.reduce((s, v) => s + v, 0) / totalVotes * 10) / 10;
  const teamsVoted = activeTeams.filter(t => { const k = _fistKey(t); return Array.isArray(fist[k]) ? fist[k].length > 0 : !!fist[k]; }).length;
  const avgColor   = globalAvg < 3 ? '#DC2626' : globalAvg < 4 ? '#D97706' : '#16A34A';

  const teamBadges = activeTeams.map(tid => {
    const tc    = CONFIG.teams[tid];
    const color = tc?.color || CLR.dark;
    const key   = _fistKey(tid);
    const votes = Array.isArray(fist[key]) ? fist[key] : (fist[key] ? [fist[key]] : []);
    if (!votes.length) return '';
    const avg   = Math.round(votes.reduce((s, v) => s + v, 0) / votes.length * 10) / 10;
    const vc    = avg < 3 ? '#DC2626' : avg < 4 ? '#D97706' : '#16A34A';
    const note  = fistNotes[key] || '';
    const sparkline = _fistSparkline(tid);
    return `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--border);">
      <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>
      <span style="font-size:11px;font-weight:600;color:${color}">${tc?.name || tid}</span>
      <span style="font-size:14px;font-weight:800;color:${vc}">${avg}</span>
      <span style="font-size:10px;color:var(--text-muted)">${votes.length}v</span>
      ${sparkline}
      ${note ? `<span style="font-size:10px;color:var(--text-muted);font-style:italic;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${note.replace(/"/g, '&quot;')}">${note}</span>` : ''}
    </div>`;
  }).filter(Boolean).join('');

  // Global sparkline
  const globalSparkline = _fistGlobalSparkline(activeTeams);

  return `<div id="pp-fist-summary" class="pp-section" style="padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:32px;font-weight:900;color:${avgColor};line-height:1">${globalAvg}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">Score de confiance</div>
          <div style="font-size:11px;color:var(--text-muted)">${totalVotes} vote${totalVotes > 1 ? 's' : ''} · ${teamsVoted}/${activeTeams.length} équipe${activeTeams.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;gap:4px;">
          ${[1,2,3,4,5].map(n => `<div style="width:28px;height:6px;border-radius:3px;background:${n <= Math.round(globalAvg) ? avgColor : 'var(--border)'}"></div>`).join('')}
        </div>
        ${globalSparkline}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${teamBadges}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:10px">Votez et gérez les votes depuis la vue <a href="#" onclick="showView('pi');setTimeout(()=>_piScrollTo('fist'),300);return false;" style="color:var(--primary);text-decoration:none;font-weight:600">PI Planning</a></div>
  </div>`;
}

// ============================================================
// PI Objectives — Summary (read-only, for Roadmap view)
// ============================================================
function _ppObjSummarySection(activeTeams) {
  const allObjs = _ppObjList();
  const objs = activeTeams.length ? allObjs.filter(o => activeTeams.includes(o.team)) : allObjs;
  if (!objs.length) return '';

  const committed = objs.filter(o => o.type === 'committed');
  const stretch   = objs.filter(o => o.type === 'stretch');
  const totalBV   = objs.reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);
  const doneObjs  = objs.filter(o => o.status === 'done');
  const doneBV    = doneObjs.reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);
  const doneCount = doneObjs.length;
  const riskCount = objs.filter(o => o.status === 'atrisk').length;
  const pct       = objs.length ? Math.round(doneCount / objs.length * 100) : 0;
  const bvPct     = totalBV ? Math.round(doneBV / totalBV * 100) : 0;

  const statusIcon = { done: '✅', inprog: '🔵', atrisk: '🔴', todo: '⬜' };

  // Group by team
  const byTeam = {};
  objs.forEach(o => { (byTeam[o.team] = byTeam[o.team] || []).push(o); });

  const teamCards = Object.entries(byTeam).map(([tid, items]) => {
    const tc = CONFIG.teams[tid] || {};
    const color = tc.color || '#94A3B8';
    const name = tc.name || tid;
    const teamBV = items.reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);
    const teamDoneBV = items.filter(o => o.status === 'done').reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);
    const rows = items
      .sort((a, b) => (parseInt(b.bv, 10) || 0) - (parseInt(a.bv, 10) || 0))
      .map(o => {
        const bv = parseInt(o.bv, 10) || 0;
        const isDone = o.status === 'done';
        const typeTag = o.type === 'stretch'
          ? '<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:#DBEAFE;color:#1D4ED8;font-weight:600;">Stretch</span>'
          : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);${isDone ? 'opacity:.7;' : ''}">
          <span style="font-size:13px;flex-shrink:0">${statusIcon[o.status] || '⬜'}</span>
          <span style="font-size:12px;color:var(--text);flex:1;${isDone ? 'text-decoration:line-through;' : ''}">${escapeHtml(o.title || 'Sans titre')}</span>
          ${typeTag}
          <span style="flex-shrink:0;font-size:11px;white-space:nowrap;font-weight:600;color:${isDone ? CLR.darkGrn : CLR.darkAmber}">💰 ${bv}</span>
        </div>`;
      }).join('');

    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${color}12;border-bottom:1px solid ${color}33;">
        <span style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="font-size:12px;font-weight:700;color:${color}">${name}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted);font-weight:600">${teamDoneBV ? `<span style="color:#16A34A">${teamDoneBV}</span>/` : ''}${teamBV} BV</span>
      </div>
      <div style="padding:4px 12px">${rows}</div>
    </div>`;
  }).join('');

  const bvColor = totalBV >= 30 ? CLR.darkGrn : totalBV >= 15 ? CLR.darkAmber : CLR.muted;

  return `<div id="pp-obj-summary" class="pp-section" style="padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:28px;font-weight:900;color:${bvColor};line-height:1">💰 ${totalBV}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">Business Value totale</div>
          <div style="font-size:11px;color:var(--text-muted)">${committed.length} committed · ${stretch.length} stretch · ${doneCount}/${objs.length} done${doneBV ? ` · <span style="color:#16A34A;font-weight:600">${doneBV} BV livrés</span>` : ''}${riskCount ? ` · <span style="color:#DC2626">${riskCount} à risque</span>` : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:100px;height:6px;border-radius:3px;background:var(--border);overflow:hidden">
          <div style="width:${bvPct}%;height:100%;background:${bvPct === 100 ? '#16A34A' : '#3B82F6'};border-radius:3px;transition:width .3s"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:var(--text-muted)">${bvPct}% BV</span>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">${teamCards}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:10px">Gérez les objectifs depuis la vue <a href="#" onclick="showView('pi');setTimeout(()=>_piScrollTo('objectifs'),300);return false;" style="color:var(--primary);text-decoration:none;font-weight:600">PI Planning</a></div>
  </div>`;
}

// ============================================================
// Multi-PI Capacity Planning - simulation what-if sur 2-3 PIs
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
      tid, name: tc.name || tid, color: tc.color || CLR.dark,
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

  const piLabels = Array.from({ length: piCount }, (_, i) => `PI+${i}`);

  const headerCols = scenarios.map(s =>
    `<th colspan="${piCount}" class="pp-th pp-th-center" style="background:${s.delta === 0 ? '#F0F9FF' : s.delta < 0 ? 'var(--danger-bg)' : 'var(--success-bg)'};">${s.label}</th>`
  ).join('');

  const subHeaderCols = scenarios.flatMap(() =>
    piLabels.map(l => `<th class="pp-th pp-th-center" style="font-size:9px;">${l}</th>`)
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
        const diffStr = s.delta !== 0 ? `<div style="font-size:9px;color:${diff >= 0 ? CLR.darkGrn : CLR.red}">${diff >= 0 ? '+' : ''}${diff} pts</div>` : '';
        return `<td style="padding:6px 8px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:13px;font-weight:700;color:${color}">${cap}</div>
          <div style="font-size:9px;color:var(--text-muted)">${newSize} dev · ${newVel}/sprint</div>
          ${diffStr}
        </td>`;
      });
    }).join('');

    return `<tr class="pp-tr">
      <td style="padding:6px 10px;font-size:12px;font-weight:700;color:${t.color};white-space:nowrap;border-right:1px solid var(--border);">
        <span class="pp-team-dot" style="background:${t.color};margin-right:4px;"></span>
        ${escapeHtml(t.name)}
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
    <div class="pp-section">
      <div class="section-header">
        <div class="section-title">📊 Capacité multi-PI - Simulation what-if</div>
        <span class="pp-sub" style="font-size:11px;">Impact sur ${piCount} PIs · ${sprintsPerPI} sprints/PI</span>
      </div>
      <div class="card pp-table-wrap">
        <table class="pp-table">
          <thead>
            <tr><th class="pp-th pp-th-center" style="border-right:1px solid var(--border);">Équipe</th>${headerCols}</tr>
            <tr><th class="pp-th pp-th-center" style="border-right:1px solid var(--border);"></th>${subHeaderCols}</tr>
          </thead>
          <tbody>${rows}
            <tr class="pp-totals"><td style="padding:6px 10px;font-size:12px;font-weight:800;border-right:1px solid var(--border);">Total</td>${totalCells}</tr>
          </tbody>
        </table>
      </div>
    </div>`;
}
