// ============================================================
// UTILS - Fonctions utilitaires partagées
// ============================================================

// Échappe les caractères HTML pour prévenir les injections XSS (données JIRA → innerHTML)
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Cache mémo pour fonctions PI coûteuses (invalidé après sync) ----
const _memoCache = {};
function _memoInvalidate() { Object.keys(_memoCache).forEach(k => delete _memoCache[k]); }

// Ticket considéré "terminé" et comptabilisé dans la vélocité (basé sur CONFIG.statuses)
function isDone(status) {
  return CONFIG.statuses[status]?.countsInVelocity === true;
}

// Initiales d'un nom complet (ex: "Martin Leclerc" → "ML", "Alice" → "AL")
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function typeName(t) {
  const map = {
    story: 'Story', storytech: 'Story Tech', bug: 'Bug', incident: 'Incident',
    support: 'Support', ops: 'OPS', tache: 'Tâche', dette: 'Dette',
    epic: 'Epic', feature: 'Feature',
  };
  return map[t] || t;
}

function priorityIcon(p) {
  const m = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  return `<span title="${p}">${m[p] || ''}</span>`;
}

function statusLabel(s) {
  return {
    todo: 'À faire', inprog: 'En cours', review: 'En review',
    done: 'Terminé', blocked: 'Bloqué', test: 'En test', backlog: 'Backlog',
  }[s] || s;
}

function blocked_count(tickets) {
  return tickets.filter(x => x.status === 'blocked').length;
}

// Uniform story-points badge - always visible, consistent style
function ptsBadge(points, opts = {}) {
  const size = opts.size || 'normal'; // 'small' | 'normal'
  const val  = points ? points + ' pts' : '– pts';
  const fs   = size === 'small' ? '10px' : '11px';
  const pad  = size === 'small' ? '1px 6px' : '2px 7px';
  return `<span style="background:#1E293B;color:#F8FAFC;font-size:${fs};font-weight:700;padding:${pad};border-radius:99px;white-space:nowrap;flex-shrink:0">${val}</span>`;
}

