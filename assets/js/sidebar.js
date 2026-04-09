// ============================================================
// SIDEBAR PANELS - Progress, Buffer, Objectives, Risks, Stats
// Extracted from scrum.js — all functions remain global.
// ============================================================

// Standalone sidebar progress - callable from any view / init
function _renderSidebarProgress() {
  const sbWrap = document.getElementById('sb-progress-wrap');
  if (!sbWrap) return;
  const tickets  = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const done     = tickets.filter(t => isDone(t.status));
  const inprog   = tickets.filter(t => t.status === 'inprog');
  const review   = tickets.filter(t => t.status === 'review');
  const test     = tickets.filter(t => t.status === 'test');
  const blocked  = tickets.filter(t => t.status === 'blocked');
  const todo     = tickets.filter(t => t.status === 'todo' || t.status === 'backlog');
  const flagged  = tickets.filter(t => t.flagged && !isDone(t.status));
  const ptsDone  = done.reduce((a, t) => a + (t.points || 0), 0);
  const ptsTotal = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const pct      = ptsTotal > 0 ? Math.round(ptsDone / ptsTotal * 100) : 0;
  const bufferTk  = tickets.filter(t => t.buffer);
  const bufferPts = bufferTk.reduce((a, t) => a + (t.points || 0), 0);
  const pctTk     = tickets.length ? Math.round(done.length / tickets.length * 100) : 0;
  const sbBufDone = bufferTk.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const sbFeatPct = ptsTotal > 0 ? Math.round((ptsDone - sbBufDone) / ptsTotal * 100) : 0;
  const sbBufPct  = ptsTotal > 0 ? Math.round(sbBufDone / ptsTotal * 100) : 0;
  const sbBufTip  = `Buffer : ${sbBufDone}/${bufferPts} pts done (${bufferTk.length} tickets)`;

  // Build ticket list HTML for popins
  const _ticketRow = t => {
    const st = isDone(t.status) ? '✅' : t.status === 'blocked' ? '🚧' : t.status === 'inprog' || t.status === 'review' ? '🔵' : t.status === 'test' ? '🧪' : '⬜';
    const typeClr = CONFIG.typeColors?.[t.type] || '#94A3B8';
    const assignee = t.assignee ? t.assignee.split(' ')[0] : '';
    return `<div class="sb-buf-ticket" onclick="openModal('${t.id}')">
      <span>${st}</span>
      <span class="sb-buf-ticket-id">${t.id}</span>
      <span class="sb-buf-ticket-type" style="background:${typeClr}22;color:${typeClr};">${typeName(t.type || 'story')}</span>
      <span class="sb-buf-ticket-title">${escapeHtml(t.title)}</span>
      ${assignee ? `<span class="sb-buf-ticket-assignee">${escapeHtml(assignee)}</span>` : ''}
      <span class="sb-buf-ticket-pts">${t.points || 0} pts</span>
    </div>`;
  };

  const _statRow = (id, label, count, colorCls, ticketList) => {
    if (!count) return '';
    const pts = ticketList.reduce((a, t) => a + (t.points || 0), 0);
    return `<div class="stat-row sb-stat-hoverable" data-sb-tip="${id}">
      <span class="stat-label">${label}</span>
      <span class="stat-val ${colorCls}">${count}</span>
      <div class="sb-buffer-tip sb-stat-tip" id="sb-stat-tip-${id}">
        <div class="sb-buf-tip-title">${label}</div>
        <div class="sb-buf-tip-summary"><span>${count} ticket${count > 1 ? 's' : ''} · ${pts} pts</span></div>
        ${ticketList.map(_ticketRow).join('')}
      </div>
    </div>`;
  };

  sbWrap.innerHTML = `
    <div class="sb-prog-bar">
      <div class="sb-prog-fill" style="width:${sbFeatPct}%" title="Feature : ${ptsDone - sbBufDone} pts done"></div>
      ${sbBufPct > 0 ? `<div class="sb-prog-buf" style="width:${sbBufPct}%;left:${sbFeatPct}%" title="${sbBufTip}"></div>` : ''}
    </div>
    <div class="stat-row"><span class="stat-label">${pct}% pts · ${pctTk}% tickets</span><span class="stat-val green">${ptsDone}/${ptsTotal} pts</span></div>
    ${_statRow('todo', 'À faire', todo.length, '', todo)}
    ${_statRow('wip', 'En cours / Review', inprog.length + review.length, 'blue', [...inprog, ...review])}
    ${test.length ? _statRow('test', 'En test', test.length, 'blue', test) : ''}
    ${_statRow('done', 'Done', done.length, 'green', done)}
    ${_statRow('blocked', 'Bloqués', blocked.length, 'red', blocked)}
    ${_statRow('flagged', '🚩 Flaggés', flagged.length, 'red', flagged)}
  `;

  // Attach hover events for stat-row popins (avec helper anti-scrollbar)
  sbWrap.querySelectorAll('.sb-stat-hoverable').forEach(row => {
    const tipId = row.dataset.sbTip;
    const tip = document.getElementById('sb-stat-tip-' + tipId);
    if (!tip) return;
    // Hide les autres stat tips au show
    row.addEventListener('mouseenter', () => {
      sbWrap.querySelectorAll('.sb-stat-tip').forEach(t => { if (t !== tip) t.style.display = 'none'; });
    });
    _attachSidebarHoverTip(row, tip);
  });
}

