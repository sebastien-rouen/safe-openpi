// ============================================================
// AMELIORATION CONTINUE - Board rétro / post-mortem / CoP / Adapt PI
// ============================================================

// PI selectionne (defaut '' = tous les PI, pas de filtre)
// Possible values : '' (tous), '29', '28', '30', etc.
let _amelPI = '';

// Etat des filtres
let _amelFilter      = '';     // 'blocked' | 'unassigned' | 'critical' | 'stale' | ''
let _amelTeamFilter  = '';     // ID equipe ou ''
let _amelTextFilter  = '';     // recherche texte
let _amelGroupBy     = 'parent'; // 'parent' | 'assignee' | 'team' | 'updated' | 'priority'
let _amelHideDone    = localStorage.getItem('amel_hide_done') === '1';
let _amelLaneCollapsed = {};

// Retourne le numero de PI effectif (null = pas de filtre, defaut)
function _amelGetPI() {
  return _amelPI ? String(_amelPI) : null;
}

function _amelSelectPI(piNum)         { _amelPI = piNum; renderAmelioration(); }
function _amelSetFilter(f)            { _amelFilter = (_amelFilter === f) ? '' : f; renderAmelioration(); }
function _amelSetTeamFilter(t)        { _amelTeamFilter = t || ''; renderAmelioration(); }
function _amelSetText(t)              { _amelTextFilter = t || ''; renderAmelioration(); }
function _amelSetGroupBy(g)           { _amelGroupBy = g || 'parent'; renderAmelioration(); }
function _amelToggleHideDone()        { _amelHideDone = !_amelHideDone; localStorage.setItem('amel_hide_done', _amelHideDone ? '1' : ''); renderAmelioration(); }
function _amelClearFilters()          { _amelFilter=''; _amelTeamFilter=''; _amelTextFilter=''; renderAmelioration(); }

// ----- Categorisation swimlane -----
function _amelCategory(t) {
  const labels = (t.labels || []).map(l => l.toLowerCase());
  const sum    = (t.title || '').toLowerCase();

  // Adapt PI prioritaire
  const piNum = _amelGetPI();
  const baseAdapt = ['adapt', 'amélioration', 'amelioration'];
  const hasBaseAdapt = labels.some(l => baseAdapt.includes(l));
  const hasPiLabel = piNum ? labels.includes(`pi${piNum}`) : true;
  if (hasBaseAdapt && hasPiLabel) return 'adapt';

  if (labels.some(l => l === 'postmortem') || /post-?mortem/i.test(sum)) return 'postmortem';
  if (labels.some(l => ['cop-méthodo','cop-dev','methodo'].includes(l)) || /\bcop\b/i.test(sum)) return 'cop';
  return 'retro';
}

// Source de l'action (badge origine)
function _amelSource(t) {
  const labels = (t.labels || []).map(l => l.toLowerCase());
  if (labels.some(l => l === 'postmortem')) return { icon: '🔍', label: 'Post-Mortem', color: '#EF4444' };
  if (labels.some(l => ['cop-méthodo','cop-dev','methodo'].includes(l))) return { icon: '🤝', label: 'CoP', color: '#8B5CF6' };
  if (labels.some(l => ['retro','rétro','retrospective','rétrospective'].includes(l))) return { icon: '🔄', label: 'Rétro', color: '#2563EB' };
  if (labels.some(l => ['metric','metrique','métrique','kpi'].includes(l))) return { icon: '📈', label: 'Métrique', color: '#10B981' };
  if (labels.some(l => ['adapt','amélioration','amelioration'].includes(l))) return { icon: '🎯', label: 'Adapt', color: '#0891B2' };
  return null;
}

