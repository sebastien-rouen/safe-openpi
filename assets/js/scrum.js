// ============================================================
// SCRUM VIEW — Board sprint, hiérarchie Feature>Epic, statistiques
// ============================================================

// ----------- Team mood / rituals persistence (data/team-mood.json) -----------
let _moodCache  = null;
let _moodLoaded = false;

function _moodData() {
  if (!_moodCache) _moodCache = { votes: {}, notes: {}, rituals: {} };
  return _moodCache;
}

let _moodSaveTimer = null;
function _moodSave() {
  clearTimeout(_moodSaveTimer);
  // Immediate localStorage
  localStorage.setItem('team_mood', JSON.stringify(_moodCache));
  // Debounced server persist
  _moodSaveTimer = setTimeout(() => {
    fetch('/data/team-mood.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_moodCache, null, 2),
    }).catch(() => { /* server unavailable — localStorage fallback */ });
  }, 300);
}

async function _moodLoad() {
  if (_moodLoaded) return;
  // localStorage first
  try {
    const local = localStorage.getItem('team_mood');
    if (local) _moodCache = JSON.parse(local);
  } catch { /* ignore */ }
  // Try server (silent fail)
  try {
    const res = await fetch('/data/team-mood.json');
    if (res.ok) {
      _moodCache = await res.json();
      localStorage.setItem('team_mood', JSON.stringify(_moodCache));
    }
  } catch { /* no server */ }
  _moodLoaded = true;
}

// Rituals helpers (vote de confiance, demo)
function _ritualsData() { return _moodData().rituals || (_moodData().rituals = {}); }

// Key for current sprint context (e.g. "Fuego__Ité 28.4")
function _ritualsKey() {
  const team = currentTeam && currentTeam !== 'all' ? currentTeam : 'all';
  const s = _activeSprintCtx();
  return `${team}__${s.label || 'sprint'}`;
}

// ----------- Sprint alerts -----------
function _renderSprintAlerts() {
  const el = document.getElementById('sprint-alerts');
  if (!el) return;

  const s   = _activeSprintCtx();
  const now = new Date(); now.setHours(0, 0, 0, 0);

  if (!s.startDate || !s.endDate) { el.innerHTML = ''; return; }

  const start = new Date(s.startDate.length === 10 ? s.startDate + 'T00:00:00' : s.startDate);
  const end   = new Date(s.endDate.length === 10   ? s.endDate   + 'T00:00:00' : s.endDate);
  start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);

  const daysFromStart = Math.round((now - start) / 86400000);
  const daysToEnd     = Math.round((end - now)   / 86400000);

  const alerts = [];
  const rKey   = _ritualsKey();
  const rd     = _ritualsData();

  const ac = CONFIG.alerts || {};
  const voteDays  = ac.voteDays  ?? 1;
  const moodDays  = ac.moodDays  ?? 2;
  const demoDays  = ac.demoDays  ?? 1;

  // J+N from sprint start → confidence vote
  if (daysFromStart >= 0 && daysFromStart <= voteDays) {
    const done = rd.vote?.[rKey];
    alerts.push({
      type: 'vote',
      icon: '🗳️',
      label: 'Vote de confiance PI Objectives',
      done,
      onclick: `_toggleRitual('vote')`,
    });
  }

  // J-N → mood meter (ROTI) — opens panel like fist of five
  if (daysToEnd >= 0 && daysToEnd <= moodDays) {
    const moodVotes = _moodData().votes || {};
    const hasVotes  = _moodTeams().some(t => { const v = moodVotes[_moodKey(t)]; return Array.isArray(v) && v.length > 0; });
    alerts.push({
      type: 'mood',
      icon: '😊',
      label: 'Mood meter (ROTI)',
      done: hasVotes,
      onclick: `_toggleMoodPanel()`,
    });
  }

  // J-N → demo prep (info only)
  if (daysToEnd >= 0 && daysToEnd <= demoDays) {
    alerts.push({
      type: 'demo',
      icon: '🎬',
      label: 'Préparation démo',
    });
  }

  el.innerHTML = alerts.map(a => {
    const statusHtml = a.done != null
      ? `<span class="sa-status">${a.done ? '✓ fait' : '⏳ à faire'}</span>`
      : '';
    const click = a.onclick ? ` onclick="${a.onclick}"` : '';
    return `<span class="sprint-alert sprint-alert-${a.type}"${click}>
      <span class="sa-icon">${a.icon}</span>${a.label}${statusHtml}
    </span>`;
  }).join('');
}

window._toggleRitual = function(type) {
  const rKey = _ritualsKey();
  const rd   = _ritualsData();
  if (!rd[type]) rd[type] = {};
  rd[type][rKey] = !rd[type][rKey];
  _moodSave();
  _renderSprintAlerts();
};

// ----------- Mood meter (ROTI) panel — like fist of five -----------
let _moodPanelOpen = false;

function _moodTeams() {
  if (currentTeam && currentTeam !== 'all') return [currentTeam];
  if (currentGroup) {
    const g = GROUPS.find(x => x.id === currentGroup);
    return g ? g.teams : Object.keys(CONFIG.teams);
  }
  return Object.keys(CONFIG.teams);
}

function _moodKey(teamId) {
  const s = _activeSprintCtx();
  return `${teamId}__${s.label || 'sprint'}`;
}

window._toggleMoodPanel = function() {
  _moodPanelOpen = !_moodPanelOpen;
  _renderMoodPanel();
};

window._moodVote = function(teamId, val) {
  const md = _moodData();
  if (!md.votes) md.votes = {};
  const key = _moodKey(teamId);
  if (!Array.isArray(md.votes[key])) md.votes[key] = [];
  md.votes[key].push(val);
  _moodSave();
  _renderMoodPanel();
  _renderSprintAlerts();
};

window._moodUndo = function(teamId) {
  const md = _moodData();
  const key = _moodKey(teamId);
  if (Array.isArray(md.votes?.[key]) && md.votes[key].length) {
    md.votes[key].pop();
    _moodSave();
    _renderMoodPanel();
    _renderSprintAlerts();
  }
};

window._moodReset = function(teamId) {
  const md = _moodData();
  const key = _moodKey(teamId);
  if (md.votes) md.votes[key] = [];
  if (md.notes) delete md.notes[key];
  _moodSave();
  _renderMoodPanel();
  _renderSprintAlerts();
};

window._moodNote = function(teamId, val) {
  const md = _moodData();
  if (!md.notes) md.notes = {};
  md.notes[_moodKey(teamId)] = val;
  _moodSave();
};

