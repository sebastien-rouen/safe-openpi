// ============================================================
// PI PLANNING VIEW - SAFe Product Increment
// Données réelles depuis TICKETS / EPICS / CONFIG.teams
// ============================================================

function renderPI() {
  const tickets  = getTickets(); // respecte le filtre sidebar (équipe / groupe)
  // Include teams from backlog PI tickets too (e.g. teams with no active sprint tickets)
  const activeTeamFilter = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const _blTeams = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(bt => !activeTeamFilter.length || activeTeamFilter.includes(bt.team))
    .map(bt => bt.team).filter(Boolean);
  const allTeams = [...new Set([...tickets.map(t => t.team).filter(Boolean), ..._blTeams])].sort();
  if (!allTeams.length) {
    document.getElementById('pi-table').innerHTML = '<tr><td colspan="4" style="padding:1rem;color:var(--text-muted)">Synchronisez les données JIRA pour afficher le PI Planning.</td></tr>';
    return;
  }

  // Sprints : précédent / actuel / prochain
  const _sprintCtx   = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  const currentLabel = _sprintCtx.label || `Sprint ${CONFIG.sprint.current}`;
  const sprintCols   = [
    {
      label: '◀ Précédent', isCurrent: false, isNext: false, isPrev: true,
      hint: '<strong>Sprint précédent</strong> - estimation<br>Epics ayant au moins un ticket <em>terminé</em> dans le sprint actif.<br>Indique le travail accompli qui était probablement en cours lors du sprint précédent.',
    },
    {
      label: `▶ ${currentLabel}`, isCurrent: true, isNext: false, isPrev: false,
      hint: `<strong>${currentLabel}</strong> - sprint actif<br>Tous les epics du sprint en cours, tels que remontés par JIRA.<br>Données réelles issues de la synchronisation.`,
    },
    {
      label: '⏭ Prochain', isCurrent: false, isNext: true, isPrev: false,
      hint: '<strong>Prochain sprint</strong> - prévisionnel<br>Epics avec au moins un ticket <em>non terminé</em> (carry-over probable).<br>Ces epics continueront vraisemblablement dans le sprint suivant.',
    },
  ];

  // Helper : un epic appartient-il à cette équipe ? (filtre les epics cross-team)
  const _isTeamEpic = (eid, team) => {
    const epic = EPICS.find(x => x.id === eid);
    return !epic || !epic.team || epic.team === team;
  };

  // Epics par équipe dans le sprint courant (données réelles)
  const epicsByTeam = {};
  allTeams.forEach(team => {
    epicsByTeam[team] = [...new Set(
      tickets.filter(t => t.team === team).map(t => t.epic).filter(Boolean)
    )].filter(eid => _isTeamEpic(eid, team));
  });

  // Epics "sprint précédent" : epics avec au moins un ticket terminé (travail accompli)
  const prevEpicsByTeam = {};
  allTeams.forEach(team => {
    const doneEpics = new Set(tickets.filter(t => t.team === team && isDone(t.status)).map(t => t.epic).filter(Boolean));
    prevEpicsByTeam[team] = [...doneEpics].filter(eid => _isTeamEpic(eid, team));
  });

  // Epics "prochain sprint" : epics avec des tickets non terminés (carry-over probable)
  const nextEpicsByTeam = {};
  allTeams.forEach(team => {
    nextEpicsByTeam[team] = [...new Set(
      tickets.filter(t => t.team === team && !isDone(t.status)).map(t => t.epic).filter(Boolean)
    )].filter(eid => _isTeamEpic(eid, team));
  });

  // Helper : data-tip enrichi pour un chip (title + progression + points + bloqués)
  function _chipTip(eid, team) {
    const e       = EPICS.find(x => x.id === eid);
    const title   = e?.title || eid;
    const tks     = getTickets().filter(t => t.team === team && t.epic === eid);
    const done    = tks.filter(t => isDone(t.status)).length;
    const blocked = tks.filter(t => t.status === 'blocked').length;
    const pts     = tks.reduce((a, t) => a + (t.points || 0), 0);
    const pct     = tks.length ? Math.round(done / tks.length * 100) : 0;
    const bar     = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    let tip = `<strong>${eid}</strong><br>${title}`;
    tip += `<hr class="pi-divider" style="margin:5px 0">`;
    tip += `${bar} ${pct}%<br>${done}/${tks.length} tickets`;
    if (pts)     tip += ` · ${pts} pts`;
    if (blocked) tip += ` · <span style="color:#FCA5A5">⚠ ${blocked} bloqué${blocked > 1 ? 's' : ''}</span>`;
    return tip;
  }

  // Helper : rendu d'une liste d'epics dans une cellule du tableau
  function _epicLines(epics, team, chipClass, _bgColor) {
    if (!epics.length) return '<span style="color:var(--text-muted);font-size:11px">-</span>';
    // Sort epics by completion % ascending (least complete first) - improvement #5
    const sortedEpics = epics.slice().sort((a, b) => {
      const tksA = tickets.filter(t => t.team === team && t.epic === a);
      const tksB = tickets.filter(t => t.team === team && t.epic === b);
      const pctA = tksA.length ? Math.round(tksA.filter(t => isDone(t.status)).length / tksA.length * 100) : 0;
      const pctB = tksB.length ? Math.round(tksB.filter(t => isDone(t.status)).length / tksB.length * 100) : 0;
      return pctA - pctB;
    });
    return sortedEpics.map(eid => {
      const e       = EPICS.find(x => x.id === eid);
      if (!e) return '';
      const tks     = tickets.filter(t => t.team === team && t.epic === eid);
      const done    = tks.filter(t => isDone(t.status)).length;
      const pct     = tks.length ? Math.round(done / tks.length * 100) : 0;
      const pctClr  = pct < 30 ? '#EF4444' : pct < 70 ? '#F59E0B' : '#22C55E';
      const blocked = tks.some(t => t.status === 'blocked');
      const statuses = [...new Set(tks.map(t => t.status))].join(',');
      return `<div class="pi-tbl-epic pi-epic-row" data-eid="${eid}" data-etitle="${(e.title || '').replace(/"/g, '&quot;').toLowerCase()}" data-statuses="${statuses}" style="background:${e.color}11;border:1px solid ${e.color}33;" data-tip="${eid}|${team}">
        <span class="pi-chip ${chipClass}" style="background:${e.color};flex-shrink:0;margin:0;cursor:default" onclick="event.stopPropagation()">${e.id}</span>
        <span class="pi-epic-title" title="${e.title || ''}">${e.title || eid}</span>
        ${blocked ? '<span style="color:#EF4444;font-size:11px;flex-shrink:0" title="Ticket(s) bloqué(s)">⚠</span>' : ''}
        <div class="pi-mini-progress" title="${pct}%"><div style="height:100%;width:${pct}%;background:${pctClr};border-radius:2px"></div></div>
      </div>`;
    }).join('');
  }

  // Barre de filtres au-dessus du tableau
  const allStatuses = [
    { key: 'inprog',  label: 'En cours',  color: '#3B82F6' },
    { key: 'blocked', label: 'Bloqués',   color: '#EF4444' },
    { key: 'review',  label: 'En review', color: '#A855F7' },
    { key: 'test',    label: 'En test',   color: '#F59E0B' },
    { key: 'todo',    label: 'À faire',   color: '#94A3B8' },
    { key: 'done',    label: 'Terminés',  color: '#22C55E' },
  ];
  const filterBarEl = document.getElementById('pi-table-filters');
  if (filterBarEl) {
    filterBarEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:12px 16px;background:#fff;border-radius:var(--radius);box-shadow:var(--shadow)">
        <input id="_pi-search" type="text" placeholder="🔍  Rechercher un epic…" style="padding:6px 12px;border:1px solid var(--border);border-radius:99px;font-size:12px;outline:none;width:200px" oninput="_piTableFilter()">
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <span class="pi-filter-label">Statut :</span>
          <button class="pi-tf-btn active" data-tf="all" onclick="_piTableFilterStatus(this)" style="padding:4px 10px;border-radius:99px;border:1px solid var(--border);background:#475569;color:#fff;font-size:11px;font-weight:600;cursor:pointer">Tous</button>
          ${allStatuses.map(s => `<button class="pi-tf-btn" data-tf="${s.key}" data-color="${s.color}" onclick="_piTableFilterStatus(this)" style="padding:4px 10px;border-radius:99px;border:1px solid ${s.color}44;background:#fff;color:${s.color};font-size:11px;font-weight:600;cursor:pointer">${s.label}</button>`).join('')}
        </div>
      </div>`;
  }

  // Table
  let html = `<thead><tr>
    <th>Équipe</th>
    ${sprintCols.map(s => {
      const bg = s.isCurrent ? 'background:rgba(2,132,199,.08);font-weight:700'
               : s.isNext   ? 'background:rgba(245,158,11,.05)'
               : s.isPrev   ? 'background:rgba(16,185,129,.04)'
               : '';
      return `<th class="pi-th-hint" style="${bg}" data-hint="${s.hint.replace(/"/g, '&quot;')}">${s.label} <span class="pi-th-icon">?</span></th>`;
    }).join('')}
  </tr></thead><tbody>`;

  allTeams.forEach(team => {
    const teamCfg = CONFIG.teams[team] || {};
    const color   = teamCfg.color || CLR.muted;
    const name    = teamCfg.name  || `Équipe ${team}`;
    html += `<tr>
      <td class="team-cell" style="color:${color}">${name}</td>`;
    sprintCols.forEach(s => {
      if (s.isCurrent) {
        const epics = epicsByTeam[team] || [];
        html += `<td style="background:rgba(2,132,199,.04);vertical-align:top" data-pi-cell="${team}|${epics.join(',')}">${_epicLines(epics, team, '', 'rgba(2,132,199,.04)')}</td>`;
      } else if (s.isPrev) {
        const epics = prevEpicsByTeam[team] || [];
        html += `<td style="background:rgba(16,185,129,.03);vertical-align:top" data-pi-cell="${team}|${epics.join(',')}">${_epicLines(epics, team, 'pi-chip-prev', 'rgba(16,185,129,.03)')}</td>`;
      } else if (s.isNext) {
        const epics = nextEpicsByTeam[team] || [];
        html += `<td style="background:rgba(245,158,11,.03);vertical-align:top" data-pi-cell="${team}|${epics.join(',')}">${_epicLines(epics, team, 'pi-chip-next', 'rgba(245,158,11,.03)')}</td>`;
      } else {
        html += `<td style="opacity:.3;vertical-align:top">-</td>`;
      }
    });
    html += '</tr>';
  });

  document.getElementById('pi-table').innerHTML = html + '</tbody>';

  // Tooltip flottant partagé (chips + headers)
  let _tipEl = document.getElementById('_pi-chip-tip');
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.id = '_pi-chip-tip';
    _tipEl.className = 'pi-tooltip';
    _tipEl.style.maxWidth = '300px';
    document.body.appendChild(_tipEl);
  }
  const _showTip = (html, e) => { _tipEl.innerHTML = html; _tipEl.style.display = 'block'; _moveTip(e); };
  const _moveTip = e => { _tipEl.style.left = (e.clientX + 14) + 'px'; _tipEl.style.top = (e.clientY - _tipEl.offsetHeight - 10) + 'px'; };
  const _hideTip = () => { _tipEl.style.display = 'none'; };

  // Tooltip sur les lignes epic du tableau
  document.querySelectorAll('.pi-tbl-epic[data-tip]').forEach(row => {
    row.addEventListener('mouseenter', e => { const [eid, team] = row.dataset.tip.split('|'); _showTip(_chipTip(eid, team), e); });
    row.addEventListener('mousemove', _moveTip);
    row.addEventListener('mouseleave', _hideTip);
  });

  document.querySelectorAll('.pi-th-hint[data-hint]').forEach(th => {
    th.addEventListener('mouseenter', e => _showTip(th.dataset.hint, e));
    th.addEventListener('mousemove', _moveTip);
    th.addEventListener('mouseleave', _hideTip);
  });

  // Clic sur une ligne epic → modal tickets de cet epic pour cette équipe
  document.querySelectorAll('.pi-tbl-epic[data-tip]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.pi-chip')) return;
      const [eid, team] = row.dataset.tip.split('|');
      _hideTip();
      _piShowCellDetail(team, [eid]);
    });
  });

  // Surbrillance colonne au survol
  const _piTbl = document.querySelector('#pi-table');
  _piTbl.addEventListener('mouseover', ev => {
    const td = ev.target.closest('td[data-pi-cell]');
    if (!td) return;
    const colIdx = [...td.parentElement.children].indexOf(td);
    _piTbl.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((cell, i) => cell.classList.toggle('pi-col-hover', i === colIdx));
    });
    _piTbl.querySelectorAll('thead th').forEach((th, i) => th.classList.toggle('pi-col-hover-th', i === colIdx));
  });
  _piTbl.addEventListener('mouseleave', () => {
    _piTbl.querySelectorAll('.pi-col-hover').forEach(c => c.classList.remove('pi-col-hover'));
    _piTbl.querySelectorAll('.pi-col-hover-th').forEach(c => c.classList.remove('pi-col-hover-th'));
  });

  // Clic sur une cellule (zone vide entre epics) → modal tous les epics de la cellule
  document.querySelectorAll('[data-pi-cell]').forEach(td => {
    td.addEventListener('click', e => {
      if (e.target.closest('.pi-tbl-epic')) return; // géré par la ligne epic
      const [team, eidsRaw] = td.dataset.piCell.split('|');
      const epicIds = eidsRaw ? eidsRaw.split(',').filter(Boolean) : [];
      if (!epicIds.length) return;
      _hideTip();
      _piShowCellDetail(team, epicIds);
    });
  });

  // Objectifs PI - epics par équipe, groupés par sprint, avec progress live
  // Cross-reference piprep objectives if available
  // ppObjs removed - was unused

  // Aggregate stats for global summary
  let _piObjStats = { totalEpics: 0, doneEpics: 0, totalTk: 0, doneTk: 0, atRisk: [] };

  // --- Helper: render one team's objectives ---
  const _piObjTeamHtml = (team) => {
    const teamCfg     = CONFIG.teams[team] || {};
    const color       = teamCfg.color || CLR.muted;
    const name        = teamCfg.name  || `Équipe ${team}`;
    const teamTickets = tickets.filter(t => t.team === team);

    const sprintMap = {};
    teamTickets.forEach(t => {
      const sp = t.sprint || 'Sprint actif';
      if (!sprintMap[sp]) sprintMap[sp] = new Set();
      if (t.epic) sprintMap[sp].add(t.epic);
    });
    const sprintKeys = Object.keys(sprintMap);

    if (!sprintKeys.length) {
      return `<div class="pi-obj" style="border-left-color:${color}">
        <div class="pi-obj-header"><span class="pi-obj-team" style="color:${color}">${name}</span></div>
        <p style="color:var(--text-muted);font-size:12px;margin:0">Aucun ticket actif</p>
      </div>`;
    }

    const teamDone  = teamTickets.filter(t => isDone(t.status)).length;
    const teamTotal = teamTickets.length;
    const teamPct   = teamTotal ? Math.round(teamDone / teamTotal * 100) : 0;
    const teamPts   = teamTickets.reduce((a, t) => a + (t.points || 0), 0);
    const teamPtsDone = teamTickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
    const teamPctClr = teamPct < 30 ? '#EF4444' : teamPct < 70 ? '#F59E0B' : '#22C55E';

    const sprintGroupsHtml = sprintKeys.map(sp => {
      const epicIds = [...sprintMap[sp]];
      const rows = epicIds.map(eid => {
        const e        = EPICS.find(x => x.id === eid);
        const ec       = e?.color || CLR.muted;
        const etitle   = e?.title || eid;
        const eTickets = teamTickets.filter(t => t.epic === eid);
        const done     = eTickets.filter(t => isDone(t.status)).length;
        const total    = eTickets.length;
        const pct      = total ? Math.round(done / total * 100) : 0;
        const pts      = eTickets.reduce((a, t) => a + (t.points || 0), 0);
        const blocked  = eTickets.filter(t => t.status === 'blocked').length;
        const url      = typeof _jiraBrowseUrl === 'function' ? _jiraBrowseUrl(eid) : '#';
        const isComplete = pct === 100 && total > 0;

        _piObjStats.totalEpics++;
        _piObjStats.totalTk += total;
        _piObjStats.doneTk += done;
        if (isComplete) _piObjStats.doneEpics++;

        const remaining = total - done;
        if (pct < 50 && remaining > 2 && blocked > 0) {
          _piObjStats.atRisk.push({ eid, title: etitle, team: name, pct, blocked, remaining });
        }

        return `<div class="pi-epic-row">
          <span class="pi-epic-dot" style="background:${ec}"></span>
          <div class="pi-epic-info">
            <a class="pi-epic-link" href="${url}" target="_blank" onclick="event.stopPropagation()">${eid}</a>
            <span class="pi-epic-title${isComplete ? ' pi-epic-done' : ''}">${etitle}</span>
          </div>
          <div class="pi-epic-meta">
            <div class="pi-epic-progress"><div class="pi-epic-fill" style="width:${pct}%;background:${ec}"></div></div>
            <span class="pi-epic-pts">${done}/${total}${pts ? ` · ${pts}pts` : ''}</span>
          </div>
        </div>`;
      }).join('');

      return `<div class="pi-sprint-group">
        <div class="pi-sprint-label">${sp}</div>
        ${rows}
      </div>`;
    }).join('');

    const teamSummary = `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
      <div class="pi-progress-track">
        <div style="height:100%;width:${teamPct}%;background:${teamPctClr};border-radius:3px;transition:width .3s;"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:${teamPctClr};white-space:nowrap;">${teamPct}%</span>
      <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;">${teamPtsDone}/${teamPts} pts</span>
    </div>`;

    return `<div class="pi-obj" style="border-left-color:${color}">
      <div class="pi-obj-header"><span class="pi-obj-team" style="color:${color}">${name}</span></div>
      ${teamSummary}
      ${sprintGroupsHtml}
    </div>`;
  };

  // --- Group teams by GROUPS, render grouped sections ---
  const activeTeamSet = new Set(allTeams);
  const teamsInGroups = new Set();
  const groupSections = (typeof GROUPS !== 'undefined' ? GROUPS : []).map(g => {
    const gTeams = (g.teams || []).filter(t => activeTeamSet.has(t));
    if (!gTeams.length) return '';
    gTeams.forEach(t => teamsInGroups.add(t));

    // Group-level aggregate
    const gTickets  = tickets.filter(t => gTeams.includes(t.team));
    const gDone     = gTickets.filter(t => isDone(t.status)).length;
    const gTotal    = gTickets.length;
    const gPct      = gTotal ? Math.round(gDone / gTotal * 100) : 0;
    const gPts      = gTickets.reduce((a, t) => a + (t.points || 0), 0);
    const gPtsDone  = gTickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
    const gPctClr   = gPct < 30 ? '#EF4444' : gPct < 70 ? '#F59E0B' : '#22C55E';
    const gColor    = g.color || CLR.muted;

    const teamsHtml = gTeams.map(t => _piObjTeamHtml(t)).join('');

    return `<div class="pi-obj-group" style="margin-bottom:20px;">
      <div class="pi-group-header" style="background:${gColor}0C;border:1px solid ${gColor}22;">
        <span class="pi-status-dot" style="background:${gColor};"></span>
        <span style="font-weight:700;font-size:14px;color:${gColor};flex:1;">${g.name || g.id}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:80px;height:5px;background:rgba(0,0,0,.08);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${gPct}%;background:${gPctClr};border-radius:3px;"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${gPctClr};">${gPct}%</span>
          <span style="font-size:10px;color:var(--text-muted);">${gPtsDone}/${gPts} pts</span>
        </div>
      </div>
      ${teamsHtml}
    </div>`;
  }).filter(Boolean);

  // Teams not in any group
  const ungroupedTeams = allTeams.filter(t => !teamsInGroups.has(t));
  const ungroupedHtml  = ungroupedTeams.map(t => _piObjTeamHtml(t)).join('');

  document.getElementById('pi-objectives').innerHTML =
    groupSections.join('') +
    (ungroupedHtml ? `<div class="pi-obj-group" style="margin-bottom:20px;">
      <div class="pi-group-header" style="background:rgba(0,0,0,.03);border:1px solid var(--border);">
        <span style="font-weight:700;font-size:14px;color:var(--text-muted);flex:1;">Autres équipes</span>
      </div>
      ${ungroupedHtml}
    </div>` : '');

  // ---- PI Objective Risk Alerts ----
  _renderPIObjRiskAlerts(_piObjStats, tickets, allTeams);

  // Buffer tracking — combine sprint actif + backlog PI + sprints fermés du PI
  const _piMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const _piNum   = _piMatch ? _piMatch[1] : null;
  const _piRe    = _piNum ? new RegExp(`(^|\\D)${_piNum}\\.\\d+`) : null;
  const _activeIds = new Set(tickets.map(t => t.id));
  // 1) Backlog PI tickets
  const _blAll   = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(bt => !_activeIds.has(bt.id))
    .filter(bt => _piNum && (
      (bt.piSprint || '').includes(_piNum) ||
      (_piRe && _piRe.test(bt.sprintName || ''))
    ));
  // 2) Buffer tickets from closed sprints of the current PI (via velocityHistory)
  const _closedBufferTickets = [];
  const _activeTeamSet2 = new Set(allTeams);
  if (_piRe) {
    Object.entries(CONFIG.teams || {}).forEach(([tid, tc]) => {
      if (!_activeTeamSet2.has(tid)) return;
      (tc.velocityHistory || []).forEach(vh => {
        if (!_piRe.test(vh.name || '')) return;
        (vh.bufferTickets || []).forEach(bt => {
          if (!_activeIds.has(bt.id) && !_closedBufferTickets.some(x => x.id === bt.id)) {
            _closedBufferTickets.push(bt);
          }
        });
      });
    });
  }
  const allPITickets = tickets.concat(_blAll, _closedBufferTickets);
  _renderPIBuffer(allPITickets, allTeams);

  // Capacity chart - par sprint du PI (stacked par équipe + ligne capacité)
  setTimeout(() => {
    const ctx = document.getElementById('piCapacityChart');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();

    const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
    const piRe = /(\d{2,3})\.(\d+)/;
    const piMatch = (CONFIG.sprint.label || '').match(piRe);
    const piNum = piMatch ? piMatch[1] : null;
    const currentIdx = piMatch ? parseInt(piMatch[2]) - 1 : 0; // 0-based

    // Sprint labels: "XX.1", "XX.2", …, "XX.N (IP)"
    const sprintLabels = Array.from({ length: sprintsPerPI }, (_, i) => {
      const label = piNum ? `${piNum}.${i + 1}` : `S${i + 1}`;
      return i === sprintsPerPI - 1 ? `${label} (IP)` : label;
    });

    // Match each ticket to a sprint index within the PI
    const _sprintIdx = (t) => {
      // Check sprintName, allSprints, piSprint for "XX.Y" pattern
      const sources = [t.sprintName, ...(t.allSprints || []), t.piSprint || ''];
      for (const s of sources) {
        if (!s) continue;
        const m = s.match(piRe);
        if (m && (!piNum || m[1] === piNum)) return parseInt(m[2]) - 1;
      }
      return null;
    };

    // Build per-sprint per-team points matrix
    const teamColors = allTeams.map(t => _teamColor(t));
    const perSprintTeam = allTeams.map(() => Array(sprintsPerPI).fill(0));

    allPITickets.forEach(t => {
      const ti = allTeams.indexOf(t.team);
      if (ti < 0) return;
      let si = _sprintIdx(t);
      if (si === null) si = currentIdx; // fallback: current sprint
      if (si < 0 || si >= sprintsPerPI) return;
      perSprintTeam[ti][si] += (t.points || 0);
    });

    // Fill past sprints from velocityHistory when ticket data is missing
    // velocityHistory entries have names like "Ité 28.1", "Team X - Ité 28.2", etc.
    allTeams.forEach((t, ti) => {
      const hist = CONFIG.teams[t]?.velocityHistory || [];
      if (!hist.length) return;
      for (let si = 0; si < currentIdx; si++) {
        if (perSprintTeam[ti][si] > 0) continue; // already has ticket data
        const sprintSuffix = piNum ? `${piNum}.${si + 1}` : null;
        if (!sprintSuffix) continue;
        const entry = hist.find(h => h.name && h.name.includes(sprintSuffix));
        if (entry && entry.velocity > 0) perSprintTeam[ti][si] = entry.velocity;
      }
    });

    // Capacity per sprint = sum of team velocities (IP sprint = 0)
    const totalCap = allTeams.reduce((s, t) => s + (CONFIG.teams[t]?.velocity || 80), 0);
    const capLine = Array.from({ length: sprintsPerPI }, (_, i) =>
      i === sprintsPerPI - 1 ? 0 : totalCap
    );

    // Stacked bar datasets (one per team) + capacity line
    const datasets = allTeams.map((t, ti) => ({
      label: CONFIG.teams[t]?.name || `Équipe ${t}`,
      data: perSprintTeam[ti],
      backgroundColor: teamColors[ti] + 'BB',
      borderColor: teamColors[ti],
      borderWidth: 1,
      stack: 'load',
    }));
    datasets.push({
      label: 'Capacité cible',
      data: capLine,
      type: 'line',
      borderColor: '#94A3B8',
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 3,
      pointBackgroundColor: '#94A3B8',
      fill: false,
      stack: false,
    });

    ctx._chart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: sprintLabels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { font: { size: 11 } } },
          tooltip: {
            mode: 'index',
            callbacks: {
              afterBody: function(items) {
                const idx = items[0]?.dataIndex;
                if (idx == null) return '';
                const load = allTeams.reduce((s, _, ti) => s + perSprintTeam[ti][idx], 0);
                const cap = capLine[idx] || 0;
                if (!cap) return '';
                const delta = load - cap;
                const sign = delta > 0 ? '+' : '';
                return `\nTotal : ${load} / ${cap} pts (${sign}${delta})`;
              }
            }
          },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Story Points' } },
        },
      },
    });
  }, 100);

  // Dependency deadline alerts
  _renderPIDepAlerts();

  // Vélocité historique - sprints fermés récents (stockés dans CONFIG.teams après sync)
  _renderVelocityHistory(allTeams);
}

// ---- Filtres du tableau PI ----

function _piTableFilter() {
  const search  = (document.getElementById('_pi-search')?.value || '').toLowerCase();
  const active  = [...document.querySelectorAll('#pi-table-filters .pi-tf-btn.active')]
                    .map(b => b.dataset.tf).filter(s => s !== 'all');
  document.querySelectorAll('.pi-tbl-epic').forEach(row => {
    const matchTxt = !search || row.dataset.eid.toLowerCase().includes(search) || (row.dataset.etitle || '').includes(search);
    const rowSts   = (row.dataset.statuses || '').split(',');
    const matchSt  = !active.length || active.some(s => rowSts.includes(s));
    row.style.display = matchTxt && matchSt ? '' : 'none';
  });
}

function _piTableFilterStatus(btn) {
  const val = btn.dataset.tf;
  if (val === 'all') {
    document.querySelectorAll('#pi-table-filters .pi-tf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tf === 'all');
      if (b.dataset.tf === 'all') { b.style.background = '#475569'; b.style.color = '#fff'; }
      else { b.style.background = '#fff'; }
    });
  } else {
    const allBtn = document.querySelector('#pi-table-filters .pi-tf-btn[data-tf="all"]');
    if (allBtn) { allBtn.classList.remove('active'); allBtn.style.background = '#fff'; allBtn.style.color = '#475569'; }
    btn.classList.toggle('active');
    const isNowActive = btn.classList.contains('active');
    const clr = btn.dataset.color || btn.style.color;
    btn.style.background = isNowActive ? clr : '#fff';
    btn.style.color      = isNowActive ? '#fff' : clr;
    btn.style.borderColor = isNowActive ? clr : (clr + '44');
    // if nothing active → reactivate "all"
    const anyActive = [...document.querySelectorAll('#pi-table-filters .pi-tf-btn:not([data-tf="all"])')].some(b => b.classList.contains('active'));
    if (!anyActive && allBtn) {
      allBtn.classList.add('active'); allBtn.style.background = '#475569'; allBtn.style.color = '#fff';
    }
  }
  _piTableFilter();
}

function _piShowCellDetail(team, epicIds) {
  const teamCfg   = CONFIG.teams[team] || {};
  const teamName  = teamCfg.name  || `Équipe ${team}`;
  const teamColor = teamCfg.color || CLR.muted;

  const ST_CFG = {
    done:    { bg: '#DCFCE7', fg: '#15803D', label: 'Terminé'   },
    blocked: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Bloqué'    },
    inprog:  { bg: '#DBEAFE', fg: '#1D4ED8', label: 'En cours'  },
    review:  { bg: '#F3E8FF', fg: '#7E22CE', label: 'En review' },
    test:    { bg: '#FEF3C7', fg: '#B45309', label: 'En test'   },
    todo:    { bg: '#F1F5F9', fg: '#475569', label: 'À faire'   },
    backlog: { bg: '#F1F5F9', fg: '#94A3B8', label: 'Backlog'   },
  };

  let totalTickets = 0;

  const sections = epicIds.map(eid => {
    const epic   = EPICS.find(x => x.id === eid);
    const eTitle = epic?.title || eid;
    const eColor = epic?.color || CLR.muted;
    const tks    = getTickets().filter(t => t.team === team && t.epic === eid);
    if (!tks.length) return '';
    totalTickets += tks.length;

    const done    = tks.filter(t => isDone(t.status)).length;
    const blocked = tks.filter(t => t.status === 'blocked').length;
    const pts     = tks.reduce((a, t) => a + (t.points || 0), 0);
    const pct     = tks.length ? Math.round(done / tks.length * 100) : 0;
    const pctGrad = pct < 30 ? '#EF4444' : pct < 70 ? '#F59E0B' : '#22C55E';

    const epicLink = _jiraBrowse(eid, { style: `color:${eColor};font-weight:800;font-size:14px;text-decoration:none;` });

    const rows = tks.map(t => {
      const st      = ST_CFG[t.status] || ST_CFG.todo;
      const typeClr = CONFIG.typeColors?.[t.type] || CLR.dark;
      const avatar  = (t.assignee || '?').slice(0, 2).toUpperCase();
      const aColor  = (typeof MEMBER_COLORS !== 'undefined' && MEMBER_COLORS[t.assignee]) || teamColor;
      const pIcon   = priorityIcon(t.priority || 'medium');
      const ticketLink = _jiraBrowse(t.id, { style: `font-weight:700;font-size:12px;color:${typeClr};text-decoration:none;` });
      const _tkDone = isDone(t.status);

      return `<div data-tk-id="${t.id}" data-tk-status="${t.status}" data-tk-type="${t.type || ''}" data-tk-assign="${t.assignee || ''}" data-tk-title="${(t.title || '').replace(/"/g, '&quot;')}" class="pi-ticket-row" style="background:${_tkDone ? '#FAFAFA' : '#fff'};border-color:${_tkDone ? 'var(--border)' : '#E2E8F0'}">
        <span style="font-size:13px;flex-shrink:0">${pIcon}</span>
        <span class="pi-type-badge" style="background:${typeClr}22;color:${typeClr};white-space:nowrap">${typeName(t.type || 'story')}</span>
        <span class="pi-ticket-title" style="${_tkDone ? 'opacity:.55;text-decoration:line-through;' : ''}">
          ${ticketLink}
          <span style="font-size:12px;color:var(--text);margin-left:4px">${t.title || '(sans titre)'}</span>
        </span>
        ${ptsBadge(t.points)}
        <span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${aColor};color:#fff;font-size:10px;font-weight:700;flex-shrink:0" title="${t.assignee || '?'}">${avatar}</span>
        <span style="padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;background:${st.bg};color:${st.fg};white-space:nowrap;flex-shrink:0">${st.label}</span>
      </div>`;
    }).join('');

    const blockedBadge = blocked
      ? `<span style="background:#FEE2E2;color:#B91C1C;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:6px">⚠ ${blocked} bloqué${blocked > 1 ? 's' : ''}</span>`
      : '';

    return `<div data-epic-section="${eid}" style="margin-bottom:20px;border:1px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <!-- Epic header -->
      <div style="background:${eColor}11;border-left:4px solid ${eColor};padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="pi-status-dot" style="background:${eColor}"></span>
          ${epicLink}
          <span style="font-size:13px;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eTitle}</span>
          ${blockedBadge}
        </div>
        <!-- Progress bar -->
        <div style="display:flex;align-items:center;gap:8px">
          <div class="pi-progress-track">
            <div style="height:100%;width:${pct}%;background:${pctGrad};border-radius:3px;transition:width .4s"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${pctGrad};flex-shrink:0">${pct}%</span>
          <span style="font-size:11px;color:var(--text-muted);flex-shrink:0">${done}/${tks.length} tickets${pts ? ` · ${pts} pts` : ''}</span>
        </div>
      </div>
      <!-- Ticket list -->
      <div style="padding:10px 12px">${rows}</div>
    </div>`;
  }).filter(Boolean).join('');

  const ticketList = sections || `<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Aucun ticket trouvé.</p>`;

  // Collecter les statuts, types et assignés présents dans ces tickets pour les filtres
  const allTks = epicIds.flatMap(eid => getTickets().filter(t => t.team === team && t.epic === eid));
  const presentStatuses = [...new Set(allTks.map(t => t.status))];
  const presentTypes    = [...new Set(allTks.map(t => t.type).filter(Boolean))];
  const presentAssigns  = [...new Set(allTks.map(t => t.assignee).filter(Boolean))];

  const ST_COLORS = { done:'#22C55E', blocked:'#EF4444', inprog:'#3B82F6', review:'#A855F7', test:'#F59E0B', todo:'#94A3B8', backlog:'#94A3B8' };
  const ST_LABELS = { done:'Terminé', blocked:'Bloqué', inprog:'En cours', review:'En review', test:'En test', todo:'À faire', backlog:'Backlog' };

  const filterBar = `
    <div id="_pimod-filters" style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;background:#F8FAFC;border-radius:8px;margin-bottom:14px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <input id="_pimod-search" type="text" placeholder="🔍  Titre ou ID…" oninput="_piModFilter()" style="padding:5px 10px;border:1px solid var(--border);border-radius:99px;font-size:12px;outline:none;width:170px">
        <span class="pi-filter-label">Statut :</span>
        <button class="pimod-btn active" data-mf-type="status" data-mf-val="all" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid #475569;background:#475569;color:#fff;font-size:11px;font-weight:600;cursor:pointer">Tous</button>
        ${presentStatuses.map(s => {
          const c = ST_COLORS[s] || CLR.muted;
          return `<button class="pimod-btn" data-mf-type="status" data-mf-val="${s}" data-color="${c}" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid ${c}55;background:#fff;color:${c};font-size:11px;font-weight:600;cursor:pointer">${ST_LABELS[s] || s}</button>`;
        }).join('')}
      </div>
      ${presentTypes.length > 1 ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="pi-filter-label">Type :</span>
        <button class="pimod-btn active" data-mf-type="type" data-mf-val="all" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid #475569;background:#475569;color:#fff;font-size:11px;font-weight:600;cursor:pointer">Tous</button>
        ${presentTypes.map(tp => {
          const c = CONFIG.typeColors?.[tp] || CLR.dark;
          return `<button class="pimod-btn" data-mf-type="type" data-mf-val="${tp}" data-color="${c}" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid ${c}55;background:#fff;color:${c};font-size:11px;font-weight:600;cursor:pointer">${typeName(tp)}</button>`;
        }).join('')}
      </div>` : ''}
      ${presentAssigns.length > 1 ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="pi-filter-label">Assigné :</span>
        <button class="pimod-btn active" data-mf-type="assignee" data-mf-val="all" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid #475569;background:#475569;color:#fff;font-size:11px;font-weight:600;cursor:pointer">Tous</button>
        ${presentAssigns.map(a => {
          const c = (typeof MEMBER_COLORS !== 'undefined' && MEMBER_COLORS[a]) || teamColor;
          return `<button class="pimod-btn" data-mf-type="assignee" data-mf-val="${a}" data-color="${c}" onclick="_piModFilterBtn(this)" style="padding:3px 10px;border-radius:99px;border:1px solid ${c}55;background:#fff;color:${c};font-size:11px;font-weight:600;cursor:pointer">${a}</button>`;
        }).join('')}
      </div>` : ''}
    </div>`;

  document.getElementById('modal-title').innerHTML =
    `<span style="color:${teamColor}">${teamName}</span>
     <span style="font-weight:400;font-size:13px;color:var(--text-muted);margin-left:8px">- ${totalTickets} ticket${totalTickets > 1 ? 's' : ''} · ${epicIds.length} epic${epicIds.length > 1 ? 's' : ''}</span>`;
  document.getElementById('modal-body').innerHTML =
    `${filterBar}<div id="_pimod-list" style="max-height:55vh;overflow-y:auto;padding-right:4px">${ticketList}</div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

