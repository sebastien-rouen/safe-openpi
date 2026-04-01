// ============================================================
// AMELIORATION CONTINUE - Board rétro / post-mortem / CoP
// ============================================================

// Swimlane categorization based on labels/summary
function _amelCategory(t) {
  const labels = (t.labels || []).map(l => l.toLowerCase());
  const sum    = (t.title || '').toLowerCase();

  // Post-Mortem
  if (labels.some(l => l === 'postmortem') || /post-?mortem/i.test(sum)) return 'postmortem';

  // CoP Méthodo
  if (labels.some(l => ['cop-méthodo','cop-dev','methodo'].includes(l)) || /\bcop\b/i.test(sum)) return 'cop';

  // Rétrospective (default)
  return 'retro';
}

const _AMEL_SWIMLANES = [
  { key: 'retro',      label: 'Rétrospective',  icon: '🔄', color: '#2563EB' },
  { key: 'postmortem', label: 'Post-Mortem',     icon: '🔍', color: '#EF4444' },
  { key: 'cop',        label: 'CoP Méthodo',     icon: '🤝', color: '#8B5CF6' },
];

let _amelLaneCollapsed = {};

function _toggleAmelLane(key) {
  _amelLaneCollapsed[key] = !_amelLaneCollapsed[key];
  renderAmelioration();
}

function renderAmelioration() {
  const el = document.getElementById('amelioration-content');
  if (!el) return;

  const tickets = AMELIORATION_TICKETS;

  if (!tickets.length) {
    el.innerHTML = '<div class="empty-state">Aucun ticket d\'amélioration continue trouvé.<br><small>Synchronisez pour charger les données depuis JIRA.</small></div>';
    return;
  }

  // Build columns from board config or use defaults
  const defaultCols = [
    { key: 'todo',   label: 'À faire',  color: _STATUS_COLORS.todo },
    { key: 'inprog', label: 'En cours',  color: _STATUS_COLORS.inprog },
    { key: 'review', label: 'En review', color: _STATUS_COLORS.review },
    { key: 'done',   label: 'Terminé',   color: _STATUS_COLORS.done },
  ];

  // Use BOARD_COLUMNS if available, otherwise defaults
  let cols = defaultCols;
  if (BOARD_COLUMNS && Object.keys(BOARD_COLUMNS).length) {
    // Merge all team columns
    const _ORDER = ['backlog','todo','inprog','review','test','done'];
    const seen = {};
    for (const tc of Object.values(BOARD_COLUMNS)) {
      for (const c of tc) {
        if (!c.internal) continue;
        if (!seen[c.internal]) seen[c.internal] = c.name;
      }
    }
    const merged = _ORDER
      .filter(k => seen[k])
      .map(k => ({ key: k, label: seen[k], color: _STATUS_COLORS[k] || CLR.muted }));
    if (merged.length) cols = merged;
  }

  // Add blocked column if needed
  const statusSet = new Set(tickets.map(t => t.status));
  if (statusSet.has('blocked') && !cols.find(c => c.key === 'blocked')) {
    const idx = cols.findIndex(c => c.key === 'inprog');
    cols.splice(idx >= 0 ? idx + 1 : 1, 0, { key: 'blocked', label: 'Bloqué', color: _STATUS_COLORS.blocked });
  }

  // KPIs
  const todo    = tickets.filter(t => t.status === 'todo' || t.status === 'backlog').length;
  const inprog  = tickets.filter(t => t.status === 'inprog' || t.status === 'review' || t.status === 'test').length;
  const blocked = tickets.filter(t => t.status === 'blocked').length;
  const done    = tickets.filter(t => isDone(t.status)).length;
  const total   = tickets.length;
  const pctDone = total ? Math.round(done / total * 100) : 0;

  // Group tickets by swimlane
  const byLane = {};
  _AMEL_SWIMLANES.forEach(s => { byLane[s.key] = []; });
  tickets.forEach(t => {
    const cat = _amelCategory(t);
    if (byLane[cat]) byLane[cat].push(t);
    else byLane['retro'].push(t);
  });

  // Grid columns CSS
  const gridCols = cols.map(() => 'minmax(220px,1fr)').join(' ');

  // Build HTML
  let html = '';

  // KPI bar
  html += `<div class="amel-kpi-bar">
    <div class="amel-kpi"><span class="amel-kpi-val">${total}</span><span class="amel-kpi-label">Total</span></div>
    <div class="amel-kpi amel-kpi-todo"><span class="amel-kpi-val">${todo}</span><span class="amel-kpi-label">À faire</span></div>
    <div class="amel-kpi amel-kpi-wip"><span class="amel-kpi-val">${inprog}</span><span class="amel-kpi-label">En cours</span></div>
    ${blocked ? `<div class="amel-kpi amel-kpi-blocked"><span class="amel-kpi-val">${blocked}</span><span class="amel-kpi-label">Bloqué</span></div>` : ''}
    <div class="amel-kpi amel-kpi-done"><span class="amel-kpi-val">${done}</span><span class="amel-kpi-label">Terminé</span></div>
    <div class="amel-kpi amel-kpi-pct"><span class="amel-kpi-val">${pctDone}%</span><span class="amel-kpi-label">Avancement</span></div>
  </div>`;

  // Progress bar
  const pctWip = total ? Math.round(inprog / total * 100) : 0;
  html += `<div class="amel-progress">
    <div class="progress-bar amel-progress-bar">
      <div class="progress-fill" style="width:${pctDone}%;"></div>
      <div class="progress-fill-wip" style="width:${pctWip}%;left:${pctDone}%;"></div>
      <span class="amel-progress-label">${pctDone}% — ${done}/${total} tickets</span>
    </div>
  </div>`;

  // Sticky column headers
  html += `<div class="amel-board">`;
  html += `<div class="board-sticky-bar" style="grid-template-columns:${gridCols}">${cols.map(col => {
    const cnt = tickets.filter(t => t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')).length;
    const cat = statusCat(col.key);
    return `<div class="col-header" data-cat="${cat}">
      <div class="col-title"><span class="pi-status-dot" style="background:${col.color};"></span><span class="col-label">${col.label}</span></div>
      <span class="col-count">${cnt}</span>
    </div>`;
  }).join('')}</div>`;

  // Board with swimlanes
  html += `<div class="board-main-grid" style="grid-template-columns:${gridCols}">`;

  _AMEL_SWIMLANES.forEach(lane => {
    const laneTickets = byLane[lane.key] || [];
    if (!laneTickets.length) return;

    const collapsed = !!_amelLaneCollapsed[lane.key];
    const arrow = collapsed ? '▶' : '▼';
    const openCnt = laneTickets.filter(t => !isDone(t.status)).length;

    html += `<div class="board-lane-header amel-lane-sticky" onclick="_toggleAmelLane('${lane.key}')" style="grid-column:1/-1;">
      <span class="swimlane-arrow">${arrow}</span>
      <span class="swimlane-icon" style="color:${lane.color};">●</span>
      <span class="swimlane-title">${lane.icon} ${lane.label}</span>
      <span class="col-count">${laneTickets.length}</span>
      <span class="swimlane-hint">${openCnt} ouvert${openCnt > 1 ? 's' : ''}</span>
    </div>`;

    if (!collapsed) {
      cols.forEach(col => {
        const colTickets = laneTickets.filter(t =>
          t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')
        );
        html += `<div class="board-col board-col-lane${!colTickets.length ? ' col-empty-state' : ''}">
          <div class="col-body">${colTickets.map(t => _amelTicketCard(t)).join('') || '<div class="col-empty"></div>'}</div>
        </div>`;
      });
    }
  });

  html += `</div></div>`;

  el.innerHTML = html;

  // Pre-set modal navigation context for this view
  window._modalTicketList = tickets.map(t => t.id);

  // Set sticky top for swimlane headers based on actual sticky bar height
  const stickyBar = el.querySelector('.board-sticky-bar');
  const mainGrid  = el.querySelector('.board-main-grid');
  if (stickyBar) {
    const stickyBottom = stickyBar.getBoundingClientRect().height - 24;
    el.querySelectorAll('.amel-lane-sticky').forEach(lh => {
      lh.style.top = stickyBottom + 'px';
    });
    // Sync horizontal scroll between sticky bar and main grid
    if (mainGrid) {
      mainGrid.addEventListener('scroll', () => { stickyBar.scrollLeft = mainGrid.scrollLeft; });
    }
  }
}

