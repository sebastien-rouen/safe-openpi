// ============================================================
// SUPPORT VIEW - Tickets support avec description complète
// Filtré par équipe/groupe sélectionné, groupé par groupe
// ============================================================

function _getSupportTickets() {
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  if (!activeTeams.length) return SUPPORT_TICKETS;
  return SUPPORT_TICKETS.filter(t => activeTeams.includes(t.team));
}

function renderSupport() {
  _renderSupportRoster();

  const filtered  = _getSupportTickets();
  const critCount = filtered.filter(t => t.priority === 'critical').length;
  const highCount = filtered.filter(t => t.priority === 'high').length;
  const openCount = filtered.filter(t => !isDone(t.status)).length;
  const doneCount = filtered.filter(t => isDone(t.status)).length;

  document.getElementById('support-stats').innerHTML = [
    { num: openCount,  lbl: 'Tickets Ouverts', color: '#3B82F6' },
    { num: critCount,  lbl: 'Critiques',        color: '#DC2626' },
    { num: highCount,  lbl: 'Haute Priorité',   color: '#EA580C' },
    { num: doneCount,  lbl: 'Résolus',           color: '#10B981' },
  ].map(s => `<div class="stat-card"><div class="num" style="color:${s.color}">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join('');

  renderSupportList();
}

function _renderSupportRoster() {
  const el = document.getElementById('support-roster');
  if (!el) return;

  // No rotation data → hide
  if (!_supportRotation || !Object.keys(_supportRotation).length) { el.innerHTML = ''; return; }

  // Determine current week index within the PI
  const weekInfos = typeof _rotWeekInfos === 'function' ? _rotWeekInfos() : [];
  if (!weekInfos.length) { el.innerHTML = ''; return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentWeekIdx = weekInfos.findIndex(w => today >= w._start && today <= w._end);
  if (currentWeekIdx < 0) { el.innerHTML = ''; return; }

  const weekInfo = weekInfos[currentWeekIdx];
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];

  // Collect roster members per team for the current week
  const rosterByTeam = [];
  for (const teamId of activeTeams) {
    const rot = _supportRotation[teamId];
    if (!rot || !rot.weeks || !rot.weeks[currentWeekIdx]) continue;
    const members = rot.weeks[currentWeekIdx];
    if (members.length) rosterByTeam.push({ teamId, members });
  }

  if (!rosterByTeam.length) { el.innerHTML = ''; return; }

  const hasAbsData = typeof _rotAbsAllNames !== 'undefined' && _rotAbsAllNames.size > 0;

  const chips = rosterByTeam.map(({ teamId, members }) => {
    const color = typeof _teamColor === 'function' ? _teamColor(teamId) : '#64748B';
    const teamName = CONFIG.teams[teamId]?.name || teamId;
    const memberChips = members.map(m => {
      const c = (typeof MEMBER_COLORS !== 'undefined' && MEMBER_COLORS[m]) || color;
      const avatar = avatarBadge(m, c, { w: 22, fs: '9px' });
      let matchDot = '';
      if (hasAbsData) {
        const matched = _rotAbsAllNames.has(m.toLowerCase());
        matchDot = `<span class="sup-roster-match ${matched ? 'matched' : 'unmatched'}" title="${matched ? 'Congés référencés' : 'Non trouvé dans les congés'}"></span>`;
      }
      return `<span class="sup-roster-member">${avatar}${matchDot}</span>`;
    }).join('');
    const names = members.join(', ');
    return `<div class="sup-roster-team">
      <span class="sup-roster-dot" style="background:${color}"></span>
      <span class="sup-roster-team-name">${teamName}</span>
      ${memberChips}
      <span class="sup-roster-names">${names}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="sup-roster-bar">
    <span class="sup-roster-icon">🛡️</span>
    <span class="sup-roster-label">Support ${weekInfo.label} <small>(${weekInfo.dateRange})</small></span>
    ${chips}
    <button class="sup-roster-cfg" onclick="showView('settings');setTimeout(()=>_stgScrollTo('rotation'),200)" title="Configurer la rotation support">⚙️</button>
  </div>`;
}

function filterSupport(f) {
  supportFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === f)
  );
  renderSupportList();
  _pushHash();
}

function renderSupportList() {
  let tickets = [..._getSupportTickets()];
  const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tickets.sort((a, b) => {
    const da = isDone(a.status) ? 1 : 0;
    const db = isDone(b.status) ? 1 : 0;
    if (da !== db) return da - db;
    return pOrder[a.priority] - pOrder[b.priority];
  });

  if      (supportFilter === 'open') tickets = tickets.filter(t => !isDone(t.status));
  else if (supportFilter === 'done') tickets = tickets.filter(t => isDone(t.status));
  else if (supportFilter !== 'all')  tickets = tickets.filter(t => t.priority === supportFilter);

  const pColors = { critical: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#059669' };
  const pLabels = { critical: '🔴 Critique', high: '🟠 Haute', medium: '🟡 Moyenne', low: '🟢 Basse' };
  const sColors = { open: '#3B82F6', inprog: '#06B6D4', done: '#10B981' };
  const sLabels = { open: 'Ouvert', inprog: 'En cours', done: 'Résolu' };

  if (!tickets.length) {
    document.getElementById('support-list').innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Aucun ticket de support.</div>';
    return;
  }

  // Grouper par groupe si un groupe est sélectionné, sinon par équipe
  const groups = typeof currentGroup !== 'undefined' && currentGroup && typeof GROUPS !== 'undefined'
    ? GROUPS.filter(g => g.id === currentGroup)
    : null;

  if (groups && groups.length) {
    // Groupé par groupe — afficher l'équipe dans les tickets (plusieurs équipes par groupe)
    document.getElementById('support-list').innerHTML = groups.map(g => {
      const gTickets = tickets.filter(t => g.teams.includes(t.team));
      if (!gTickets.length) return '';
      const showTeam = g.teams.length > 1;
      return `<div class="sup-group">
        <div class="sup-group-header" style="border-left-color:${g.color}">
          <span class="sup-group-dot" style="background:${g.color}"></span>
          <span class="sup-group-name">${g.name}</span>
          <span class="sup-group-count">${gTickets.length} ticket${gTickets.length > 1 ? 's' : ''}</span>
        </div>
        ${gTickets.map(t => _supportCard(t, pColors, pLabels, sColors, sLabels, showTeam)).join('')}
      </div>`;
    }).join('');
  } else {
    // Toujours grouper par équipe (même si une seule)
    const teamIds = [...new Set(tickets.map(t => t.team).filter(Boolean))].sort();
    document.getElementById('support-list').innerHTML = teamIds.map(tid => {
      const color = _teamColor(tid);
      const name  = CONFIG.teams[tid]?.name || `Équipe ${tid}`;
      const tTickets = tickets.filter(t => t.team === tid);
      return `<div class="sup-group">
        <div class="sup-group-header" style="border-left-color:${color}">
          <span class="sup-group-dot" style="background:${color}"></span>
          <span class="sup-group-name">${name}</span>
          <span class="sup-group-count">${tTickets.length} ticket${tTickets.length > 1 ? 's' : ''}</span>
        </div>
        ${tTickets.map(t => _supportCard(t, pColors, pLabels, sColors, sLabels, false)).join('')}
      </div>`;
    }).join('');
  }
}

function _supportCard(t, pColors, pLabels, sColors, sLabels, showTeam) {
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const done        = isDone(t.status);
  const teamHtml    = showTeam
    ? `<span class="sup-team" style="color:${_teamColor(t.team)}">${CONFIG.teams[t.team]?.name || t.team}</span>`
    : '';
  return `
  <div class="support-card ${t.priority}${done ? ' sup-done' : ''}" onclick="_openSupportModal('${t.id}')" style="cursor:pointer;">
    <div class="support-header">
      <div class="sup-left">
        <span class="sup-id">${_jiraBrowse(t.id, { style: 'color:inherit;text-decoration:none;font-weight:700;' })}</span>
        <span class="sup-title">${t.title}</span>
      </div>
      <div class="sup-right">
        <span class="badge" style="background:${pColors[t.priority]}22;color:${pColors[t.priority]}">${pLabels[t.priority]}</span>
        <span class="badge" style="background:${(sColors[t.status] || CLR.muted)}22;color:${sColors[t.status] || CLR.muted}">${sLabels[t.status] || t.status}</span>
        ${teamHtml}
        ${avatarBadge(t.assignee, avatarColor)}
        <span class="sup-date">${t.date || ''}</span>
      </div>
    </div>
  </div>`;
}

function _openSupportModal(id) {
  // Set navigation context to current filtered support list
  const cards = document.querySelectorAll('#support-list .support-card');
  window._modalTicketList = [...cards].map(c => {
    const m = c.getAttribute('onclick')?.match(/_openSupportModal\('([^']+)'\)/);
    return m ? m[1] : null;
  }).filter(Boolean);
  window._modalCurrentIdx = window._modalTicketList.indexOf(id);
  openModal(id);
}