// Filtre interactif dans la popin ticket
window._piModFilter = function() {
  const search = (document.getElementById('_pimod-search')?.value || '').toLowerCase();
  const activeSt  = [...document.querySelectorAll('#_pimod-filters .pimod-btn[data-mf-type="status"].active')].map(b => b.dataset.mfVal).filter(v => v !== 'all');
  const activeTp  = [...document.querySelectorAll('#_pimod-filters .pimod-btn[data-mf-type="type"].active')].map(b => b.dataset.mfVal).filter(v => v !== 'all');
  const activeAss = [...document.querySelectorAll('#_pimod-filters .pimod-btn[data-mf-type="assignee"].active')].map(b => b.dataset.mfVal).filter(v => v !== 'all');
  document.querySelectorAll('#_pimod-list [data-tk-id]').forEach(row => {
    const st  = row.dataset.tkStatus || '';
    const tp  = row.dataset.tkType   || '';
    const ass = row.dataset.tkAssign || '';
    const txt = (row.dataset.tkTitle || '').toLowerCase() + (row.dataset.tkId || '').toLowerCase();
    const ok  = (!search || txt.includes(search))
             && (!activeSt.length  || activeSt.includes(st))
             && (!activeTp.length  || activeTp.includes(tp))
             && (!activeAss.length || activeAss.includes(ass));
    row.style.display = ok ? '' : 'none';
  });
  // cacher les sections epic vides
  document.querySelectorAll('#_pimod-list [data-epic-section]').forEach(sec => {
    const hasVisible = [...sec.querySelectorAll('[data-tk-id]')].some(r => r.style.display !== 'none');
    sec.style.display = hasVisible ? '' : 'none';
  });
};

