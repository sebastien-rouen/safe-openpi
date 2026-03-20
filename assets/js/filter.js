// ============================================================
// FILTER - Filtrage équipes / groupes
// ============================================================

// Liste dynamique des équipes présentes dans les données
function _allTeams() {
  const fromTickets = TICKETS.map(t => t.team).filter(Boolean);
  const fromConfig  = Object.keys(typeof CONFIG !== 'undefined' && CONFIG.teams || {})
                        .filter(t => { const tc = CONFIG.teams[t] || {}; return !tc.inactive && tc.sprintName; });
  const teams = [...new Set([...fromTickets, ...fromConfig])].sort();
  return teams.length ? teams : [];
}

function getActiveTeams() {
  if (currentGroup) {
    const g = GROUPS.find(x => x.id === currentGroup);
    return g ? g.teams : [];
  }
  const all = _allTeams();
  if (!currentTeam || currentTeam === 'all') return all;
  return all.includes(currentTeam) ? [currentTeam] : all;
}

function getTickets() {
  const teams = getActiveTeams();
  const all   = _allTeams();
  if (teams.length === all.length && !currentGroup) return TICKETS;
  return TICKETS.filter(t => teams.includes(t.team));
}

// ---- Couleur d'une équipe depuis son groupe -----

function _teamColor(teamId) {
  for (const g of GROUPS) {
    if (g.teams.includes(teamId)) return g.color;
  }
  return CONFIG.teams[teamId]?.color || CLR.dark;
}

// ---- Rendu dynamique des boutons d'équipe -----

function renderTeamBtns() {
  const el = document.getElementById('team-btns');
  if (!el) return;
  const allTeams  = _allTeams();
  const allActive = !currentGroup && (!currentTeam || currentTeam === 'all');

  function _teamBtn(t) {
    const color    = _teamColor(t);
    const avatar   = t.slice(0, 2).toUpperCase();
    const isActive = currentTeam === t && !currentGroup;
    const inGroup  = currentGroup && GROUPS.find(g => g.id === currentGroup)?.teams.includes(t);
    return `<button class="team-btn${isActive || inGroup ? ' active' : ''}" data-team="${t}" onclick="selectTeam('${t}')" title="${t}" style="background:${color}">${avatar}</button>`;
  }

  // Grouper par groupe (ordre de GROUPS), puis alphabétique dans chaque groupe
  let html = `<button class="team-btn${allActive ? ' active' : ''}" data-team="all" onclick="selectTeam('all')" title="Toutes les équipes" style="background:#475569">Tous</button>`;
  const seen = new Set();

  GROUPS.forEach(g => {
    const groupTeams = g.teams.filter(t => allTeams.includes(t)).sort();
    if (!groupTeams.length) return;
    groupTeams.forEach(t => { seen.add(t); html += _teamBtn(t); });
  });

  // Équipes sans groupe, tri alpha
  allTeams.filter(t => !seen.has(t)).sort().forEach(t => { html += _teamBtn(t); });

  el.innerHTML = html;
}

// ---- Sélection équipe / groupe ----------------

function selectTeam(team) {
  currentTeam  = team;
  currentGroup = null;
  renderTeamBtns();
  renderGroupBtns();
  updateSidebarGroupLabel();
  if (typeof _updateBlockedBadge === 'function') _updateBlockedBadge();
  renderScrum();
  if (currentView === 'kanban')  renderKanban();
  if (currentView === 'pi')      renderPI();
  if (currentView === 'reports') {
    if (team !== 'all') reportTeam = team;
    renderReport();
  }
  if (currentView === 'support') renderSupport();
  if (currentView === 'roadmap')  renderRoadmap();
  _pushHash();
}

function selectGroup(gid) {
  currentGroup = gid;
  currentTeam  = 'all';
  const g = GROUPS.find(x => x.id === gid);
  renderTeamBtns();
  document.querySelectorAll('.team-btn').forEach(b => {
    if (b.dataset.team === 'all') b.classList.remove('active');
    else b.classList.toggle('active', g && g.teams.includes(b.dataset.team));
  });
  renderGroupBtns();
  updateSidebarGroupLabel();
  if (typeof _updateBlockedBadge === 'function') _updateBlockedBadge();
  renderScrum();
  if (currentView === 'kanban') renderKanban();
  if (currentView === 'pi')     renderPI();
  if (currentView === 'reports') {
    renderReportTabs();
    reportTeam = 'group';
    renderReport();
  }
  if (currentView === 'support') renderSupport();
  if (currentView === 'roadmap')  renderRoadmap();
  _pushHash();
}

function renderGroupBtns() {
  const el = document.getElementById('group-btns');
  if (!el) return;
  const active = new Set(_allTeams()); // équipes avec des tickets = actives

  el.innerHTML = GROUPS.map(g => {
    const activeTeams = g.teams.filter(t => active.has(t)); // équipes actives dans ce groupe
    if (!activeTeams.length) return '';                      // groupe entièrement inactif → masqué

    const isActive    = currentGroup === g.id;
    const activeStyle = isActive ? `background:${g.color}22;` : '';
    const teamLabels  = activeTeams.join(', ');
    // Tooltip : toutes les équipes du groupe (inactives grises, actives normales)
    const tooltip     = g.teams.map(t => active.has(t) ? t : `${t} (inactif)`).join('\n');

    return `<button class="group-btn${isActive ? ' active' : ''}" style="${activeStyle}" onclick="selectGroup('${g.id}')">
      <span class="group-dot" style="background:${g.color}"></span>
      <span class="group-btn-inner" data-tooltip="${tooltip}">
        <span class="group-btn-name">${g.name}</span>
        <span class="group-btn-teams">${teamLabels}</span>
      </span>
    </button>`;
  }).join('');
}

function updateSidebarGroupLabel() {
  const el = document.getElementById('sb-group-label');
  if (!el) return;
  if (currentGroup) {
    const g = GROUPS.find(x => x.id === currentGroup);
    el.style.display = 'block';
    el.innerHTML = `<span class="group-badge" style="background:${g.color}">Groupe: ${g.name}</span>`;
  } else {
    el.style.display = 'none';
  }
}