function _amelTicketCard(t) {
  const epic        = EPICS.find(e => e.id === t.epic);
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const isBlocked   = t.status === 'blocked';
  const statusBadge = isBlocked ? '<span class="sc-flag-badge">⚠ Bloqué</span>' : '';
  const cat         = _amelCategory(t);
  const lane        = _AMEL_SWIMLANES.find(s => s.key === cat);
  const laneBadge   = lane ? `<span class="badge" style="background:${lane.color}22;color:${lane.color};font-size:10px;">${lane.icon}</span>` : '';

  return `<div class="ticket-card type-${t.type}${isBlocked ? ' blocked' : ''}" onclick="openModal('${t.id}')" data-ticket-id="${t.id}">
    <div class="ticket-top">
      <span class="ticket-prio-key">${priorityIcon(t.priority)}<span class="ticket-key">${_jiraBrowse(t.id)}</span></span>
      ${ptsBadge(t.points, {size:'small'})}
    </div>
    <div class="ticket-title">${escapeHtml(t.title)}</div>
    <div class="ticket-meta">
      <span class="badge badge-${t.type}">${typeName(t.type)}</span>
      ${epicTag(epic, t.epic)}
      ${avatarBadge(t.assignee, avatarColor)}
      ${statusBadge}
      ${laneBadge}
    </div>
  </div>`;
}