// ----- Helper : tooltip robuste avec zone 'pont' (gere la scrollbar entre source et tooltip) -----
let _sbHoverMouse = { x: 0, y: 0 };
if (!window._sbHoverMouseTracker) {
  window._sbHoverMouseTracker = true;
  document.addEventListener('mousemove', e => { _sbHoverMouse = { x: e.clientX, y: e.clientY }; });
}
function _attachSidebarHoverTip(source, tip) {
  if (!source || !tip) return;
  let _timer = null;
  const _isOver = (el, m = 8) => {
    const r = el.getBoundingClientRect();
    return _sbHoverMouse.x >= r.left - m && _sbHoverMouse.x <= r.right + m
        && _sbHoverMouse.y >= r.top - m && _sbHoverMouse.y <= r.bottom + m;
  };
  const _isInBridge = () => {
    const cr = source.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    if (tr.width === 0) return false;
    const minX = Math.min(cr.right, tr.right);
    const maxX = Math.max(cr.left, tr.left);
    const minY = Math.min(cr.top, tr.top);
    const maxY = Math.max(cr.bottom, tr.bottom);
    return _sbHoverMouse.x >= minX - 6 && _sbHoverMouse.x <= maxX + 6
        && _sbHoverMouse.y >= minY && _sbHoverMouse.y <= maxY;
  };
  const showTip = () => {
    clearTimeout(_timer);
    const rect = source.getBoundingClientRect();
    tip.style.display = 'block';
    const tipW = 500;
    if (rect.right + tipW + 16 < window.innerWidth) {
      tip.style.left = (rect.right + 8) + 'px';
    } else {
      tip.style.left = Math.max(8, rect.left - tipW - 8) + 'px';
    }
    tip.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - tip.offsetHeight - 8)) + 'px';
  };
  const hideTip = () => {
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      if (_isOver(source) || _isOver(tip) || _isInBridge()) { hideTip(); return; }
      tip.style.display = 'none';
    }, 350);
  };
  source.addEventListener('mouseenter', showTip);
  source.addEventListener('mouseleave', hideTip);
  tip.addEventListener('mouseenter', () => clearTimeout(_timer));
  tip.addEventListener('mouseleave', hideTip);
}