window._piModFilterBtn = function(btn) {
  const type = btn.dataset.mfType;
  const val  = btn.dataset.mfVal;
  const group = document.querySelectorAll(`#_pimod-filters .pimod-btn[data-mf-type="${type}"]`);
  const allBtn = document.querySelector(`#_pimod-filters .pimod-btn[data-mf-type="${type}"][data-mf-val="all"]`);
  if (val === 'all') {
    group.forEach(b => {
      const isAll = b.dataset.mfVal === 'all';
      b.classList.toggle('active', isAll);
      const origClr = b.dataset.color || CLR.dark;
      b.style.background  = isAll ? '#475569' : '#fff';
      b.style.color       = isAll ? '#fff' : origClr;
      b.style.borderColor = isAll ? '#475569' : (origClr + '55');
    });
  } else {
    if (allBtn) { allBtn.classList.remove('active'); allBtn.style.background = '#fff'; allBtn.style.color = '#475569'; allBtn.style.borderColor = '#47556955'; }
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    const c  = btn.dataset.color || CLR.dark;
    btn.style.background  = on ? c : '#fff';
    btn.style.color       = on ? '#fff' : c;
    btn.style.borderColor = on ? c : (c + '55');
    // si plus rien actif → tout réactiver
    const anyOn = [...group].filter(b => b.dataset.mfVal !== 'all').some(b => b.classList.contains('active'));
    if (!anyOn && allBtn) { allBtn.classList.add('active'); allBtn.style.background = '#475569'; allBtn.style.color = '#fff'; allBtn.style.borderColor = '#475569'; }
  }
  _piModFilter();
};