// Age du ticket en jours (depuis updated ou created)
function _amelAgeDays(t) {
  const dateStr = t.updatedAt || t.updated || t.createdAt || t.created || null;
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function _amelAgeBadge(days) {
  if (days == null) return '';
  if (days < 30) return `<span class="amel-age amel-age-fresh" title="Mis à jour il y a ${days}j">${days}j</span>`;
  if (days < 90) return `<span class="amel-age amel-age-warm" title="Mis à jour il y a ${days}j">${days}j</span>`;
  return `<span class="amel-age amel-age-stale" title="⚠ Pas de mise à jour depuis ${days}j">${days}j ⚠</span>`;
}

function _amelSwimlanes() {
  const piNum = _amelGetPI();
  const adaptLabel = piNum ? `Adapt PI${piNum}` : 'Adapt';
  const adaptTooltip = piNum
    ? `Tickets avec label "Adapt" OU "Amélioration" ET avec label "PI${piNum}"`
    : `Tickets avec label "Adapt" ou "Amélioration"`;
  return [
    { key: 'adapt',      label: adaptLabel,         icon: '🎯', color: '#0891B2', tooltip: adaptTooltip,
      jql: piNum ? `labels in (Adapt, Amélioration) AND labels = "PI${piNum}"` : `labels in (Adapt, Amélioration)` },
    { key: 'retro',      label: 'Rétrospective',    icon: '🔄', color: '#2563EB', tooltip: 'Tickets sans autre catégorie (défaut)',
      jql: null },
    { key: 'postmortem', label: 'Post-Mortem',       icon: '🔍', color: '#EF4444', tooltip: 'Label "postmortem" ou titre contenant "post-mortem"',
      jql: 'labels = postmortem OR summary ~ "post-mortem"' },
    { key: 'cop',        label: 'CoP Méthodo',       icon: '🤝', color: '#8B5CF6', tooltip: 'Label "cop-méthodo", "cop-dev", "methodo" ou titre contenant "cop"',
      jql: 'labels in ("cop-méthodo","cop-dev","methodo") OR summary ~ "cop"' },
  ];
}

function _toggleAmelLane(key) { _amelLaneCollapsed[key] = !_amelLaneCollapsed[key]; renderAmelioration(); }

// ----- Filtrage des tickets -----
function _amelFilterTickets(all) {
  let result = all;
  // Filtre PI : si un PI est selectionne, ne garder que les tickets ayant le label pi{N}
  // (cela rend les KPIs et compteurs reactifs au PI selectionne)
  const piNum = _amelGetPI();
  if (piNum) {
    const piLabel = `pi${piNum}`;
    result = result.filter(t => (t.labels || []).some(l => String(l).toLowerCase() === piLabel));
  }
  if (_amelFilter === 'blocked')    result = result.filter(t => t.status === 'blocked');
  if (_amelFilter === 'unassigned') result = result.filter(t => !t.assignee && !isDone(t.status));
  if (_amelFilter === 'critical')   result = result.filter(t => (t.priority === 'critical' || t.priority === 'high') && !isDone(t.status));
  if (_amelFilter === 'stale')      result = result.filter(t => { const a = _amelAgeDays(t); return a != null && a >= 60 && !isDone(t.status); });
  if (_amelTeamFilter)              result = result.filter(t => t.team === _amelTeamFilter);
  if (_amelHideDone)                result = result.filter(t => !isDone(t.status));
  if (_amelTextFilter) {
    const lq = _amelTextFilter.toLowerCase();
    result = result.filter(t =>
      (t.id || '').toLowerCase().includes(lq) ||
      (t.title || '').toLowerCase().includes(lq) ||
      (t.assignee || '').toLowerCase().includes(lq)
    );
  }
  return result;
}

// ----- PI Burn-up : tickets de la swimlane Adapt par PI -----
// Aligne sur la logique de _amelCategory : (Adapt OR Amélioration) ET label PIxx
function _amelPIBurnup(allTickets) {
  const baseAdapt = ['adapt', 'amélioration', 'amelioration'];
  // Collecte les PIs depuis les labels PIxx des tickets
  const piSet = new Set();
  allTickets.forEach(t => {
    (t.labels || []).forEach(l => {
      const m = String(l).toLowerCase().match(/^pi(\d{2,3})$/);
      if (m) piSet.add(parseInt(m[1]));
    });
  });
  const pis = [...piSet].sort((a, b) => a - b).slice(-8);
  return pis.map(pi => {
    const piTix = allTickets.filter(t => {
      const labels = (t.labels || []).map(l => String(l).toLowerCase());
      return labels.includes(`pi${pi}`) && labels.some(l => baseAdapt.includes(l));
    });
    const done  = piTix.filter(t => isDone(t.status)).length;
    const total = piTix.length;
    return { pi, done, total };
  });
}

function renderAmelioration() {
  const el = document.getElementById('amelioration-content');
  if (!el) return;

  // Memoriser le focus + position curseur de l'input recherche avant le re-render
  let _amelFocusRestore = null;
  const _focused = document.activeElement;
  if (_focused && _focused.id === 'amel-search-input') {
    _amelFocusRestore = { selStart: _focused.selectionStart, selEnd: _focused.selectionEnd };
  }

  const allTickets = AMELIORATION_TICKETS;

  if (!allTickets.length) {
    el.innerHTML = '<div class="empty-state">Aucun ticket d\'amélioration continue trouvé.<br><small>Synchronisez pour charger les données depuis JIRA.</small></div>';
    return;
  }

  // Tickets apres filtres
  const tickets = _amelFilterTickets(allTickets);

  // Pool pour compteurs filtres rapides : applique le filtre PI mais pas les autres filtres
  // (pour ne pas s'auto-influencer entre filtres rapides, mais rester reactif au PI)
  const piNumForFilter = _amelGetPI();
  const ticketsForCounts = piNumForFilter
    ? allTickets.filter(t => (t.labels || []).some(l => String(l).toLowerCase() === `pi${piNumForFilter}`))
    : allTickets;
  const cntBlocked    = ticketsForCounts.filter(t => t.status === 'blocked').length;
  const cntUnassigned = ticketsForCounts.filter(t => !t.assignee && !isDone(t.status)).length;
  const cntCritical   = ticketsForCounts.filter(t => (t.priority === 'critical' || t.priority === 'high') && !isDone(t.status)).length;
  const cntStale      = ticketsForCounts.filter(t => { const a = _amelAgeDays(t); return a != null && a >= 60 && !isDone(t.status); }).length;

  // Liste des equipes presentes
  const allTeamsInTickets = [...new Set(allTickets.map(t => t.team).filter(Boolean))].sort();

  // Build columns from board config or use defaults
  const defaultCols = [
    { key: 'todo',   label: 'À faire',  color: _STATUS_COLORS.todo },
    { key: 'inprog', label: 'En cours',  color: _STATUS_COLORS.inprog },
    { key: 'review', label: 'En review', color: _STATUS_COLORS.review },
    { key: 'done',   label: 'Terminé',   color: _STATUS_COLORS.done },
  ];
  let cols = defaultCols;
  if (BOARD_COLUMNS && Object.keys(BOARD_COLUMNS).length) {
    const _ORDER = ['backlog','todo','inprog','review','test','done'];
    const seen = {};
    for (const tc of Object.values(BOARD_COLUMNS)) {
      for (const c of tc) { if (c.internal && !seen[c.internal]) seen[c.internal] = c.name; }
    }
    const merged = _ORDER.filter(k => seen[k]).map(k => ({ key: k, label: seen[k], color: _STATUS_COLORS[k] || CLR.muted }));
    if (merged.length) cols = merged;
  }
  const statusSet = new Set(tickets.map(t => t.status));
  if (statusSet.has('blocked') && !cols.find(c => c.key === 'blocked')) {
    const idx = cols.findIndex(c => c.key === 'inprog');
    cols.splice(idx >= 0 ? idx + 1 : 1, 0, { key: 'blocked', label: 'Bloqué', color: _STATUS_COLORS.blocked });
  }
  // Si "Masquer terminés" actif, retirer la colonne done
  if (_amelHideDone) cols = cols.filter(c => c.key !== 'done');

  // KPIs sur tickets filtrés
  const todo    = tickets.filter(t => t.status === 'todo' || t.status === 'backlog').length;
  const inprog  = tickets.filter(t => t.status === 'inprog' || t.status === 'review' || t.status === 'test').length;
  const blocked = tickets.filter(t => t.status === 'blocked').length;
  const done    = tickets.filter(t => isDone(t.status)).length;
  const total   = tickets.length;
  const pctDone = total ? Math.round(done / total * 100) : 0;

  // Group tickets by swimlane
  const swimlanes = _amelSwimlanes();
  const byLane = {};
  swimlanes.forEach(s => { byLane[s.key] = []; });
  tickets.forEach(t => {
    const cat = _amelCategory(t);
    if (byLane[cat]) byLane[cat].push(t);
    else byLane['retro'].push(t);
  });

  // Stats par swimlane (sur ticketsForCounts : filtre PI applique mais pas filtres rapides)
  const laneStats = {};
  swimlanes.forEach(s => {
    const laneAll = ticketsForCounts.filter(t => _amelCategory(t) === s.key);
    const laneDone = laneAll.filter(t => isDone(t.status));
    const lanePts = laneAll.reduce((a, t) => a + (t.points || 0), 0);
    const laneDonePts = laneDone.reduce((a, t) => a + (t.points || 0), 0);
    laneStats[s.key] = {
      total: laneAll.length,
      done: laneDone.length,
      pct: laneAll.length ? Math.round(laneDone.length / laneAll.length * 100) : 0,
      pts: lanePts,
      donePts: laneDonePts,
    };
  });

  // PI Burnup data
  const burnup = _amelPIBurnup(allTickets);

  const gridCols = cols.map(() => 'minmax(220px,1fr)').join(' ');
  let html = '';

  // ===== TOP BAR : selecteur PI + groupBy + hide done + export =====
  const currentPiNum = _amelGetPI() || '';
  const piOptions = typeof _piSelectOptions === 'function'
    ? _piSelectOptions(currentPiNum, { allOption: '(tous les PI)' })
    : `<option value="">(tous)</option>`;
  html += `<div class="amel-topbar">
    <div class="amel-pi-selector">
      <label class="amel-pi-label">🎯 PI Adapt :</label>
      <select class="rm-pi-select" onchange="_amelSelectPI(this.value)">${piOptions}</select>
    </div>
    <div class="amel-groupby">
      <label class="amel-pi-label">Tri :</label>
      <select class="rm-pi-select" onchange="_amelSetGroupBy(this.value)">
        <option value="parent"${_amelGroupBy==='parent'?' selected':''}>📂 Parent</option>
        <option value="assignee"${_amelGroupBy==='assignee'?' selected':''}>👤 Assigné</option>
        <option value="team"${_amelGroupBy==='team'?' selected':''}>🏷️ Équipe</option>
        <option value="updated"${_amelGroupBy==='updated'?' selected':''}>📅 Mise à jour</option>
        <option value="priority"${_amelGroupBy==='priority'?' selected':''}>🎯 Priorité</option>
      </select>
    </div>
    <button class="amel-hide-done${_amelHideDone?' active':''}" onclick="_amelToggleHideDone()" title="Masquer/Afficher la colonne Terminé">
      ${_amelHideDone ? '👁️ Afficher terminés' : '🙈 Masquer terminés'}
    </button>
  </div>`;

  // ===== Filtres rapides =====
  const teamOptions = allTeamsInTickets.map(t =>
    `<option value="${t}"${_amelTeamFilter===t?' selected':''}>${escapeHtml(CONFIG.teams[t]?.name || t)}</option>`
  ).join('');
  const hasFilters = _amelFilter || _amelTeamFilter || _amelTextFilter;
  html += `<div class="amel-quick-filters">
    <button class="sqf-btn${_amelFilter==='blocked'?' active danger':''}${cntBlocked===0?' sqf-btn-empty':''}" onclick="_amelSetFilter('blocked')"${cntBlocked===0?' disabled':''}>🚫 Bloqués<span class="sqf-count">${cntBlocked}</span></button>
    <button class="sqf-btn${_amelFilter==='unassigned'?' active':''}${cntUnassigned===0?' sqf-btn-empty':''}" onclick="_amelSetFilter('unassigned')"${cntUnassigned===0?' disabled':''}>👤 Non assignés<span class="sqf-count">${cntUnassigned}</span></button>
    <button class="sqf-btn${_amelFilter==='critical'?' active':''}${cntCritical===0?' sqf-btn-empty':''}" onclick="_amelSetFilter('critical')"${cntCritical===0?' disabled':''}>🔴 Critique<span class="sqf-count">${cntCritical}</span></button>
    <button class="sqf-btn${_amelFilter==='stale'?' active':''}${cntStale===0?' sqf-btn-empty':''}" onclick="_amelSetFilter('stale')"${cntStale===0?' disabled':''} title="Tickets sans mise à jour depuis 60+ jours">⏳ Stale<span class="sqf-count">${cntStale}</span></button>
    ${allTeamsInTickets.length > 1 ? `<select class="sqf-select${_amelTeamFilter?' active':''}" onchange="_amelSetTeamFilter(this.value)" title="Filtrer par équipe">
      <option value="">🏷️ Toutes équipes</option>${teamOptions}
    </select>` : ''}
    <input id="amel-search-input" class="sqf-input" type="text" placeholder="🔍 Rechercher…" value="${escapeHtml(_amelTextFilter)}" oninput="_amelSetText(this.value)">
    ${hasFilters ? `<button class="sqf-btn" onclick="_amelClearFilters()">✕ Effacer</button>` : ''}
  </div>`;

  // ===== KPI bar avec compteurs par swimlane =====
  html += `<div class="amel-kpi-bar">
    <div class="amel-kpi"><span class="amel-kpi-val">${total}</span><span class="amel-kpi-label">Total</span></div>
    <div class="amel-kpi amel-kpi-todo"><span class="amel-kpi-val">${todo}</span><span class="amel-kpi-label">À faire</span></div>
    <div class="amel-kpi amel-kpi-wip"><span class="amel-kpi-val">${inprog}</span><span class="amel-kpi-label">En cours</span></div>
    ${blocked ? `<div class="amel-kpi amel-kpi-blocked"><span class="amel-kpi-val">${blocked}</span><span class="amel-kpi-label">Bloqué</span></div>` : ''}
    <div class="amel-kpi amel-kpi-done${_amelHideDone?' amel-kpi-disabled':''}"${_amelHideDone?' title="Masqué : activez \'Afficher terminés\' pour voir"':''}><span class="amel-kpi-val">${done}</span><span class="amel-kpi-label">Terminé</span></div>
    <div class="amel-kpi amel-kpi-pct${_amelHideDone?' amel-kpi-disabled':''}"${_amelHideDone?' title="Non significatif : tickets terminés masqués"':''}><span class="amel-kpi-val">${pctDone}%</span><span class="amel-kpi-label">Avancement</span></div>
  </div>`;

  // KPI par swimlane
  html += `<div class="amel-swimlane-kpis">${swimlanes.map(s => {
    const st = laneStats[s.key];
    if (!st || !st.total) return '';
    return `<div class="amel-sl-kpi" style="border-left:3px solid ${s.color}">
      <span class="amel-sl-kpi-icon">${s.icon}</span>
      <span class="amel-sl-kpi-name">${escapeHtml(s.label)}</span>
      <span class="amel-sl-kpi-val">${st.done}/${st.total}</span>
      <div class="amel-sl-kpi-bar"><div class="amel-sl-kpi-fill" style="width:${st.pct}%;background:${s.color}"></div></div>
      <span class="amel-sl-kpi-pct" style="color:${s.color}">${st.pct}%</span>
    </div>`;
  }).join('')}</div>`;

  // ===== PI Burnup chart (mini) =====
  if (burnup.length >= 2) {
    const maxTotal = Math.max(...burnup.map(b => b.total), 1);
    const selectedPi = currentPiNum ? parseInt(currentPiNum) : null;
    const isAllPI = !currentPiNum;
    html += `<div class="amel-burnup">
      <div class="amel-burnup-title" title="Tickets ayant à la fois un label Adapt/Amélioration ET un label PI{N}">
        📈 Évolution Adapt PI sur ${burnup.length} PIs <span style="font-weight:400;color:var(--text-muted);font-size:11px;">(swimlane Adapt uniquement)</span>
        ${selectedPi ? `<button class="amel-burnup-clear" onclick="_amelSelectPI('')" title="Afficher tous les PI">✕ PI${selectedPi}</button>` : ''}
      </div>
      <div class="amel-burnup-chart">
        <div class="amel-burnup-col amel-burnup-col-all${isAllPI ? ' amel-burnup-col-selected' : ''}" onclick="_amelSelectPI('')" title="Afficher tous les PI (pas de filtre)${isAllPI ? ' · sélectionné' : ''}">
          <div class="amel-burnup-bar-wrap" style="height:60px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:20px;">🌐</span>
          </div>
          <div class="amel-burnup-label">Tous${isAllPI ? ' ★' : ''}</div>
          <div class="amel-burnup-val">les PI</div>
        </div>
        ${burnup.map(b => {
          const totalH = Math.round(b.total / maxTotal * 60);
          const doneH = Math.round(b.done / maxTotal * 60);
          const pct = b.total ? Math.round(b.done / b.total * 100) : 0;
          const isSelected = selectedPi === b.pi;
          return `<div class="amel-burnup-col${isSelected ? ' amel-burnup-col-selected' : ''}" onclick="_amelSelectPI('${isSelected ? '' : b.pi}')" title="PI${b.pi} : ${b.done}/${b.total} terminés (${pct}%)${isSelected ? ' · cliquer pour désélectionner' : ' · cliquer pour sélectionner'}">
            <div class="amel-burnup-bar-wrap" style="height:60px;">
              <div class="amel-burnup-bar-total" style="height:${totalH}px"></div>
              <div class="amel-burnup-bar-done" style="height:${doneH}px"></div>
            </div>
            <div class="amel-burnup-label">PI${b.pi}${isSelected ? ' ★' : ''}</div>
            <div class="amel-burnup-val">${b.done}/${b.total}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // ===== Sticky column headers =====
  // Compteurs de colonne : somme des tickets affiches dans toutes les swimlanes
  // (tous les tickets visibles dans la colonne du tableau, toutes swimlanes confondues)
  // Pour la colonne 'done', on utilise isDone() pour matcher tous les statuts termines
  const _matchCol = (t, col) => {
    if (col.key === 'done') return isDone(t.status);
    if (col.key === 'inprog') return t.status === 'inprog' || t.status === 'blocked';
    return t.status === col.key;
  };
  html += `<div class="amel-board">`;
  html += `<div class="board-sticky-bar" style="grid-template-columns:${gridCols}">${cols.map(col => {
    const cnt = tickets.filter(t => _matchCol(t, col)).length;
    const cat = statusCat(col.key);
    return `<div class="col-header" data-cat="${cat}" title="Total tickets visibles dans cette colonne (toutes swimlanes)">
      <div class="col-title"><span class="pi-status-dot" style="background:${col.color};"></span><span class="col-label">${col.label}</span></div>
      <span class="col-count">${cnt}</span>
    </div>`;
  }).join('')}</div>`;

  // ===== Board with swimlanes =====
  html += `<div class="board-main-grid" style="grid-template-columns:${gridCols}">`;

  swimlanes.forEach(lane => {
    const laneTickets = byLane[lane.key] || [];
    if (!laneTickets.length) return;

    const collapsed = !!_amelLaneCollapsed[lane.key];
    const arrow = collapsed ? '▶' : '▼';
    const openCnt = laneTickets.filter(t => !isDone(t.status)).length;
    const laneDone = laneTickets.filter(t => isDone(t.status)).length;
    const lanePct = laneTickets.length ? Math.round(laneDone / laneTickets.length * 100) : 0;

    const laneTip = lane.tooltip ? escapeHtml(lane.tooltip) : '';
    const jiraBase = (CONFIG.jira?.url || '').replace(/\/$/, '');
    const jiraLink = lane.jql && jiraBase && !jiraBase.includes('votre-jira')
      ? `<a class="amel-lane-jira" href="${jiraBase}/issues/?jql=${encodeURIComponent(lane.jql)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Voir tous dans JIRA">📋</a>`
      : '';

    html += `<div class="board-lane-header amel-lane-sticky" onclick="_toggleAmelLane('${lane.key}')" title="${laneTip}" style="grid-column:1/-1;">
      <span class="swimlane-arrow">${arrow}</span>
      <span class="swimlane-icon" style="color:${lane.color};">●</span>
      <span class="swimlane-title">${lane.icon} ${escapeHtml(lane.label)}</span>
      <span class="col-count">${laneTickets.length}</span>
      <span class="swimlane-hint">${openCnt} ouvert${openCnt > 1 ? 's' : ''}</span>
      <div class="amel-lane-progress" title="${lanePct}% terminé"><div class="amel-lane-progress-fill" style="width:${lanePct}%;background:${lane.color}"></div></div>
      <span class="amel-lane-pct" style="color:${lane.color}">${lanePct}%</span>
      ${lane.tooltip ? `<span class="swimlane-info" title="${laneTip}">ℹ️</span>` : ''}
      ${jiraLink}
    </div>`;

    if (!collapsed) {
      const featIds = new Set([...FEATURES.map(f => f.id), ...EPICS.map(e => e.id)]);
      cols.forEach(col => {
        const colTickets = laneTickets.filter(t => _matchCol(t, col));
        const ordered = _amelOrderTickets(colTickets, featIds);
        html += `<div class="board-col board-col-lane${!colTickets.length ? ' col-empty-state' : ''}">
          <div class="col-body">${ordered.map(o => _amelTicketCard(o.ticket, o.isChild)).join('') || '<div class="col-empty"></div>'}</div>
        </div>`;
      });
    }
  });

  html += `</div></div>`;

  el.innerHTML = html;
  window._modalTicketList = tickets.map(t => t.id);

  // Restaurer le focus de l'input recherche apres re-render
  if (_amelFocusRestore) {
    const newInput = document.getElementById('amel-search-input');
    if (newInput) {
      newInput.focus();
      try { newInput.setSelectionRange(_amelFocusRestore.selStart, _amelFocusRestore.selEnd); } catch (e) {}
    }
  }

  // Sticky offset
  const stickyBar = el.querySelector('.board-sticky-bar');
  const mainGrid  = el.querySelector('.board-main-grid');
  if (stickyBar) {
    const stickyBottom = stickyBar.getBoundingClientRect().height - 24;
    el.querySelectorAll('.amel-lane-sticky').forEach(lh => { lh.style.top = stickyBottom + 'px'; });
    if (mainGrid) {
      mainGrid.addEventListener('scroll', () => { stickyBar.scrollLeft = mainGrid.scrollLeft; });
    }
  }
}

// ----- Tri / groupement des tickets dans une colonne -----
function _amelOrderTickets(colTickets, featIds) {
  if (_amelGroupBy === 'assignee') {
    return [...colTickets].sort((a, b) => (a.assignee || 'zzz').localeCompare(b.assignee || 'zzz')).map(t => ({ ticket: t, isChild: false }));
  }
  if (_amelGroupBy === 'team') {
    return [...colTickets].sort((a, b) => (a.team || 'zzz').localeCompare(b.team || 'zzz')).map(t => ({ ticket: t, isChild: false }));
  }
  if (_amelGroupBy === 'updated') {
    return [...colTickets].sort((a, b) => {
      const da = new Date(a.updatedAt || a.updated || 0).getTime();
      const db = new Date(b.updatedAt || b.updated || 0).getTime();
      return db - da; // recent en premier
    }).map(t => ({ ticket: t, isChild: false }));
  }
  if (_amelGroupBy === 'priority') {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...colTickets].sort((a, b) => (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4)).map(t => ({ ticket: t, isChild: false }));
  }
  // Defaut : par parent (hierarchique)
  const parents = colTickets.filter(t => featIds.has(t.id));
  const parentIds = new Set(parents.map(p => p.id));
  const orphans = colTickets.filter(t => !parentIds.has(t.id) && (!t.epic || !parentIds.has(t.epic)));
  const ordered = [];
  parents.forEach(p => {
    ordered.push({ ticket: p, isChild: false });
    colTickets
      .filter(c => c.epic === p.id && !parentIds.has(c.id))
      .forEach(c => ordered.push({ ticket: c, isChild: true, parentId: p.id }));
  });
  orphans.forEach(o => ordered.push({ ticket: o, isChild: false }));
  return ordered;
}

function _amelTicketCard(t, isChild = false) {
  const epic        = EPICS.find(e => e.id === t.epic);
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const isBlocked   = t.status === 'blocked';
  const statusBadge = isBlocked ? '<span class="sc-flag-badge">⚠ Bloqué</span>' : '';
  const cat         = _amelCategory(t);
  const lane        = _amelSwimlanes().find(s => s.key === cat);
  const laneBadge   = lane ? `<span class="badge" style="background:${lane.color}22;color:${lane.color};font-size:10px;">${lane.icon}</span>` : '';
  const childCls    = isChild ? ' amel-child-card' : '';
  const teamColor   = t.team ? (typeof _teamColor === 'function' ? _teamColor(t.team) : (CONFIG.teams[t.team]?.color || CLR.slate)) : null;
  const ageDays     = _amelAgeDays(t);
  const ageBadge    = _amelAgeBadge(ageDays);
  const source      = _amelSource(t);
  const sourceBadge = source ? `<span class="amel-source" style="background:${source.color}18;color:${source.color};border:1px solid ${source.color}40" title="Source : ${source.label}">${source.icon}</span>` : '';

  // Date cible
  let dueBadge = '';
  if (t.dueDate) {
    const dd = new Date(t.dueDate.length === 10 ? t.dueDate + 'T00:00:00' : t.dueDate);
    if (!isNaN(dd)) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const diff = Math.ceil((dd - now) / 86400000);
      const dateStr = dd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const overdue = diff < 0 && !isDone(t.status);
      const soon = diff >= 0 && diff <= 3 && !isDone(t.status);
      const cls = overdue ? 'amel-due-overdue' : soon ? 'amel-due-soon' : 'amel-due-ok';
      const suffix = overdue ? ` (${Math.abs(diff)}j retard)` : diff === 0 ? ' (auj.)' : diff <= 7 && !isDone(t.status) ? ` (J-${diff})` : '';
      dueBadge = `<span class="amel-due ${cls}" title="Date cible : ${dateStr}${suffix}">📅 ${dateStr}${suffix}</span>`;
    }
  }

  // Tooltip avec description courte
  const descShort = (t.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const titleAttr = descShort ? escapeHtml(descShort + ((t.description || '').length > 200 ? '…' : '')) : escapeHtml(t.title || '');
  const teamBorder = teamColor ? `border-left:4px solid ${teamColor};` : '';

  return `<div class="ticket-card type-${t.type}${isBlocked ? ' blocked' : ''}${childCls}" onclick="openModal('${t.id}')" data-ticket-id="${t.id}" title="${titleAttr}" style="${teamBorder}">
    <div class="ticket-top">
      <span class="ticket-prio-key">${isChild ? '<span class="amel-child-arrow">↳</span>' : ''}${priorityIcon(t.priority)}<span class="ticket-key">${_jiraBrowse(t.id)}</span></span>
      <div class="amel-card-right">
        ${dueBadge}
        ${ptsBadge(t.points, {size:'small'})}
      </div>
    </div>
    <div class="ticket-title">${escapeHtml(t.title)}</div>
    <div class="ticket-meta">
      <span class="badge badge-${t.type}">${typeName(t.type)}</span>
      ${epicTag(epic, t.epic)}
      ${avatarBadge(t.assignee, avatarColor)}
      ${statusBadge}
      ${laneBadge}
      ${sourceBadge}
      ${ageBadge}
    </div>
  </div>`;
}