// Epic tag - shows truncated title, hover reveals key + title with JIRA link
// opts.maxWidth: max width in px (default 120), set to 'none' for no truncation
function epicTag(epic, ticketEpicId, opts = {}) {
  if (!epic) return '';
  const id    = epic.id || ticketEpicId || '';
  const title = epic.title || id;
  const color = epic.color || CLR.dark;
  const base  = (CONFIG.jira.url || '').replace(/\/$/, '');
  const url   = base && !base.includes('votre-jira') ? `${base}/browse/${id}` : '';
  const tip   = `${id} - ${title}`;
  const mw    = opts.maxWidth === 'none' ? '' : `max-width:${opts.maxWidth || 120}px;overflow:hidden;text-overflow:ellipsis;`;
  const inner = `<span class="epic-tag" style="background:${color};${mw}white-space:nowrap;display:inline-block;vertical-align:middle;" title="${tip.replace(/"/g, '&quot;')}">${title}</span>`;
  if (url) {
    const extIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:3px;opacity:.6;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="text-decoration:none;flex-shrink:0;display:inline-flex;align-items:center;">${inner}${extIcon}</a>`;
  }
  return inner;
}

// Lien cliquable vers un ticket JIRA - retourne juste l'id si URL non configurée
function _jiraBrowse(id, opts = {}) {
  const base = (CONFIG.jira.url || '').replace(/\/$/, '');
  if (!base || base.includes('votre-jira')) return opts.text || id;
  const url   = `${base}/browse/${id}`;
  const label = opts.text || id;
  const style = opts.style || 'color:inherit;text-decoration:none;font-weight:inherit;';
  const icon  = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:3px;opacity:.6;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="${style}" title="Ouvrir dans JIRA">${label}${icon}</a>`;
}

// URL brute vers un ticket JIRA (pour les rapports texte/Slack)
function _jiraBrowseUrl(id) {
  const base = (CONFIG.jira.url || '').replace(/\/$/, '');
  if (!base || base.includes('votre-jira')) return '';
  return `${base}/browse/${id}`;
}

// Shared color constants - semantic fallback palette
// Used as fallback values when team/member/type color is undefined.
// These CANNOT be CSS variables because they're used in hex-opacity expressions (e.g., color + '18').
const CLR = {
  muted:   '#94A3B8', // light gray - todo, muted text, fallback badges
  slate:   '#64748B', // medium gray - default avatar, unset team color
  dark:    '#475569', // dark slate - default type color, filter buttons
  red:     '#DC2626', // blocked, critical, flagged
  orange:  '#D97706', // warning, presentiel
  amber:   '#F59E0B', // test, lead time, caution
  green:   '#22C55E', // buffer, success
  darkGrn: '#16A34A', // done, health good, IP sprint
  blue:    '#3B82F6', // in progress, cycle time
  purple:  '#7C3AED', // review, epic default
  teal:    '#06B6D4', // review column
};

// Status → hex color map (for JS contexts needing hex, e.g. opacity suffixes)
const STATUS_HEX = {
  blocked: CLR.red, inprog: CLR.blue, review: CLR.purple,
  todo: CLR.muted, done: CLR.darkGrn, test: CLR.amber, backlog: CLR.muted,
};

// Colored dot indicator (status, team, epic)
// size: 'sm' (6px), 'md' (8px), 'lg' (10px, default)
function statusDot(color, size) {
  const px = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  return `<span style="width:${px}px;height:${px}px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>`;
}

// Avatar badge with initials
// opts: { w (px, default 24), fs (font-size, default '10px') }
function avatarBadge(name, color, opts = {}) {
  const w  = opts.w || 24;
  const fs = opts.fs || '10px';
  return `<span class="avatar" style="background:${color};width:${w}px;height:${w}px;font-size:${fs};flex-shrink:0;" title="${(name || 'Non assigné').replace(/"/g, '&quot;')}">${initials(name)}</span>`;
}

// Internal status → CSS color variable
const _STATUS_COLORS = {
  backlog: '#94A3B8', todo: 'var(--todo)', inprog: 'var(--inprog)',
  review: 'var(--review)', test: '#0891B2', done: 'var(--done)', blocked: 'var(--blocked)',
};

// Internal status → board category (todo / wip / blocked / done)
function statusCat(key) {
  if (key === 'done') return 'done';
  if (key === 'blocked') return 'blocked';
  if (key === 'backlog' || key === 'todo') return 'todo';
  return 'wip'; // inprog, review, test
}

/**
 * Build board columns from BOARD_COLUMNS for the active team(s).
 * Returns array of { key (internal), label (JIRA name), color }.
 * - Single team selected → exact JIRA columns in order
 * - Multiple teams / all → merged unique columns, ordered by workflow
 * - Fallback (demo / no config) → default columns
 */
function getBoardColumns(tickets) {
  const teams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const _defaultCols = [
    { key: 'todo',   label: 'À faire',   color: _STATUS_COLORS.todo   },
    { key: 'inprog', label: 'En cours',   color: _STATUS_COLORS.inprog },
    { key: 'review', label: 'En review',  color: _STATUS_COLORS.review },
    { key: 'done',   label: 'Terminé',    color: _STATUS_COLORS.done   },
  ];

  if (!BOARD_COLUMNS || !Object.keys(BOARD_COLUMNS).length) return _defaultCols;

  // Collect relevant team configs
  const teamConfigs = teams.length === 1 && BOARD_COLUMNS[teams[0]]
    ? [BOARD_COLUMNS[teams[0]]]
    : Object.values(BOARD_COLUMNS);

  if (!teamConfigs.length) return _defaultCols;

  // Single team → use its exact columns (preserving JIRA order)
  // Each column keeps its JIRA statuses for precise ticket matching
  if (teams.length === 1 && BOARD_COLUMNS[teams[0]]) {
    const cols = BOARD_COLUMNS[teams[0]]
      .filter(c => c.internal) // skip unmapped columns
      .map(c => ({
        key: c.internal,
        label: c.name,
        color: _STATUS_COLORS[c.internal] || CLR.muted,
        jiraStatuses: (c.statuses || []).map(s => (s.name || '').toLowerCase().trim()).filter(Boolean),
      }));
    return cols.length ? cols : _defaultCols;
  }

  // Multiple teams → merge, deduplicate by internal key, keep canonical order
  const _ORDER = ['backlog','todo','inprog','review','test','done'];
  const seen = {};
  for (const tc of teamConfigs) {
    for (const c of tc) {
      if (!c.internal) continue;
      if (!seen[c.internal]) seen[c.internal] = c.name; // first name wins
    }
  }
  const cols = _ORDER
    .filter(k => seen[k])
    .map(k => ({ key: k, label: seen[k], color: _STATUS_COLORS[k] || CLR.muted }));

  // Add columns for statuses present in tickets but not in board config (e.g. blocked)
  if (tickets) {
    const statusSet = new Set(tickets.map(t => t.status));
    for (const s of statusSet) {
      if (!cols.find(c => c.key === s) && _STATUS_COLORS[s]) {
        // Find insertion point based on order
        const idx = _ORDER.indexOf(s);
        const insertAt = idx >= 0 ? cols.findIndex(c => _ORDER.indexOf(c.key) > idx) : cols.length;
        cols.splice(insertAt >= 0 ? insertAt : cols.length, 0, {
          key: s, label: s === 'blocked' ? 'Bloqué' : s, color: _STATUS_COLORS[s],
        });
      }
    }
  }

  return cols.length ? cols : _defaultCols;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ============================================================
// PI STATS — Fonctions centralisées de calcul PI
// Utilisées par pi.js, roadmap.js et piprep.js
// ============================================================

/**
 * Détecte le numéro de PI sélectionné (piprep) ou courant (sprint actif).
 * @returns {{ piNum: string|null, isCurrent: boolean, sprintsPerPI: number }}
 */
function _piDetect() {
  const ppPI = typeof _ppCurrentPI === 'function' ? _ppCurrentPI() : null;
  const cacheKey = `_piDetect:${ppPI}`;
  if (_memoCache[cacheKey]) return _memoCache[cacheKey];
  const ppNum     = ppPI ? (ppPI.match(/\d+/) || [])[0] || null : null;
  const detected  = typeof _ppDetectPI === 'function' ? _ppDetectPI() : null;
  const detNum    = detected ? (detected.match(/\d+/) || [])[0] || null : null;
  const fallMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const piNum     = ppNum || (fallMatch ? fallMatch[1] : null);
  const isCurrent = piNum === (detNum || (fallMatch ? fallMatch[1] : null));
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const result = { piNum, isCurrent, sprintsPerPI };
  _memoCache[cacheKey] = result;
  return result;
}

/**
 * Liste tous les PI disponibles, triés décroissant.
 * Source unique pour tous les sélecteurs PI du dashboard.
 * @returns {Array<{num: string, label: string, isCurrent: boolean, isFuture: boolean}>}
 */
function _piListAll() {
  const piSet = new Set();
  const fallMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const currentPINum = fallMatch ? parseInt(fallMatch[1]) : null;

  // 1. PI courant depuis sprint label
  if (currentPINum) piSet.add(currentPINum);

  // 2. PI futurs depuis config sync
  const piFuture = CONFIG.sync?.piFutureCount || 2;
  if (currentPINum) {
    for (let i = 1; i <= piFuture; i++) piSet.add(currentPINum + i);
  }

  // 3. PI depuis vélocité (sprints fermés)
  Object.values(CONFIG.teams || {}).forEach(tc => {
    (tc.velocityHistory || []).forEach(h => {
      const m = (h.name || '').match(/(\d{2,3})\.\d+/);
      if (m) piSet.add(parseInt(m[1]));
    });
  });

  // 4. PI depuis backlog (sprints futurs, piSprint)
  (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : []).forEach(t => {
    if (t.piSprint) { const m = t.piSprint.match(/(\d+)/); if (m) piSet.add(parseInt(m[1])); }
    const sm = (t.sprintName || '').match(/(\d{2,3})\.\d+/);
    if (sm) piSet.add(parseInt(sm[1]));
  });

  // 5. PI depuis piprep (données persistées)
  if (typeof _ppListPIs === 'function') {
    _ppListPIs().forEach(pi => { const m = pi.match(/\d+/); if (m) piSet.add(parseInt(m[0])); });
  }

  return [...piSet]
    .sort((a, b) => b - a)
    .map(n => ({
      num: String(n),
      label: `PI ${n}`,
      isCurrent: n === currentPINum,
      isFuture:  currentPINum ? n > currentPINum : false,
    }));
}

/**
 * Génère les <option> HTML pour un sélecteur PI.
 * @param {string} selected - PI sélectionné (ex: "29")
 * @param {object} opts - { showSuffix: bool, allOption: string|false }
 * @returns {string} HTML options
 */
function _piSelectOptions(selected, opts = {}) {
  const pis = _piListAll();
  const showSuffix = opts.showSuffix !== false;
  let html = '';
  if (opts.allOption) html += `<option value=""${!selected ? ' selected' : ''}>${opts.allOption}</option>`;
  pis.forEach(p => {
    const suffix = showSuffix ? (p.isCurrent ? ' (actuel)' : p.isFuture ? ' (futur)' : '') : '';
    html += `<option value="${p.num}"${p.num === selected ? ' selected' : ''}>${p.label}${suffix}</option>`;
  });
  return html;
}

/**
 * Collecte tous les tickets d'un PI (sprint actif + backlog + buffer sprints fermés).
 * @param {string[]} teams - Équipes à inclure
 * @param {string} piNum - Numéro du PI (ex: "28")
 * @returns {object[]} tickets
 */
function _piAllTickets(teams, piNum) {
  if (!piNum) return [];
  const cacheKey = `_piAllTickets:${[...teams].sort().join(',')}:${piNum}`;
  if (_memoCache[cacheKey]) return _memoCache[cacheKey];
  const piRe = new RegExp(`(^|\\D)${piNum}\\.\\d+`);
  const teamSet = new Set(teams);

  // Tickets du sprint actif — seulement si le sprint actif appartient au PI sélectionné
  const active = typeof getTickets === 'function' ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const teamList = teams.length ? teams : Object.keys(CONFIG.teams || {});
  const activeInPI = piRe.test(CONFIG.sprint?.label || '') ||
    teamList.some(tid => piRe.test((CONFIG.teams[tid]?.sprintName || '')));
  const filtered = activeInPI
    ? active.filter(t => !teamSet.size || teamSet.has(t.team))
    : [];
  const activeIds = new Set(filtered.map(t => t.id));

  // Backlog PI — filtre strict : piSprint doit correspondre exactement au PI demandé
  const blAll = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const piSprintRe = new RegExp(`(^|\\D)${piNum}(\\D|$)`); // match "PI#29", "PI 29", pas "PI#28"

  // Construire le set des features/epics appartenant à ce PI
  // Sources : titre contenant "PIxx", ou remontée hiérarchique depuis les tickets avec sprint xx.y
  const _feats = typeof FEATURES !== 'undefined' ? FEATURES : [];
  const _epics = typeof EPICS !== 'undefined' ? EPICS : [];
  const piTitleRe = new RegExp(`PI\\s*#?\\s*${piNum}\\b`, 'i'); // match "PI29", "PI#29", "PI 29"
  const _matchPiItem = item => piTitleRe.test(item.piSprint || '');
  const _piFeatIds = new Set(_feats.filter(f => _matchPiItem(f)).map(f => f.id));
  const _piEpicIds = new Set();

  // 1. Epics directement nommés PIxx ou avec piSprint PIxx
  _epics.filter(e => _matchPiItem(e)).forEach(e => _piEpicIds.add(e.id));
  // 2. Epics rattachés à une feature PIxx
  _epics.filter(e => e.feature && _piFeatIds.has(e.feature)).forEach(e => _piEpicIds.add(e.id));

  // 3. Remontée hiérarchique : tickets avec sprint PI → epic parent → feature grand-parent
  //    Permet de découvrir des features/epics PI même si leur titre ne mentionne pas le PI
  const _epicMap = {};
  _epics.forEach(e => { _epicMap[e.id] = e; });
  const allPool = [].concat(active, blAll);
  allPool.forEach(t => {
    // Le ticket a-t-il un sprint qui matche ce PI ?
    const hasPiSprint = piRe.test(t.sprintName || '') ||
      piSprintRe.test(t.piSprint || '') ||
      (t.allSprints || []).some(s => piRe.test(s) || piSprintRe.test(s));
    if (!hasPiSprint || !t.epic) return;
    // Niveau 1 : epic parent
    _piEpicIds.add(t.epic);
    // Niveau 2 : feature grand-parent (via epic.feature)
    const epic = _epicMap[t.epic];
    if (epic && epic.feature) _piFeatIds.add(epic.feature);
    // Niveau 2 bis : l'epic est peut-être directement dans FEATURES
    if (_feats.some(f => f.id === t.epic)) _piFeatIds.add(t.epic);
  });

  // Pour le filtrage team des features backlog, vérifier aussi FEATURES/EPICS (qui ont la bonne team)
  const _featTeamMap = {};
  _feats.forEach(f => { if (f.team && f.team !== '_PI' && f.team !== '') _featTeamMap[f.id] = f.team; });
  _epics.forEach(e => { if (e.team && e.team !== '_PI' && e.team !== '') _featTeamMap[e.id] = e.team; });

  const blPI = blAll.filter(bt => {
    if (activeIds.has(bt.id)) return false;
    // Vérifier la team : backlog team OU team depuis FEATURES/EPICS
    const effectiveTeam = bt.team && bt.team !== '_PI' ? bt.team : (_featTeamMap[bt.id] || bt.team);
    if (teamSet.size && !teamSet.has(effectiveTeam)) return false;
    // 1. Champs sprint explicites
    const matchPiSprint = piSprintRe.test(bt.piSprint || '');
    const matchSprintName = piRe.test(bt.sprintName || '');
    const matchAllSprints = (bt.allSprints || []).some(s => piRe.test(s) || piSprintRe.test(s));
    // 2. Feature/epic parente nommée avec le PI
    const matchParent = (bt.epic && (_piFeatIds.has(bt.epic) || _piEpicIds.has(bt.epic)));
    // 3. Label "Cadrage_PIXX" (cadrage pour ce PI)
    const cadrageRe = new RegExp(`cadrage_pi\\s*#?\\s*${piNum}\\b`, 'i');
    const matchCadrage = (bt.labels || []).some(l => cadrageRe.test(l));
    if (matchCadrage) bt._cadrage = true;
    if (!matchPiSprint && !matchSprintName && !matchAllSprints && !matchParent && !matchCadrage) return false;
    // Exclure les tickets done/resolved d'un PI antérieur
    if (isDone(bt.status) && !matchPiSprint && !matchSprintName && !matchParent) return false;
    return true;
  });

  // Aussi inclure les tickets actifs rattachés à une feature/epic PI (même sans sprint PI)
  if (!activeInPI && (_piFeatIds.size || _piEpicIds.size)) {
    active.forEach(t => {
      if (activeIds.has(t.id)) return; // déjà inclus
      if (teamSet.size && !teamSet.has(t.team)) return;
      if (t.epic && (_piFeatIds.has(t.epic) || _piEpicIds.has(t.epic))) {
        filtered.push(t);
        activeIds.add(t.id);
      }
    });
  }

  // Tickets des sprints fermés du PI (done + buffer)
  // IMPORTANT : traiter bufferTickets EN PREMIER pour que le flag buffer:true soit préservé
  // lors de la déduplication (un ticket buffer done apparaît dans les deux listes)
  const closedTix = [];
  const seenIds = new Set([...activeIds, ...blPI.map(t => t.id)]);
  // Aussi marquer les tickets actifs/backlog qui sont buffer dans bufferTickets
  const _bufferIds = new Set();
  Object.entries(CONFIG.teams || {}).forEach(([tid, tc]) => {
    if (teamSet.size && !teamSet.has(tid)) return;
    (tc.velocityHistory || []).forEach(vh => {
      if (!piRe.test(vh.name || '')) return;
      (vh.bufferTickets || []).forEach(bt => _bufferIds.add(bt.id));
    });
  });
  // Marquer les tickets actifs/backlog déjà collectés qui sont aussi buffer
  filtered.forEach(t => { if (_bufferIds.has(t.id)) t.buffer = true; });
  blPI.forEach(t => { if (_bufferIds.has(t.id)) t.buffer = true; });

  Object.entries(CONFIG.teams || {}).forEach(([tid, tc]) => {
    if (teamSet.size && !teamSet.has(tid)) return;
    (tc.velocityHistory || []).forEach(vh => {
      if (!piRe.test(vh.name || '')) return;
      // Buffer tickets first (preserve buffer: true flag)
      (vh.bufferTickets || []).forEach(bt => {
        if (!seenIds.has(bt.id)) {
          seenIds.add(bt.id);
          closedTix.push({ ...bt, team: bt.team || tid, sprintName: bt.sprintName || vh.name });
        }
      });
      // Done tickets from closed sprints
      (vh.tickets || []).forEach(t => {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          closedTix.push({ ...t, team: t.team || tid, sprintName: t.sprintName || vh.name });
        }
      });
    });
  });

  const result = filtered.concat(blPI, closedTix);
  _memoCache[cacheKey] = result;
  return result;
}

/**
 * Calcule les stats de vélocité pour un PI donné, basé sur velocityHistory.
 * @param {string[]} teams
 * @param {string} piNum
 * @returns {{ avg: number, min: number, max: number, capacity: number, delivered: number,
 *             sprintsDone: number, sprintsPerPI: number, teamDetails: object[], piSprints: object[] }}
 */
function _piVelocityStats(teams, piNum) {
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const piRe = piNum ? new RegExp(`\\b${piNum}\\.\\d+`) : null;
  const result = { avg: 0, min: 0, max: 0, capacity: 0, delivered: 0, sprintsDone: 0, sprintsPerPI, teamDetails: [], piSprints: [] };

  const teamList = teams.length ? teams : Object.keys(CONFIG.teams || {});
  let totalAvg = 0;

  teamList.forEach(tid => {
    const cfg = CONFIG.teams[tid] || {};
    const history = cfg.velocityHistory || [];
    // Sprints de ce PI
    const piSps = piRe ? history.filter(s => piRe.test(s.name)) : [];
    const delivered = piSps.reduce((s, sp) => s + (sp.velocity || 0), 0);
    // Moyenne empirique sur tout l'historique (non-zéro)
    const histVals = history.filter(s => s.velocity > 0).map(s => s.velocity);
    const avgVel = histVals.length ? Math.round(histVals.reduce((a, b) => a + b, 0) / histVals.length) : (cfg.velocity || 0);
    const minVel = histVals.length >= 2 ? Math.min(...histVals) : avgVel;
    const maxVel = histVals.length >= 2 ? Math.max(...histVals) : avgVel;
    const teamCap = avgVel * sprintsPerPI;

    totalAvg += avgVel;
    result.capacity += teamCap;
    result.delivered += delivered;
    if (piSps.length > result.sprintsDone) result.sprintsDone = piSps.length;

    result.teamDetails.push({
      team: tid, name: cfg.name || tid, color: cfg.color || '#94A3B8',
      avgVel, minVel, maxVel, delivered, teamCap,
      sprintsDone: piSps.length, histVals
    });
  });

  // Agrégats : somme des moyennes par équipe = vélocité combinée par sprint
  result.avg = totalAvg;
  // Min/Max agrégés : somme des min/max par équipe par sprint
  const allNonZero = result.teamDetails.flatMap(d => {
    // Pour chaque sprint PI, récupérer la vélocité de cette équipe
    const piRe2 = piRe;
    const history = (CONFIG.teams[d.team] || {}).velocityHistory || [];
    return piRe2 ? history.filter(s => piRe2.test(s.name) && s.velocity > 0).map(s => s.velocity) : [];
  });

  // Vélocité agrégée par sprint du PI
  if (piRe) {
    const bySprintKey = {};
    teamList.forEach(tid => {
      ((CONFIG.teams[tid] || {}).velocityHistory || []).forEach(s => {
        if (!piRe.test(s.name)) return;
        const key = (s.name.match(/(\d+\.\d+)/) || [])[1] || s.name;
        bySprintKey[key] = (bySprintKey[key] || 0) + (s.velocity || 0);
      });
    });
    const sprintVals = Object.entries(bySprintKey)
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([key, vel]) => ({ key, vel }));
    result.piSprints = sprintVals;
    const vals = sprintVals.map(s => s.vel).filter(v => v > 0);
    result.min = vals.length ? Math.min(...vals) : result.avg;
    result.max = vals.length ? Math.max(...vals) : result.avg;
  } else {
    result.min = result.avg;
    result.max = result.avg;
  }

  return result;
}