function _renderVelocityHistory(allTeams) {
  const el = document.getElementById('pi-velocity');
  if (!el) return;

  // Collecter tous les sprints connus (union de tous les historiques), triés du plus ancien au plus récent
  const sprintMap = new Map(); // name → { name, startDate }
  allTeams.forEach(t => {
    (CONFIG.teams[t]?.velocityHistory || []).forEach(s => {
      if (!sprintMap.has(s.name)) sprintMap.set(s.name, s);
    });
  });
  const allSprints = [...sprintMap.values()]
    .sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      const numA = (a.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1];
      const numB = (b.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1];
      if (numA && numB) return parseFloat(numA) - parseFloat(numB);
      return a.name.localeCompare(b.name);
    })
    .map(s => s.name);

  if (!allSprints.length) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:12px;padding:8px 0">
      Aucun historique disponible. Synchronisez pour charger les derniers sprints fermés depuis JIRA.
    </p>`;
    return;
  }

  // Tableau récapitulatif - cible empirique = moyenne des sprints fermés
  const _velTipData = {}; // per-team tip data for hover
  const teamRows = allTeams.map(t => {
    const cfg     = CONFIG.teams[t] || {};
    const color   = cfg.color || CLR.muted;
    const name    = cfg.name  || t;
    const history = cfg.velocityHistory || [];
    // Cible empirique : moyenne des vélocités historiques
    const histVals = history.filter(s => s.velocity > 0).map(s => s.velocity);
    const empirical = histVals.length ? Math.round(histVals.reduce((a, b) => a + b, 0) / histVals.length) : (cfg.velocity || 0);
    const minVal    = histVals.length ? Math.min(...histVals) : 0;
    const maxVal    = histVals.length ? Math.max(...histVals) : 0;
    const median    = histVals.length ? [...histVals].sort((a,b) => a-b)[Math.floor(histVals.length / 2)] : 0;
    _velTipData[t]  = { name, color, history, histVals, empirical, minVal, maxVal, median };

    const cells   = allSprints.map(spName => {
      const entry = history.find(s => s.name === spName);
      if (!entry) return `<td style="color:var(--text-muted);text-align:center">-</td>`;
      const pct   = empirical ? Math.round(entry.velocity / empirical * 100) : null;
      const color2 = pct === null ? '' : pct >= 90 ? '#22C55E' : pct >= 70 ? '#F59E0B' : '#EF4444';
      return `<td class="pi-vel-cell" data-vel-detail="${t}|${spName}" style="cursor:pointer">
        <strong style="color:${color2 || 'inherit'}">${entry.velocity}</strong>
        ${pct !== null ? `<span class="pi-vel-pct">${pct}%</span>` : ''}
      </td>`;
    }).join('');
    const currentPts = getTickets().filter(x => x.team === t).reduce((a, x) => a + x.points, 0);
    return `<tr>
      <td class="pi-vel-team" style="color:${color}">${name}</td>
      ${cells}
      <td class="pi-vel-cell pi-vel-current" data-vel-detail="${t}|_current" style="cursor:pointer">
        <strong>${currentPts}</strong>
        ${empirical ? `<span class="pi-vel-pct">${Math.round(currentPts / empirical * 100)}%</span>` : ''}
      </td>
      <td class="pi-vel-target" data-vel-team="${t}" style="cursor:default">${empirical ? `${empirical} pts` : '-'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card pi-vel-wrap">
      <table class="pi-vel-table">
        <thead><tr>
          <th>Équipe</th>
          ${allSprints.map(s => `<th>${s}</th>`).join('')}
          <th style="background:rgba(2,132,199,.08)">Sprint actif</th>
          <th title="Moyenne empirique des sprints fermés">Cible (moy.)</th>
        </tr></thead>
        <tbody>${teamRows}</tbody>
      </table>
    </div>`;

  // Tooltips on target cells
  let _tipEl = document.getElementById('_pi-chip-tip');
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.id = '_pi-chip-tip';
    _tipEl.className = 'pi-tooltip';
    document.body.appendChild(_tipEl);
  }
  el.querySelectorAll('[data-vel-team]').forEach(td => {
    const d = _velTipData[td.dataset.velTeam];
    if (!d || !d.histVals.length) return;

    const sum = d.histVals.reduce((a, b) => a + b, 0);
    const sprintLines = d.history
      .filter(s => s.velocity > 0)
      .map(s => {
        const short = (s.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1] || s.name;
        const delta = s.velocity - d.empirical;
        const deltaStr = delta >= 0 ? `<span style="color:#4ADE80">+${delta}</span>` : `<span style="color:#F87171">${delta}</span>`;
        return `<tr><td style="padding:1px 10px 1px 0">${short}</td><td style="text-align:right;font-weight:700">${s.velocity} pts</td><td style="text-align:right;padding-left:8px">${deltaStr}</td></tr>`;
      }).join('');

    const tipHtml = `<div style="font-size:12px;line-height:1.7">
      <div style="font-weight:700;margin-bottom:6px;color:${d.color}">📊 ${d.name} - Calcul cible</div>
      <table style="width:100%;margin-bottom:8px">${sprintLines}</table>
      <hr class="pi-divider">
      <div style="display:flex;flex-direction:column;gap:2px">
        <span>Somme : <strong>${sum} pts</strong> sur <strong>${d.histVals.length}</strong> sprints</span>
        <span>Moyenne : ${sum} ÷ ${d.histVals.length} = <strong style="color:#60A5FA">${d.empirical} pts</strong></span>
        <span>Min : <strong>${d.minVal}</strong> · Max : <strong>${d.maxVal}</strong> · Médiane : <strong>${d.median}</strong></span>
      </div>
    </div>`;

    const _mov = e => { _tipEl.style.left = (e.clientX + 14) + 'px'; _tipEl.style.top = Math.max(8, e.clientY - _tipEl.offsetHeight - 10) + 'px'; };
    td.addEventListener('mouseenter', e => { _tipEl.innerHTML = tipHtml; _tipEl.style.display = 'block'; _tipEl.style.maxWidth = '360px'; _mov(e); });
    td.addEventListener('mousemove', _mov);
    td.addEventListener('mouseleave', () => { _tipEl.style.display = 'none'; });
  });

  // Click on velocity cells → detail modal
  el.querySelectorAll('[data-vel-detail]').forEach(td => {
    td.addEventListener('click', () => {
      const [teamId, sprintName] = td.dataset.velDetail.split('|');
      _piVelCellDetail(teamId, sprintName);
    });
  });

  // Chart vélocité trend
  setTimeout(() => {
    const canvasId = '_piVelChart';
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = canvasId;
      const wrap = document.createElement('div');
      wrap.className = 'chart-card';
      wrap.style.marginTop = '12px';
      const inner = document.createElement('div');
      inner.className = 'chart-wrap';
      inner.style.height = '200px';
      inner.appendChild(canvas);
      wrap.appendChild(inner);
      el.appendChild(wrap);
    }
    if (canvas._chart) canvas._chart.destroy();

    const datasets = allTeams
      .filter(t => (CONFIG.teams[t]?.velocityHistory || []).length)
      .map(t => {
        const cfg   = CONFIG.teams[t] || {};
        const color = cfg.color || CLR.muted;
        const data  = allSprints.map(spName => {
          const e = (cfg.velocityHistory || []).find(s => s.name === spName);
          return e ? e.velocity : null;
        });
        return {
          label: cfg.name || t,
          data,
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2,
          pointRadius: 4,
          tension: .3,
          spanGaps: true,
        };
      });

    if (!datasets.length) return;
    canvas._chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: allSprints, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Story Points livrés' } },
        },
      },
    });
  }, 150);
}

// ============================================================
// DEPENDENCY DEADLINE ALERTS - dépendances non résolues à D-N
// ============================================================

function _renderPIDepAlerts() {
  // Get deps from piprep if available
  const deps = (typeof _ppDepList === 'function') ? _ppDepList() : [];
  if (!deps.length) return;

  const alertDays = CONFIG.alerts?.depAlertDays ?? 5;
  const now = new Date(); now.setHours(0, 0, 0, 0);

  // Check sprint end as the implicit deadline for deps without explicit targetDate
  const s = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  const sprintEnd = s.endDate ? new Date(s.endDate) : null;
  if (sprintEnd) sprintEnd.setHours(0, 0, 0, 0);

  // Filtrer par équipes actives (sélection sidebar)
  const activeTeams = new Set(typeof getActiveTeams === 'function' ? getActiveTeams() : []);

  const alerts = [];
  deps.forEach(d => {
    // Skip resolved deps (if they have a resolved flag)
    if (d.resolved) return;
    if (!d.fromTeam || !d.toTeam) return;
    // Ne montrer que les dépendances impliquant au moins une équipe active
    if (activeTeams.size && !activeTeams.has(d.fromTeam) && !activeTeams.has(d.toTeam)) return;

    // Use targetDate if set, otherwise use sprint end
    const target = d.targetDate ? new Date(d.targetDate) : sprintEnd;
    if (!target) return;

    const daysLeft = Math.round((target - now) / 86400000);
    if (daysLeft <= alertDays && daysLeft >= -7) { // Alert from D-N to D+7 (overdue)
      const fromName = CONFIG.teams[d.fromTeam]?.name || d.fromTeam;
      const toName   = CONFIG.teams[d.toTeam]?.name || d.toTeam;
      const title    = d.fromTitle || d.toTitle || 'Dépendance';
      const overdue  = daysLeft < 0;
      alerts.push({
        icon: overdue ? '🔴' : '🟡',
        text: `<strong>${title}</strong> - ${fromName} → ${toName}${overdue ? ` · <span style="color:#DC2626">en retard de ${Math.abs(daysLeft)}j</span>` : ` · ${daysLeft}j restant${daysLeft > 1 ? 's' : ''}`}`,
      });
    }
  });

  if (!alerts.length) return;

  // Insert after pi-velocity or append to pi view
  let container = document.getElementById('pi-dep-alerts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pi-dep-alerts';
    const piVel = document.getElementById('pi-velocity');
    if (piVel) piVel.parentElement.insertBefore(container, piVel);
    else {
      const piView = document.getElementById('view-pi');
      if (piView) piView.appendChild(container);
      else return;
    }
  }

  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <div class="section-header"><div class="section-title">🔗 Alertes dépendances</div></div>
      <div style="padding:10px 14px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;">
        ${alerts.map(a => `<div style="font-size:12px;color:#78350F;padding:3px 0;display:flex;align-items:flex-start;gap:6px;">
          <span style="flex-shrink:0;">${a.icon}</span><span>${a.text}</span>
        </div>`).join('')}
      </div>
    </div>`;
}