// --- Sidebar: Buffer info with hover popin ---
function _renderSidebarBuffer() {
  const el = document.getElementById('sb-buffer-wrap');
  if (!el) return;
  const tickets = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const bufferTk = tickets.filter(t => t.buffer);
  if (!bufferTk.length) { el.innerHTML = ''; return; }
  const totalPts = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const bufPts   = bufferTk.reduce((a, t) => a + (t.points || 0), 0);
  const bufDone  = bufferTk.filter(t => isDone(t.status));
  const bufDonePts = bufDone.reduce((a, t) => a + (t.points || 0), 0);
  const bufInprog = bufferTk.filter(t => t.status === 'inprog' || t.status === 'review');
  const bufBlocked = bufferTk.filter(t => t.status === 'blocked');
  const bufTodo   = bufferTk.filter(t => !isDone(t.status) && t.status !== 'inprog' && t.status !== 'review' && t.status !== 'blocked');
  const pct = bufPts ? Math.round(bufDonePts / bufPts * 100) : 0;
  const pctClr = pct >= 70 ? '#34D399' : pct >= 30 ? '#F59E0B' : '#F87171';
  const bufRatio = totalPts ? Math.round(bufPts / totalPts * 100) : 0;

  // Group buffer tickets by team
  const byTeam = {};
  bufferTk.forEach(t => {
    const team = t.team || '?';
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(t);
  });

  const teamSections = Object.entries(byTeam).map(([team, tks]) => {
    const teamConfig = CONFIG.teams[team] || {};
    const color = teamConfig.color || '#94A3B8';
    const name = teamConfig.name || team;
    const rows = tks.map(t => {
      const st = isDone(t.status) ? '✅' : t.status === 'blocked' ? '🚧' : t.status === 'inprog' || t.status === 'review' ? '🔵' : '⬜';
      const typeClr = CONFIG.typeColors?.[t.type] || '#94A3B8';
      const assignee = t.assignee ? t.assignee.split(' ')[0] : '';
      return `<div class="sb-buf-ticket" onclick="openModal('${t.id}')">
        <span>${st}</span>
        <span class="sb-buf-ticket-id">${t.id}</span>
        <span class="sb-buf-ticket-type" style="background:${typeClr}22;color:${typeClr};">${typeName(t.type || 'story')}</span>
        <span class="sb-buf-ticket-title">${escapeHtml(t.title)}</span>
        ${assignee ? `<span class="sb-buf-ticket-assignee">${escapeHtml(assignee)}</span>` : ''}
        <span class="sb-buf-ticket-pts">${t.points || 0} pts</span>
      </div>`;
    }).join('');
    const teamPts = tks.reduce((a, t) => a + (t.points || 0), 0);
    const teamDone = tks.filter(t => isDone(t.status)).length;
    return `<div class="sb-buf-team">
      <div class="sb-buf-team-header">
        <span class="sb-buf-dot" style="background:${color};"></span>
        <span class="sb-buf-team-name" style="color:${color};">${escapeHtml(name)}</span>
        <span class="sb-buf-team-stats">${teamDone}/${tks.length} · ${teamPts} pts</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  const tipHtml = `
    <div class="sb-buf-tip-title">🛡️ Détail Buffer Sprint</div>
    <div class="sb-buf-tip-summary">
      <span>${bufferTk.length} tickets · ${bufPts} pts</span>
      <span>Ratio : <strong style="color:${bufRatio > 20 ? '#F87171' : '#34D399'}">${bufRatio}%</strong> du sprint</span>
      <span>Done : <strong style="color:${pctClr}">${pct}%</strong></span>
    </div>
    ${teamSections}`;

  el.innerHTML = `<div class="sb-extra-card" id="sb-buffer-card">
    <div class="sb-extra-header">
      <span>🛡️ Buffer</span>
      <span style="font-weight:700;color:${pctClr}">${bufferTk.length} tickets · ${bufPts} pts</span>
    </div>
    <div class="sb-prog-bar" style="margin:4px 0;">
      <div class="sb-prog-fill" style="width:${pct}%;background:${pctClr}"></div>
    </div>
    <div class="sb-buf-stats">
      <span class="sb-buf-stats-done">✅ ${bufDone.length}</span>
      <span class="sb-buf-stats-wip">🔵 ${bufInprog.length}</span>
      ${bufBlocked.length ? `<span class="sb-buf-stats-blocked">🚧 ${bufBlocked.length}</span>` : ''}
      <span>⬜ ${bufTodo.length}</span>
      <span class="sb-buf-ratio">${bufRatio}% du sprint</span>
    </div>
    <div class="sb-buffer-tip" id="sb-buffer-tip-el">${tipHtml}</div>
  </div>`;

  // Tooltip robuste avec helper anti-scrollbar
  const card = document.getElementById('sb-buffer-card');
  const tip = document.getElementById('sb-buffer-tip-el');
  _attachSidebarHoverTip(card, tip);
}

// --- Sidebar: PI Objectives (collapsed) - from piprep data ---
function _renderSidebarObjectives() {
  const el = document.getElementById('sb-objectives-wrap');
  if (!el) return;
  const allObjs = typeof _ppObjList === 'function' ? _ppObjList() : [];
  const _activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const _allTeamKeys = Object.keys(CONFIG.teams || {});
  const _hasFilter = _activeTeams.length && _activeTeams.length < _allTeamKeys.length;
  const _teamSet = _hasFilter ? new Set(_activeTeams) : null;
  const objs = _teamSet ? allObjs.filter(o => _teamSet.has(o.team)) : allObjs;
  if (!objs.length) { el.innerHTML = ''; return; }

  const ST = { todo: { icon: '🔲', c: '#94A3B8' }, inprog: { icon: '🔵', c: '#3B82F6' }, done: { icon: '✅', c: '#22C55E' }, atrisk: { icon: '🔴', c: '#EF4444' } };
  const committed = objs.filter(o => o.type === 'committed');
  const stretch   = objs.filter(o => o.type === 'stretch');
  const doneCount = objs.filter(o => o.status === 'done').length;
  const atRiskCount = objs.filter(o => o.status === 'atrisk').length;
  const totalBV   = committed.reduce((s, o) => s + (parseInt(o.bv, 10) || 0), 0);

  const objRows = objs.map(o => {
    const st = ST[o.status] || ST.todo;
    const teamColor = CONFIG.teams[o.team]?.color || '#94A3B8';
    const teamName = CONFIG.teams[o.team]?.name || o.team || '';
    const isStretch = o.type === 'stretch';
    return `<div class="sb-obj-row${o.status === 'done' ? ' sb-obj-row--done' : ''}" title="${(o.title || '(sans titre)').replace(/"/g, '&quot;')} — ${teamName} · BV${o.bv || '?'}">
      <span>${st.icon}</span>
      <span class="sb-obj-dot" style="background:${teamColor};" title="${teamName}"></span>
      <span class="sb-risk-title${isStretch ? ' sb-obj-row--stretch' : ''}">${escapeHtml(o.title || '(sans titre)')}</span>
      <span class="sb-obj-bv">BV${o.bv || '?'}</span>
    </div>`;
  }).join('');

  const summaryParts = [];
  if (doneCount) summaryParts.push(`<span class="sb-obj-done">${doneCount} atteint${doneCount > 1 ? 's' : ''}</span>`);
  if (atRiskCount) summaryParts.push(`<span class="sb-obj-atrisk">${atRiskCount} à risque</span>`);

  el.innerHTML = `<details class="sb-extra-details">
    <summary class="sb-extra-header sb-extra-toggle">
      <span>🎯 Objectifs PI</span>
      <span class="sb-extra-count" style="color:#94A3B8">${objs.length}</span>
      <span class="sb-extra-chevron">›</span>
    </summary>
    <div class="sb-extra-body">
      <div class="sb-obj-summary" onclick="showView('roadmap');setTimeout(()=>_rmScrollTo('planification'),200);setTimeout(()=>{const e=document.getElementById('pp-objectives');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},400);" title="Voir les objectifs PI">
        <span>${committed.length} committed · ${stretch.length} stretch</span>
        <span>BV : ${totalBV}</span>
        ${summaryParts.join(' · ')}
      </div>
      ${objRows}
    </div>
  </details>`;
}

// --- Sidebar: Risks (collapsed) - from piprep ROAM + deps + sprint risks ---
function _renderSidebarRisks() {
  const el = document.getElementById('sb-risks-wrap');
  if (!el) return;
  const items = [];

  // Active team filter
  const _activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const _allTeamKeys = Object.keys(CONFIG.teams || {});
  const _hasFilter = _activeTeams.length && _activeTeams.length < _allTeamKeys.length;
  const _teamSet = _hasFilter ? new Set(_activeTeams) : null;

  // ROAM risks (from piprep)
  const roam = typeof _ppRoamList === 'function' ? _ppRoamList() : [];
  const roamFiltered = roam.filter(r => r.cat !== 'R' && (!_teamSet || !r.team || _teamSet.has(r.team)));
  const roamActive = roamFiltered;
  const ROAM_ICONS = { O: '👤', A: '🤝', M: '🛡️' };
  const ROAM_LABELS = { O: 'Owned', A: 'Accepted', M: 'Mitigated' };
  ['O', 'A', 'M'].forEach(cat => {
    const catItems = roamActive.filter(r => r.cat === cat);
    if (catItems.length) {
      items.push({ icon: ROAM_ICONS[cat], label: `${catItems.length} ${ROAM_LABELS[cat]}`, color: cat === 'O' ? '#F59E0B' : cat === 'A' ? '#94A3B8' : '#34D399',
        sub: catItems.map(r => r.title || '(sans titre)'), nav: 'risques' });
    }
  });

  // Dependencies (from piprep) — filtered by active teams
  const allDeps = typeof _ppDepList === 'function' ? _ppDepList() : [];
  const deps = _teamSet ? allDeps.filter(d => _teamSet.has(d.fromTeam) || _teamSet.has(d.toTeam) || (!d.fromTeam && !d.toTeam)) : allDeps;
  const interDeps = deps.filter(d => d.fromTeam !== d.toTeam || !d.fromTeam || !d.toTeam);
  const intraDeps = deps.filter(d => d.fromTeam && d.toTeam && d.fromTeam === d.toTeam);

  const _depStIcons = { todo: '🔲', inprog: '🔵', blocked: '🚧', done: '✅' };
  const _depStColors = { todo: 'var(--text-muted)', inprog: 'var(--inprog)', blocked: 'var(--blocked)', done: 'var(--success)' };

  if (interDeps.length) {
    const interDetail = interDeps.map(d => {
      const st = d.status || 'todo';
      const icon = _depStIcons[st] || '🔲';
      const c = _depStColors[st] || '#475569';
      const from = CONFIG.teams[d.fromTeam]?.name || d.fromTeam || '?';
      const to = CONFIG.teams[d.toTeam]?.name || d.toTeam || '?';
      return `<div class="sb-risk-row sb-risk-sub" title="${(d.fromTitle || '(sans titre)').replace(/"/g, '&quot;')} — ${from} → ${to}">
        <span style="color:${c}">${icon}</span>
        <span class="sb-risk-teams">${from} → ${to}</span>
        <span class="sb-risk-title">${d.fromTitle || '(sans titre)'}</span>
      </div>`;
    }).join('');
    const blocked = interDeps.filter(d => d.status === 'blocked').length;
    const blockedBadge = blocked ? ` <span class="sb-risk-blocked">(${blocked} bloqué${blocked > 1 ? 's' : ''})</span>` : '';
    items.push({ icon: '🔗', label: `${interDeps.length} dep. inter-équipes${blockedBadge}`, color: '#A78BFA',
      detail: interDetail, nav: 'risques' });
  }
  if (intraDeps.length) {
    const intraDetail = intraDeps.map(d => {
      const st = d.status || 'todo';
      const icon = _depStIcons[st] || '🔲';
      const c = _depStColors[st] || '#475569';
      const team = CONFIG.teams[d.fromTeam]?.name || d.fromTeam || '?';
      return `<div class="sb-risk-row sb-risk-sub" title="${(d.fromTitle || '(sans titre)').replace(/"/g, '&quot;')} — ${team}">
        <span style="color:${c}">${icon}</span>
        <span class="sb-risk-teams">${team}</span>
        <span class="sb-risk-title">${d.fromTitle || '(sans titre)'}</span>
      </div>`;
    }).join('');
    const blocked = intraDeps.filter(d => d.status === 'blocked').length;
    const blockedBadge = blocked ? ` <span class="sb-risk-blocked">(${blocked} bloqué${blocked > 1 ? 's' : ''})</span>` : '';
    items.push({ icon: '🔁', label: `${intraDeps.length} risque${intraDeps.length > 1 ? 's' : ''} intra${blockedBadge}`, color: '#818CF8',
      detail: intraDetail, nav: 'risques' });
  }

  // Sprint risks (blocked, flagged)
  const tickets = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const blocked = tickets.filter(t => t.status === 'blocked');
  if (blocked.length) {
    const pts = blocked.reduce((a, t) => a + (t.points || 0), 0);
    items.push({ icon: '🚧', label: `${blocked.length} bloqué${blocked.length > 1 ? 's' : ''} · ${pts} pts`, color: '#F87171',
      sub: blocked.map(t => `${t.id} — ${escapeHtml(t.title || '?')} (${t.points || 0} pts)`) });
  }

  const flagged = tickets.filter(t => t.flagged && !isDone(t.status) && t.status !== 'blocked');
  if (flagged.length) {
    const pts = flagged.reduce((a, t) => a + (t.points || 0), 0);
    items.push({ icon: '🚩', label: `${flagged.length} flaggé${flagged.length > 1 ? 's' : ''} · ${pts} pts`, color: '#F87171',
      sub: flagged.map(t => `${t.id} — ${escapeHtml(t.title || '?')} (${t.points || 0} pts)`) });
  }

  // PI objectives at risk
  const objs = typeof _ppObjList === 'function' ? _ppObjList() : [];
  const atRisk = objs.filter(o => o.status === 'atrisk');
  if (atRisk.length) {
    items.push({ icon: '🔴', label: `${atRisk.length} objectif${atRisk.length > 1 ? 's' : ''} à risque`, color: '#F87171',
      sub: atRisk.map(o => o.title || '(sans titre)'), nav: 'risques' });
  }

  if (!items.length) { el.innerHTML = ''; return; }

  const _navGo = (sec) => `event.preventDefault();event.stopPropagation();showView('roadmap');setTimeout(()=>_rmScrollTo('${sec}'),120);`;
  const rows = items.map(it => {
    if (it.detail) {
      const navSpan = it.nav ? `<span class="sb-risk-nav" onclick="${_navGo(it.nav)}" style="cursor:pointer" title="Voir dans Roadmap">↗</span>` : '';
      return `<details class="sb-risk-detail">
        <summary class="sb-risk-row">
          <span>${it.icon}</span>
          <span class="sb-risk-label" style="color:${it.color}">${it.label}</span>
          ${navSpan}
          <span class="sb-extra-chevron">›</span>
        </summary>
        <div class="sb-risk-detail-body">${it.detail}</div>
      </details>`;
    }
    const hasSub = it.sub?.length;
    if (it.nav) {
      return `<div class="sb-risk-row sb-risk-clickable" ${hasSub ? `title="${it.sub.join('\n')}"` : ''} onclick="${_navGo(it.nav)}">
        <span>${it.icon}</span>
        <span class="sb-risk-label" style="color:${it.color}">${it.label}</span>
        <span class="sb-risk-nav" title="Voir dans Roadmap">↗</span>
      </div>`;
    }
    return `<div class="sb-risk-row" ${hasSub ? `title="${it.sub.join('\n')}"` : ''}>
      <span>${it.icon}</span>
      <span class="sb-risk-label" style="color:${it.color}">${it.label}</span>
    </div>`;
  }).join('');

  // Preserve open state across re-renders
  const _prevOpen = document.getElementById('sb-risks-details')?.open || false;

  el.innerHTML = `<details class="sb-extra-details" id="sb-risks-details"${_prevOpen ? ' open' : ''}>
    <summary class="sb-extra-header sb-extra-toggle">
      <span>⚠️ Risques & Qualité</span>
      <span class="sb-extra-count" style="color:#F87171">${items.length}</span>
      <span class="sb-extra-chevron">›</span>
    </summary>
    <div class="sb-extra-body">${rows}</div>
  </details>`;

  // Toggle all sb-risk-detail when parent details opens/closes
  const wrapper = document.getElementById('sb-risks-details');
  if (wrapper) {
    wrapper.addEventListener('toggle', () => {
      const open = wrapper.open;
      wrapper.querySelectorAll('.sb-risk-detail').forEach(d => { d.open = open; });
    });
  }
}

// Met à jour le bloc contexte sprint/PI dans la sidebar.
// Appelé depuis renderScrum() ET directement après chargement du cache.
function _updateSidebarStats() {
  const sprintContext        = _activeSprintCtx();
  const teamCfgS = currentTeam && currentTeam !== 'all' ? CONFIG.teams[currentTeam] : null;
  const url = CONFIG.jira?.url || '';
  const _el = id => document.getElementById(id);

  // Nom du sprint + lien board
  const linkEl = _el('sb-sprint-link');
  if (linkEl) {
    linkEl.textContent = sprintContext.label || '-';
    // Lien vers le board JIRA de l'équipe courante (si configuré)
    const teamCfg  = teamCfgS;
    const boardId  = teamCfg?.boardId;
    const projKey  = teamCfg?.projectKey || (CONFIG.jira.projects || [])[0] || '';
    const jiraBase = url && !url.includes('votre-jira') ? url : null;
    if (jiraBase && boardId && projKey) {
      linkEl.href  = `${jiraBase}/jira/software/c/projects/${projKey}/boards/${boardId}`;
      linkEl.style.pointerEvents = '';
      linkEl.style.opacity = '';
    } else if (jiraBase && projKey) {
      linkEl.href  = `${jiraBase}/jira/software/c/projects/${projKey}/boards`;
      linkEl.style.pointerEvents = '';
      linkEl.style.opacity = '';
    } else {
      linkEl.removeAttribute('href');
      linkEl.style.pointerEvents = 'none';
      linkEl.style.opacity = '.5';
    }
  }

  // PI détecté depuis le nom du sprint (ex: "PI4 S2", "PI 3 - Sprint 1")
  const piBadge = _el('sb-pi-badge');
  if (piBadge) {
    const piMatch = (sprintContext.label || '').match(/PI\s*(\d+)/i);
    if (piMatch) {
      piBadge.textContent  = `PI ${piMatch[1]}`;
      piBadge.style.display = '';
    } else {
      piBadge.style.display = 'none';
    }
  }

  // Jours restants
  const remEl = _el('sb-remaining');
  if (remEl) {
    const endStr = sprintContext.endDate || '';
    const end    = endStr ? new Date(endStr.split('/').reverse().join('-')) : null;
    const diff   = end ? Math.ceil((end - new Date()) / MS_PER_DAY) : null;
    if (diff !== null && !isNaN(diff)) {
      if (diff < 0) {
        remEl.textContent = 'Terminé';
        remEl.className   = 'sb-remaining urgent';
      } else if (diff === 0) {
        remEl.textContent = 'Aujourd\'hui';
        remEl.className   = 'sb-remaining urgent';
      } else {
        remEl.textContent = `J-${diff}`;
        remEl.className   = `sb-remaining ${diff <= 2 ? 'urgent' : diff <= 5 ? 'warn' : 'ok'}`;
      }
    } else {
      remEl.textContent = '';
    }
  }

  // Dates sprint - format "06 mar. → 19 mar. 2026"
  const datesEl = _el('sb-sprint-dates');
  if (datesEl && sprintContext.startDate && sprintContext.endDate) {
    const _shortDate = (str) => {
      const d = new Date(str.split('/').reverse().join('-'));
      if (isNaN(d)) return str;
      const months = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
      return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]}`;
    };
    const endD = new Date(sprintContext.endDate.split('/').reverse().join('-'));
    const year = !isNaN(endD) ? ' ' + endD.getFullYear() : '';
    datesEl.textContent = `${_shortDate(sprintContext.startDate)} → ${_shortDate(sprintContext.endDate)}${year}`;
  } else if (datesEl) {
    datesEl.textContent = '';
  }
}
