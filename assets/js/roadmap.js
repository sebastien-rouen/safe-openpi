// ============================================================
// ROADMAP - Planification charge / vélocité / règle 80/20
// ============================================================

// Projection table (était dans releases.js, utilisée par la section Vision)
function _relProjectionTable(projections, avgVelocity, sprint) {
  if (!projections.length) return '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Aucune donnée de projection</div>';
  const durationDays = CONFIG.sprint.durationDays || 14;
  return `<table class="rel-proj-table">
    <thead><tr><th>Epic</th><th>Total</th><th>Done</th><th>Restant</th><th>Avancement</th><th>Sprints estimés</th><th>Date estimée</th></tr></thead>
    <tbody>${projections.map(f => {
      const remaining = f.totalPts - f.donePts;
      const epicShare = f.totalPts / Math.max(1, projections.reduce((a, p) => a + p.totalPts, 0));
      const epicVel = Math.max(1, Math.round(avgVelocity * epicShare));
      const sprints = remaining > 0 ? Math.ceil(remaining / epicVel) : 0;
      const estDate = sprint.endDate ? (() => { const d = new Date(sprint.endDate); d.setDate(d.getDate() + sprints * durationDays); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); })() : '-';
      const color = f.pct === 100 ? CLR.darkGrn : f.pct > 70 ? CLR.blue : f.pct > 30 ? CLR.amber : CLR.red;
      return `<tr class="rel-proj-epic-row">
        <td><span style="font-weight:700;color:${f.color || CLR.purple};font-size:11px;">${escapeHtml(f.id)}</span> <span style="font-size:11px;color:var(--text);">${escapeHtml((f.title || '').slice(0, 40))}${(f.title || '').length > 40 ? '…' : ''}</span>${f.team ? ` <span style="font-size:10px;color:var(--text-muted);">[${escapeHtml(f.team)}]</span>` : ''} <span style="font-size:10px;color:var(--text-muted);">(${f.total} tickets)</span></td>
        <td style="text-align:center;font-weight:600;">${f.totalPts}</td>
        <td style="text-align:center;color:var(--success);font-weight:600;">${f.donePts}</td>
        <td style="text-align:center;color:${remaining > 0 ? 'var(--warning)' : 'var(--success)'};font-weight:600;">${remaining}</td>
        <td><div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${f.pct}%;background:${color};border-radius:3px;"></div></div><span style="font-size:11px;font-weight:700;color:${color};min-width:32px;text-align:right;">${f.pct}%</span></div></td>
        <td style="text-align:center;font-weight:700;">${f.pct === 100 ? '✅' : sprints}</td>
        <td style="text-align:center;font-size:11px;color:var(--text-muted);">${f.pct === 100 ? 'Terminé' : estDate}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// Breakdown du buffer 20% (% relatifs à la vélocité totale)
const _BUFFER_CATS = [
  {
    key: 'dette',
    label: 'Dette technique émergente',
    pct: 6,
    icon: '🔧',
    desc: 'Corrections urgentes, refactoring critique, hotfixes non planifiés en cours de sprint',
  },
  {
    key: 'outillage',
    label: 'Outillage & CI/CD',
    pct: 5,
    icon: '⚙️',
    desc: 'Amélioration des pipelines, automatisation du build, observabilité, devX',
  },
  {
    key: 'innovation',
    label: 'Innovation & exploration',
    pct: 5,
    icon: '🔬',
    desc: 'POCs, spikes techniques, veille technologique outillée, R&D interne',
  },
  {
    key: 'n2n3',
    label: 'Automatisation N2/N3',
    pct: 4,
    icon: '🤖',
    desc: 'Runbooks automatisés, réduction des tickets support récurrents, playbooks ops',
  },
];

// ============================================================
// Point d'entrée principal
// ============================================================

// Section collapsible - état persisté dans localStorage
function _rmSection(id, icon, title, content, defaultOpen) {
  const stored = localStorage.getItem('rm_sec_' + id);
  const open = stored !== null ? stored === '1' : defaultOpen !== false;
  return `<div class="rm-section${open ? '' : ' collapsed'}" id="rm-sec-${id}">
    <div class="rm-section-header" onclick="_rmToggleSection('${id}')">
      <span class="rm-section-arrow">▼</span>
      <span style="font-size:15px;">${icon}</span>
      <span class="rm-section-title">${title}</span>
    </div>
    <div class="rm-section-body" style="${open ? '' : 'display:none;'}">${content}</div>
  </div>`;
}
window._rmToggleSection = function(id) {
  const sec = document.getElementById('rm-sec-' + id);
  if (!sec) return;
  const isCollapsed = sec.classList.toggle('collapsed');
  const body = sec.querySelector('.rm-section-body');
  if (isCollapsed) { body.style.display = 'none'; localStorage.setItem('rm_sec_' + id, '0'); }
  else             { body.style.display = '';     localStorage.setItem('rm_sec_' + id, '1'); }
};

// Toggle detail panel in timeline past sprint cards
window._rmToggleTlDetail = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : '';
  el.closest('.rm-tl-card')?.classList.toggle('rm-tl-expanded', !visible);
};

// Scroll to section + open it if collapsed
window._rmScrollTo = function(id) {
  const sec = document.getElementById('rm-sec-' + id);
  if (!sec) return;
  // Open if collapsed
  if (sec.classList.contains('collapsed')) _rmToggleSection(id);
  // Scroll with offset for sticky tabs + topbar
  setTimeout(() => {
    const container = document.getElementById('content') || document.documentElement;
    const rect = sec.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const offset = (document.getElementById('rm-tabs')?.offsetHeight || 0) + (document.getElementById('topbar')?.offsetHeight || 0) + 16;
    container.scrollBy({ top: rect.top - contRect.top - offset, behavior: 'smooth' });
    // Highlight section header for 3 seconds
    sec.classList.add('pi-highlight');
    setTimeout(() => sec.classList.remove('pi-highlight'), 3000);
  }, 50);
  // Highlight active tab
  document.querySelectorAll('.rm-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === id));
  // Update URL hash
  if (typeof _pushHash === 'function') _pushHash();
};

// Scroll spy - highlight tab matching visible section
let _rmSpyCleanup = null;
function _rmInitScrollSpy() {
  if (_rmSpyCleanup) _rmSpyCleanup();
  const content = document.getElementById('main') || window;
  const handler = () => {
    const tabs = document.getElementById('rm-tabs');
    if (!tabs) return;
    const sections = document.querySelectorAll('.rm-section');
    let activeId = null;
    const offset = 120;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= offset && rect.bottom > offset) activeId = sec.id.replace('rm-sec-', '');
    });
    if (activeId) {
      const prev = tabs.querySelector('.rm-tab.active')?.dataset.sec;
      tabs.querySelectorAll('.rm-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === activeId));
      if (prev !== activeId && typeof _pushHash === 'function') _pushHash();
    }
  };
  content.addEventListener('scroll', handler, { passive: true });
  _rmSpyCleanup = () => content.removeEventListener('scroll', handler);
  handler();
}

// ============================================================
// Roadmap visuelle - Groupes × Équipes × Epics par PI
// ============================================================
function _roadmapVisual(_featureData, _sprintPlan, s) {
  const activeTeams = getActiveTeams();
  const allTickets = getTickets();
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const allPool = [...allTickets, ..._bl];

  // Use PI sélectionné (dropdown) au lieu de détecter depuis les sprint labels
  const piRegex = /(\d{2,3})\.(\d+)/;
  const _selPI = _piDetect();
  let currentPI = _selPI.piNum ? parseInt(_selPI.piNum) : null;

  // Fallback : détection depuis sprint labels
  if (currentPI === null) {
    const piMatchLabel = (s.label || '').match(piRegex);
    if (piMatchLabel) {
      currentPI = parseInt(piMatchLabel[1]);
    } else {
      for (const tid of activeTeams) {
        const tc = CONFIG.teams[tid];
        if (tc?.sprintName) {
          const m = tc.sprintName.match(piRegex);
          if (m) { currentPI = parseInt(m[1]); break; }
        }
      }
      if (currentPI === null) {
        const m2 = (CONFIG.sprint.label || '').match(piRegex);
        if (m2) currentPI = parseInt(m2[1]);
      }
    }
  }

  if (currentPI === null) return ''; // Can't build visual without PI context

  // Helper: extract PI number from a ticket (piSprint > sprintName > default)
  const _piFromTicket = (t) => {
    // 1. Try piSprint field (ex: "PI#29")
    if (t.piSprint) {
      const m = t.piSprint.match(/(\d{2,3})/);
      if (m) return parseInt(m[1]);
    }
    // 2. Try sprintName (ex: "Fuego - Ité 29.1")
    if (t.sprintName) {
      const m = t.sprintName.match(piRegex);
      if (m) return parseInt(m[1]);
    }
    return null;
  };

  // Extract PI numbers from all ticket sprint names and piSprint fields
  const piSet = new Set();
  allPool.forEach(t => {
    const pi = _piFromTicket(t);
    if (pi !== null) piSet.add(pi);
  });
  // Also add current PI
  piSet.add(currentPI);

  // Build sorted PI columns (current + future PIs, include PI+2 if tickets exist)
  const piColumns = [...piSet].filter(pi => pi >= currentPI).sort((a, b) => a - b);
  // Ensure at least PI+1 is shown
  if (!piColumns.includes(currentPI + 1)) piColumns.push(currentPI + 1);
  // Add PI+2 if there are tickets for it
  if (piSet.has(currentPI + 2) && !piColumns.includes(currentPI + 2)) piColumns.push(currentPI + 2);
  piColumns.sort((a, b) => a - b);

  // Map epics to PIs (which PIs have tickets for each epic?)
  // Include synthetic epics for backlog tickets whose epic isn't in EPICS
  const _allEpics = typeof EPICS !== 'undefined' ? [...EPICS] : [];
  const _knownEpicIds = new Set(_allEpics.map(e => e.id));
  allPool.forEach(t => {
    if (!t.epic || _knownEpicIds.has(t.epic)) return;
    const pi = _piFromTicket(t);
    if (pi === null || pi < currentPI) return;
    const team = (t.team === '_PI') ? null : t.team;
    _allEpics.push({ id: t.epic, title: t.epic, team, color: team ? (_teamColor(team)) : '#7C3AED' });
    _knownEpicIds.add(t.epic);
  });
  const epics = _allEpics.filter(e => !e.team || activeTeams.includes(e.team));

  // Build epic lookup for resolving _PI team from epic
  const _epicTeam = {};
  epics.forEach(e => { if (e.team) _epicTeam[e.id] = e.team; });

  // Build epic data: epic → { piMap: { PI# → { pts, done, total, tickets } }, team, title }
  const epicData = [];
  epics.forEach(e => {
    const eTickets = allPool.filter(t => {
      if (t.epic !== e.id) return false;
      // Accept ticket if team matches active teams, or if team is '_PI' (PI board fallback)
      const effectiveTeam = (t.team === '_PI') ? _epicTeam[t.epic] : t.team;
      return !e.team || activeTeams.includes(effectiveTeam || e.team);
    });
    if (!eTickets.length) return;
    const piMap = {};
    eTickets.forEach(t => {
      let pi = _piFromTicket(t);
      if (pi === null) pi = currentPI; // default: current PI for active sprint tickets
      if (pi < currentPI) return; // Skip past PIs
      if (!piMap[pi]) piMap[pi] = { pts: 0, donePts: 0, total: 0, done: 0, blocked: 0, inprog: 0, tickets: [] };
      piMap[pi].pts += (t.points || 0);
      piMap[pi].total++;
      piMap[pi].tickets.push(t);
      if (isDone(t.status)) { piMap[pi].donePts += (t.points || 0); piMap[pi].done++; }
      if (t.status === 'blocked') piMap[pi].blocked++;
      if (t.status === 'inprog' || t.status === 'review') piMap[pi].inprog++;
    });
    if (!Object.keys(piMap).length) return;
    const totalPts = Object.values(piMap).reduce((a, p) => a + p.pts, 0);
    const donePts = Object.values(piMap).reduce((a, p) => a + p.donePts, 0);
    const pct = totalPts ? Math.round(donePts / totalPts * 100) : 0;
    const totalTickets = Object.values(piMap).reduce((a, p) => a + p.total, 0);
    const doneTickets = Object.values(piMap).reduce((a, p) => a + p.done, 0);
    const blockedTickets = Object.values(piMap).reduce((a, p) => a + p.blocked, 0);
    const inprogTickets = Object.values(piMap).reduce((a, p) => a + p.inprog, 0);
    const piNums = Object.keys(piMap).map(Number).sort((a, b) => a - b);
    epicData.push({
      id: e.id, title: e.title || e.id, team: e.team, color: e.color || '#7C3AED',
      piMap, totalPts, donePts, pct, totalTickets, doneTickets, blockedTickets, inprogTickets,
      minPI: piNums[0], maxPI: piNums[piNums.length - 1],
    });
  });

  if (!epicData.length) return '';

  // Group epics by team
  const teamEpics = {};
  epicData.forEach(e => {
    const t = e.team || 'Autre';
    (teamEpics[t] = teamEpics[t] || []).push(e);
  });

  // Helper: render a bar cell
  function _vrBarCell(e, pi) {
    if (pi < e.minPI || pi > e.maxPI) return `<div class="rm-vr-cell"></div>`;
    const d = e.piMap[pi];
    const isStart = pi === e.minPI;
    const isEnd   = pi === e.maxPI;
    const hasPts = d && d.pts > 0;
    const barCls = `rm-vr-bar${isStart ? ' rm-vr-bar-start' : ''}${isEnd ? ' rm-vr-bar-end' : ''}`;
    const pctColor = e.pct === 100 ? '#16A34A' : e.pct > 50 ? '#2563EB' : e.pct > 0 ? '#F59E0B' : '#94A3B8';
    return `<div class="rm-vr-cell">
      <div class="${barCls}" style="background:${e.color}18;border-color:${e.color};cursor:pointer;" onclick="_showVrEpicDetail('${e.id}')">
        ${isStart ? `<span class="rm-vr-bar-title" style="color:${e.color};">${e.id}</span>` : ''}
        ${hasPts ? `<span class="rm-vr-bar-pts">${d.pts}pts</span>` : ''}
        <span class="rm-vr-bar-pct" style="background:${pctColor}">${e.pct}%</span>
      </div>
    </div>`;
  }

  // Build swimlanes: grouped by GROUPS → teams
  const renderedTeams = new Set();
  let swimlanesHtml = '';

  GROUPS.forEach(g => {
    const groupTeams = g.teams.filter(t => activeTeams.includes(t) && teamEpics[t]);
    if (!groupTeams.length) return;

    // Group header spanning all columns
    swimlanesHtml += `<div class="rm-vr-group-header" style="border-left:4px solid ${g.color};background:${g.color}0D;">
      <span class="rm-vr-group-name" style="color:${g.color};">${escapeHtml(g.name)}</span>
    </div>`;

    groupTeams.forEach(tid => {
      renderedTeams.add(tid);
      const teamColor = _teamColor(tid);
      const epicsForTeam = teamEpics[tid].sort((a, b) => a.minPI - b.minPI || b.totalPts - a.totalPts);

      // Team sub-header
      swimlanesHtml += `<div class="rm-vr-team-header" style="background:${teamColor}0A;border-left:3px solid ${teamColor};">
        <span class="rm-vr-team-name" style="color:${teamColor};">${tid}</span>
        <span class="rm-vr-team-count">${epicsForTeam.length} epic${epicsForTeam.length > 1 ? 's' : ''} · ${epicsForTeam.reduce((a, e) => a + e.totalPts, 0)} pts</span>
      </div>`;

      // Epic rows
      epicsForTeam.forEach(e => {
        const cells = piColumns.map(pi => _vrBarCell(e, pi)).join('');
        swimlanesHtml += `<div class="rm-vr-row">
          <div class="rm-vr-label" title="${escapeHtml(e.title)}\n${e.totalPts} pts · ${e.pct}%" style="cursor:pointer;" onclick="_showVrEpicDetail('${e.id}')">
            <span class="rm-vr-feat-id" style="color:${e.color};">${e.id}</span>
            <span class="rm-vr-feat-title">${escapeHtml((e.title).slice(0, 30))}${e.title.length > 30 ? '…' : ''}</span>
          </div>
          ${cells}
        </div>`;
      });
    });
  });

  // Teams not in any group
  Object.keys(teamEpics).filter(t => !renderedTeams.has(t) && activeTeams.includes(t)).forEach(tid => {
    const teamColor = _teamColor(tid);
    const epicsForTeam = teamEpics[tid].sort((a, b) => a.minPI - b.minPI || b.totalPts - a.totalPts);

    swimlanesHtml += `<div class="rm-vr-team-header" style="background:${teamColor}0A;border-left:3px solid ${teamColor};">
      <span class="rm-vr-team-name" style="color:${teamColor};">${tid}</span>
      <span class="rm-vr-team-count">${epicsForTeam.length} epic${epicsForTeam.length > 1 ? 's' : ''}</span>
    </div>`;

    epicsForTeam.forEach(e => {
      const cells = piColumns.map(pi => _vrBarCell(e, pi)).join('');
      swimlanesHtml += `<div class="rm-vr-row">
        <div class="rm-vr-label" title="${escapeHtml(e.title)}\n${e.totalPts} pts · ${e.pct}%" style="cursor:pointer;" onclick="_showVrEpicDetail('${e.id}')">
          <span class="rm-vr-feat-id" style="color:${e.color};">${e.id}</span>
          <span class="rm-vr-feat-title">${escapeHtml((e.title).slice(0, 30))}${e.title.length > 30 ? '…' : ''}</span>
        </div>
        ${cells}
      </div>`;
    });
  });

  // PI column headers
  const _realPINum = typeof _ppDetectPI === 'function' ? parseInt((_ppDetectPI().match(/\d+/) || [])[0]) : currentPI;
  const colHeaders = piColumns.map(pi => {
    const isActive = pi === _realPINum;
    const piLabel = pi < _realPINum ? 'Passé' : pi === _realPINum ? 'En cours' : 'Futur';
    return `<div class="rm-vr-col-header${isActive ? ' rm-vr-col-current' : ''}">
      <div class="rm-vr-col-pi">PI ${pi}</div>
      <div class="rm-vr-col-name">${piLabel}</div>
    </div>`;
  }).join('');

  return `<div class="rm-vr-wrap">
    <div class="section-header" style="margin-bottom:12px;">
      <div class="section-title">🗺️ Roadmap Visuelle</div>
      <span style="font-size:12px;color:var(--text-muted);">Groupes × Équipes × Epics par PI · Story Points</span>
    </div>
    <div class="rm-vr-grid" style="grid-template-columns: 200px repeat(${piColumns.length}, 1fr);">
      <div class="rm-vr-corner"></div>
      ${colHeaders}
      ${swimlanesHtml}
    </div>
  </div>`;
}