// ============================================================
// PI OBJECTIVE RISK ALERTS - objectifs en danger
// ============================================================

function _renderPIObjRiskAlerts(stats, tickets, allTeams) {
  const el = document.getElementById('pi-obj-risk-alerts');
  if (!el) { // Create the container dynamically if not in HTML
    const objEl = document.getElementById('pi-objectives');
    if (!objEl) return;
    const div = document.createElement('div');
    div.id = 'pi-obj-risk-alerts';
    objEl.parentElement.insertBefore(div, objEl.nextSibling);
    return _renderPIObjRiskAlerts(stats, tickets, allTeams);
  }

  const alerts = [];

  // 1. Epics at risk (< 50% done with blockers)
  stats.atRisk.forEach(r => {
    alerts.push({
      icon: '🔴',
      text: `<strong>${r.eid}</strong> (${r.team}) - ${r.pct}% terminé, ${r.blocked} bloqué${r.blocked > 1 ? 's' : ''}, ${r.remaining} restant${r.remaining > 1 ? 's' : ''}`,
    });
  });

  // 2. Capacity gap - overloaded teams
  allTeams.forEach(team => {
    const tc = CONFIG.teams[team];
    if (!tc) return;
    const vel = tc.velocity || 0;
    const planned = tickets.filter(t => t.team === team).reduce((a, t) => a + (t.points || 0), 0);
    if (vel > 0 && planned > vel * 1.2) {
      const overPct = Math.round((planned / vel - 1) * 100);
      alerts.push({
        icon: '⚠️',
        text: `<strong>${tc.name || team}</strong> - surcharge +${overPct}% (${planned} pts planifiés vs ${vel} pts capacité)`,
      });
    }
  });

  // 3. Sprint end approaching with low completion
  const s = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  if (s.endDate) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end - now) / 86400000);
    const globalPct = stats.totalTk ? Math.round(stats.doneTk / stats.totalTk * 100) : 0;
    if (daysLeft <= 3 && globalPct < 60) {
      alerts.push({
        icon: '⏰',
        text: `Fin de sprint dans ${daysLeft}j - seulement ${globalPct}% terminé (${stats.doneTk}/${stats.totalTk} tickets)`,
      });
    }
  }

  if (!alerts.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div style="margin-top:12px;padding:10px 14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;">
      <div style="font-size:12px;font-weight:700;color:#991B1B;margin-bottom:6px;">🚨 Alertes objectifs PI</div>
      ${alerts.map(a => `<div style="font-size:12px;color:#7F1D1D;padding:3px 0;display:flex;align-items:flex-start;gap:6px;">
        <span style="flex-shrink:0;">${a.icon}</span><span>${a.text}</span>
      </div>`).join('')}
    </div>`;
}

// ============================================================
// VELOCITY CELL DETAIL - popin détail des tickets terminés par sprint/équipe
// ============================================================

function _piVelCellDetail(teamId, sprintName) {
  const tc        = CONFIG.teams[teamId] || {};
  const teamName  = tc.name  || teamId;
  const teamColor = tc.color || CLR.muted;
  const isCurrent = sprintName === '_current';

  // Tickets de cette équipe
  const allTk = typeof getTickets === 'function' ? getTickets() : TICKETS;
  let tks, sprintLabel;

  if (isCurrent) {
    // Sprint actif : tickets done de l'équipe
    tks = allTk.filter(t => t.team === teamId && isDone(t.status));
    sprintLabel = CONFIG.sprint.label || 'Sprint actif';
  } else {
    // Sprint passé : chercher dans velocityHistory (tickets stockés lors du fetch)
    const histEntry = (tc.velocityHistory || []).find(s => s.name === sprintName);
    if (histEntry && histEntry.tickets && histEntry.tickets.length) {
      tks = histEntry.tickets;
    } else {
      // Fallback : chercher dans TICKETS courants (cas démo ou cache ancien)
      tks = allTk.filter(t => t.team === teamId && isDone(t.status) && t.sprintName === sprintName);
      if (!tks.length) {
        tks = allTk.filter(t => t.team === teamId && isDone(t.status) && t.allSprints && t.allSprints.includes(sprintName));
      }
    }
    sprintLabel = sprintName;
  }

  const totalPts = tks.reduce((a, t) => a + (t.points || 0), 0);

  // Group by type
  const byType = {};
  tks.forEach(t => {
    const tn = t.type || 'autre';
    if (!byType[tn]) byType[tn] = { count: 0, pts: 0, tickets: [] };
    byType[tn].count++;
    byType[tn].pts += (t.points || 0);
    byType[tn].tickets.push(t);
  });

  const typeSummary = Object.entries(byType)
    .sort((a, b) => b[1].pts - a[1].pts)
    .map(([type, g]) => {
      const color = CONFIG.typeColors?.[type] || CLR.dark;
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:${color}15;border:1px solid ${color}33;font-size:11px;font-weight:600;color:${color}">${typeName(type)} ${g.count} · ${g.pts} pts</span>`;
    }).join(' ');

  const rows = tks
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .map(t => {
      const typeClr = CONFIG.typeColors?.[t.type] || CLR.dark;
      const epicObj = typeof EPICS !== 'undefined' ? EPICS.find(e => e.id === t.epic) : null;
      const epicLabel = epicObj ? epicTag(epicObj, t.epic, { maxWidth: 100 }) : '';
      return `<div class="pi-modal-row" onclick="closeModalDirect();openModal('${t.id}')">
        <span class="pi-type-badge" style="background:${typeClr}22;color:${typeClr}">${typeName(t.type || 'story')}</span>
        ${_jiraBrowse(t.id, { style: 'font-weight:600;font-size:11px;color:inherit;text-decoration:none;flex-shrink:0' })}
        <span class="pi-ticket-title" style="font-size:12px;color:var(--text)">${t.title}</span>
        ${epicLabel}
        ${ptsBadge(t.points, { size: 'small' })}
        <span style="font-size:10px;color:var(--text-muted);flex-shrink:0">${t.assignee || '–'}</span>
      </div>`;
    }).join('');

  document.getElementById('modal-title').innerHTML =
    `<span style="color:${teamColor}">${teamName}</span>
     <span style="font-weight:400;font-size:13px;color:var(--text-muted);margin-left:8px">· ${sprintLabel} · ${tks.length} ticket${tks.length > 1 ? 's' : ''} · <strong>${totalPts} pts</strong></span>`;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${typeSummary}</div>
    <div style="max-height:55vh;overflow-y:auto">${rows || '<p style="color:var(--text-muted);font-size:12px">Aucun ticket terminé trouvé pour ce sprint.</p>'}</div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