/**
 * Calcule les stats buffer pour un PI donné.
 * @param {string[]} teams
 * @param {string} piNum
 * @returns {{ totalPts: number, totalTix: number, donePts: number, doneTix: number,
 *             inprogPts: number, todoPts: number, blockedPts: number, tickets: object[] }}
 */
function _piBufferStats(teams, piNum) {
  const allTix = _piAllTickets(teams, piNum);
  const bufTix = allTix.filter(t => t.buffer);
  const totalPts   = bufTix.reduce((s, t) => s + (t.points || 0), 0);
  const donePts    = bufTix.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const inprogPts  = bufTix.filter(t => ['inprog','review','test'].includes(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const blockedPts = bufTix.filter(t => t.status === 'blocked').reduce((s, t) => s + (t.points || 0), 0);
  const todoPts    = totalPts - donePts - inprogPts - blockedPts;
  return {
    totalPts, totalTix: bufTix.length,
    donePts, doneTix: bufTix.filter(t => isDone(t.status)).length,
    inprogPts, todoPts, blockedPts, tickets: bufTix
  };
}

// ============================================================
// REUSABLE CHARTS — Métriques réutilisables (Roadmap, PI, Scrum)
// ============================================================

/** Chart instances registry for reusable charts (keyed by canvasId) */
const _reusableCharts = {};

/** Shared tooltip style for all reusable charts */
const _TOOLTIP_SHARED = {
  backgroundColor: 'rgba(15,23,42,.94)',
  titleColor:      '#F8FAFC',
  bodyColor:       '#CBD5E1',
  borderColor:     'rgba(255,255,255,.10)',
  borderWidth:     1,
  padding:         12,
  cornerRadius:    10,
  titleFont:       { size: 12, weight: 'bold' },
  bodyFont:        { size: 11 },
  displayColors:   true,
  boxWidth:        10,
  boxHeight:       10,
  boxPadding:      4,
};

/**
 * Render a velocity bar chart on a canvas.
 * @param {string} canvasId
 * @param {{ labels: string[], engaged: (number|null)[], realized: (number|null)[] }} data
 * @param {object} [opts] - { highlightIdx }
 */
function _renderVelocityBarChart(canvasId, data, opts) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_reusableCharts[canvasId]) { _reusableCharts[canvasId].destroy(); _reusableCharts[canvasId] = null; }

  const { labels, engaged, realized } = data;
  const hi = opts?.highlightIdx ?? -1;
  const engBg  = labels.map((_, i) => i === hi ? 'rgba(2,132,199,.75)'  : 'rgba(2,132,199,.22)');
  const reaBg  = labels.map((_, i) => i === hi ? 'rgba(16,185,129,.9)'  : 'rgba(16,185,129,.35)');
  const engBdr = labels.map((_, i) => i === hi ? '#0284C7'              : 'rgba(2,132,199,.4)');
  const reaBdr = labels.map((_, i) => i === hi ? '#10B981'              : 'rgba(16,185,129,.5)');

  _reusableCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Engagés',  data: engaged,  backgroundColor: engBg,  borderColor: engBdr,  borderWidth: 2 },
        { label: 'Réalisés', data: realized, backgroundColor: reaBg, borderColor: reaBdr, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP_SHARED,
          callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw} pts`,
            footer: items => {
              const eng = items.find(i => i.dataset.label === 'Engagés'  && i.raw != null);
              const rea = items.find(i => i.dataset.label === 'Réalisés' && i.raw != null);
              if (!eng || !rea || !eng.raw) return [];
              const rate = Math.round(rea.raw / eng.raw * 100);
              const icon = rate >= 90 ? '✅' : rate >= 70 ? '🟡' : '⚠️';
              return [`${icon}  Taux de réalisation : ${rate}%`];
            },
          },
          footerColor: '#10B981',
          footerFont:  { size: 11, weight: '600' },
        },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

/**
 * Render a type distribution donut on a canvas.
 * @param {string} canvasId
 * @param {object[]} tickets - array with .type property
 */
function _renderTypeDonutChart(canvasId, tickets) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_reusableCharts[canvasId]) { _reusableCharts[canvasId].destroy(); _reusableCharts[canvasId] = null; }

  const typeCounts = {};
  tickets.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1; });
  if (!Object.keys(typeCounts).length) { canvas.parentElement.style.display = 'none'; return; }
  canvas.parentElement.style.display = '';

  _reusableCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(typeCounts).map(typeName),
      datasets: [{
        data:            Object.values(typeCounts),
        backgroundColor: Object.keys(typeCounts).map(k => CONFIG.typeColors[k] || '#94A3B8'),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: {
          ..._TOOLTIP_SHARED,
          callbacks: {
            label: item => {
              const total = item.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total ? Math.round(item.raw / total * 100) : 0;
              return ` ${item.label}: ${item.raw} ticket${item.raw !== 1 ? 's' : ''} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Render a burnup chart on a canvas.
 * @param {string} canvasId
 * @param {{ scope: number, done: number, labels: string[], doneData: (number|null)[] }} data
 */
function _renderBurnupChart(canvasId, data) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_reusableCharts[canvasId]) { _reusableCharts[canvasId].destroy(); _reusableCharts[canvasId] = null; }

  const { scope, labels, doneData } = data;
  const scopeData = Array.from({ length: labels.length }, () => scope);

  _reusableCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Scope',
          data: scopeData,
          borderColor: '#94A3B8', borderDash: [5, 5], pointRadius: 0, tension: 0, fill: false,
        },
        {
          label: 'Terminé',
          data: doneData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,.15)',
          fill: true, tension: .3,
          pointBackgroundColor: '#10B981',
          pointRadius: 3, pointHoverRadius: 5,
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP_SHARED,
          callbacks: {
            label: item => {
              if (item.raw == null) return null;
              if (item.dataset.label === 'Scope') return ` Scope: ${item.raw} pts`;
              return ` Terminé: ${item.raw} pts`;
            },
            footer: items => {
              const done  = items.find(i => i.dataset.label !== 'Scope' && i.raw != null);
              const sc = items.find(i => i.dataset.label === 'Scope'  && i.raw != null);
              if (!done || !sc || !sc.raw) return [];
              const pct  = Math.round(done.raw / sc.raw * 100);
              const icon = pct >= 80 ? '✅' : pct >= 50 ? '🟡' : '📍';
              return [`${icon}  Avancement : ${pct}%`];
            },
          },
          footerColor: '#10B981',
          footerFont:  { size: 11, weight: '600' },
        },
      },
      scales: {
        y: { beginAtZero: true, max: Math.ceil(scope * 1.1) || undefined, title: { display: true, text: 'Points' } },
      },
    },
  });
}