// ============================================================
// Visual Roadmap - Epic detail popin
// ============================================================
function _showVrEpicDetail(epicId) {
  const activeTeams = getActiveTeams();
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const allPool = [...(getTickets()), ..._bl];
  const epics = typeof EPICS !== 'undefined' ? EPICS : [];
  const epic = epics.find(e => e.id === epicId);
  if (!epic) return;

  const eTickets = allPool.filter(t => t.epic === epicId && (!epic.team || activeTeams.includes(t.team)));
  if (!eTickets.length) return;

  const totalPts = eTickets.reduce((a, t) => a + (t.points || 0), 0);
  const donePts = eTickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const pct = totalPts ? Math.round(donePts / totalPts * 100) : 0;
  const done = eTickets.filter(t => isDone(t.status)).length;
  const blocked = eTickets.filter(t => t.status === 'blocked').length;
  const inprog = eTickets.filter(t => t.status === 'inprog' || t.status === 'review').length;
  const todo = eTickets.filter(t => t.status === 'todo' || t.status === 'backlog').length;
  const remaining = totalPts - donePts;
  const color = epic.color || '#7C3AED';
  const pctColor = pct === 100 ? '#16A34A' : pct > 50 ? '#2563EB' : pct > 0 ? '#F59E0B' : '#94A3B8';
  const teamColor = _teamColor(epic.team);

  // Group tickets by PI
  const piRegex = /(\d{2,3})\.(\d+)/;
  const piGroups = {};
  eTickets.forEach(t => {
    let piLabel = 'Sprint actif';
    // Try piSprint first (ex: "PI#29"), then sprintName (ex: "Fuego - Ité 29.1")
    if (t.piSprint) {
      const m = t.piSprint.match(/(\d{2,3})/);
      if (m) piLabel = 'PI ' + m[1];
    } else if (t.sprintName) {
      const m = t.sprintName.match(piRegex);
      if (m) piLabel = 'PI ' + m[1];
    }
    (piGroups[piLabel] = piGroups[piLabel] || []).push(t);
  });

  // Status breakdown donut (CSS)
  const total = eTickets.length;
  const donePctR = total ? Math.round(done / total * 100) : 0;
  const inprogPctR = total ? Math.round(inprog / total * 100) : 0;
  const blockedPctR = total ? Math.round(blocked / total * 100) : 0;
  const todoPctR = 100 - donePctR - inprogPctR - blockedPctR;

  // Header card
  const header = `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:700;color:${color};">${_jiraBrowse(epic.id)}</span>
          ${epic.team ? `<span style="font-size:10px;font-weight:600;color:${teamColor};background:${teamColor}15;padding:1px 6px;border-radius:4px;">${escapeHtml(epic.team)}</span>` : ''}
        </div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">${escapeHtml(epic.title) || epic.id}</div>
        <div class="rm-detail-progress">
          <div class="rm-detail-bar">
            <div style="height:100%;width:${pct}%;background:${pctColor};border-radius:4px;transition:width .3s;"></div>
          </div>
          <span style="font-size:14px;font-weight:800;color:${pctColor};min-width:40px;text-align:right;">${pct}%</span>
        </div>
      </div>
    </div>`;

  // Stats cards
  const stats = `
    <div class="rm-stats-grid">
      <div class="rm-detail-stat">
        <div class="rm-detail-stat-val" style="color:var(--text);">${totalPts}</div>
        <div class="rm-detail-stat-lbl">Story Points</div>
      </div>
      <div class="rm-detail-stat">
        <div class="rm-detail-stat-val" style="color:#16A34A;">${donePts}</div>
        <div class="rm-detail-stat-lbl">Terminés</div>
      </div>
      <div class="rm-detail-stat">
        <div class="rm-detail-stat-val" style="color:#F59E0B;">${remaining}</div>
        <div class="rm-detail-stat-lbl">Restants</div>
      </div>
      <div class="rm-detail-stat">
        <div class="rm-detail-stat-val" style="color:var(--text);">${total}</div>
        <div class="rm-detail-stat-lbl">Tickets</div>
      </div>
    </div>`;

  // Status breakdown bar
  const statusBar = `
    <div style="margin-bottom:20px;">
      <div class="rm-status-bar">
        ${donePctR > 0 ? `<div style="width:${donePctR}%;background:#16A34A;" title="Terminé ${donePctR}%"></div>` : ''}
        ${inprogPctR > 0 ? `<div style="width:${inprogPctR}%;background:#2563EB;" title="En cours ${inprogPctR}%"></div>` : ''}
        ${blockedPctR > 0 ? `<div style="width:${blockedPctR}%;background:#DC2626;" title="Bloqué ${blockedPctR}%"></div>` : ''}
        ${todoPctR > 0 ? `<div style="width:${todoPctR}%;background:var(--border);" title="A faire ${todoPctR}%"></div>` : ''}
      </div>
      <div class="rm-status-legend">
        <span><span class="rm-legend-dot" style="background:#16A34A;"></span>Terminé ${done}</span>
        <span><span class="rm-legend-dot" style="background:#2563EB;"></span>En cours ${inprog}</span>
        ${blocked > 0 ? `<span><span class="rm-legend-dot" style="background:#DC2626;"></span>Bloqué ${blocked}</span>` : ''}
        <span><span class="rm-legend-dot" style="background:var(--border);"></span>A faire ${todo}</span>
      </div>
    </div>`;

  // Ticket list grouped by PI
  const piKeys = Object.keys(piGroups).sort();
  const ticketSections = piKeys.map(piLabel => {
    const tickets = piGroups[piLabel].sort((a, b) => {
      const statusOrder = { blocked: 0, inprog: 1, review: 1, todo: 2, backlog: 3, done: 4 };
      return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) || (b.points || 0) - (a.points || 0);
    });
    const piPts = tickets.reduce((a, t) => a + (t.points || 0), 0);
    const piDone = tickets.filter(t => isDone(t.status)).length;
    const rows = tickets.map(t => {
      const _tkDone = isDone(t.status);
      const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
      return `<div class="rm-ticket-row" style="${_tkDone ? 'opacity:.5;' : ''}" onclick="closeModalDirect();openModal('${t.id}')">
        <span style="flex-shrink:0;width:18px;text-align:center;font-size:12px;">${priorityIcon(t.priority)}</span>
        <span class="badge badge-${t.status}" style="font-size:9px;padding:1px 5px;flex-shrink:0;">${statusLabel(t.status)}</span>
        <span class="badge badge-${t.type}" style="font-size:9px;padding:1px 5px;flex-shrink:0;">${typeName(t.type)}</span>
        <span class="rm-ticket-title" style="${_tkDone ? 'text-decoration:line-through;' : ''}">${_jiraBrowse(t.id)} ${escapeHtml(t.title)}</span>
        ${ptsBadge(t.points)}
        ${avatarBadge(t.assignee, avatarColor, {w:22, fs:'9px'})}
      </div>`;
    }).join('');

    return `<div style="margin-bottom:12px;">
      <div class="rm-pi-group-hdr">
        <span style="font-size:12px;font-weight:700;color:var(--text);">${piLabel}</span>
        <span style="font-size:10px;color:var(--text-muted);">${piDone}/${tickets.length} tickets · ${piPts} pts</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  document.getElementById('modal-title').innerHTML = `${_jiraBrowse(epic.id, { style: 'color:' + color + ';font-weight:700;text-decoration:none;' })} <span style="font-weight:400;color:var(--text-muted);font-size:14px;">- ${escapeHtml((epic.title || '').slice(0, 50))}</span>`;
  document.getElementById('modal-body').innerHTML = header + stats + statusBar + ticketSections;

  window._modalTicketList = eTickets.map(t => t.id);
  window._modalCurrentIdx = 0;
  if (typeof _updateModalNavButtons === 'function') _updateModalNavButtons();
  { const _dlg = document.getElementById('modal-overlay'); if (!_dlg.open) _dlg.showModal(); }
}

async function renderRoadmap() {
  _capTicketsMode = null;
  document.getElementById('topbar-title').textContent = '🗺️ Roadmap & Planification';
  const el = document.getElementById('roadmap-content');
  if (!el) return;

  // Charger les données PI Prep (async)
  if (typeof _ppLoad === 'function') await _ppLoad();

  const tickets     = getTickets();
  const activeTeams = getActiveTeams();
  const velRef      = _roadmapVelocity();
  const cap80       = Math.round(velRef.avg * 0.8);
  const cap20       = velRef.avg - cap80;
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;

  // Backlog : BACKLOG_TICKETS + fallback sprint:0 dans TICKETS (démo)
  const pOrder      = { critical: 0, high: 1, medium: 2, low: 3 };
  const _filterBacklog = t =>
    t.type !== 'support' && t.type !== 'incident' &&
    !isDone(t.status) &&
    (!activeTeams.length || activeTeams.includes(t.team));

  const fromBacklog = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(_filterBacklog);
  const seenIds     = new Set(fromBacklog.map(t => t.id));
  const fromSprint  = tickets
    .filter(t =>
      (t.status === 'backlog' || !t.sprint || t.sprint === 0) &&
      _filterBacklog(t) && !seenIds.has(t.id)
    );
  const backlog = [...fromBacklog, ...fromSprint]
    .sort((a, b) => {
      const pd = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      if (pd !== 0) return pd;
      return (b.points || 0) - (a.points || 0);
    });

  const ipInfo     = _detectIPSprint();
  const sprintPlan = _roadmapSimulateSprints(backlog, cap80, ipInfo);

  // ---- Données par Epic (remplace l'ancien featureData basé sur F-1) ----
  const epics = (typeof EPICS !== 'undefined' ? EPICS : []).filter(e => !e.team || activeTeams.includes(e.team));
  const epicData = epics.map(e => {
    const eTickets = tickets.filter(t => t.epic === e.id);
    const totalPts = eTickets.reduce((a, t) => a + (t.points || 0), 0);
    const donePts = eTickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
    const pct = totalPts ? Math.round(donePts / totalPts * 100) : 0;
    const total = eTickets.length;
    const done = eTickets.filter(t => isDone(t.status)).length;
    const blocked = eTickets.filter(t => t.status === 'blocked').length;
    const inprog = eTickets.filter(t => t.status === 'inprog' || t.status === 'review').length;
    return { ...e, tickets: eTickets, totalPts, donePts, pct, total, done, blocked, inprog, epics: [] };
  }).filter(e => e.tickets.length > 0);

  const velHistory = [];
  _allTeams().forEach(t => {
    const hist = CONFIG.teams[t]?.velocityHistory || [];
    hist.forEach((h, i) => {
      if (!velHistory[i]) velHistory[i] = { name: h.name, velocity: 0 };
      velHistory[i].velocity += h.velocity || 0;
    });
  });
  const currentVel = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const avgVelocity = velHistory.length
    ? Math.round(velHistory.reduce((a, v) => a + v.velocity, 0) / velHistory.length)
    : (currentVel || 40);
  const s = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  const projections = epicData.map(e => {
    const remaining = e.totalPts - e.donePts;
    const epicShare = e.totalPts / Math.max(1, epicData.reduce((a, x) => a + x.totalPts, 0));
    const epicVel = Math.max(1, Math.round(avgVelocity * epicShare));
    const sprintsNeeded = remaining > 0 ? Math.ceil(remaining / epicVel) : 0;
    return { ...e, remaining, sprintsNeeded };
  });
  const totalPtsAll = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const donePtsAll = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const pctAll = totalPtsAll ? Math.round(donePtsAll / totalPtsAll * 100) : 0;
  const remainingPts = totalPtsAll - donePtsAll;
  const sprintsToComplete = avgVelocity > 0 ? Math.ceil(remainingPts / avgVelocity) : '?';

  // ---- Données PI Prep ----
  const unpointed    = backlog.filter(t => !t.points);
  const readiness    = typeof _ppReadiness === 'function' ? _ppReadiness(backlog, activeTeams) : null;
  const membersByTeam = typeof _ppMembersByTeam === 'function' ? _ppMembersByTeam(activeTeams) : {};
  // piCalendar removed — info intégrée dans la chronologie

  // ---- KPIs releases (basés sur les stats PI centralisées) ----
  const _kpi = _piDetect();
  const _kpiVel = _piVelocityStats(activeTeams, _kpi.piNum);
  const _kpiBuf = _piBufferStats(activeTeams, _kpi.piNum);
  const _kpiAllTix = _piAllTickets(activeTeams, _kpi.piNum);
  const _kpiTotalPts = _kpiAllTix.reduce((s, t) => s + (t.points || 0), 0);
  const _kpiDonePts  = _kpiAllTix.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const _kpiInpPts   = _kpiAllTix.filter(t => ['inprog','review','test'].includes(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const _kpiBlkPts   = _kpiAllTix.filter(t => t.status === 'blocked').reduce((s, t) => s + (t.points || 0), 0);
  const _kpiTodoPts  = _kpiTotalPts - _kpiDonePts - _kpiInpPts - _kpiBlkPts;
  const _kpiPct      = _kpiVel.capacity ? Math.round(_kpiDonePts / _kpiVel.capacity * 100) : (_kpiTotalPts ? Math.round(_kpiDonePts / _kpiTotalPts * 100) : 0);
  const _kpiRemaining = Math.max(0, (_kpiVel.capacity || _kpiTotalPts) - _kpiDonePts - _kpiInpPts);
  const _kpiSprintsLeft = Math.max(0, _kpiVel.sprintsPerPI - _kpiVel.sprintsDone);
  const _kpiEpics = [...new Set(_kpiAllTix.map(t => t.epic).filter(Boolean))];
  const _kpiEpicsDone = _kpiEpics.filter(eid => {
    const eTix = _kpiAllTix.filter(t => t.epic === eid);
    return eTix.length && eTix.every(t => isDone(t.status));
  }).length;
  const _kpiPctColor = _kpiPct >= 80 ? '#22C55E' : _kpiPct >= 40 ? '#F59E0B' : '#94A3B8';
  const _kpiPiLabel = _kpi.piNum ? `PI ${_kpi.piNum}` : 'PI';

  const _kpiTip1 = `${_kpiPiLabel} — Avancement\n✅ ${_kpiDonePts} pts terminés\n🔵 ${_kpiInpPts} pts en cours\n🚧 ${_kpiBlkPts} pts bloqués\n📋 ${_kpiTodoPts} pts à faire\nCapacité : ${_kpiVel.capacity} pts`;
  const _kpiTip2 = `${_kpiPiLabel} — Story Points\n${_kpiDonePts} terminés / ${_kpiTotalPts} planifiés\n${_kpiAllTix.length} tickets au total\nBuffer : ${_kpiBuf.totalPts} pts (${_kpiBuf.totalTix} tickets)`;
  const _kpiTip3 = _kpiVel.teamDetails.map(d => `${escapeHtml(d.name)}: ${d.avgVel} pts/spr (min ${d.minVel}, max ${d.maxVel})`).join('\n');
  const _kpiTip4 = `${_kpiSprintsLeft} sprint${_kpiSprintsLeft > 1 ? 's' : ''} restant${_kpiSprintsLeft > 1 ? 's' : ''} sur ${_kpiVel.sprintsPerPI}\n${_kpiVel.sprintsDone} sprint${_kpiVel.sprintsDone > 1 ? 's' : ''} fermé${_kpiVel.sprintsDone > 1 ? 's' : ''}\nReste estimé : ${_kpiRemaining} pts`;
  const _kpiTip5 = `${_kpiEpics.length} epics avec tickets\n${_kpiEpicsDone} entièrement terminés\n${_kpiEpics.length - _kpiEpicsDone} en cours`;

  const relKpis = `
    <div class="rel-header" style="margin-top:0;">
      <div class="rel-kpi" title="${_kpiTip1}" style="cursor:default"><div class="rel-kpi-val" style="color:${_kpiPctColor}">${_kpiPct}%</div><div class="rel-kpi-label">Avancement PI</div></div>
      <div class="rel-kpi" title="${_kpiTip2}" style="cursor:default"><div class="rel-kpi-val">${_kpiDonePts}<small>/${_kpiVel.capacity || _kpiTotalPts} pts</small></div><div class="rel-kpi-label">Terminé / Engagé</div></div>
      <div class="rel-kpi" title="${_kpiTip3}" style="cursor:default"><div class="rel-kpi-val">${_kpiVel.avg}<small> pts/sprint</small></div><div class="rel-kpi-label">Vélocité (moy. équipes)</div></div>
      <div class="rel-kpi" title="${_kpiTip4}" style="cursor:default"><div class="rel-kpi-val">${_kpiSprintsLeft}<small>/${_kpiVel.sprintsPerPI}</small></div><div class="rel-kpi-label">Sprints restants</div></div>
      <div class="rel-kpi" title="${_kpiTip5}" style="cursor:default"><div class="rel-kpi-val">${_kpiEpicsDone}<small>/${_kpiEpics.length}</small></div><div class="rel-kpi-label">Epics terminés</div></div>
    </div>`;

  // ============================================================
  // RENDU - sections thématiques collapsibles
  // ============================================================

  // 1. VISION & AVANCEMENT (includes Fist of Five summary)
  const ppFistSummary = typeof _ppFistSummarySection === 'function' ? _ppFistSummarySection(activeTeams) : '';
  const secVision = `
    <div class="rm-top-grid">
      ${_roadmapVelocityCard(velRef, cap80, cap20)}
      ${_roadmapBufferCard(velRef.avg, cap20)}
    </div>
    ${relKpis}
    ${ppFistSummary}
    <div class="chart-card" style="margin-top:8px;"><div class="chart-title">📈 Évolution Confiance PI</div><div class="chart-wrap" style="height:180px"><canvas id="fistChartRoadmap"></canvas></div></div>
    ${_roadmapVisual(epicData, sprintPlan, s)}
    ${epicData.length ? `<div class="rel-projection-table" style="margin-top:16px;">${_relProjectionTable(projections, avgVelocity, s)}</div>` : ''}
  `;

  // 2. PLANIFICATION
  const ppObjSummary = typeof _ppObjSummarySection === 'function' ? _ppObjSummarySection(activeTeams) : '';
  const secPlanification = `
    ${_roadmapTimeline(velRef, cap80, sprintPlan)}
    ${_roadmapSprintPlan(sprintPlan, cap80, cap20)}
    ${ppObjSummary}
  `;

  // 3. CAPACITÉ & CHARGE
  const ppReadinessHtml = readiness && typeof _ppSectionHeader === 'function' ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-bottom:16px;">
      <div id="pp-readiness-wrap">${_ppSectionHeader(readiness)}</div>
      <div id="pp-unpointed">${typeof _ppUnpointedBanner === 'function' ? _ppUnpointedBanner(unpointed) : ''}</div>
    </div>` : '';
  const ppLoadMatrix = typeof _ppLoadMatrix === 'function' ? `<div id="pp-load-wrap">${_ppLoadMatrix(activeTeams, sprintsPerPI, backlog)}</div>` : '';
  const ppCapacity = typeof _ppCapacitySection === 'function' ? _ppCapacitySection(activeTeams, sprintsPerPI, membersByTeam) : '';
  const secCapacite = `
    ${ppReadinessHtml}
    ${ppLoadMatrix}
    ${ppCapacity}
  `;

  // 4. RISQUES & QUALITÉ (ROAM moved to PI Planning)
  const ppDeps = typeof _ppDepsSection === 'function' ? _ppDepsSection(activeTeams) : '';
  const secRisques = `
    ${ppDeps}
    ${_roadmapBacklogHealth(backlog)}
  `;

  // 5. BACKLOG
  const secBacklog = _roadmapBacklogTable(backlog, cap80);

  // ---- Sommaire navigation ----
  // 6. MÉTRIQUES
  const secMetriques = _metricsChartsHTML('rm');

  const _rmTabs = [
    { id: 'vision',        icon: '📊', label: 'Vision' },
    { id: 'planification', icon: '📅', label: 'Planification' },
    { id: 'capacite',      icon: '⚡', label: 'Capacité' },
    { id: 'risques',       icon: '⚠️', label: 'Risques' },
    { id: 'metriques',     icon: '📈', label: 'Métriques' },
    { id: 'backlog',       icon: '📋', label: 'Backlog' },
  ];

  const ppPISel = typeof _ppPISelector === 'function' ? _ppPISelector() : '';
  const tabsHtml = `<div class="rm-tabs" id="rm-tabs">
    ${_rmTabs.map(t => `<button class="rm-tab" data-sec="${t.id}" onclick="_rmScrollTo('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
    <span class="rm-tabs-spacer"></span>
    ${ppPISel}
  </div>`;

  // ---- Assemblage final ----
  el.innerHTML = `
    ${tabsHtml}
    ${_rmSection('vision',       '📊', 'Vision & Avancement',    secVision)}
    ${_rmSection('planification','📅', 'Planification',           secPlanification)}
    ${_rmSection('capacite',     '⚡', 'Capacité & Charge',       secCapacite)}
    ${_rmSection('risques',      '⚠️', 'Risques & Qualité',      secRisques)}
    ${_rmSection('metriques',    '📈', `Métriques · ${_kpiPiLabel}`, secMetriques)}
    ${_rmSection('backlog',      '📋', 'Backlog',                 secBacklog, false)}
  `;

  // Active tab tracking on scroll
  _rmInitScrollSpy();

  // Fist of Five evolution chart
  if (typeof _renderFistChart === 'function') _renderFistChart('fistChartRoadmap', activeTeams);

  // Metrics charts (reusable)
  if (typeof _renderMetricsCharts === 'function') _renderMetricsCharts('rm', activeTeams);
}

// ============================================================
// Calcul de la vélocité de référence
// ============================================================

function _roadmapVelocity() {
  const activeTeams = getActiveTeams();
  const maxLen = (CONFIG.sync && CONFIG.sync.velocityHistoryCount) || 5;

  // Agréger les vélocités par position dans l'historique
  // Tri par date (startDate) puis par nom de sprint pour garantir l'ordre chronologique
  const _sortVH = (arr) => [...arr].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
    // Fallback : extraire le numéro d'itération du nom (ex: "Ité. 27.4" → 27.4)
    const numA = (a.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1];
    const numB = (b.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1];
    if (numA && numB) return parseFloat(numA) - parseFloat(numB);
    return a.name.localeCompare(b.name);
  });

  const byPos = [];
  const names = [];
  const startDates = [];
  const endDates = [];
  const ticketsByPos = [];
  const bufferByPos = [];
  const membersByPos = [];
  const velByTeam = [];
  activeTeams.forEach(tid => {
    const tc = CONFIG.teams[tid];
    if (!tc || !Array.isArray(tc.velocityHistory) || !tc.velocityHistory.length) return;
    _sortVH(tc.velocityHistory).slice(-maxLen).forEach((e, i) => {
      byPos[i] = (byPos[i] || 0) + (e.velocity || 0);
      if (!names[i] && e.name) names[i] = e.name;
      if (!startDates[i] && e.startDate) startDates[i] = e.startDate;
      if (!endDates[i] && e.endDate) endDates[i] = e.endDate;
      if (!ticketsByPos[i]) ticketsByPos[i] = [];
      if (e.tickets) ticketsByPos[i].push(...e.tickets);
      if (!bufferByPos[i]) bufferByPos[i] = [];
      if (e.bufferTickets) bufferByPos[i].push(...e.bufferTickets);
      if (!membersByPos[i]) membersByPos[i] = new Set();
      if (e.members) e.members.forEach(m => membersByPos[i].add(m));
      if (!velByTeam[i]) velByTeam[i] = [];
      velByTeam[i].push({ team: tid, vel: e.velocity || 0 });
    });
  });

  if (!byPos.length) {
    const target = activeTeams.reduce((s, tid) => s + (CONFIG.teams[tid]?.velocity || 0), 0);
    const v = target || 80;
    return { avg: v, min: v, max: v, history: [], hasHistory: false };
  }

  // Use centralized PI velocity stats for avg/min/max
  const _pi = _piDetect();
  const _vs = _piVelocityStats(activeTeams, _pi.piNum);
  const avg = _vs.avg;
  const min = _vs.min;
  const max = _vs.max;

  const history = byPos.map((v, i) => ({
    vel:  v,
    name: names[i] || `S-${byPos.length - i}`,
    startDate: startDates[i] || null,
    endDate: endDates[i] || null,
    tickets: ticketsByPos[i] || [],
    bufferTickets: bufferByPos[i] || [],
    members: membersByPos[i] ? [...membersByPos[i]] : [],
    teamBreakdown: velByTeam[i] || [],
  }));
  return { avg, min, max, history, hasHistory: true };
}

// ============================================================
// Carte vélocité + barre 80/20
// ============================================================

function _roadmapVelocityCard(vel, cap80, cap20) {
  // Use centralized PI stats for buffer
  const _pi = _piDetect();
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  const _buf = _piBufferStats(activeTeams, _pi.piNum);
  const _velStats = _piVelocityStats(activeTeams, _pi.piNum);

  // Only use current sprint tickets if the active sprint belongs to the selected PI
  const _allTickets = typeof getTickets === 'function' ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const totalPts = _pi.isCurrent ? _allTickets.reduce((a, t) => a + (t.points || 0), 0) : 0;
  const bufferTk = _buf.tickets;
  const bufferPts = _buf.totalPts;
  const bufferCount = _buf.totalTix;

  // PI-level totals computed after bars are built (uses piHistory)
  let piTotalPts = 0; // set after bar build

  // Build exactly sprintsPerPI bars from centralized PI velocity stats
  const sprintsPerPI = _velStats.sprintsPerPI;
  const piSprints = _velStats.piSprints; // [{ key: "28.1", vel: 6 }, ...]

  // Detect current sprint index within PI — only relevant for the current PI
  const ipInfo = _detectIPSprint();
  const sprintIdx = _pi.isCurrent ? (ipInfo.sprintInPI || 1) : 0; // 0 = no active sprint in this PI

  // Compute current sprint pts for the active bar (feature only, no buffer)
  // Only subtract buffer pts from the current sprint, not the whole PI buffer
  const currentSprintBufPts = _pi.isCurrent ? _allTickets.filter(t => t.buffer).reduce((a, t) => a + (t.points || 0), 0) : 0;
  const featurePts = totalPts - currentSprintBufPts;
  const allVals = [...piSprints.map(s => s.vel), ...(featurePts > 0 ? [featurePts] : [])];
  const piMax = Math.max(...allVals, 1);

  // Build all PI bars
  const piBars = [];
  for (let i = 0; i < sprintsPerPI; i++) {
    const sprintKey = _pi.piNum ? `${_pi.piNum}.${i + 1}` : `${i + 1}`;
    const piSp = piSprints.find(s => s.key === sprintKey);
    const isCurrent = (i + 1) === sprintIdx;
    const isPast = (i + 1) < sprintIdx;
    const isFuture = (i + 1) > sprintIdx;

    if ((isPast || !_pi.isCurrent) && piSp) {
      // Completed sprint from velocity history (or any sprint with data when viewing non-current PI)
      const pct = piMax ? Math.round((piSp.vel / piMax) * 100) : 0;
      piBars.push(`<div class="rm-hist-bar-wrap" title="Ité ${escapeHtml(sprintKey)}: ${piSp.vel} pts">
        <div class="rm-hist-bar-zone"><div class="rm-hist-bar-inner" style="height:${Math.max(pct, 4)}%"></div></div>
        <div class="rm-hist-bar-val">${piSp.vel}</div>
        <div class="rm-hist-bar-label">${escapeHtml(sprintKey)}</div>
      </div>`);
    } else if (isCurrent) {
      // Current active sprint (feature pts only, buffer shown separately)
      const curPts = featurePts;
      const curPct = piMax ? Math.round((curPts / piMax) * 100) : 0;
      piBars.push(`<div class="rm-hist-bar-wrap rm-hist-bar-current" title="Ité ${escapeHtml(sprintKey)}: ${curPts} pts (hors buffer)">
        <div class="rm-hist-bar-zone">
          <div class="rm-hist-bar-inner" style="height:${Math.max(curPct, 4)}%"></div>
        </div>
        <div class="rm-hist-bar-val">${curPts}</div>
        <div class="rm-hist-bar-label">${escapeHtml(sprintKey)}</div>
      </div>`);
    } else {
      // Future or missing sprint placeholder
      piBars.push(_emptyBar(i + 1));
    }
  }

  function _emptyBar(num) {
    const isIP = num === sprintsPerPI;
    const label = _pi.piNum ? `${_pi.piNum}.${num}` : (isIP ? 'IP' : `S${num}`);
    return `<div class="rm-hist-bar-wrap rm-hist-bar-future" title="${escapeHtml(label)} — à venir">
      <div class="rm-hist-bar-zone"><div class="rm-hist-bar-inner rm-hist-bar-placeholder" style="height:15%"></div></div>
      <div class="rm-hist-bar-val">–</div>
      <div class="rm-hist-bar-label">${escapeHtml(label)}</div>
    </div>`;
  }

  const barsHtml = piBars.join('');

  // PI totals: from centralized velocity stats (delivered from closed sprints + current sprint)
  piTotalPts = _velStats.delivered + totalPts;

  // Buffer bar chart: per-status breakdown (centralized stats)
  const bufDonePts = _buf.donePts;
  const bufInprogPts = _buf.inprogPts;
  const bufTodoPts = _buf.todoPts;
  const bufBlockedPts = _buf.blockedPts;
  const bufMax = Math.max(bufferPts, 1);
  const _bufBar = (pts, color, label) => {
    const pct = Math.round((pts / bufMax) * 100);
    return `<div class="rm-hist-bar-wrap" title="${escapeHtml(label)}: ${pts} pts">
      <div class="rm-hist-bar-zone"><div class="rm-hist-bar-inner" style="height:${Math.max(pct, pts ? 4 : 0)}%;background:${color};opacity:1;"></div></div>
      <div class="rm-hist-bar-val">${pts}</div>
      <div class="rm-hist-bar-label">${escapeHtml(label)}</div>
    </div>`;
  };
  const bufBars = _bufBar(bufTodoPts, '#94A3B8', '⬜ Todo')
    + _bufBar(bufInprogPts, '#3B82F6', '🔄 WIP')
    + _bufBar(bufBlockedPts, '#F87171', '🚧 Bloqué')
    + _bufBar(bufDonePts, '#10B981', '✅ Done');

  const bufPctDone = bufferPts ? Math.round(_buf.donePts / bufferPts * 100) : 0;

  return `
    <div class="card rm-vel-card">
      <div class="rm-card-title">⚡ État des lieux du PI</div>
      <div class="rm-vel-cols">
        <div class="rm-vel-col">
          <div class="rm-vel-col-title" onclick="_toggleCapTickets('feat')">📊 Vélocité</div>
          <div class="rm-vel-main">
            <div class="rm-vel-big">${piTotalPts}<small> pts au total</small></div>
            <div class="rm-vel-sub">${_velStats.piSprints.length ? `Min: <b>${_velStats.min}</b> · Max: <b>${_velStats.max}</b>` : (vel.hasHistory ? `Min: <b>${vel.min}</b> · Max: <b>${vel.max}</b>` : 'Cible config (pas d\'historique)')}</div>
          </div>
          <div class="rm-hist-bars">${barsHtml}</div>
          <div class="rm-pi-summary">
            <div class="rm-pi-kpi rm-kpi-hover">
              <div class="rm-pi-kpi-val">${_velStats.avg}</div>
              <div class="rm-pi-kpi-label">Moy. pts/sprint</div>
              <div class="rm-kpi-popin">
                <div class="rm-kpi-popin-title">Vélocité moyenne par équipe</div>
                ${_velStats.teamDetails.map(d => `<div class="rm-kpi-popin-row">
                  <span class="rm-kpi-popin-dot" style="background:${d.color}"></span>
                  <span class="rm-kpi-popin-name">${escapeHtml(d.name)}</span>
                  <span class="rm-kpi-popin-val">${d.avgVel} <small>pts/spr</small></span>
                  <span class="rm-kpi-popin-val" style="color:#94A3B8;font-size:9px">${d.minVel}–${d.maxVel}</span>
                </div>`).join('')}
                <div class="rm-kpi-popin-footer">
                  <span>Moyenne sur l'historique complet · min–max par équipe</span>
                </div>
              </div>
            </div>
            <div class="rm-pi-kpi rm-kpi-hover">
              <div class="rm-pi-kpi-val">${_velStats.capacity}</div>
              <div class="rm-pi-kpi-label">Capacité PI</div>
              <div class="rm-kpi-popin">
                <div class="rm-kpi-popin-title">Capacité par équipe</div>
                ${_velStats.teamDetails.map(d => `<div class="rm-kpi-popin-row">
                  <span class="rm-kpi-popin-dot" style="background:${d.color}"></span>
                  <span class="rm-kpi-popin-name">${escapeHtml(d.name)}</span>
                  <span class="rm-kpi-popin-val">${d.avgVel} <small>pts/spr</small></span>
                  <span class="rm-kpi-popin-val">${d.teamCap} <small>pts PI</small></span>
                </div>`).join('')}
                <div class="rm-kpi-popin-footer">
                  <span>Moy/sprint × ${_velStats.sprintsPerPI} sprints = capacité PI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="rm-vel-col">
          <div class="rm-vel-col-title rm-vel-col-title-buf" onclick="_toggleCapTickets('buf')">🛡️ Buffer</div>
          <div class="rm-vel-main">
            <div class="rm-vel-big" style="color:#8B5CF6;">${bufferPts}<small> pts · ${bufferCount} tickets</small></div>
            <div class="rm-vel-sub">${bufPctDone}% terminé · cible ${cap20} pts (20%)</div>
          </div>
          <div class="rm-hist-bars">${bufBars}</div>
          <div class="rm-pi-summary">
            ${(() => {
              // Per-status detail for remaining buffer
              const bufRemPts = bufferPts - bufDonePts;
              const bufRemTix = bufferCount - _buf.doneTix;
              return `<div class="rm-pi-kpi rm-pi-kpi-buf rm-kpi-hover">
                <div class="rm-pi-kpi-val">${bufRemPts}</div>
                <div class="rm-pi-kpi-label">Restants (pts)</div>
                <div class="rm-kpi-popin">
                  <div class="rm-kpi-popin-title">Buffer restant par statut</div>
                  <div class="rm-kpi-popin-row">
                    <span>⬜</span>
                    <span class="rm-kpi-popin-name">À faire</span>
                    <span class="rm-kpi-popin-val">${bufTodoPts} <small>pts</small></span>
                  </div>
                  <div class="rm-kpi-popin-row">
                    <span>🔄</span>
                    <span class="rm-kpi-popin-name">En cours</span>
                    <span class="rm-kpi-popin-val">${bufInprogPts} <small>pts</small></span>
                  </div>
                  <div class="rm-kpi-popin-row">
                    <span>🚧</span>
                    <span class="rm-kpi-popin-name">Bloqué</span>
                    <span class="rm-kpi-popin-val">${bufBlockedPts} <small>pts</small></span>
                  </div>
                  <div class="rm-kpi-popin-footer">
                    <span>${bufRemTix} ticket${bufRemTix > 1 ? 's' : ''} restant${bufRemTix > 1 ? 's' : ''} · cible ${cap20} pts (20%)</span>
                  </div>
                </div>
              </div>`;
            })()}
            ${(() => {
              // Per-team detail for done buffer
              const bufTeams = {};
              (bufferTk || []).filter(t => isDone(t.status)).forEach(t => {
                const tid = t.team || '?';
                if (!bufTeams[tid]) bufTeams[tid] = { pts: 0, count: 0, color: (CONFIG.teams[tid]?.color || '#94A3B8'), name: (CONFIG.teams[tid]?.name || tid) };
                bufTeams[tid].pts += (t.points || 0);
                bufTeams[tid].count++;
              });
              const teamRows = Object.values(bufTeams).sort((a, b) => b.pts - a.pts).map(d =>
                `<div class="rm-kpi-popin-row">
                  <span class="rm-kpi-popin-dot" style="background:${d.color}"></span>
                  <span class="rm-kpi-popin-name">${escapeHtml(d.name)}</span>
                  <span class="rm-kpi-popin-val">${d.count} <small>tickets</small></span>
                  <span class="rm-kpi-popin-val">${d.pts} <small>pts</small></span>
                </div>`
              ).join('');
              return `<div class="rm-pi-kpi rm-pi-kpi-buf rm-kpi-hover">
                <div class="rm-pi-kpi-val">${bufDonePts}</div>
                <div class="rm-pi-kpi-label">Terminés (pts)</div>
                <div class="rm-kpi-popin">
                  <div class="rm-kpi-popin-title">Buffer terminé par équipe</div>
                  ${teamRows || '<div class="rm-kpi-popin-row" style="color:#64748B">Aucun ticket buffer terminé</div>'}
                  <div class="rm-kpi-popin-footer">
                    <span>${_buf.doneTix} ticket${_buf.doneTix > 1 ? 's' : ''} · ${bufPctDone}% du buffer consommé</span>
                  </div>
                </div>
              </div>`;
            })()}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div class="rm-bar-split" title="Répartition idéale SAFe">
          <div class="rm-bar-feat" style="width:80%">80% Features · Idéal</div>
          <div class="rm-bar-buf"  style="width:20%">20% Buffer</div>
        </div>
        ${(() => {
          const featPts = piTotalPts - bufferPts;
          const realBufPct = piTotalPts ? Math.round(bufferPts / piTotalPts * 100) : 0;
          const realFeatPct = 100 - realBufPct;
          const bufColor = realBufPct > 25 ? '#DC2626' : realBufPct < 15 ? '#D97706' : '#8B5CF6';
          return `<div class="rm-bar-split" title="Répartition réelle : ${featPts} pts features / ${bufferPts} pts buffer">
            <div class="rm-bar-feat" style="width:${realFeatPct}%;opacity:.85;cursor:pointer" onclick="_toggleCapTickets('feat')">${realFeatPct}% Features · Réel <small>(${featPts} pts)</small></div>
            <div class="rm-bar-buf"  style="width:${Math.max(realBufPct, 3)}%;background:${bufColor};opacity:.85;cursor:pointer" onclick="_toggleCapTickets('buf')">${realBufPct}% Buffer <small>(${bufferPts} pts)</small></div>
          </div>`;
        })()}
      </div>
      <div id="rm-cap-tickets"></div>
    </div>`;
}

// Toggle ticket list under the 80/20 bar
let _capTicketsMode = null;
function _toggleCapTickets(mode) {
  const el = document.getElementById('rm-cap-tickets');
  if (!el) return;
  const blocks = document.querySelectorAll('.rm-cap-block');

  // Toggle off if same mode clicked
  if (_capTicketsMode === mode) {
    _capTicketsMode = null;
    el.innerHTML = '';
    blocks.forEach(b => b.classList.remove('active'));
    return;
  }
  _capTicketsMode = mode;
  blocks.forEach(b => b.classList.remove('active'));

  // Use centralized PI tickets grouped by sprint
  const _pi = _piDetect();
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  const allPITix = _piAllTickets(activeTeams, _pi.piNum);
  let filtered;
  if (mode === 'buf') {
    filtered = allPITix.filter(t => t.buffer);
    document.querySelector('.rm-cap-buf')?.classList.add('active');
  } else {
    filtered = allPITix.filter(t => !t.buffer);
    document.querySelector('.rm-cap-feat')?.classList.add('active');
  }

  if (!filtered.length) {
    el.innerHTML = `<div class="rm-cap-tickets"><div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">Aucun ticket ${mode === 'buf' ? 'buffer' : 'feature'} sur ce PI</div></div>`;
    return;
  }

  const totalPts = filtered.reduce((s, t) => s + (t.points || 0), 0);
  const donePts  = filtered.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const doneCount = filtered.filter(t => isDone(t.status)).length;

  const _capTicketRow = (t) => {
    const done = isDone(t.status);
    const st = done ? '✅' : t.status === 'blocked' ? '🚧' : t.status === 'inprog' || t.status === 'review' ? '🔵' : t.status === 'test' ? '🧪' : '⬜';
    const teamColor = CONFIG.teams[t.team]?.color || 'var(--text-muted)';
    return `<div class="rm-cap-row${done ? ' rm-cap-done' : ''}" onclick="openModal('${t.id}')" style="display:flex;align-items:center;gap:6px;padding:3px 10px;cursor:pointer;font-size:11px;">
      <span style="flex-shrink:0">${st}</span>
      <span class="badge badge-${t.type}" style="font-size:9px;flex-shrink:0;">${typeName(t.type)}</span>
      <span style="color:var(--text-muted);font-weight:600;flex-shrink:0;font-size:10px">${t.id}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${escapeHtml(t.title) || ''}</span>
      <span style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${teamColor}" title="${escapeHtml(t.team) || ''}"></span>
      ${ptsBadge(t.points, {size:'small'})}
    </div>`;
  };

  // Group tickets by sprint
  const _sprintKey = (t) => {
    // Also check CONFIG sprint label and team sprint names for the PI pattern
    const teamSprintName = t.team ? (CONFIG.teams[t.team]?.sprintName || '') : '';
    const configLabel = CONFIG.sprint?.label || '';
    const sources = [t.sprintName, ...(t.allSprints || []), t.piSprint || '', teamSprintName, configLabel];
    for (const s of sources) {
      if (!s) continue;
      const m = s.match(/(\d{2,3}\.\d+)/);
      if (m) return m[1];
    }
    // Fallback: use sprint name or CONFIG label
    if (t.sprintName) return t.sprintName;
    if (t.sprint) return configLabel || 'Sprint actif';
    return 'Non planifié';
  };
  const bySprint = {};
  filtered.forEach(t => {
    const key = _sprintKey(t);
    (bySprint[key] = bySprint[key] || []).push(t);
  });
  const sprintKeys = Object.keys(bySprint).sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const icon = mode === 'buf' ? '🛡️' : '📦';
  const label = mode === 'buf' ? 'Buffer' : 'Features & Stories';
  let sprintSections = '';
  sprintKeys.forEach(key => {
    const tks = bySprint[key].sort((a, b) => {
      const aDone = isDone(a.status) ? 1 : 0;
      const bDone = isDone(b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (b.points || 0) - (a.points || 0);
    });
    const sPts = tks.reduce((s, t) => s + (t.points || 0), 0);
    const sDonePts = tks.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
    sprintSections += `<div style="padding:5px 10px 2px;font-size:10px;font-weight:700;color:var(--primary);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <span>📅 Ité ${key}</span>
      <span style="display:flex;gap:4px;">
        <span class="rm-cap-chip">${tks.length} ticket${tks.length > 1 ? 's' : ''}</span>
        <span class="rm-cap-chip rm-cap-chip-done">${sDonePts} pts done</span>
        <span class="rm-cap-chip">${sPts} pts</span>
      </span>
    </div>`;
    sprintSections += tks.map(_capTicketRow).join('');
  });

  el.innerHTML = `<div class="rm-cap-tickets">
    <div style="padding:6px 10px;font-size:10px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span>${icon} ${label} — ${filtered.length} ticket${filtered.length > 1 ? 's' : ''} · ${totalPts} pts</span>
      <span style="font-size:9px;">✅ ${doneCount} terminés (${donePts} pts)</span>
    </div>
    ${sprintSections}
  </div>`;
}

// ============================================================
// Carte breakdown buffer 20%
// ============================================================

function _roadmapBufferCard(totalVel, cap20) {
  const rows = _BUFFER_CATS.map(cat => {
    const pts = Math.round(totalVel * cat.pct / 100);
    const w   = cap20 ? Math.round(pts / cap20 * 100) : 0;
    return `<div class="rm-buf-row">
      <span class="rm-buf-icon">${cat.icon}</span>
      <div class="rm-buf-info">
        <div class="rm-buf-label">${cat.label}</div>
        <div class="rm-buf-desc">${cat.desc}</div>
        <div class="rm-buf-prog"><div class="rm-buf-prog-fill" style="width:${w}%"></div></div>
      </div>
      <div class="rm-buf-right">
        <span class="rm-buf-pct">${cat.pct}%</span>
        <span class="rm-buf-pts">~${pts} pts</span>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="card rm-buf-card">
      <div class="rm-card-title">🛡️ Détail du buffer 20%
        <small class="rm-card-sub">${cap20} pts/sprint</small>
      </div>
      <div class="rm-buf-rows">${rows}</div>
    </div>`;
}

// ============================================================
// Carte présentiels simulés
// ============================================================

// _roadmapPresentielCard removed

// ============================================================
// Helper - ticket rows pour timeline avec expand + onclick modal
// ============================================================

let _rmTlUid = 0;

function _rmTicketRow(t) {
  return `<div class="rm-tl-ticket" onclick="openModal('${t.id}')" style="cursor:pointer;" title="${escapeHtml(t.title || '')}">
    ${priorityIcon(t.priority)}
    <span class="rm-tl-tid">${_jiraBrowse(t.id)}</span>
    <span class="rm-tl-ticket-title">${escapeHtml(t.title) || t.id}</span>
    <span class="rm-tl-ticket-pts">${t.points ? t.points : '–'}</span>
  </div>`;
}

function _rmTicketList(tickets, previewCount) {
  const uid = 'rm-tl-exp-' + (++_rmTlUid);
  const top = tickets.slice(0, previewCount).map(_rmTicketRow).join('');
  const rest = tickets.slice(previewCount);
  if (!rest.length) return `<div class="rm-tl-tickets">${top}</div>`;
  const hidden = rest.map(_rmTicketRow).join('');
  return `<div class="rm-tl-tickets">
    ${top}
    <div id="${uid}" style="display:none">${hidden}</div>
    <div class="rm-tl-ticket-more" style="cursor:pointer" onclick="var el=document.getElementById('${uid}');if(el.style.display==='none'){el.style.display='block';this.textContent='▲ Réduire';}else{el.style.display='none';this.textContent='+ ${rest.length} autres tickets';}">+ ${rest.length} autres tickets</div>
  </div>`;
}

// ============================================================
// Chronologie des sprints (passés + actuel + futurs)
// ============================================================

function _roadmapTimeline(velRef, cap80, sprintPlan) {
  const activeTeams = getActiveTeams();
  const _pi = _piDetect();
  const selPiNum = _pi.piNum;
  const isCurrent = _pi.isCurrent;

  // Label du sprint actif : nom du board de l'équipe sélectionnée si une seule équipe active
  const currentLabel = (activeTeams.length === 1 && CONFIG.teams[activeTeams[0]]?.sprintName)
    ? CONFIG.teams[activeTeams[0]].sprintName
    : CONFIG.sprint.label || `Sprint ${CONFIG.sprint.current || 'Actif'}`;
  const tickets  = getTickets();
  const ptsDone  = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const ptsTotal = tickets.reduce((a, t) => a + (t.points || 0), 0) || 1;
  const pctDone  = Math.round(ptsDone / ptsTotal * 100);

  // Filtrer l'historique par PI sélectionné
  const piRegex = selPiNum ? new RegExp(`\\b${selPiNum}\\.\\d+`) : null;

  // Helper: format date range + holidays for a sprint period
  const _fmtDate = d => { if (!d) return ''; const dt = typeof d === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d) : d; return isNaN(dt) ? '' : `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`; };
  const _sprintHolidays = (startStr, endStr) => {
    if (!startStr || !endStr || typeof _frenchHolidays !== 'function') return [];
    const s = typeof startStr === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(startStr) ? startStr + 'T00:00:00' : startStr) : new Date(startStr);
    const e = typeof endStr === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(endStr) ? endStr + 'T00:00:00' : endStr) : new Date(endStr);
    if (isNaN(s) || isNaN(e)) return [];
    const hols = [..._frenchHolidays(s.getFullYear()), ...(e.getFullYear() !== s.getFullYear() ? _frenchHolidays(e.getFullYear()) : [])];
    return hols.filter(h => h.d >= s && h.d <= e);
  };
  const _dateHtml = (start, end, holidays) => {
    const ds = _fmtDate(start), de = _fmtDate(end);
    const dateStr = ds && de ? `${ds} → ${de}` : ds || de || '';
    const holStr = holidays?.length ? holidays.map(h => `<span class="rm-tl-hol" title="${escapeHtml(h.name)}">${h.d ? _fmtDate(h.d) + ' ' : ''}${escapeHtml(h.name)}</span>`).join('') : '';
    return dateStr || holStr ? `<div class="rm-tl-dates">${dateStr ? `<span class="rm-tl-daterange">${dateStr}</span>` : ''}${holStr}</div>` : '';
  };

  // Compute future sprint dates from _rotWeekInfos
  const _futureSprintDates = {};
  if (typeof _rotWeekInfos === 'function') {
    const wi = _rotWeekInfos(0);
    const dur = CONFIG.sprint?.durationDays || 14;
    const wps = dur / 7;
    const sprintsPerPI = CONFIG.sprint?.sprintsPerPI || 5;
    // Current sprint index
    let curIdx = 0;
    for (const tc of Object.values(CONFIG.teams || {})) {
      const m = (tc.sprintName || '').match(/(\d{2,3})\.(\d+)\s*$/);
      if (m) { curIdx = parseInt(m[2]) - 1; break; }
    }
    for (let si = curIdx + 1; si < sprintsPerPI; si++) {
      const wIdx = si * wps;
      const wEnd = wIdx + wps - 1;
      if (wi[wIdx] && wi[wEnd]) {
        _futureSprintDates[si] = { start: wi[wIdx]._start, end: wi[wEnd]._end, holidays: [] };
        // Collect holidays in this sprint
        for (let w = wIdx; w <= wEnd; w++) {
          if (wi[w]?.holidays?.length) {
            wi[w].holidays.forEach(hName => {
              _futureSprintDates[si].holidays.push(hName);
            });
          }
        }
      }
    }
  }

  // Filtrer l'historique : ne garder que les sprints du PI sélectionné
  const piHistory = piRegex
    ? velRef.history.filter(h => piRegex.test(h.name))
    : velRef.history;

  // Cartes sprints passés du PI sélectionné (tous les sprints terminés du PI)
  const pastSprints = piHistory;
  const pastCards = pastSprints.map((h, hIdx) => {
    const pct    = velRef.max ? Math.round(h.vel / velRef.max * 100) : 80;
    const hols = _sprintHolidays(h.startDate, h.endDate);
    const allTix = [...(h.tickets || []), ...(h.bufferTickets || [])];
    const totalTix = allTix.length;
    const bufTix = (h.bufferTickets || []).length;
    const bufPts = (h.bufferTickets || []).reduce((s, t) => s + (t.points || 0), 0);
    const members = h.members || [];
    const teamBd = h.teamBreakdown || [];

    // Type breakdown
    const typeMap = {};
    allTix.forEach(t => { typeMap[t.type || 'story'] = (typeMap[t.type || 'story'] || 0) + 1; });
    const typePills = Object.entries(typeMap).map(([type, cnt]) => {
      const c = (typeof CONFIG !== 'undefined' && CONFIG.typeColors?.[type]) || '#64748B';
      return `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${c}22;color:${c};border:1px solid ${c}44;font-weight:600;">${typeof typeName === 'function' ? typeName(type) : type}×${cnt}</span>`;
    }).join(' ');

    // Team velocity breakdown
    const teamHtml = teamBd.length > 1 ? teamBd.map(tb => {
      const tc = CONFIG.teams?.[tb.team];
      const color = tc?.color || 'var(--text-muted)';
      return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;"><span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span><span style="flex:1;color:var(--text-muted)">${escapeHtml(tb.team)}</span><span style="font-weight:700;">${tb.vel} pts</span></div>`;
    }).join('') : '';

    // Ticket list (top 5)
    const topTickets = allTix.map(t => {
      const c = (typeof CONFIG !== 'undefined' && CONFIG.typeColors?.[t.type]) || '#64748B';
      const pts = t.points ? `<span style="font-weight:700;margin-left:auto;">${t.points}</span>` : '';
      return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;padding:2px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="openModal('${(t.id || '').replace(/'/g, "\\'")}')"><span style="color:${c};font-weight:700;min-width:65px;">${t.id || ''}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${escapeHtml(t.title || t.summary || '')}</span>${pts}</div>`;
    }).join('');

    // Members avatars
    const memberAvatars = members.slice(0, 6).map(m => {
      const ini = typeof window.initials === 'function' ? window.initials(m) : (m || '?').slice(0, 2).toUpperCase();
      return `<span class="avatar" style="width:18px;height:18px;font-size:8px;background:#475569;" title="${escapeHtml(m)}">${ini}</span>`;
    }).join('');
    const memberMore = members.length > 6 ? `<span style="font-size:9px;color:var(--text-muted);">+${members.length - 6}</span>` : '';

    const detailId = `rm-tl-detail-${hIdx}`;
    const hasDetail = totalTix > 0 || teamBd.length > 1;

    return `<div class="rm-tl-card rm-tl-past${hasDetail ? ' rm-tl-clickable' : ''}" ${hasDetail ? `onclick="_rmToggleTlDetail('${detailId}')"` : ''}>
      <div class="rm-tl-dot rm-tl-dot-past"></div>
      <div class="rm-tl-name">${escapeHtml(h.name.replace(/sprint\s*/i, 'S '))}</div>
      ${_dateHtml(h.startDate, h.endDate, hols)}
      <div class="rm-tl-pts">${h.vel} pts réalisés${bufTix ? ` · <span style="color:#7C3AED">${bufPts} buf</span>` : ''}</div>
      <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-past" style="width:${pct}%"></div></div></div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:4px;">
        <div class="rm-tl-badge rm-tl-badge-past">✓ ${totalTix} tickets</div>
        ${memberAvatars}${memberMore}
      </div>
      ${hasDetail ? `<div class="rm-tl-detail" id="${detailId}" style="display:none;" onclick="event.stopPropagation()">
        ${teamHtml ? `<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border);">${teamHtml}</div>` : ''}
        ${typePills ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">${typePills}</div>` : ''}
        ${topTickets}
      </div>` : ''}
    </div>`;
  });

  // Carte sprint actuel
  const pctBar = Math.min(100, pctDone);
  const curStart = CONFIG.sprint?.startDate || CONFIG.sprint?.startDateISO || '';
  const curEnd = CONFIG.sprint?.endDate || CONFIG.sprint?.endDateISO || '';
  const curHols = _sprintHolidays(curStart, curEnd);
  const currentCard = `<div class="rm-tl-card rm-tl-current">
    <div class="rm-tl-dot rm-tl-dot-current"></div>
    <div class="rm-tl-name">${currentLabel}</div>
    ${_dateHtml(curStart, curEnd, curHols)}
    <div class="rm-tl-pts">${ptsDone} / ${ptsTotal} pts</div>
    <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-current" style="width:${pctBar}%"></div></div></div>
    <div class="rm-tl-badge rm-tl-badge-current">⚡ En cours</div>
    <div class="rm-tl-pct">${pctDone}%</div>
  </div>`;

  // Cartes sprints futurs simulés
  const futureCards = sprintPlan.map(sp => {
    const pct = cap80 ? Math.min(100, Math.round(sp.pts / cap80 * 100)) : 0;
    const ticketList = _rmTicketList(sp.tickets, 3);

    // Match sprint index to get dates
    const sprintMatch = sp.name?.match(/(\d{2,3})\.(\d+)\s*$/);
    const spIdx = sprintMatch ? parseInt(sprintMatch[2]) - 1 : null;
    const fd = spIdx != null ? _futureSprintDates[spIdx] : null;
    const fHols = fd?.holidays?.length ? fd.holidays.map(n => ({ name: n, d: null })) : [];
    const futureDateHtml = fd ? _dateHtml(fd.start, fd.end, fHols) : '';

    if (sp.isIP) {
      const ipTypes = {};
      sp.tickets.forEach(t => { ipTypes[t.type] = (ipTypes[t.type] || 0) + 1; });
      const ipPills = Object.entries(ipTypes).map(([type, cnt]) => {
        const c = CONFIG.typeColors[type] || CLR.dark;
        return `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${c}22;color:${c};border:1px solid ${c}44;font-weight:600;">${typeName(type)}×${cnt}</span>`;
      }).join(' ');
      return `<div class="rm-tl-card" style="border:2px solid var(--success);background:var(--success-bg);">
        <div class="rm-tl-dot" style="background:#22C55E;border-color:#fff;"></div>
        <div class="rm-tl-name">🍃 ${sp.name || 'IP Sprint'}</div>
        ${futureDateHtml}
        <div class="rm-tl-pts">${sp.pts} pts · dette, bugs, ops</div>
        <div class="rm-tl-badge rm-tl-badge-past" style="background:#D1FAE5;color:#065F46;">🍃 Innovation</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;">${ipPills}</div>
        ${ticketList}
      </div>`;
    }

    return `<div class="rm-tl-card rm-tl-future">
      <div class="rm-tl-dot rm-tl-dot-future"></div>
      <div class="rm-tl-name">${sp.name || 'Sprint +' + sp.idx}</div>
      ${futureDateHtml}
      <div class="rm-tl-pts">${sp.pts} / ${cap80} pts</div>
      <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-future" style="width:${pct}%"></div></div></div>
      <div class="rm-tl-badge rm-tl-badge-future">🗓️ Planifié</div>
      ${ticketList}
    </div>`;
  });

  // Pour un PI non-courant, ne pas afficher le sprint actif ni les futurs simulés
  const showCurrent = isCurrent;
  const showFuture  = isCurrent;

  if (!pastCards.length && !showCurrent && !futureCards.length) return '';

  const allCards = [
    ...pastCards,
    ...(showCurrent ? [currentCard] : []),
    ...(showFuture ? futureCards : []),
  ].join('');
  const parts = [];
  if (pastCards.length) parts.push(`${pastCards.length} terminé${pastCards.length > 1 ? 's' : ''}`);
  if (showCurrent) parts.push('sprint actuel');
  if (showFuture && futureCards.length) parts.push(`${futureCards.length} planifié${futureCards.length > 1 ? 's' : ''}`);
  const label = parts.join(' · ');

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📅 Chronologie des sprints${selPiNum ? ` · PI ${selPiNum}` : ''}</div>
        <span style="font-size:12px;color:var(--text-muted)">${label}</span>
      </div>
      <div class="rm-timeline-wrap">
        <div class="rm-timeline">${allCards}</div>
      </div>
    </div>`;
}

// ============================================================
// Détection du sprint d'Innovation & Planning (IP)
// Si le sprint actif est XX.4 (ou dernier sprint feature du PI),
// le prochain sprint est un IP sprint : pas de stories/features,
// uniquement dette, bugs, ops, évolutions.
// ============================================================

const _IP_ALLOWED_TYPES = new Set(['dette', 'bug', 'incident', 'ops', 'storytech', 'tache']);

function _detectIPSprint() {
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const lastFeature  = sprintsPerPI - 1; // ex: 4 pour 5 sprints/PI (4 feature + 1 IP)

  // Parse sprint names like "Ité 28.4", "Sprint 12.4"
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const toCheck = activeTeams.length ? activeTeams : Object.keys(CONFIG.teams || {});
  let sprintInPI = 0;
  toCheck.forEach(tid => {
    const name = CONFIG.teams[tid]?.sprintName || '';
    const m = name.match(/\b(\d{2,3})\.(\d+)\s*$/);
    if (m) {
      const num = parseInt(m[2], 10);
      if (num > sprintInPI) sprintInPI = num;
    }
  });

  // Si le sprint actuel est le dernier feature sprint, le prochain est IP
  const nextIsIP = sprintInPI >= lastFeature;
  return { nextIsIP, sprintInPI, sprintsPerPI };
}

// ============================================================
// Simulation greedy : répartition du backlog en sprints
// Tient compte du sprint IP (types restreints) et de la vélocité
// ============================================================

function _roadmapSimulateSprints(backlog, cap80, ipInfo) {
  if (!backlog.length || !cap80) return [];

  // If tickets have real JIRA sprint names, group by sprint name first
  const withSprint = backlog.filter(t => t.sprintName);
  const noSprint   = backlog.filter(t => !t.sprintName);

  if (withSprint.length) {
    const sprintOrder = [];
    const sprintMap   = {};
    withSprint.forEach(t => {
      if (!sprintMap[t.sprintName]) {
        sprintMap[t.sprintName] = { name: t.sprintName, tickets: [], pts: 0 };
        sprintOrder.push(t.sprintName);
      }
      sprintMap[t.sprintName].tickets.push(t);
      sprintMap[t.sprintName].pts += t.points || 0;
    });

    sprintOrder.sort((a, b) => {
      const sa = sprintMap[a].tickets[0]?.sprintStart || '';
      const sb = sprintMap[b].tickets[0]?.sprintStart || '';
      return sa.localeCompare(sb);
    });

    const sprints = sprintOrder.map((name, i) => ({
      idx: i + 1, name, tickets: sprintMap[name].tickets, pts: sprintMap[name].pts, isIP: false,
    }));

    if (noSprint.length) {
      _binPackRemaining(sprints, noSprint, cap80, ipInfo);
    }
    return sprints;
  }

  // Fallback: greedy bin-packing (no JIRA sprint names)
  return _binPackFromScratch(backlog, cap80, ipInfo);
}

function _binPackFromScratch(backlog, cap80, ipInfo) {
  const sprints = [];
  const nextIsIP = ipInfo && ipInfo.nextIsIP;

  // If next sprint is IP, create it first with only allowed types
  if (nextIsIP) {
    const ipTickets = backlog.filter(t => _IP_ALLOWED_TYPES.has(t.type));
    const featureTickets = backlog.filter(t => !_IP_ALLOWED_TYPES.has(t.type));
    const ipSprint = { idx: 1, name: 'IP Sprint', tickets: [], pts: 0, isIP: true };
    ipTickets.forEach(t => {
      if (ipSprint.pts + (t.points || 0) <= cap80) {
        ipSprint.tickets.push(t);
        ipSprint.pts += t.points || 0;
      } else {
        featureTickets.push(t); // overflow → next sprints
      }
    });
    sprints.push(ipSprint);
    // Remaining feature tickets go into subsequent sprints
    _fillSprints(sprints, featureTickets, cap80);
  } else {
    _fillSprints(sprints, backlog, cap80);
  }
  return sprints;
}

function _fillSprints(sprints, tickets, cap80) {
  let cur = { idx: sprints.length + 1, tickets: [], pts: 0, isIP: false };
  tickets.forEach(t => {
    const pts = t.points || 0;
    if (cur.tickets.length && cur.pts + pts > cap80) {
      sprints.push({ ...cur });
      cur = { idx: sprints.length + 1, tickets: [], pts: 0, isIP: false };
    }
    cur.tickets.push(t);
    cur.pts += pts;
  });
  if (cur.tickets.length) sprints.push(cur);
}

function _binPackRemaining(sprints, remaining, cap80, ipInfo) {
  const nextIsIP = ipInfo && ipInfo.nextIsIP;

  if (nextIsIP && sprints.length === 0) {
    // First sprint is IP
    const ipTickets = remaining.filter(t => _IP_ALLOWED_TYPES.has(t.type));
    const rest      = remaining.filter(t => !_IP_ALLOWED_TYPES.has(t.type));
    const ipSprint  = { idx: 1, name: 'IP Sprint', tickets: [], pts: 0, isIP: true };
    ipTickets.forEach(t => {
      if (ipSprint.pts + (t.points || 0) <= cap80) {
        ipSprint.tickets.push(t);
        ipSprint.pts += t.points || 0;
      } else {
        rest.push(t);
      }
    });
    sprints.push(ipSprint);
    _fillSprints(sprints, rest, cap80);
  } else {
    _fillSprints(sprints, remaining, cap80);
  }
}

// ============================================================
// Affichage du plan de sprints simulé
// ============================================================

function _roadmapSprintPlan(plan, cap80, cap20) {
  // PI Suivant = 4 sprints feature + 1 sprint Innovation & Planning
  const PI_SPRINTS = 4;
  const featureSprints = plan.slice(0, PI_SPRINTS);

  // Cartes sprints feature (1–4)
  const featureCards = Array.from({ length: PI_SPRINTS }, (_, i) => {
    const s = featureSprints[i];
    if (!s) {
      // Sprint vide (backlog insuffisant pour remplir ce slot)
      return `<div class="rm-sprint-card" style="opacity:.5;border:1.5px dashed var(--border)">
        <div class="rm-sprint-header">
          <span class="rm-sprint-label">Sprint +${i + 1}</span>
          <span class="rm-sprint-pts" style="color:var(--text-muted)">- / ${cap80} pts</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Backlog insuffisant</div>
      </div>`;
    }

    const pct   = cap80 ? Math.min(100, Math.round(s.pts / cap80 * 100)) : 0;
    const color = pct >= 95 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)';

    const typeGroups = {};
    s.tickets.forEach(t => { typeGroups[t.type] = (typeGroups[t.type] || 0) + 1; });
    const typePills = Object.entries(typeGroups).map(([type, cnt]) => {
      const c = CONFIG.typeColors[type] || CLR.dark;
      return `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${typeName(type)}×${cnt}</span>`;
    }).join('');

    const spTicketList = _rmTicketList(s.tickets, 4);

    return `<div class="rm-sprint-card">
      <div class="rm-sprint-header">
        <span class="rm-sprint-label">${s.name || 'Sprint +' + s.idx}</span>
        <span class="rm-sprint-pts" style="color:${color}">${s.pts} / ${cap80} pts</span>
      </div>
      <div class="rm-sprint-prog-wrap">
        <div class="rm-sprint-prog"><div class="rm-sprint-prog-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="rm-sprint-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="rm-sprint-types">${typePills}</div>
      ${spTicketList}
    </div>`;
  }).join('');

  // Sprint 5 - Innovation & Planning (IP sprint SAFe)
  const ipRows = _BUFFER_CATS.map(cat => {
    const pts = Math.round((cap20 || 0) * cat.pct / 20); // pct sur les 20% du buffer
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid #D1FAE5">
      <span>${cat.icon}</span>
      <span style="flex:1;color:var(--text)">${cat.label}</span>
      <span style="font-weight:700;color:var(--success-fg)">~${pts} pts</span>
    </div>`;
  }).join('');

  const ipCard = `<div class="rm-sprint-card rm-sprint-card-ip">
    <div class="rm-sprint-header">
      <span class="rm-sprint-label" style="color:var(--success-fg)">🍃 Innovation &amp; Planning</span>
    </div>
    <div style="font-size:11px;color:var(--success-fg);font-weight:600;margin-bottom:8px">${cap20} pts · buffer PI</div>
    <div>${ipRows}</div>
    <div style="font-size:10px;color:#6B7280;margin-top:8px;font-style:italic">Retrospective · PI Planning · Exploration · Réduction dette</div>
  </div>`;

  const overflowCount = Math.max(0, plan.length - PI_SPRINTS);
  const subtitle = overflowCount
    ? `Capacité feature: ${cap80} pts/sprint · ${overflowCount} sprint${overflowCount > 1 ? 's' : ''} supplémentaire${overflowCount > 1 ? 's' : ''} dans le backlog`
    : `Capacité feature: ${cap80} pts/sprint · priorité critique → haute → moyenne → basse`;

  // Titre dynamique : "PI XX" si PI futur sélectionné, sinon "PI Suivant"
  const _simPI = _piDetect();
  const _simTitle = (!_simPI.isCurrent && _simPI.piNum) ? `PI ${_simPI.piNum}` : 'PI Suivant';

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📋 Simulation - ${_simTitle}</div>
        <span style="font-size:12px;color:var(--text-muted)">${subtitle}</span>
      </div>
      <div class="rm-sprint-grid">${featureCards}${ipCard}</div>
    </div>`;
}

// ============================================================
// Calendrier PI Suivant - jours ouvrés & présentiels
// ============================================================

// Détecte automatiquement la date de début du PI Suivant depuis les données JIRA
// Priorité 1 : tickets backlog avec sprintName "PI#29" → utilise sprintStart si dispo
// Priorité 2 : parse le nom du sprint actif "Ité 28.4" → calcule le reste du PI courant
function _detectNextPIStart() {
  const sprintsPerPI   = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI)                               || 5;
  const durationDays   = (CONFIG.sprint && CONFIG.sprint.durationDays)                               || 14;
  const sprintStartDay = (CONFIG.sprint && CONFIG.sprint.sprintStartDay != null ? CONFIG.sprint.sprintStartDay : 5);

  // Priorité 1 - sprints nommés "PI#xx" / "#PIxx" / "PI xx" dans BACKLOG_TICKETS
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const piSprintNames = new Map(); // sprintName → sprintStart
  _bl.forEach(t => {
    if (t.sprintName && /^(#?PI[#\s]*\d+)/i.test(t.sprintName.trim())) {
      if (!piSprintNames.has(t.sprintName)) piSprintNames.set(t.sprintName, t.sprintStart || '');
    }
  });

  if (piSprintNames.size) {
    const dates = [];
    piSprintNames.forEach(startStr => {
      if (startStr) {
        const d = new Date(startStr.length === 10 ? startStr + 'T00:00:00' : startStr);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    });
    if (dates.length) {
      const today  = new Date(); today.setHours(0,0,0,0);
      const future = dates.filter(d => d >= today).sort((a,b) => a-b);
      const chosen = future.length ? future[0] : dates.sort((a,b) => a-b)[0];
      const dow    = chosen.getDay();
      if (dow !== sprintStartDay) chosen.setDate(chosen.getDate() + (sprintStartDay - dow + 7) % 7);
      return { date: chosen, source: `Sprint JIRA "${[...piSprintNames.keys()][0]}"` };
    }
    return { date: null, source: `Sprint JIRA "${[...piSprintNames.keys()][0]}" (date non disponible)` };
  }

  // Priorité 2 - parse "Ité 28.4" depuis CONFIG.teams[X].sprintName
  const endDate = CONFIG.sprint && CONFIG.sprint.endDate;
  if (!endDate) return null;

  let sprintInPI = 0;
  let sourceName = '';
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const toCheck = activeTeams.length ? activeTeams : Object.keys(CONFIG.teams || {});
  toCheck.forEach(tid => {
    const name = CONFIG.teams[tid]?.sprintName || '';
    const m = name.match(/\b(\d{2,3})\.(\d+)\s*$/);
    if (m && parseInt(m[2], 10) > sprintInPI) {
      sprintInPI = parseInt(m[2], 10);
      sourceName = name;
    }
  });
  if (!sprintInPI) return null;

  const remaining = Math.max(0, sprintsPerPI - sprintInPI);
  const end = new Date(/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate + 'T00:00:00' : endDate);
  if (isNaN(end.getTime())) return null;
  end.setDate(end.getDate() + 1 + remaining * durationDays);
  const dow = end.getDay();
  if (dow !== sprintStartDay) end.setDate(end.getDate() + (sprintStartDay - dow + 7) % 7);
  return { date: end, source: `Sprint actif "${sourceName}" (sprint ${sprintInPI}/${sprintsPerPI})` };
}

// Handlers globaux pour les inputs du calendrier (appelés depuis les attributs onchange)
function _setPIStart(v) {
  localStorage.setItem('rm_pi_start', v);
  _ppRefresh();
}
function _setPISprintPres(v, i) {
  try {
    const a = JSON.parse(localStorage.getItem('rm_pi_pres') || '[]');
    while (a.length <= i) a.push(0);
    a[i] = Math.max(0, parseInt(v, 10) || 0);
    localStorage.setItem('rm_pi_pres', JSON.stringify(a));
  } catch (e) { /* ignore */ }
  _ppRefresh();
}

// Calcul de la date de Pâques (algorithme Meeus/Jones/Butcher)
function _easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const ii = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * ii - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

// Jours fériés français pour une année donnée
function _frenchHolidays(year) {
  const e   = _easterDate(year);
  const add = (base, n) => { const r = new Date(base); r.setDate(r.getDate() + n); return r; };
  return [
    { d: new Date(year, 0,  1),   name: 'Jour de l\'An' },
    { d: add(e, 1),                name: 'Lundi de Pâques' },
    { d: new Date(year, 4,  1),   name: 'Fête du Travail' },
    { d: new Date(year, 4,  8),   name: 'Victoire 1945' },
    { d: add(e, 39),               name: 'Ascension' },
    { d: add(e, 50),               name: 'Lundi de Pentecôte' },
    { d: new Date(year, 6, 14),   name: 'Fête Nationale' },
    { d: new Date(year, 7, 15),   name: 'Assomption' },
    { d: new Date(year, 10,  1),  name: 'Toussaint' },
    { d: new Date(year, 10, 11),  name: 'Armistice' },
    { d: new Date(year, 11, 25),  name: 'Noël' },
  ];
}

// Nombre de jours ouvrés dans [start, end] en excluant les fériés
function _workingDaysIn(start, end, holidays) {
  const holSet = new Set(holidays.map(h => h.d.toDateString()));
  let n = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6 && !holSet.has(d.toDateString())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Format court date en français : "17 mars"
function _fmtD(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const _PRES_TYPES = [
  { icon: '🗓️', label: 'PI Planning',      note: '2 j · alignement & backlog' },
  { icon: '🔍', label: 'Mid-PI Review',     note: '½ j · ajustements' },
  { icon: '🎯', label: 'PI Demo & Rétro',   note: '1 j · démo système' },
  { icon: '🤝', label: 'Innovation Sprint', note: '1 j · IP sprint' },
];

function _roadmapPICalendar(cap80) {
  const durationDays    = (CONFIG.sprint && CONFIG.sprint.durationDays)    || 14;
  const sprintsPerPI    = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI)    || 5;
  const presentielPerPI = (CONFIG.sprint && CONFIG.sprint.presentielPerPI) || 2;

  const sprintStartDay = (CONFIG.sprint && CONFIG.sprint.sprintStartDay != null ? CONFIG.sprint.sprintStartDay : 5);
  const pipDays        = (CONFIG.sprint && CONFIG.sprint.pipDays)        || 2;

  // Date début PI : stockée manuellement > auto-détectée > prochain vendredi (ou jour configuré)
  const storedStart = localStorage.getItem('rm_pi_start') || '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() + (sprintStartDay - today.getDay() + 7) % 7);

  const _isValidDate = d => d instanceof Date && !isNaN(d.getTime());

  const autoDetect = !storedStart ? _detectNextPIStart() : null;

  // Résolution défensive : valider chaque source avant d'utiliser
  let piStart = defaultStart;
  const _DAY_NAMES = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  let autoLabel = `📅 Prochain ${_DAY_NAMES[sprintStartDay]} (défaut)`;
  if (storedStart) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(storedStart) ? storedStart + 'T00:00:00' : storedStart);
    if (_isValidDate(d)) {
      piStart   = d;
      autoLabel = '✏️ Saisie manuelle';
    } else {
      try { localStorage.removeItem('rm_pi_start'); } catch(e) { /* ignore */ }
    }
  } else if (autoDetect?.date && _isValidDate(autoDetect.date)) {
    piStart   = autoDetect.date;
    autoLabel = autoDetect.source;
  } else if (autoDetect?.source) {
    autoLabel = autoDetect.source; // source détectée mais pas de date valide
  }
  const piStartStr = piStart.toISOString().split('T')[0];

  // Présentiels saisis par sprint (persistés)
  let storedPres = [];
  try { storedPres = JSON.parse(localStorage.getItem('rm_pi_pres') || '[]'); } catch (e) { /* ignore */ }

  // Construction des sprints PI
  const sprints = [];
  let cur = new Date(piStart);
  for (let i = 0; i < sprintsPerPI; i++) {
    const start = new Date(cur);
    const end   = new Date(cur);
    end.setDate(end.getDate() + durationDays - 1);

    const h1 = _frenchHolidays(start.getFullYear());
    const h2 = start.getFullYear() !== end.getFullYear() ? _frenchHolidays(end.getFullYear()) : [];
    const allH     = [...h1, ...h2];
    const inPeriod = allH.filter(h => h.d >= start && h.d <= end && h.d.getDay() !== 0 && h.d.getDay() !== 6);
    const workDays = _workingDaysIn(start, end, allH);
    const adjustedCap = Math.round(cap80 * workDays / 10);
    const isIP   = i === sprintsPerPI - 1;
    const pres   = Math.max(0, parseInt(storedPres[i], 10) || 0);

    sprints.push({ idx: i + 1, sprintIdx: i, start, end, workDays, inPeriod, adjustedCap, isIP, pres });
    cur = new Date(end);
    cur.setDate(cur.getDate() + 1);
  }

  // Sprints conseillés pour présentiels = feature sprints avec le + de jours ouvrés
  const featByWorkDays = sprints.filter(s => !s.isIP).sort((a, b) => b.workDays - a.workDays);
  const suggestedIdxs  = new Set(featByWorkDays.slice(0, presentielPerPI).map(s => s.idx));
  const suggestedArr   = featByWorkDays.slice(0, presentielPerPI).map(s => s.idx);

  const cards = sprints.map(s => {
    const isSugg = suggestedIdxs.has(s.idx);
    const presTypeIdx = suggestedArr.indexOf(s.idx);
    const presType = presTypeIdx >= 0 ? _PRES_TYPES[presTypeIdx % _PRES_TYPES.length] : null;

    const borderColor = s.isIP ? 'var(--success)' : isSugg ? 'var(--warning)' : 'var(--border)';
    const bgColor     = s.isIP ? 'var(--success-bg)' : isSugg   ? 'var(--warning-bg)' : 'var(--card)';
    const wdColor     = s.workDays < 8 ? '#DC2626' : s.workDays < 10 ? '#D97706' : '#16A34A';
    const capColor    = s.workDays < 8 ? '#DC2626' : s.workDays < 10 ? '#D97706' : 'var(--text-muted)';
    const inputBorder = s.pres > 0 ? '#F59E0B' : 'var(--border)';
    const inputBg     = s.pres > 0 ? 'var(--warning-bg)' : 'var(--card)';
    const inputClr    = s.pres > 0 ? 'var(--warning-fg)' : 'var(--text)';

    const holBadges = s.inPeriod.map(h =>
      `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:500;background:var(--danger-bg);color:var(--danger-fg);border:1px solid var(--danger);padding:2px 7px;border-radius:20px;margin:2px 3px 2px 0;">🇫🇷 ${escapeHtml(h.name)}</span>`
    ).join('');

    const bottomBadge = s.isIP
      ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0;padding:2px 9px;border-radius:20px;">🍃 Innovation &amp; Planning</div>`
      : isSugg && presType
        ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;background:var(--warning-bg);color:var(--warning-fg);border:1px solid var(--warning);padding:2px 9px;border-radius:20px;">${presType.icon} ${presType.label} <span style="font-weight:400;opacity:.7">${presType.note}</span></div>`
        : '';

    return `
      <div style="background:${bgColor};border:1.5px solid ${borderColor};border-radius:10px;padding:14px 12px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:13px;">${s.isIP ? '🍃 IP Sprint' : `Sprint ${s.idx}`}</span>
          <span style="font-size:11px;color:var(--text-muted);font-weight:500;">${_fmtD(s.start)} – ${_fmtD(s.end)}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;">
          <span style="font-size:22px;font-weight:800;color:${wdColor};line-height:1.1;">${s.workDays}</span>
          <span style="font-size:11px;color:var(--text-muted);">jours ouvrés</span>
          <span style="margin-left:auto;font-size:12px;font-weight:700;color:${capColor};">~${s.adjustedCap} pts</span>
        </div>
        <div style="min-height:22px;">${s.inPeriod.length ? holBadges : '<span style="font-size:11px;color:#16A34A;font-weight:500;">✓ Aucun férié</span>'}</div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--border);">
          <label style="font-size:11px;color:var(--text-muted);white-space:nowrap;">Présentiels</label>
          <input type="number" min="0" max="${s.workDays}" value="${s.pres}"
            style="width:54px;padding:5px 8px;border:1.5px solid ${inputBorder};border-radius:8px;font-size:14px;font-weight:700;background:${inputBg};color:${inputClr};text-align:center;outline:none;"
            onchange="_setPISprintPres(this.value, ${s.sprintIdx})"
          />
          <span style="font-size:11px;color:var(--text-muted);">j</span>
        </div>
        ${bottomBadge}
      </div>`;
  }).join('');

  const totalWorkDays = sprints.slice(0, -1).reduce((s, sp) => s + sp.workDays, 0);
  const totalCap      = sprints.slice(0, -1).reduce((s, sp) => s + sp.adjustedCap, 0);
  const totalPres     = sprints.reduce((s, sp) => s + sp.pres, 0);
  const presColor     = totalPres > 0 ? '#D97706' : 'var(--text-muted)';

  // PIP = les {pipDays} jours ouvrés qui précèdent le début du PI
  const _pipHolSet = new Set([
    ..._frenchHolidays(piStart.getFullYear() - 1),
    ..._frenchHolidays(piStart.getFullYear()),
  ].map(h => h.d.toDateString()));
  const pipDates = [];
  const _pipCur  = new Date(piStart);
  _pipCur.setDate(_pipCur.getDate() - 1);
  while (pipDates.length < pipDays) {
    if (_pipCur.getDay() !== 0 && _pipCur.getDay() !== 6 && !_pipHolSet.has(_pipCur.toDateString()))
      pipDates.unshift(new Date(_pipCur));
    _pipCur.setDate(_pipCur.getDate() - 1);
  }
  const pipBanner = pipDates.length >= pipDays
    ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;background:#EFF6FF;border:1.5px solid #BFDBFE;font-size:12px;font-weight:600;color:#1D4ED8;margin-bottom:10px;">
        🗓️ PI Planning (PIP) · ${_fmtD(pipDates[0])} – ${_fmtD(pipDates[pipDates.length - 1])} <span style="font-weight:400;color:#3B82F6;font-size:11px;">(${pipDays} j ouvrés avant le PI)</span>
      </div>`
    : '';

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📅 Calendrier PI Suivant</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Début du PI :</label>
            <input type="date" value="${piStartStr}"
              style="padding:5px 10px;border:1.5px solid ${storedStart ? 'var(--primary)' : 'var(--border)'};border-radius:8px;font-size:12px;background:var(--card);color:var(--text);cursor:pointer;"
              onchange="_setPIStart(this.value)"
            />
            <span style="font-size:11px;color:${storedStart ? 'var(--primary)' : '#16A34A'};font-style:italic;white-space:nowrap;" title="Source de la date">
              ${autoLabel}
            </span>
            ${storedStart ? `<button onclick="localStorage.removeItem('rm_pi_start');_ppRefresh();" style="font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Revenir à la détection automatique">↺ auto</button>` : ''}
          </div>
          <span style="font-size:12px;color:var(--text-muted);">${totalWorkDays} j ouvrés · <strong>${totalCap} pts</strong> cap. feature · <strong style="color:${presColor}">${totalPres} j présentiel${totalPres !== 1 ? 's' : ''}</strong></span>
        </div>
      </div>
      ${pipBanner}
      <div style="display:grid;grid-template-columns:repeat(${sprintsPerPI}, 1fr);gap:12px;">
        ${cards}
      </div>
    </div>`;
}