// ============================================================
// BUFFER TRACKING - planifié vs terminé, évolution en cours de PI
// ============================================================

function _renderPIBuffer(tickets, allTeams) {
  const el = document.getElementById('pi-buffer');
  if (!el) return;

  // PI context
  const _bufPiMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const _piNum      = _bufPiMatch ? _bufPiMatch[1] : null;
  const _piRe       = _piNum ? new RegExp(`(^|\\D)${_piNum}\\.\\d+`) : null;

  const bufferTickets = tickets.filter(t => t.buffer);
  if (!bufferTickets.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px 0">Aucun ticket buffer détecté dans le PI en cours.</p>';
    return;
  }

  const totalPts     = bufferTickets.reduce((s, t) => s + (t.points || 0), 0);
  const donePts      = bufferTickets.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const inprogPts    = bufferTickets.filter(t => ['inprog','review','test'].includes(t.status)).reduce((s, t) => s + (t.points || 0), 0);
  const todoPts      = totalPts - donePts - inprogPts;

  // PI context label (e.g. "PI 28 · 5 sprints")
  const _piLabel = _piNum ? `PI ${_piNum}` : 'PI';
  const _sprintNames = new Set(bufferTickets.map(t => t.sprintName || '').filter(Boolean));
  const _sprintCount = _sprintNames.size || 1;

  // Total PI points: current sprint tickets + velocity of past PI sprints
  const _currentSprintPts = tickets.reduce((s, t) => s + (t.points || 0), 0);
  let _pastPIVelocity = 0;
  if (_piRe) {
    const _activeTeamSet = new Set(allTeams);
    Object.entries(CONFIG.teams || {}).forEach(([tid, tc]) => {
      if (!_activeTeamSet.has(tid)) return;
      (tc.velocityHistory || []).forEach(vh => {
        if (_piRe.test(vh.name || '')) _pastPIVelocity += (vh.velocity || 0);
      });
    });
  }
  const sprintTotal  = _currentSprintPts + _pastPIVelocity;
  const bufferRatio  = sprintTotal ? Math.round(totalPts / sprintTotal * 100) : 0;

  // Status breakdown
  const ST = {
    done:    { label: 'Terminé',   color: '#22C55E', icon: '✅' },
    inprog:  { label: 'En cours',  color: '#3B82F6', icon: '🔄' },
    review:  { label: 'En review', color: '#A855F7', icon: '👀' },
    test:    { label: 'En test',   color: '#F59E0B', icon: '🧪' },
    todo:    { label: 'À faire',   color: '#94A3B8', icon: '📋' },
    blocked: { label: 'Bloqué',    color: '#EF4444', icon: '🚫' },
  };

  // Per-team breakdown
  const teamRows = allTeams.map(tid => {
    const tc      = CONFIG.teams[tid] || {};
    const color   = tc.color || CLR.muted;
    const name    = tc.name || tid;
    const tBuf    = bufferTickets.filter(t => t.team === tid);
    if (!tBuf.length) return '';
    const tTotal  = tBuf.reduce((s, t) => s + (t.points || 0), 0);
    const tDone   = tBuf.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
    const tInprog = tBuf.filter(t => ['inprog','review','test'].includes(t.status)).reduce((s, t) => s + (t.points || 0), 0);
    const tDonePct   = tTotal ? Math.round(tDone / tTotal * 100) : 0;
    const tInprogPct = tTotal ? Math.round(tInprog / tTotal * 100) : 0;
    return `<tr>
      <td style="font-weight:600;color:${color};font-size:12px;white-space:nowrap">${name}</td>
      <td style="text-align:center;font-size:12px">${tBuf.length}</td>
      <td style="text-align:center;font-size:12px;font-weight:600">${tTotal} pts</td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:#22C55E">${tDone} pts</td>
      <td style="width:120px">
        <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;background:#F1F5F9">
          <div style="width:${tDonePct}%;background:#22C55E"></div>
          <div style="width:${tInprogPct}%;background:#3B82F6"></div>
        </div>
      </td>
      <td style="text-align:center;font-size:12px;font-weight:700;color:${tDonePct >= 80 ? '#22C55E' : tDonePct >= 50 ? '#F59E0B' : '#94A3B8'}">${tDonePct}%</td>
    </tr>`;
  }).filter(Boolean).join('');

  // Ticket list grouped by status
  const statusGroups = Object.entries(ST).map(([key, cfg]) => {
    const tks = bufferTickets.filter(t => t.status === key);
    if (!tks.length) return '';
    const pts = tks.reduce((s, t) => s + (t.points || 0), 0);
    const rows = tks.map(t => {
      const teamColor = _teamColor(t.team);
      const teamName  = CONFIG.teams[t.team]?.name || t.team;
      return `<div class="pi-buf-row" onclick="openModal('${t.id}')">
        <span style="color:${cfg.color};flex-shrink:0">${cfg.icon}</span>
        ${_jiraBrowse(t.id, { style: 'font-weight:600;font-size:11px;color:inherit;text-decoration:none;flex-shrink:0' })}
        <span class="pi-ticket-title" style="color:var(--text)">${t.title}</span>
        ${(() => { const sn = t.sprintName || (t.allSprints && t.allSprints[t.allSprints.length - 1]) || CONFIG.teams[t.team]?.sprintName || ''; return sn ? `<span style="font-size:10px;color:var(--text-muted);font-weight:600;flex-shrink:0;white-space:nowrap">${sn.replace(/sprint\s*/i, 'S')}</span>` : ''; })()}
        ${ptsBadge(t.points, {size:'small'})}
        <span style="font-size:10px;color:${teamColor};font-weight:600;flex-shrink:0">${teamName}</span>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;color:${cfg.color}">${cfg.icon} ${cfg.label}</span>
        <span style="font-size:10px;color:var(--text-muted)">${tks.length} ticket${tks.length > 1 ? 's' : ''} · ${pts} pts</span>
      </div>
      ${rows}
    </div>`;
  }).filter(Boolean).join('');

  el.innerHTML = `
    <div class="card" style="padding:16px">
      <!-- KPIs row -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="pi-buf-kpi">
          <div class="pi-buf-kpi-val">${totalPts}<small> pts</small></div>
          <div class="pi-buf-kpi-label">Buffer total ${_piLabel}</div>
          <div style="font-size:9px;color:var(--text-muted)">${bufferTickets.length} ticket${bufferTickets.length > 1 ? 's' : ''} · ${_sprintCount} sprint${_sprintCount > 1 ? 's' : ''}</div>
        </div>
        <div class="pi-buf-kpi">
          <div class="pi-buf-kpi-val" style="color:#22C55E">${donePts}<small> pts</small></div>
          <div class="pi-buf-kpi-label">Terminé sur le PI</div>
        </div>
        <div class="pi-buf-kpi">
          <div class="pi-buf-kpi-val" style="color:#3B82F6">${inprogPts}<small> pts</small></div>
          <div class="pi-buf-kpi-label">En cours</div>
        </div>
        <div class="pi-buf-kpi">
          <div class="pi-buf-kpi-val" style="color:#94A3B8">${todoPts}<small> pts</small></div>
          <div class="pi-buf-kpi-label">Non commencé</div>
        </div>
        <div class="pi-buf-kpi pi-buf-kpi-tip" data-buf-tip="ratio" style="flex:1;min-width:180px">
          <div class="pi-buf-kpi-label" style="margin-bottom:4px">% Buffer dans le PI</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="position:relative;flex:1;height:10px;border-radius:5px;overflow:hidden;background:#F1F5F9">
              <div style="position:absolute;left:0;top:0;height:100%;width:${bufferRatio}%;background:${bufferRatio > 20 ? '#EF4444' : '#22C55E'};transition:width .3s;border-radius:5px"></div>
              <div style="position:absolute;left:20%;top:-2px;width:2px;height:14px;background:#64748B;border-radius:1px;z-index:1" title="Seuil 20%"></div>
            </div>
            <span style="font-size:13px;font-weight:700;color:${bufferRatio > 20 ? '#EF4444' : '#22C55E'}">${bufferRatio}%</span>
          </div>
          <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${bufferRatio > 20 ? '⚠️ Seuil 20% dépassé' : '✅ Dans le seuil 20%'}</div>
        </div>
      </div>

      <!-- Per-team table -->
      ${teamRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th class="pi-table-th" style="text-align:left">Équipe</th>
          <th class="pi-table-th" style="text-align:center">Tickets</th>
          <th class="pi-table-th" style="text-align:center">Total PI</th>
          <th class="pi-table-th" style="text-align:center">Done PI</th>
          <th class="pi-table-th" style="text-align:center">Progression</th>
          <th class="pi-table-th" style="text-align:center">%</th>
        </tr></thead>
        <tbody>${teamRows}</tbody>
      </table>` : ''}

      <!-- Ticket list by status -->
      <details style="margin-top:4px">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-muted);user-select:none">
          📋 Détail des ${bufferTickets.length} tickets buffer
        </summary>
        <div style="margin-top:8px">${statusGroups}</div>
      </details>
    </div>`;

  // Tooltip on ratio KPI
  const featurePts = sprintTotal - totalPts;
  const bufDone    = bufferTickets.filter(t => isDone(t.status));
  const bufInprog  = bufferTickets.filter(t => ['inprog','review','test'].includes(t.status));
  const bufTodo    = bufferTickets.filter(t => t.status === 'todo' || t.status === 'backlog');
  const bufBlocked = bufferTickets.filter(t => t.status === 'blocked');
  // Per-type breakdown
  const typeMap = {};
  bufferTickets.forEach(t => {
    const tn = typeName(t.type || 'autre');
    if (!typeMap[tn]) typeMap[tn] = { count: 0, pts: 0 };
    typeMap[tn].count++;
    typeMap[tn].pts += (t.points || 0);
  });
  const typeLines = Object.entries(typeMap)
    .sort((a, b) => b[1].pts - a[1].pts)
    .map(([name, v]) => `<tr><td style="padding:2px 8px 2px 0">${name}</td><td style="text-align:right;padding:2px 0">${v.count} tk</td><td style="text-align:right;padding:2px 0 2px 8px;font-weight:700">${v.pts} pts</td></tr>`)
    .join('');

  const ratioTipHtml = `
    <div style="font-size:12px;line-height:1.7">
      <div style="font-weight:700;margin-bottom:6px;font-size:13px">📊 Répartition ${_piLabel}</div>
      <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-bottom:8px">
        <div style="width:${100 - bufferRatio}%;background:#3B82F6" title="Features"></div>
        <div style="width:${bufferRatio}%;background:#F59E0B" title="Buffer"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span>🔵 Features : <strong>${featurePts} pts</strong> (${100 - bufferRatio}%)</span>
        <span>🟡 Buffer : <strong>${totalPts} pts</strong> (${bufferRatio}%)</span>
      </div>
      <hr class="pi-divider">
      <div style="font-weight:700;margin-bottom:4px">🛡️ Détail buffer - ${bufferTickets.length} tickets</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        <span>✅ ${bufDone.length} terminé${bufDone.length > 1 ? 's' : ''} (${donePts} pts)</span>
        <span>🔄 ${bufInprog.length} en cours (${inprogPts} pts)</span>
        ${bufTodo.length ? `<span>📋 ${bufTodo.length} non commencé${bufTodo.length > 1 ? 's' : ''} (${todoPts} pts)</span>` : ''}
        ${bufBlocked.length ? `<span>🚫 ${bufBlocked.length} bloqué${bufBlocked.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      <hr class="pi-divider">
      <div style="font-weight:700;margin-bottom:4px">Par type</div>
      <table style="width:100%">${typeLines}</table>
    </div>`;

  const ratioEl = el.querySelector('.pi-buf-kpi-tip[data-buf-tip="ratio"]');
  if (ratioEl) {
    let _tipEl = document.getElementById('_pi-chip-tip');
    if (!_tipEl) {
      _tipEl = document.createElement('div');
      _tipEl.id = '_pi-chip-tip';
      _tipEl.className = 'pi-tooltip';
      document.body.appendChild(_tipEl);
    }
    ratioEl.addEventListener('mouseenter', e => { _tipEl.innerHTML = ratioTipHtml; _tipEl.style.display = 'block'; _tipEl.style.maxWidth = '360px'; _movRatioTip(e); });
    ratioEl.addEventListener('mousemove', _movRatioTip);
    ratioEl.addEventListener('mouseleave', () => { _tipEl.style.display = 'none'; });
    function _movRatioTip(e) { _tipEl.style.left = (e.clientX + 14) + 'px'; _tipEl.style.top = Math.max(8, e.clientY - _tipEl.offsetHeight - 10) + 'px'; }
  }
}