/**
 * Render a status distribution horizontal stacked bar.
 * @param {string} canvasId
 * @param {object[]} tickets
 */
function _renderStatusBarChart(canvasId, tickets) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_reusableCharts[canvasId]) { _reusableCharts[canvasId].destroy(); _reusableCharts[canvasId] = null; }

  if (!tickets.length) { canvas.parentElement.style.display = 'none'; return; }
  canvas.parentElement.style.display = '';

  const statuses = [
    { key: 'done',    label: 'Terminé',  color: '#10B981' },
    { key: 'test',    label: 'En test',  color: '#06B6D4' },
    { key: 'review',  label: 'Review',   color: '#3B82F6' },
    { key: 'inprog',  label: 'En cours', color: '#F59E0B' },
    { key: 'blocked', label: 'Bloqué',   color: '#EF4444' },
    { key: 'todo',    label: 'À faire',  color: '#94A3B8' },
  ];
  const counts = {};
  tickets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  // Also count anything not in standard statuses as 'todo'
  tickets.forEach(t => {
    if (!statuses.find(s => s.key === t.status)) counts['todo'] = (counts['todo'] || 0) + 1;
  });

  const datasets = statuses.map(s => ({
    label: s.label,
    data: [counts[s.key] || 0],
    backgroundColor: s.color + 'CC',
    borderColor: s.color,
    borderWidth: 1,
    borderRadius: 3,
  }));

  _reusableCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: [''], datasets },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
        tooltip: {
          ..._TOOLTIP_SHARED,
          callbacks: {
            label: item => {
              const total = tickets.length;
              const pct = Math.round(item.raw / total * 100);
              return ` ${item.dataset.label}: ${item.raw} (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true, display: false },
        y: { stacked: true, display: false },
      },
    },
  });
}

/**
 * Build HTML for a metrics section with chart cards.
 * @param {string} prefix - unique prefix for canvas IDs (e.g. 'rm', 'pi')
 * @returns {string} HTML
 */
function _metricsChartsHTML(prefix) {
  return `<div class="charts-row" style="grid-template-columns: repeat(3, 1fr);">
    <div class="chart-card"><div class="chart-title">⚡ Vélocité</div><div class="chart-wrap"><canvas id="${prefix}VelocityChart"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">🍩 Distribution Types</div><div class="chart-wrap"><canvas id="${prefix}TypeChart"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">📈 Burnup PI</div><div class="chart-wrap"><canvas id="${prefix}BurnupChart"></canvas></div></div>
  </div>
  <div class="charts-row" style="grid-template-columns: repeat(2, 1fr); margin-top: 8px;">
    <div class="chart-card"><div class="chart-title">📊 Répartition Statuts</div><div class="chart-wrap" style="height:100px"><canvas id="${prefix}StatusChart"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">✋ Confiance PI (Fist of Five)</div><div class="chart-wrap" style="height:200px"><canvas id="${prefix}FistChart"></canvas></div></div>
  </div>`;
}

/**
 * Render all metrics charts for a PI-level view.
 * @param {string} prefix - canvas ID prefix ('rm' or 'piM')
 * @param {string[]} activeTeams
 */
function _renderMetricsCharts(prefix, activeTeams) {
  if (typeof Chart === 'undefined') return;
  const pi = _piDetect();
  const piNum = pi.piNum;
  const allTix = _piAllTickets(activeTeams, piNum);

  // Check if there's any meaningful data
  const hasData = allTix.length > 0;
  if (!hasData) {
    // Show empty state for each chart card
    [prefix + 'VelocityChart', prefix + 'TypeChart', prefix + 'BurnupChart', prefix + 'StatusChart', prefix + 'FistChart'].forEach(id => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      if (_reusableCharts[id]) { _reusableCharts[id].destroy(); _reusableCharts[id] = null; }
      canvas.style.display = 'none';
      const wrap = canvas.parentElement;
      let msg = wrap.querySelector('.metrics-empty');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'metrics-empty';
        msg.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:120px;gap:6px;color:var(--text-muted);text-align:center;';
        msg.innerHTML = '<span style="font-size:24px;opacity:.5;">📊</span><span style="font-size:11px;">Aucune donnée disponible pour ce PI</span>';
        wrap.appendChild(msg);
      }
      msg.style.display = 'flex';
    });
    return;
  }

  // Clear empty states
  [prefix + 'VelocityChart', prefix + 'TypeChart', prefix + 'BurnupChart', prefix + 'StatusChart', prefix + 'FistChart'].forEach(id => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.style.display = '';
    const msg = canvas.parentElement.querySelector('.metrics-empty');
    if (msg) msg.style.display = 'none';
  });

  // -- Velocity: aggregated across teams --
  const velData = _metricsVelocityData(activeTeams);
  _renderVelocityBarChart(prefix + 'VelocityChart', velData);

  // -- Type donut --
  _renderTypeDonutChart(prefix + 'TypeChart', allTix);

  // -- Burnup PI (cumulative actual delivered per sprint) --
  const totalPts = allTix.reduce((s, t) => s + (t.points || 0), 0);
  const velStats = _piVelocityStats(activeTeams, piNum);
  const sprintsPerPI = pi.sprintsPerPI || 5;

  // Use actual PI sprint labels and delivered points from velocity history
  const piSprints = velStats.piSprints || []; // [{key: "28.1", vel: 42}, …]
  const labels = Array.from({ length: sprintsPerPI }, (_, i) => {
    const sp = piSprints[i];
    return sp ? `Ité ${sp.key}` : (piNum ? `${piNum}.${i + 1}` : `Sprint ${i + 1}`);
  });

  // Cumulative delivered points per sprint
  let cumul = 0;
  const sprintsDone = velStats.sprintsDone || 0;
  const doneData = labels.map((_, i) => {
    if (i < piSprints.length) {
      cumul += piSprints[i].vel || 0;
      return cumul;
    }
    // Current sprint: add active done pts
    if (i === sprintsDone && sprintsDone === piSprints.length) {
      const activeDone = allTix.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
      // Subtract already counted from closed sprints
      const closedTotal = piSprints.reduce((s, sp) => s + (sp.vel || 0), 0);
      cumul += Math.max(0, activeDone - closedTotal);
      return cumul;
    }
    return null; // future sprint
  });

  // Scope = capacity estimate or total planned
  const scope = velStats.capacity || totalPts || cumul || 1;
  _renderBurnupChart(prefix + 'BurnupChart', { scope, labels, doneData });

  // -- Status distribution --
  _renderStatusBarChart(prefix + 'StatusChart', allTix);

  // -- Fist of Five --
  if (typeof _renderFistChart === 'function') _renderFistChart(prefix + 'FistChart', activeTeams);
}

/**
 * Build velocity data aggregated across teams for the reusable velocity chart.
 * @param {string[]} teams
 * @returns {{ labels: string[], engaged: (number|null)[], realized: (number|null)[] }}
 */
function _metricsVelocityData(teams) {
  const maxLen = (CONFIG.sync && CONFIG.sync.velocityHistoryCount) || 5;

  // Aggregate velocity history across teams, sorted chronologically
  const iterMap = new Map(); // iterKey → { label, totalVel, idx }
  teams.forEach(tid => {
    const tc = CONFIG.teams[tid];
    if (!tc?.velocityHistory?.length) return;
    tc.velocityHistory.forEach((entry, i) => {
      const key = entry.name || `S-${i}`;
      if (!iterMap.has(key)) {
        iterMap.set(key, { label: key.replace(/sprint\s*/i, 'S'), totalEngaged: 0, totalRealized: 0, startDate: entry.startDate || '' });
      }
      const m = iterMap.get(key);
      m.totalEngaged  += entry.committed || entry.velocity || 0;
      m.totalRealized += entry.velocity || 0;
    });
  });

  const sorted = [...iterMap.values()]
    .sort((a, b) => a.startDate ? a.startDate.localeCompare(b.startDate || '') : 0)
    .slice(0, maxLen);

  // Add current sprint
  const tickets = typeof getTickets === 'function' ? getTickets() : [];
  const ptsTotal = tickets.filter(t => teams.includes(t.team)).reduce((a, t) => a + t.points, 0);
  const ptsDone  = tickets.filter(t => teams.includes(t.team) && isDone(t.status)).reduce((a, t) => a + t.points, 0);
  const s = typeof _activeSprintCtx === 'function' ? _activeSprintCtx() : CONFIG.sprint;
  const currentLabel = (s.label || 'Actuel').replace(/sprint\s*/i, 'S');

  const labels   = [...sorted.map(e => e.label), currentLabel];
  const engaged  = [...sorted.map(e => e.totalEngaged), ptsTotal];
  const realized = [...sorted.map(e => e.totalRealized), ptsDone];

  return { labels, engaged, realized };
}

// ============================================================
// FIST OF FIVE CHART — Évolution confiance PI par sprint
// Réutilisable : PI Planning, Roadmap, Scrum
// ============================================================

/** Fist of Five chart instances (destroy before re-render) */
const _fistCharts = {};

/**
 * Compute Fist of Five + Mood chart data for the current PI.
 * @param {string[]} teams - team IDs
 * @returns {{ labels: string[], datasets: {tid,name,color,data}[], globalData: number[], moodData: number[] }}
 */
function _piFistChartData(teams) {
  if (typeof _ppFistGet !== 'function') return { labels: [], datasets: [], globalData: [], moodData: [] };
  const fist  = _ppFistGet();
  const piNum = _piDetect().piNum;
  if (!piNum || !teams.length) return { labels: [], datasets: [], globalData: [], moodData: [] };

  // Collect all PI sprint labels (union across teams, sorted)
  const sprintOrder = new Map();
  teams.forEach(tid => {
    if (typeof _fistPISprints !== 'function') return;
    _fistPISprints(tid, piNum).forEach(sp => {
      if (!sprintOrder.has(sp)) {
        const m = sp.match(new RegExp(`${piNum}\\.(\\d+)`));
        sprintOrder.set(sp, m ? parseInt(m[1], 10) : 0);
      }
    });
  });
  const labels = [...sprintOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([l]) => l);

  if (!labels.length) return { labels: [], datasets: [], globalData: [], moodData: [] };

  // Per-team fist data
  const datasets = teams.map(tid => {
    const tc = CONFIG.teams[tid];
    return {
      tid,
      name: tc?.name || tid,
      color: tc?.color || '#94A3B8',
      data: labels.map(sp => {
        const k = `${tid}__${sp}`;
        const v = Array.isArray(fist[k]) ? fist[k] : [];
        return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null;
      }),
    };
  });

  // Global fist average per sprint
  const globalData = labels.map((_, i) => {
    const vals = datasets.map(d => d.data[i]).filter(v => v !== null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : null;
  });

  // Mood meter average per sprint (from _moodData)
  const md = typeof _moodData === 'function' ? _moodData() : {};
  const moodVotes = md.votes || {};
  const moodData = labels.map(sp => {
    const allVotes = [];
    teams.forEach(tid => {
      const k = `${tid}__${sp}`;
      const v = moodVotes[k];
      if (Array.isArray(v)) allVotes.push(...v);
    });
    return allVotes.length ? Math.round(allVotes.reduce((s, x) => s + x, 0) / allVotes.length * 10) / 10 : null;
  });

  // Collect sprint dates from velocityHistory + active sprint
  const sprintDates = {};
  teams.forEach(tid => {
    const tc = CONFIG.teams[tid];
    (tc?.velocityHistory || []).forEach(vh => {
      if (vh.startDate || vh.endDate) sprintDates[vh.name] = { start: vh.startDate || '', end: vh.endDate || '' };
    });
  });
  // Active sprint dates
  if (CONFIG.sprint?.startDateISO || CONFIG.sprint?.endDate) {
    const activeName = CONFIG.sprint.label || '';
    if (activeName && !sprintDates[activeName]) {
      sprintDates[activeName] = { start: CONFIG.sprint.startDateISO || '', end: CONFIG.sprint.endDate || '' };
    }
  }

  const _fmtShort = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    } catch { return ''; }
  };

  // Short labels with dates (multi-line array for Chart.js)
  const shortLabels = labels.map(l => {
    const m = l.match(/(\d+\.\d+)/);
    const name = m ? m[1] : l.replace(/sprint\s*/i, '');
    // Find dates: match by sprint label
    const dates = sprintDates[l];
    if (dates) {
      const s = _fmtShort(dates.start);
      const e = _fmtShort(dates.end);
      if (s && e) return [name, `${s} › ${e}`];
      if (s || e) return [name, s || e];
    }
    return name;
  });

  return { labels: shortLabels, datasets, globalData, moodData };
}

/**
 * Render or update a Fist of Five bar chart + Mood line on a canvas.
 * @param {string} canvasId - DOM id of the <canvas>
 * @param {string[]} teams  - team IDs
 */
function _renderFistChart(canvasId, teams) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy previous instance
  if (_fistCharts[canvasId]) { _fistCharts[canvasId].destroy(); _fistCharts[canvasId] = null; }

  const { labels, datasets, globalData, moodData } = _piFistChartData(teams);
  const chartCard = canvas.closest('.chart-card');
  if (!labels.length) {
    // Hide the entire chart card when no data
    if (chartCard) chartCard.style.display = 'none';
    return;
  }
  // Re-show if previously hidden
  if (chartCard) chartCard.style.display = '';
  canvas.style.display = '';

  // Per-team bars (grouped)
  const chartDatasets = datasets.map(d => ({
    type: 'bar',
    label: '✊ ' + d.name,
    data: d.data,
    backgroundColor: d.color + '99',
    borderColor: d.color,
    borderWidth: 1,
    borderRadius: 3,
    order: 2,
  }));

  // Mood meter line (orange, dashed)
  const hasMood = moodData.some(v => v !== null);
  if (hasMood) {
    chartDatasets.push({
      type: 'line',
      label: '😊 Mood',
      data: moodData,
      borderColor: '#F59E0B',
      backgroundColor: '#F59E0B22',
      borderWidth: 2.5,
      pointRadius: 5,
      pointBackgroundColor: '#F59E0B',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: 0.3,
      spanGaps: true,
      fill: false,
      order: 0,
    });
  }

  // Global fist average (dashed line)
  chartDatasets.push({
    type: 'line',
    label: '✊ Moyenne',
    data: globalData,
    borderColor: '#64748B',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [6, 3],
    pointRadius: 3,
    pointBackgroundColor: '#64748B',
    pointBorderColor: '#fff',
    pointBorderWidth: 1,
    tension: 0.3,
    spanGaps: true,
    fill: false,
    order: 1,
  });

  const tooltipStyle = {
    backgroundColor: 'rgba(15,23,42,.94)',
    titleColor: '#F8FAFC',
    bodyColor: '#CBD5E1',
    borderColor: 'rgba(255,255,255,.10)',
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    bodyFont: { size: 12 },
    titleFont: { size: 12, weight: '600' },
  };

  _fistCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    data: { labels, datasets: chartDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          ...tooltipStyle,
          callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw}/5`,
          },
        },
      },
      scales: {
        y: {
          min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 11 } },
          grid: { color: 'rgba(148,163,184,.15)' },
          title: { display: true, text: 'Score /5', font: { size: 11 } },
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });
}