// ============================================================
// Table du backlog complet
// ============================================================

// ============================================================
// Backlog Health Score
// ============================================================
function _roadmapBacklogHealth(backlog) {
  if (!backlog.length) return '';

  const agingSprints = CONFIG.alerts?.backlogAgingSprints ?? 3;
  const sprintDays = CONFIG.sprint.durationDays || 14;
  const agingMs = agingSprints * sprintDays * 86400000;
  const now = Date.now();

  // Orphan stories: no epic, no points, or no priority
  const noEpic     = backlog.filter(t => !t.epic);
  const noPoints   = backlog.filter(t => !t.points);
  const noPriority = backlog.filter(t => !t.priority || t.priority === 'none');

  // Aging: tickets not updated in N sprints
  const aging = backlog.filter(t => {
    if (!t.updatedAt) return false;
    return (now - new Date(t.updatedAt).getTime()) > agingMs;
  });

  // Health score (0-100)
  const total = backlog.length;
  const issues = new Set([...noEpic, ...noPoints, ...noPriority, ...aging].map(t => t.id)).size;
  const healthPct = Math.round((1 - issues / total) * 100);
  const healthColor = healthPct >= 80 ? '#16A34A' : healthPct >= 50 ? '#F59E0B' : '#DC2626';
  const healthBg    = healthPct >= 80 ? 'var(--success-bg)' : healthPct >= 50 ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const healthIcon  = healthPct >= 80 ? '✅' : healthPct >= 50 ? '⚠️' : '🔴';

  // Store lists globally for the detail popin
  window._bhNoEpic     = noEpic;
  window._bhNoPoints   = noPoints;
  window._bhNoPriority = noPriority;
  window._bhAging      = aging;
  window._bhAgingSprints = agingSprints;

  const kpi = (icon, label, count, color, filter) => count > 0 ? `
    <div class="rm-health-kpi" onclick="_showBacklogHealthDetail('${filter}')" title="Voir le détail" style="background:${color}11;border:1px solid ${color}33;">
      <span class="rm-health-kpi-icon">${icon}</span>
      <span class="rm-health-kpi-val" style="color:${color}">${count}</span>
      <span class="rm-health-kpi-lbl">${label}</span>
    </div>` : '';

  return `
    <div style="margin-bottom:16px;">
      <div class="section-header">
        <div class="section-title">🩺 Santé du Backlog</div>
        <div style="display:flex;align-items:center;gap:6px;padding:4px 12px;background:${healthBg};border-radius:8px;border:1px solid ${healthColor}33;">
          <span>${healthIcon}</span>
          <span style="font-size:16px;font-weight:800;color:${healthColor}">${healthPct}%</span>
          <span style="font-size:11px;color:${healthColor};font-weight:600;">${issues}/${total} tickets à corriger</span>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        ${kpi('📭', 'sans Epic', noEpic.length, '#DC2626', 'noEpic')}
        ${kpi('🔢', 'sans points', noPoints.length, '#F59E0B', 'noPoints')}
        ${kpi('⚖️', 'sans priorité', noPriority.length, '#D97706', 'noPriority')}
        ${kpi('⏳', `inactif >${agingSprints} sprints`, aging.length, '#64748B', 'aging')}
      </div>
    </div>`;
}