function _renderMoodPanel() {
  const el = document.getElementById('mood-panel');
  if (!el) return;
  if (!_moodPanelOpen) { el.innerHTML = ''; return; }

  const teams = _moodTeams();
  const md    = _moodData();
  const emojis = ['😡', '😟', '😐', '🙂', '😍'];
  const labels = ['', 'Très insatisfait', 'Insatisfait', 'Neutre', 'Satisfait', 'Très satisfait'];

  const cards = teams.map(tid => {
    const tc    = CONFIG.teams[tid];
    const color = tc?.color || '#475569';
    const key   = _moodKey(tid);
    const votes = Array.isArray(md.votes?.[key]) ? md.votes[key] : [];
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor = !count ? '#94A3B8' : avg < 2.5 ? '#DC2626' : avg < 3.5 ? '#D97706' : '#16A34A';
    const borderColor = !count ? 'var(--border)' : avg >= 3.5 ? '#86EFAC' : avg >= 2.5 ? '#FCD34D' : '#FECACA';
    const note = (md.notes?.[key] || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    // Distribution bars
    const distrib = [1,2,3,4,5].map(n => votes.filter(v => v === n).length);
    const maxD = Math.max(...distrib, 1);
    const distribHtml = count ? `<div style="display:flex;align-items:flex-end;gap:4px;height:36px;">
      ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <div style="width:18px;height:${Math.max(3, Math.round(d / maxD * 28))}px;background:${d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:3px;"></div>
        <span style="font-size:8px;color:var(--text-muted);">${d || ''}</span>
      </div>`).join('')}
    </div>` : '';

    const btns = [1,2,3,4,5].map(n => `
      <button onclick="_moodVote('${tid}',${n})"
        style="border:1.5px solid var(--border);border-radius:10px;background:var(--surface);padding:8px 12px;font-size:22px;cursor:pointer;transition:all .15s;"
        title="${n} — ${labels[n]}">${emojis[n-1]}</button>`
    ).join('');

    const actions = count ? `
      <button onclick="_moodUndo('${tid}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text-muted);cursor:pointer;" title="Annuler le dernier vote">↩</button>
      <button onclick="_moodReset('${tid}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text-muted);cursor:pointer;" title="Réinitialiser">✕</button>` : '';

    return `<div class="mood-card" style="border-left:3px solid ${color};border:1.5px solid ${borderColor};border-left:3px solid ${color};">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="font-weight:700;font-size:14px;color:${color};min-width:100px;display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
          ${tc?.name || tid}
        </div>
        <div style="display:flex;align-items:center;gap:4px;min-width:60px;">
          <span style="font-size:28px;font-weight:900;color:${vColor};line-height:1;">${count ? avg : '?'}</span>
          <span style="font-size:11px;color:${vColor};font-weight:600;">/5</span>
        </div>
        ${distribHtml}
        <div style="display:flex;gap:4px;align-items:center;">${btns}</div>
        ${count ? `<span style="font-size:11px;color:var(--text-muted);font-weight:600;">${count} vote${count > 1 ? 's' : ''}</span>` : ''}
        <div style="display:flex;gap:4px;margin-left:auto;">${actions}</div>
      </div>
      <input type="text" value="${note}" placeholder="Note / commentaire…"
        onchange="_moodNote('${tid}',this.value)"
        style="width:100%;border:none;border-top:1px solid var(--border);background:transparent;padding:5px 0 0;font-size:11px;color:var(--text-muted);font-style:italic;outline:none;margin-top:6px;">
    </div>`;
  }).join('');

  // Global average
  const allVotes = teams.flatMap(t => { const v = md.votes?.[_moodKey(t)]; return Array.isArray(v) ? v : []; });
  const totalV   = allVotes.length;
  const gAvg     = totalV ? Math.round(allVotes.reduce((s, v) => s + v, 0) / totalV * 10) / 10 : null;
  const teamsV   = teams.filter(t => { const v = md.votes?.[_moodKey(t)]; return Array.isArray(v) && v.length; }).length;
  const gColor   = gAvg === null ? 'var(--text-muted)' : gAvg < 2.5 ? '#DC2626' : gAvg < 3.5 ? '#D97706' : '#16A34A';
  const gBg      = gAvg === null ? 'var(--bg)' : gAvg < 2.5 ? '#FEF2F2' : gAvg < 3.5 ? '#FFFBEB' : '#F0FDF4';

  const avgBadge = gAvg !== null
    ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:8px;background:${gBg};margin-left:auto;">
        <span style="font-size:16px;font-weight:900;color:${gColor};">${gAvg}</span><span style="font-size:10px;color:${gColor};font-weight:600;">/5</span>
        <span style="font-size:10px;color:var(--text-muted);">${totalV} vote${totalV > 1 ? 's' : ''} · ${teamsV}/${teams.length} équipe${teams.length > 1 ? 's' : ''}</span>
      </div>`
    : '';

  el.innerHTML = `<div class="mood-panel">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:14px;font-weight:700;">😊 Mood Meter (ROTI)</span>
      ${avgBadge}
      <button onclick="_toggleMoodPanel()" style="margin-left:${gAvg !== null ? '8px' : 'auto'};border:none;background:none;font-size:16px;cursor:pointer;color:var(--text-muted);">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">${cards}</div>
  </div>`;
}

// Board view mode — 'columns' | 'deadlines' | 'list'
let _boardViewMode = localStorage.getItem('board_view_mode') || 'columns';

// Quick-filter state (improvement #9) — persisted in localStorage
let _scrumFilter     = localStorage.getItem('sqf_filter') || null;
let _scrumTextFilter = localStorage.getItem('sqf_text')   || '';
let _scrumTypeFilter = localStorage.getItem('sqf_type')   || '';
let _scrumAssignee   = localStorage.getItem('sqf_assignee') || '';
let _scrumEpicFilter = localStorage.getItem('sqf_epic')   || '';

// Standalone sidebar progress — callable from any view / init
function _renderSidebarProgress() {
  const sbWrap = document.getElementById('sb-progress-wrap');
  if (!sbWrap) return;
  const tickets  = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const done     = tickets.filter(t => t.status === 'done');
  const inprog   = tickets.filter(t => t.status === 'inprog');
  const review   = tickets.filter(t => t.status === 'review');
  const blocked  = tickets.filter(t => t.status === 'blocked');
  const ptsDone  = done.reduce((a, t) => a + (t.points || 0), 0);
  const ptsTotal = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const pct      = ptsTotal > 0 ? Math.round(ptsDone / ptsTotal * 100) : 0;
  const todo     = tickets.filter(t => t.status === 'todo').length;
  const flagged  = tickets.filter(t => t.flagged).length;
  const bufferTk  = tickets.filter(t => t.buffer);
  const bufferCnt = bufferTk.length;
  const bufferPts = bufferTk.reduce((a, t) => a + (t.points || 0), 0);
  const pctTk     = tickets.length ? Math.round(done.length / tickets.length * 100) : 0;
  const bufferPct = ptsTotal ? Math.round(bufferPts / ptsTotal * 100) : 0;
  const sbBufDone = bufferTk.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const sbFeatPct = ptsTotal > 0 ? Math.round((ptsDone - sbBufDone) / ptsTotal * 100) : 0;
  const sbBufPct  = ptsTotal > 0 ? Math.round(sbBufDone / ptsTotal * 100) : 0;
  const sbBufTip  = `Buffer : ${sbBufDone}/${bufferPts} pts done (${bufferCnt} tickets)`;
  sbWrap.innerHTML = `
    <div class="sb-prog-bar">
      <div class="sb-prog-fill" style="width:${sbFeatPct}%" title="Feature : ${ptsDone - sbBufDone} pts done"></div>
      ${sbBufPct > 0 ? `<div class="sb-prog-buf" style="width:${sbBufPct}%;left:${sbFeatPct}%" title="${sbBufTip}"></div>` : ''}
    </div>
    <div class="stat-row"><span class="stat-label">${pct}% pts · ${pctTk}% tickets</span><span class="stat-val green">${ptsDone}/${ptsTotal} pts</span></div>
    <div class="stat-row"><span class="stat-label">Done</span><span class="stat-val green">${done.length}</span></div>
    <div class="stat-row"><span class="stat-label">En cours / Review</span><span class="stat-val" style="color:#7DD3FC">${inprog.length + review.length}</span></div>
    <div class="stat-row"><span class="stat-label">À faire</span><span class="stat-val">${todo}</span></div>
    ${blocked.length ? `<div class="stat-row"><span class="stat-label">Bloqués</span><span class="stat-val red">${blocked.length}</span></div>` : ''}
    ${flagged ? `<div class="stat-row"><span class="stat-label">🚩 Flaggés</span><span class="stat-val red">${flagged}</span></div>` : ''}
    ${bufferCnt ? `<div class="stat-row"><span class="stat-label">🛡️ Buffer</span><span class="stat-val" style="color:#22C55E">${bufferCnt} · ${bufferPts} pts (${bufferPct}%)</span></div>` : ''}
  `;
}

function renderScrum() {
  const tickets = getTickets();
  const done    = tickets.filter(t => t.status === 'done');
  const inprog  = tickets.filter(t => t.status === 'inprog');
  const review  = tickets.filter(t => t.status === 'review');
  const blocked = tickets.filter(t => t.status === 'blocked');

  const ptsDone  = done.reduce((a, t) => a + t.points, 0);
  const ptsTotal = tickets.reduce((a, t) => a + t.points, 0);
  const ptsRem   = ptsTotal - ptsDone;
  const pct      = ptsTotal > 0 ? Math.round(ptsDone / ptsTotal * 100) : 0;

  // Sprint effectif selon le filtre courant
  const s    = _activeSprintCtx();
  const _el  = id => document.getElementById(id);
  const startShort = s.startDate ? s.startDate.replace(/\s+\d{4}$/, '') : '—';
  const endFull    = s.endDate   || '—';
  if (_el('sprint-name'))     _el('sprint-name').textContent     = s.label || '—';
  if (_el('sprint-dates'))    _el('sprint-dates').textContent    = s.startDate ? `${startShort} – ${endFull}` : '—';
  if (_el('sprint-velocity')) _el('sprint-velocity').textContent = ptsTotal + ' pts';
  // Buffer visualization in progress bar
  const bufTickets   = tickets.filter(t => t.buffer);
  const bufDonePts   = bufTickets.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const bufTotalPts  = bufTickets.reduce((a, t) => a + (t.points || 0), 0);
  const featDonePts  = ptsDone - bufDonePts;
  const featPct      = ptsTotal > 0 ? Math.round(featDonePts / ptsTotal * 100) : 0;
  const bufDonePct   = ptsTotal > 0 ? Math.round(bufDonePts / ptsTotal * 100) : 0;

  // WIP fill (inprog + review + test) — shown after done, before remaining
  const wipStatuses = ['inprog', 'review', 'test'];
  const wipPts     = tickets.filter(t => wipStatuses.includes(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const wipPct     = ptsTotal > 0 ? Math.round(wipPts / ptsTotal * 100) : 0;
  if (_el('sprint-prog-wip')) {
    _el('sprint-prog-wip').style.left  = pct + '%';
    _el('sprint-prog-wip').style.width = wipPct + '%';
    _el('sprint-prog-wip').title       = `En cours: ${wipPts} pts`;
  }

  if (_el('sprint-prog'))     _el('sprint-prog').style.width     = featPct + '%';
  if (_el('sprint-prog-buffer')) {
    _el('sprint-prog-buffer').style.width = bufDonePct + '%';
    _el('sprint-prog-buffer').style.left  = featPct + '%';
    _el('sprint-prog-buffer').title       = `Buffer: ${bufDonePts}/${bufTotalPts} pts done`;
  }
  if (_el('sprint-mark-80')) {
    _el('sprint-mark-80').style.display = bufTotalPts > 0 ? '' : 'none';
  }
  if (_el('sprint-pct'))      _el('sprint-pct').textContent      = pct + '%';
  if (_el('pts-done'))        _el('pts-done').textContent        = ptsDone + ' / ' + ptsTotal;
  if (_el('pts-rem'))         _el('pts-rem').textContent         = ptsRem + ' pts';
  if (_el('sprint-goal'))     _el('sprint-goal').innerHTML       = s.goal ? `<strong>🎯 Goal</strong>${s.goal}` : '';

  _renderSprintAlerts();
  if (_moodPanelOpen) _renderMoodPanel();
  _renderSidebarProgress();

  _updateSidebarStats();

  // Topbar
  const _ctxLabel = currentTeam && currentTeam !== 'all'
    ? currentTeam
    : currentGroup ? (GROUPS.find(g => g.id === currentGroup)?.name || '') : '';
  if (_el('topbar-title')) _el('topbar-title').textContent = `📋 Vue Scrum — ${s.label || 'Sprint actif'}${_ctxLabel ? ` · ${_ctxLabel}` : ''}`;

  // Stat cards
  const bufferAll  = tickets.filter(t => t.buffer);
  const bufferPtsS = bufferAll.reduce((a, t) => a + (t.points || 0), 0);
  const statCards = [
    { num: ptsDone,                       lbl: 'Points Terminés', color: '#10B981', filter: 'done',    title: 'Tickets terminés' },
    { num: ptsRem,                        lbl: 'Points Restants', color: '#F59E0B', filter: 'remaining', title: 'Tickets restants' },
    { num: inprog.length + review.length, lbl: 'En Cours',        color: '#3B82F6', filter: 'inprog',  title: 'Tickets en cours' },
    { num: blocked.length,                lbl: 'Bloqués',         color: '#EF4444', filter: 'blocked', title: 'Tickets bloqués' },
  ];
  if (bufferAll.length) {
    statCards.push({ num: bufferPtsS, lbl: '🛡️ Buffer', color: '#22C55E', filter: 'buffer', title: 'Tickets buffer (20%)' });
  }
  document.getElementById('scrum-stats').innerHTML = statCards.map(s => {
    const clickable = s.num > 0;
    return `<div class="stat-card${clickable ? ' stat-card--clickable' : ''}"${clickable ? ` onclick="_showScrumStatDetail('${s.filter}')" title="Voir : ${s.title}"` : ''}><div class="num" style="color:${s.color}">${s.num}</div><div class="lbl">${s.lbl}</div></div>`;
  }).join('');

  renderHierarchy(tickets);
  _renderScrumQuickFilters();
  _renderDailyActivity();
  renderBoard(tickets);

  if (!chartsInitialized) {
    initCharts();
    chartsInitialized = true;
  } else {
    // Mettre à jour les charts avec les nouvelles données
    refreshCharts();
  }
}

// Retourne le contexte sprint effectif selon le filtre courant.
// - Équipe sélectionnée → sprint de cette équipe
// - Groupe ou tout → sprint référence global (CONFIG.sprint)
function _activeSprintCtx() {
  if (currentTeam && currentTeam !== 'all') {
    const tc = CONFIG.teams[currentTeam];
    if (tc?.sprintName) {
      return {
        ...CONFIG.sprint,
        label:          tc.sprintName,
        startDate:      tc.sprintStart || CONFIG.sprint.startDate,
        endDate:        tc.sprintEnd   || CONFIG.sprint.endDate,
        velocityTarget: tc.velocity    || CONFIG.sprint.velocityTarget,
        goal:           tc.sprintGoal  || CONFIG.sprint.goal || '',
      };
    }
  }
  // Vue multi-équipes ou groupe : label générique (CONFIG.sprint.label est team-spécifique)
  return { ...CONFIG.sprint, label: 'Sprint actif' };
}

// Met à jour le bloc contexte sprint/PI dans la sidebar.
// Appelé depuis renderScrum() ET directement après chargement du cache.
function _updateSidebarStats() {
  const s        = _activeSprintCtx();
  const teamCfgS = currentTeam && currentTeam !== 'all' ? CONFIG.teams[currentTeam] : null;
  const url = CONFIG.jira?.url || '';
  const _el = id => document.getElementById(id);

  // Nom du sprint + lien board
  const linkEl = _el('sb-sprint-link');
  if (linkEl) {
    linkEl.textContent = s.label || '—';
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
    const piMatch = (s.label || '').match(/PI\s*(\d+)/i);
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
    const endStr = s.endDate || '';
    const end    = endStr ? new Date(endStr.split('/').reverse().join('-')) : null;
    const diff   = end ? Math.ceil((end - new Date()) / 86400000) : null;
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

  // Dates sprint — format "06 mar. → 19 mar. 2026"
  const datesEl = _el('sb-sprint-dates');
  if (datesEl && s.startDate && s.endDate) {
    const _shortDate = (str) => {
      const d = new Date(str.split('/').reverse().join('-'));
      if (isNaN(d)) return str;
      const months = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
      return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]}`;
    };
    const endD = new Date(s.endDate.split('/').reverse().join('-'));
    const year = !isNaN(endD) ? ' ' + endD.getFullYear() : '';
    datesEl.textContent = `${_shortDate(s.startDate)} → ${_shortDate(s.endDate)}${year}`;
  } else if (datesEl) {
    datesEl.textContent = '';
  }
}

function renderHierarchy(tickets) {
  const el = document.getElementById('hierarchy-view');
  let html = '';

  FEATURES.forEach(f => {
    const fEpics   = EPICS.filter(e => e.feature === f.id);
    const fTickets = tickets.filter(t => fEpics.some(e => e.id === t.epic));
    if (!fTickets.length) return;

    // Regrouper les tickets par groupe
    const groupMap = new Map();
    fTickets.forEach(t => {
      const grp = GROUPS.find(g => g.teams.includes(t.team));
      const key = grp ? grp.id : '__none__';
      if (!groupMap.has(key)) groupMap.set(key, { grp: grp || null, teams: new Set(), tkts: [], epicIds: new Set() });
      const entry = groupMap.get(key);
      entry.teams.add(t.team);
      entry.tkts.push(t);
      if (t.epic) entry.epicIds.add(t.epic);
    });

    groupMap.forEach(({ grp, teams, tkts, epicIds }) => {
      const grpDone  = tkts.filter(t => t.status === 'done').length;
      const grpPts   = tkts.reduce((a, t) => a + t.points, 0);
      const teamsStr = [...teams].sort().join(', ');
      const label    = grp ? grp.name : f.title;
      const dotColor = grp ? grp.color : f.color;

      const allDone = grpDone === tkts.length && tkts.length > 0;
      html += `<div class="feature-row" style="background:${dotColor}18;border-left:3px solid ${dotColor};${allDone ? 'opacity:.55;' : ''}" onclick="const s=this.nextElementSibling,open=s.style.display==='none';s.style.display=open?'block':'none';this.querySelector('.fr-arrow').textContent=open?'▼':'▶';">
        <span style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span><span class="fr-arrow">▶</span> ${label}${teamsStr ? ' — ' + teamsStr : ''}</span>
        <span style="font-size:12px;opacity:.8">${allDone ? '✓ ' : ''}${grpDone}/${tkts.length} tickets • ${grpPts} pts</span>
      </div><div style="display:none;">`;

      // Sort epics: not-done first, done last
      const sortedEpics = fEpics.filter(e => epicIds.has(e.id)).sort((a, b) => {
        const aDone = tkts.filter(t => t.epic === a.id).every(t => t.status === 'done');
        const bDone = tkts.filter(t => t.epic === b.id).every(t => t.status === 'done');
        return (aDone ? 1 : 0) - (bDone ? 1 : 0);
      });

      sortedEpics.forEach(e => {
        const eTickets = tkts.filter(t => t.epic === e.id);
        if (!eTickets.length) return;
        const eDone  = eTickets.filter(t => t.status === 'done').length;
        const ePct   = eTickets.length ? Math.round(eDone / eTickets.length * 100) : 0;
        const ePts   = eTickets.reduce((a, t) => a + t.points, 0);
        const isDone = ePct === 100 && eTickets.length > 0;
        const titleStyle = isDone ? 'text-decoration:line-through;opacity:.55;' : '';
        const prefix     = isDone
          ? `<span style="color:#22C55E;font-size:14px;line-height:1;" title="Terminé">✓</span>`
          : `<span style="width:10px;height:10px;border-radius:50%;background:${e.color};display:inline-block;flex-shrink:0;"></span>`;
        html += `<div class="epic-row" style="cursor:default;">
          <span style="display:flex;align-items:center;gap:8px;min-width:0;">
            ${prefix}
            <span style="${titleStyle}">${_jiraBrowse(e.id, { style: 'color:inherit;text-decoration:none;font-weight:700;cursor:pointer;' })} — ${e.title}</span>
            <span class="badge badge-epic">${e.team}</span>
          </span>
          <span class="prog">${eDone}/${eTickets.length} • ${ePct}%${ePts ? ` <span style="opacity:.65;font-size:11px;">${ePts}pts</span>` : ''}
            <span style="position:relative;display:inline-block;width:60px;height:4px;background:#DBEAFE;border-radius:2px;vertical-align:middle;margin-left:4px;overflow:hidden;">
              <span style="position:absolute;top:0;left:0;width:${ePct}%;height:100%;background:${isDone ? '#22C55E' : e.color};border-radius:2px;"></span>
            </span>
          </span>
        </div>`;
      });

      html += '</div>';
    });
  });

  el.innerHTML = html || '<div style="padding:1rem;color:var(--text-muted);font-size:13px;">Aucune hiérarchie à afficher. Synchronisez les données JIRA.</div>';
}

// ============================================================
// DAILY ACTIVITY — snapshot + changelog for PO checklist
// ============================================================

// Field labels for display
const _DA_FIELD_LABELS = {
  status: '🔄 Statut', assignee: '👤 Assigné', 'Story Points': '🎯 Points',
  priority: '⚡ Priorité', description: '📝 Description', labels: '🏷️ Étiquettes',
  Sprint: '🏃 Sprint', Link: '🔗 Lien', Rank: '📊 Rang', resolution: '✅ Résolution',
  summary: '✏️ Titre', duedate: '📅 Échéance', Flagged: '🚩 Flag',
  'Story point estimate': '🎯 Points',
};
const _daFieldLabel = (f) => _DA_FIELD_LABELS[f] || f;

// Build daily activity from JIRA changelog (recentChanges on each ticket)
// Returns { today: [...], yesterday: [...] }
function _buildDailyChanges() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yDate    = new Date(Date.now() - 86400000);
  const yStr     = yDate.toISOString().slice(0, 10);
  const today = [], yesterday = [];
  TICKETS.forEach(t => {
    if (!Array.isArray(t.recentChanges) || !t.recentChanges.length) return;
    t.recentChanges.forEach(c => {
      if (c.date !== todayStr && c.date !== yStr) return;
      const entry = {
        id:       t.id,
        title:    t.title,
        kind:     c.field === 'status' ? 'status' : 'field',
        field:    c.field,
        from:     c.from,
        to:       c.to,
        author:   c.author,
        assignee: t.assignee || '',
        team:     t.team || '',
        time:     c.time,
      };
      (c.date === todayStr ? today : yesterday).push(entry);
    });
  });
  today.sort((a, b) => a.time.localeCompare(b.time));
  yesterday.sort((a, b) => a.time.localeCompare(b.time));
  return { today, yesterday };
}

let _dailyActivityCollapsed = localStorage.getItem('daily_activity_collapsed') === 'true';

window._toggleDailyActivity = function() {
  _dailyActivityCollapsed = !_dailyActivityCollapsed;
  localStorage.setItem('daily_activity_collapsed', _dailyActivityCollapsed);
  const body = document.getElementById('daily-activity-body');
  const arrow = document.getElementById('daily-activity-arrow');
  if (body) body.style.display = _dailyActivityCollapsed ? 'none' : '';
  if (arrow) arrow.textContent = _dailyActivityCollapsed ? '▶' : '▼';
};

function _daRenderRow(c) {
  const authorName  = c.author || c.assignee || '';
  const avatarColor = MEMBER_COLORS[authorName] || '#64748B';
  let transitionHtml;
  if (c.kind === 'status') {
    const fromS = _mapStatus(c.from) || c.from;
    const toS   = _mapStatus(c.to) || c.to;
    transitionHtml = `<span class="badge badge-${fromS}" style="font-size:10px;">${statusLabel(fromS)}</span><span class="da-arrow">→</span><span class="badge badge-${toS}" style="font-size:10px;">${statusLabel(toS)}</span>`;
  } else {
    transitionHtml = `<span class="da-field-badge">${_daFieldLabel(c.field)}</span><span class="da-field-val" title="${c.from || '—'}">${c.from || '—'}</span><span class="da-arrow">→</span><span class="da-field-val" title="${c.to || '—'}">${c.to || '—'}</span>`;
  }
  const mappedTo = c.kind === 'status' ? (_mapStatus(c.to) || c.to) : '';
  return `<div class="da-row${mappedTo === 'done' ? ' da-done' : ''}${c.kind === 'field' ? ' da-field' : ''}" onclick="openModal('${c.id}')">
    <span class="da-time">${c.time}</span>
    <span class="da-transition">${transitionHtml}</span>
    <span class="da-ticket">
      <span class="da-ticket-id">${_jiraBrowse(c.id)}</span>
      <span class="da-ticket-title">${c.title}</span>
    </span>
    <span class="da-assignee" title="${authorName}">
      <span class="avatar" style="background:${avatarColor};width:20px;height:20px;font-size:9px;flex-shrink:0;">${initials(authorName)}</span>
    </span>
  </div>`;
}

function _daSummary(changes) {
  const sc = changes.filter(c => c.kind === 'status');
  const fc = changes.filter(c => c.kind === 'field');
  const done = sc.filter(c => { const s = _mapStatus(c.to) || c.to; return s === 'done'; }).length;
  return [
    done       ? `✅ ${done} terminé${done > 1 ? 's' : ''}` : '',
    sc.length  ? `🔄 ${sc.length} transition${sc.length > 1 ? 's' : ''}` : '',
    fc.length  ? `✏️ ${fc.length} modif${fc.length > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' · ');
}

function _renderDailyActivity() {
  const { today: todayAll, yesterday: yesterdayAll } = _buildDailyChanges();

  // Filter by active team/group
  const visibleIds = new Set(getTickets().map(t => t.id));
  // Also filter by member quick filter if active
  const memberFilter = typeof _scrumAssignee !== 'undefined' ? _scrumAssignee : '';
  const _filter = (list) => list.filter(c => {
    if (!visibleIds.has(c.id)) return false;
    if (memberFilter && c.author !== memberFilter) return false;
    return true;
  });
  const todayChanges     = _filter(todayAll);
  const yesterdayChanges = _filter(yesterdayAll);

  // Get or create container — placed after scrum-quick-filters
  let wrap = document.getElementById('daily-activity-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'daily-activity-wrap';
    const qf = document.getElementById('scrum-quick-filters');
    if (qf) qf.parentNode.insertBefore(wrap, qf.nextSibling);
    else {
      const board = document.getElementById('scrum-board');
      if (board) board.parentNode.insertBefore(wrap, board);
      else return;
    }
  }

  const arrow = _dailyActivityCollapsed ? '▶' : '▼';
  const todayLabel     = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const yDate          = new Date(Date.now() - 86400000);
  const yesterdayLabel = yDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const allChanges = [...todayChanges, ...yesterdayChanges];
  const summary    = _daSummary(todayChanges);
  const totalCount = allChanges.length;

  // Render today rows
  const todayRows = todayChanges.slice().reverse().map(_daRenderRow).join('');
  // Render yesterday rows
  const yRows     = yesterdayChanges.slice().reverse().map(_daRenderRow).join('');

  const todaySection = todayRows
    ? `<div class="da-day-label">📅 ${todayLabel}</div>${todayRows}`
    : `<div class="da-day-label">📅 ${todayLabel}</div><div class="da-empty">Pas encore de mouvement aujourd'hui… synchronisez pour détecter les changements.</div>`;

  const yesterdaySection = yRows
    ? `<div class="da-day-label da-day-yesterday">📅 ${yesterdayLabel}</div>${yRows}`
    : '';

  wrap.innerHTML = `
    <div class="da-header" onclick="_toggleDailyActivity()">
      <span id="daily-activity-arrow" class="da-collapse-arrow">${arrow}</span>
      <span class="da-header-icon">📋</span>
      <span class="da-header-title">Activité récente</span>
      <span class="da-header-summary">${summary || 'Aucune activité pour le moment'}</span>
      ${totalCount ? `<span class="da-header-count">${totalCount}</span>` : ''}
    </div>
    <div id="daily-activity-body" class="da-body" style="${_dailyActivityCollapsed ? 'display:none;' : ''}">
      ${todaySection}
      ${yesterdaySection}
    </div>`;
}

function _renderScrumQuickFilters() {
  let el = document.getElementById('scrum-quick-filters');
  if (!el) {
    el = document.createElement('div');
    el.id = 'scrum-quick-filters';
    const board = document.getElementById('scrum-board');
    if (board) board.parentNode.insertBefore(el, board);
  }
  const filters = [
    { key: 'blocked',    label: '🚫 Bloqués',      danger: true  },
    { key: 'unassigned', label: '👤 Non assignés',  danger: false },
    { key: 'critical',   label: '🔴 Critique',      danger: false },
  ];
  const dangerCls = (f) => f.danger && _scrumFilter === f.key ? ' danger' : '';

  // Build dynamic options from current tickets
  const allT     = getTickets();
  const types    = [...new Set(allT.map(t => t.type).filter(Boolean))].sort();
  const assignees = [...new Set(allT.map(t => t.assignee).filter(Boolean))].sort();
  const epics    = [...new Set(allT.map(t => t.epic).filter(Boolean))].sort();

  const hasAny = _scrumFilter || _scrumTextFilter || _scrumTypeFilter || _scrumAssignee || _scrumEpicFilter;

  el.innerHTML =
    filters.map(f =>
      `<button class="sqf-btn${_scrumFilter === f.key ? ' active' + dangerCls(f) : ''}"
        onclick="_setScrumFilter('${f.key}')">${f.label}</button>`
    ).join('') +
    `<select class="sqf-select${_scrumTypeFilter ? ' active' : ''}" onchange="_setScrumType(this.value)" title="Filtrer par type">
      <option value="">Type</option>${types.map(t => `<option value="${t}"${_scrumTypeFilter === t ? ' selected' : ''}>${typeName(t)}</option>`).join('')}
    </select>` +
    `<select class="sqf-select${_scrumAssignee ? ' active' : ''}" onchange="_setScrumAssignee(this.value)" title="Filtrer par assigné">
      <option value="">Assigné</option>${assignees.map(a => `<option value="${a}"${_scrumAssignee === a ? ' selected' : ''}>${a}</option>`).join('')}
    </select>` +
    `<select class="sqf-select${_scrumEpicFilter ? ' active' : ''}" onchange="_setScrumEpic(this.value)" title="Filtrer par epic">
      <option value="">Epic</option>${epics.map(e => { const ep = EPICS.find(x => x.id === e); return `<option value="${e}"${_scrumEpicFilter === e ? ' selected' : ''}>${ep ? ep.title : e}</option>`; }).join('')}
    </select>` +
    `<input id="sqf-text" type="text" placeholder="🔍 Rechercher…" value="${_scrumTextFilter.replace(/"/g,'&quot;')}"
      oninput="_setScrumText(this.value)">` +
    (hasAny ? `<button class="sqf-btn" onclick="_clearAllScrumFilters()">✕ Effacer</button>` : '');
}

function _persistScrumFilters() {
  const set = (k, v) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  set('sqf_filter', _scrumFilter);
  set('sqf_text', _scrumTextFilter);
  set('sqf_type', _scrumTypeFilter);
  set('sqf_assignee', _scrumAssignee);
  set('sqf_epic', _scrumEpicFilter);
}

window._setScrumFilter = function(key) {
  _scrumFilter = (_scrumFilter === key) ? null : key;
  _persistScrumFilters();
  renderBoard(getTickets());
  _renderScrumQuickFilters();
};

window._setScrumText = function(val) {
  _scrumTextFilter = val;
  _persistScrumFilters();
  renderBoard(getTickets());
};

window._setScrumType = function(val) {
  _scrumTypeFilter = val;
  _persistScrumFilters();
  renderBoard(getTickets());
  _renderScrumQuickFilters();
};

window._setScrumAssignee = function(val) {
  _scrumAssignee = val;
  _persistScrumFilters();
  renderBoard(getTickets());
  _renderScrumQuickFilters();
  _renderDailyActivity();
};

window._setScrumEpic = function(val) {
  _scrumEpicFilter = val;
  _persistScrumFilters();
  renderBoard(getTickets());
  _renderScrumQuickFilters();
};

window._clearAllScrumFilters = function() {
  _scrumFilter = null;
  _scrumTextFilter = '';
  _scrumTypeFilter = '';
  _scrumAssignee = '';
  _scrumEpicFilter = '';
  _persistScrumFilters();
  renderBoard(getTickets());
  _renderScrumQuickFilters();
  _renderDailyActivity();
};

function _applyScrumQuickFilter(tickets) {
  let result = tickets;
  if (_scrumFilter === 'blocked')    result = result.filter(t => t.status === 'blocked');
  if (_scrumFilter === 'unassigned') result = result.filter(t => !t.assignee);
  if (_scrumFilter === 'critical')   result = result.filter(t => t.priority === 'critical');
  if (_scrumTypeFilter)              result = result.filter(t => t.type === _scrumTypeFilter);
  if (_scrumAssignee)                result = result.filter(t => t.assignee === _scrumAssignee);
  if (_scrumEpicFilter)              result = result.filter(t => t.epic === _scrumEpicFilter);
  if (_scrumTextFilter) {
    const q = _scrumTextFilter.toLowerCase();
    result = result.filter(t =>
      (t.id    || '').toLowerCase().includes(q) ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.assignee || '').toLowerCase().includes(q)
    );
  }
  return result;
}

function _renderBoardViewToggle() {
  const el = document.getElementById('board-view-toggle');
  if (!el) return;
  const modes = [
    { key: 'columns',   icon: '▤', tip: 'Colonnes par statut' },
    { key: 'deadlines', icon: '📅', tip: 'Couloirs par échéance' },
    { key: 'list',      icon: '☰', tip: 'Liste compacte' },
  ];
  el.innerHTML = modes.map(m =>
    `<button class="bv-btn${_boardViewMode === m.key ? ' active' : ''}" title="${m.tip}" onclick="_setBoardView('${m.key}')">${m.icon}</button>`
  ).join('');
}

window._setBoardView = function(mode) {
  _boardViewMode = mode;
  localStorage.setItem('board_view_mode', mode);
  _renderBoardViewToggle();
  renderBoard(getTickets());
};

function renderBoard(tickets) {
  const filtered = _applyScrumQuickFilter(tickets);
  window._modalTicketList = filtered.map(t => t.id);
  _renderBoardViewToggle();

  if (_boardViewMode === 'deadlines') return _renderBoardDeadlines(filtered);
  if (_boardViewMode === 'list')      return _renderBoardList(filtered);
  _renderBoardColumns(filtered);
}

// Swimlane collapse state
let _taskLaneCollapsed = localStorage.getItem('task_lane_collapsed') === 'true';

window._toggleTaskLane = function() {
  _taskLaneCollapsed = !_taskLaneCollapsed;
  localStorage.setItem('task_lane_collapsed', _taskLaneCollapsed);
  renderBoard(getTickets());
};

function _renderBoardColumns(filtered) {
  const cols = [
    { key: 'todo',   label: 'À faire',   color: 'var(--todo)'   },
    { key: 'inprog', label: 'En cours',  color: 'var(--inprog)' },
    { key: 'review', label: 'En review', color: 'var(--review)' },
    { key: 'done',   label: 'Terminé',   color: 'var(--done)'   },
  ];

  // Separate task tickets with specific labels into their own swimlane
  const _isSwimlaneTache = (t) => t.type === 'tache' && Array.isArray(t.labels) &&
    t.labels.some(l => l.includes('onboarding') || l.includes('actionretro'));
  const taskTickets  = filtered.filter(_isSwimlaneTache);
  const otherTickets = filtered.filter(t => !_isSwimlaneTache(t));

  const board = document.getElementById('scrum-board');
  board.className = 'board board-with-lanes';

  // Task swimlane
  let taskLaneHtml = '';
  if (taskTickets.length) {
    const arrow = _taskLaneCollapsed ? '▶' : '▼';
    taskLaneHtml = `<div class="board-swimlane">
      <div class="swimlane-header" onclick="_toggleTaskLane()">
        <span class="swimlane-arrow">${arrow}</span>
        <span class="swimlane-icon" style="color:var(--tache);">●</span>
        <span class="swimlane-title">Tâches</span>
        <span class="col-count">${taskTickets.length}</span>
        <span class="swimlane-hint">Rétros · Onboarding · Actions</span>
      </div>
      ${!_taskLaneCollapsed ? `<div class="board-swimlane-grid">${cols.map(col => {
        const colT = taskTickets.filter(t =>
          t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')
        );
        return `<div class="board-col board-col-mini">
          <div class="col-body">${colT.map(t => ticketCard(t)).join('') || '<div class="col-empty"></div>'}</div>
        </div>`;
      }).join('')}</div>` : ''}
    </div>`;
  }

  // Main board
  const mainHtml = cols.map(col => {
    const colTickets = otherTickets.filter(t =>
      t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')
    );
    return `<div class="board-col">
      <div class="col-header">
        <div class="col-title"><span style="width:10px;height:10px;border-radius:50%;background:${col.color};display:inline-block;"></span>${col.label}</div>
        <span class="col-count">${colTickets.length}</span>
      </div>
      <div class="col-body">${colTickets.map(t => ticketCard(t)).join('')}</div>
    </div>`;
  }).join('');

  board.innerHTML = taskLaneHtml + `<div class="board-main-grid">${mainHtml}</div>`;
}

function _renderBoardDeadlines(filtered) {
  const now = new Date(); now.setHours(0,0,0,0);
  const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  const endOfNextWeek = new Date(endOfWeek); endOfNextWeek.setDate(endOfWeek.getDate() + 7);

  const _dueDate = (t) => {
    const d = t.dueDate;
    if (!d) return null;
    return new Date(d.length === 10 ? d + 'T00:00:00' : d);
  };

  const lanes = [
    { key: 'overdue',  label: '🔴 En retard',        color: '#DC2626', tickets: [] },
    { key: 'today',    label: '🟠 Aujourd\'hui',      color: '#F59E0B', tickets: [] },
    { key: 'week',     label: '🟡 Cette semaine',     color: '#EAB308', tickets: [] },
    { key: 'nextweek', label: '🔵 Semaine prochaine', color: '#3B82F6', tickets: [] },
    { key: 'later',    label: '🟢 Plus tard',         color: '#10B981', tickets: [] },
    { key: 'nodate',   label: '⚪ Sans échéance',     color: '#94A3B8', tickets: [] },
  ];

  filtered.forEach(t => {
    if (t.status === 'done') return; // skip done tickets in deadline view
    const dd = _dueDate(t);
    if (!dd || isNaN(dd)) { lanes[5].tickets.push(t); return; }
    const diff = Math.ceil((dd - now) / 86400000);
    if (diff < 0)                          lanes[0].tickets.push(t);
    else if (diff === 0)                   lanes[1].tickets.push(t);
    else if (dd <= endOfWeek)              lanes[2].tickets.push(t);
    else if (dd <= endOfNextWeek)          lanes[3].tickets.push(t);
    else                                   lanes[4].tickets.push(t);
  });

  // Sort each lane by date asc
  lanes.forEach(l => l.tickets.sort((a, b) => {
    const da = _dueDate(a), db = _dueDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  }));

  // Add done lane at end
  const doneTickets = filtered.filter(t => t.status === 'done');
  if (doneTickets.length) {
    lanes.push({ key: 'done', label: '✅ Terminés', color: '#10B981', tickets: doneTickets });
  }

  const board = document.getElementById('scrum-board');
  board.className = 'board board-lanes';
  board.innerHTML = lanes.filter(l => l.tickets.length).map(lane => {
    const pts = lane.tickets.reduce((a, t) => a + (t.points || 0), 0);
    return `<div class="board-lane">
      <div class="lane-header" style="border-left:3px solid ${lane.color};">
        <span class="lane-title">${lane.label}</span>
        <span class="col-count">${lane.tickets.length}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${pts} pts</span>
      </div>
      <div class="lane-body">${lane.tickets.map(t => {
        const dd = _dueDate(t);
        const dateStr = dd ? dd.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : '';
        return _deadlineCard(t, dateStr);
      }).join('')}</div>
    </div>`;
  }).join('');
}

function _deadlineCard(t, dateStr) {
  const epic        = EPICS.find(e => e.id === t.epic);
  const avatarColor = MEMBER_COLORS[t.assignee] || '#64748B';
  const isBlocked   = t.status === 'blocked';
  const isFlagged   = !!t.flagged;
  const extraCls    = isBlocked ? ' blocked' : isFlagged ? ' flagged' : '';
  return `<div class="ticket-card type-${t.type}${extraCls}" onclick="openModal('${t.id}')" style="flex-direction:row;align-items:center;gap:8px;padding:8px 10px;">
    <span style="font-size:11px;color:var(--text-muted);min-width:45px;flex-shrink:0;">${dateStr}</span>
    <span class="badge badge-${t.status}" style="font-size:10px;flex-shrink:0;">${statusLabel(t.status)}</span>
    <span class="ticket-key" style="flex-shrink:0;">${_jiraBrowse(t.id)}</span>
    <span style="flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title}</span>
    ${epicTag(epic, t.epic)}
    ${ptsBadge(t.points, {size:'small'})}
    <span class="avatar" style="background:${avatarColor};width:22px;height:22px;font-size:9px;flex-shrink:0;" title="${t.assignee || 'Non assigné'}">${initials(t.assignee)}</span>
  </div>`;
}

// List sort state
let _blSortCol = localStorage.getItem('bl_sort_col') || 'priority';
let _blSortAsc = (localStorage.getItem('bl_sort_asc') ?? 'true') === 'true';

window._setBoardListSort = function(col) {
  if (_blSortCol === col) { _blSortAsc = !_blSortAsc; }
  else { _blSortCol = col; _blSortAsc = true; }
  localStorage.setItem('bl_sort_col', _blSortCol);
  localStorage.setItem('bl_sort_asc', _blSortAsc);
  renderBoard(getTickets());
};

function _renderBoardList(filtered) {
  const priOrder  = { critical: 0, high: 1, medium: 2, low: 3 };
  const statOrder = { blocked: 0, inprog: 1, review: 2, todo: 3, test: 3, done: 4 };

  const _dueTs = (t) => {
    if (!t.dueDate) return Infinity;
    const d = new Date(t.dueDate.length === 10 ? t.dueDate + 'T00:00:00' : t.dueDate);
    return isNaN(d) ? Infinity : d.getTime();
  };

  const comparators = {
    priority: (a, b) => (priOrder[a.priority] ?? 9) - (priOrder[b.priority] ?? 9),
    key:      (a, b) => a.id.localeCompare(b.id),
    title:    (a, b) => (a.title || '').localeCompare(b.title || ''),
    type:     (a, b) => (a.type || '').localeCompare(b.type || ''),
    status:   (a, b) => (statOrder[a.status] ?? 9) - (statOrder[b.status] ?? 9),
    points:   (a, b) => (a.points || 0) - (b.points || 0),
    dueDate:  (a, b) => _dueTs(a) - _dueTs(b),
    epic:     (a, b) => (a.epic || '').localeCompare(b.epic || ''),
    assignee: (a, b) => (a.assignee || '').localeCompare(b.assignee || ''),
  };

  const cmp = comparators[_blSortCol] || comparators.priority;
  const dir = _blSortAsc ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => cmp(a, b) * dir || (priOrder[a.priority] ?? 9) - (priOrder[b.priority] ?? 9));

  const _arrow = (col) => {
    if (_blSortCol !== col) return '';
    return _blSortAsc ? ' ▲' : ' ▼';
  };

  const columns = [
    { col: 'priority', label: '',         w: '30px'  },
    { col: 'key',      label: 'Clé',      w: '70px'  },
    { col: 'title',    label: 'Titre',     w: null    },
    { col: 'type',     label: 'Type',      w: '75px'  },
    { col: 'status',   label: 'Statut',    w: '80px'  },
    { col: 'points',   label: 'Pts',       w: '55px'  },
    { col: 'dueDate',  label: 'Échéance',  w: '80px'  },
    { col: 'epic',     label: 'Epic',      w: '110px' },
    { col: 'assignee', label: '',          w: '32px'  },
  ];

  const board = document.getElementById('scrum-board');
  board.className = 'board board-list';
  board.innerHTML = `
    <div class="bl-header-row">
      ${columns.map(c => {
        const flex = c.w ? `width:${c.w};` : 'flex:1;';
        const sortable = c.label ? ` bl-sortable${_blSortCol === c.col ? ' bl-sorted' : ''}` : '';
        const click = c.label ? ` onclick="_setBoardListSort('${c.col}')"` : '';
        return `<span class="bl-h${sortable}" style="${flex}"${click}>${c.label}${_arrow(c.col)}</span>`;
      }).join('')}
    </div>
    ${sorted.map(t => {
      const epic = EPICS.find(e => e.id === t.epic);
      const avatarColor = MEMBER_COLORS[t.assignee] || '#64748B';
      const isDone = t.status === 'done';
      const rowCls = t.status === 'blocked' ? ' bl-blocked' : t.flagged ? ' bl-flagged' : t.buffer ? ' bl-buffer' : '';
      let ddStr = '';
      if (t.dueDate) {
        const dd = new Date(t.dueDate.length === 10 ? t.dueDate + 'T00:00:00' : t.dueDate);
        if (!isNaN(dd)) ddStr = dd.toLocaleDateString('fr-FR', {day:'numeric',month:'short'});
      }
      return `<div class="bl-row${rowCls}${isDone ? ' bl-done' : ''}" onclick="openModal('${t.id}')">
        <span class="bl-cell" style="width:30px;">${priorityIcon(t.priority)}</span>
        <span class="bl-cell bl-key" style="width:70px;">${_jiraBrowse(t.id)}</span>
        <span class="bl-cell bl-title" style="flex:1;">${t.title}</span>
        <span class="bl-cell" style="width:75px;"><span class="badge badge-${t.type}" style="font-size:10px;">${typeName(t.type)}</span></span>
        <span class="bl-cell" style="width:80px;"><span class="badge badge-${t.status}" style="font-size:10px;">${statusLabel(t.status)}</span></span>
        <span class="bl-cell" style="width:55px;">${ptsBadge(t.points, {size:'small'})}</span>
        <span class="bl-cell" style="width:80px;font-size:11px;color:var(--text-muted);">${ddStr}</span>
        <span class="bl-cell" style="width:110px;">${epicTag(epic, t.epic)}</span>
        <span class="bl-cell" style="width:32px;"><span class="avatar" style="background:${avatarColor};width:22px;height:22px;font-size:9px;" title="${t.assignee || ''}">${initials(t.assignee)}</span></span>
      </div>`;
    }).join('')}`;
}

function _showScrumBlockedDetail() { _showScrumStatDetail('blocked'); }

function _showScrumStatDetail(filter) {
  const all = getTickets();
  const cfg = {
    done:      { icon: '✅', label: 'Tickets terminés',  list: all.filter(t => t.status === 'done') },
    remaining: { icon: '🔶', label: 'Tickets restants',  list: all.filter(t => t.status !== 'done') },
    inprog:    { icon: '🔵', label: 'Tickets en cours',  list: all.filter(t => t.status === 'inprog' || t.status === 'review') },
    blocked:   { icon: '⚠',  label: 'Tickets bloqués',  list: all.filter(t => t.status === 'blocked') },
    buffer:    { icon: '🛡️', label: 'Tickets buffer',   list: all.filter(t => t.buffer) },
  }[filter];
  if (!cfg || !cfg.list.length) return;

  // Group by type
  const byType = {};
  cfg.list.forEach(t => { (byType[t.type] = byType[t.type] || []).push(t); });
  const typeOrder = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);

  // Type summary pills
  const typePills = typeOrder.map(type => {
    const c = CONFIG.typeColors[type] || '#475569';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;background:${c}18;border:1px solid ${c}40;font-size:11px;font-weight:700;color:${c};margin:2px;">${typeName(type)} ×${byType[type].length}</span>`;
  }).join('');

  // Points total
  const totalPts = cfg.list.reduce((a, t) => a + (t.points || 0), 0);

  document.getElementById('modal-title').innerHTML = `${cfg.icon} ${cfg.label} <span style="font-size:14px;font-weight:400;color:#94A3B8;">(${cfg.list.length} · ${totalPts} pts)</span>`;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #E2E8F0;">${typePills}</div>
    ${cfg.list.map(t => {
      const epic        = EPICS.find(e => e.id === t.epic);
      const avatarColor = MEMBER_COLORS[t.assignee] || '#64748B';
      const isDone      = t.status === 'done';
      const strike      = isDone ? 'text-decoration:line-through;opacity:.5;' : '';
      const flagBadge   = t.flagged ? '<span style="color:#DC2626;font-size:11px;font-weight:700;flex-shrink:0;">🚩</span>' : '';
      const rowBg = t.flagged ? 'background:#FEF2F2;' : t.buffer ? 'background:#F0FDF4;' : '';
      return `<div style="display:flex;align-items:center;gap:8px;${rowBg}padding:7px 8px;border-bottom:1px solid var(--border);border-radius:4px;cursor:pointer;${isDone ? 'opacity:.6;' : ''}" onclick="closeModalDirect();openModal('${t.id}')">
        ${flagBadge}
        <span style="flex-shrink:0;width:20px;text-align:center;">${priorityIcon(t.priority)}</span>
        <span class="badge badge-${t.type}" style="white-space:nowrap;flex-shrink:0;">${typeName(t.type)}</span>
        <span style="flex:1;font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${strike}">${_jiraBrowse(t.id)} — ${t.title}</span>
        <span class="badge badge-${t.status}" style="white-space:nowrap;font-size:10px;flex-shrink:0;">${statusLabel(t.status)}</span>
        ${epicTag(epic, t.epic)}
        ${ptsBadge(t.points)}
        <span class="avatar" style="background:${avatarColor};flex-shrink:0;" title="${t.assignee || 'Non assigné'}">${initials(t.assignee)}</span>
      </div>`;
    }).join('')}`;

  window._modalTicketList = [];
  window._modalCurrentIdx = 0;
  if (typeof _updateModalNavButtons === 'function') _updateModalNavButtons();
  document.getElementById('modal-overlay').classList.add('open');
}

function ticketCard(t) {
  const epic        = EPICS.find(e => e.id === t.epic);
  const avatarColor = MEMBER_COLORS[t.assignee] || '#64748B';
  const isBlocked   = t.status === 'blocked';
  const isFlagged   = !!t.flagged;
  const isBuffer    = !!t.buffer;
  const statusBadge = isBlocked
    ? '<span style="color:#DC2626;font-size:11px;font-weight:700;">⚠ Bloqué</span>'
    : isFlagged ? '<span style="color:#DC2626;font-size:11px;font-weight:700;">🚩 Flaggé</span>' : '';
  const bufferBadge = isBuffer ? '<span class="buffer-badge">🛡️ Buffer</span>' : '';
  const extraCls    = isBlocked ? ' blocked' : isFlagged ? ' flagged' : isBuffer ? ' buffer' : '';
  return `<div class="ticket-card type-${t.type}${extraCls}" onclick="openModal('${t.id}')">
    <div class="ticket-top">
      <span class="ticket-key">${_jiraBrowse(t.id)}</span>
      ${ptsBadge(t.points, {size:'small'})}
    </div>
    <div class="ticket-title">${t.title}</div>
    <div class="ticket-meta">
      <span class="badge badge-${t.type}">${typeName(t.type)}</span>
      ${epicTag(epic, t.epic)}
      <span class="avatar" style="background:${avatarColor}" title="${t.assignee || 'Non assigné'}">${initials(t.assignee)}</span>
      ${priorityIcon(t.priority)}
      ${statusBadge}
      ${bufferBadge}
    </div>
  </div>`;
}