// Detail popin for backlog health KPI cards
function _showBacklogHealthDetail(filter) {
  const cfg = {
    noEpic:     { icon: '📭', label: 'Tickets sans Epic',     color: '#DC2626', list: window._bhNoEpic     || [] },
    noPoints:   { icon: '🔢', label: 'Tickets sans points',   color: '#F59E0B', list: window._bhNoPoints   || [] },
    noPriority: { icon: '⚖️', label: 'Tickets sans priorité', color: '#D97706', list: window._bhNoPriority || [] },
    aging:      { icon: '⏳', label: `Tickets inactifs (>${window._bhAgingSprints || 3} sprints)`, color: '#64748B', list: window._bhAging || [] },
  }[filter];
  if (!cfg || !cfg.list.length) return;

  const totalPts = cfg.list.reduce((a, t) => a + (t.points || 0), 0);

  // Group by type
  const byType = {};
  cfg.list.forEach(t => { (byType[t.type] = byType[t.type] || []).push(t); });
  const typeOrder = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);
  const typePills = typeOrder.map(type => {
    const c = CONFIG.typeColors[type] || CLR.dark;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;background:${c}18;border:1px solid ${c}40;font-size:11px;font-weight:700;color:${c};margin:2px;">${typeName(type)} ×${byType[type].length}</span>`;
  }).join('');

  document.getElementById('modal-title').innerHTML = `${cfg.icon} ${cfg.label} <span style="font-size:14px;font-weight:400;color:#94A3B8;">(${cfg.list.length} · ${totalPts} pts)</span>`;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #E2E8F0;">${typePills}</div>
    ${cfg.list.map(t => {
      const epic        = EPICS.find(e => e.id === t.epic);
      const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
      const highlight   = filter === 'noEpic' && !t.epic ? 'background:var(--danger-bg);'
                        : filter === 'noPoints' && !t.points ? 'background:var(--warning-bg);'
                        : filter === 'noPriority' ? 'background:#FFF7ED;'
                        : filter === 'aging' ? 'background:var(--info-bg);' : '';
      // Extra info depending on filter
      let extra = '';
      if (filter === 'aging' && t.updatedAt) {
        const days = Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / 86400000);
        extra = `<span style="font-size:10px;color:#64748B;white-space:nowrap;flex-shrink:0;">${days}j inactif</span>`;
      }
      return `<div class="rm-ticket-row" style="${highlight}border-radius:4px;" onclick="closeModalDirect();openModal('${t.id}')">
        <span style="flex-shrink:0;width:20px;text-align:center;">${priorityIcon(t.priority)}</span>
        <span class="badge badge-${t.type}" style="white-space:nowrap;flex-shrink:0;">${typeName(t.type)}</span>
        <span class="rm-ticket-title-lg">${_jiraBrowse(t.id)} - ${escapeHtml(t.title)}</span>
        ${epic ? epicTag(epic, t.epic) : '<span style="font-size:10px;color:#DC2626;font-weight:600;flex-shrink:0;">Ø epic</span>'}
        ${ptsBadge(t.points)}
        ${extra}
        ${avatarBadge(t.assignee, avatarColor)}
      </div>`;
    }).join('')}`;

  window._modalTicketList = [];
  window._modalCurrentIdx = 0;
  if (typeof _updateModalNavButtons === 'function') _updateModalNavButtons();
  { const _dlg = document.getElementById('modal-overlay'); if (!_dlg.open) _dlg.showModal(); }
}

function _roadmapBacklogTable(backlog, cap80) {
  if (!backlog.length) return '';

  const totalPts  = backlog.reduce((s, t) => s + (t.points || 0), 0);
  const sprintEst = cap80 ? Math.ceil(totalPts / cap80) : '-';
  const unpointed = backlog.filter(t => !t.points).length;

  const rows = backlog.map(t => {
    const epic = EPICS.find(e => e.id === t.epic);
    const tc   = CONFIG.typeColors[t.type] || CLR.dark;
    const sn = t.sprintName || '';
    // Short sprint label: remove team prefix (e.g. "Fuego - Ité. 28.4" → "Ité. 28.4")
    const snShort = sn.replace(/^[^-]+-\s*/, '') || '-';
    return `<tr class="rm-backlog-row" onclick="openModal('${t.id}')" style="cursor:pointer">
      <td style="width:28px">${priorityIcon(t.priority)}</td>
      <td style="white-space:nowrap">${_jiraBrowse(t.id)}</td>
      <td class="rm-bt-title">${escapeHtml(t.title) || '-'}</td>
      <td><span class="badge" style="background:${tc}22;color:${tc};border:1px solid ${tc}44">${typeName(t.type)}</span></td>
      <td>${epic ? `<span style="background:${epic.color || '#2563eb'}22;color:${epic.color || '#2563eb'};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;display:inline-block">${escapeHtml(epic.title)}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-muted)" title="${escapeHtml(sn)}">${escapeHtml(snShort)}</td>
      <td style="text-align:right">${ptsBadge(t.points, {size:'small'})}</td>
    </tr>`;
  }).join('');

  return `
    <div>
      <div class="section-header">
        <div class="section-title">📋 Backlog non planifié - ${backlog.length} ticket${backlog.length > 1 ? 's' : ''} · ${totalPts} pts · ~${sprintEst} sprint${sprintEst > 1 ? 's' : ''}</div>
        ${unpointed ? `<span style="font-size:12px;color:var(--amber)">⚠ ${unpointed} ticket${unpointed > 1 ? 's' : ''} sans points</span>` : ''}
      </div>
      <div class="card" style="overflow-x:auto;padding:0">
        <table class="rm-backlog-table">
          <thead>
            <tr>
              <th></th><th>ID</th><th>Titre</th><th>Type</th><th>Epic</th><th>Sprint</th><th style="text-align:right">Points</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
