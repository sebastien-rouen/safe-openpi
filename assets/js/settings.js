// ============================================================
// SETTINGS VIEW - Configuration équipes, JIRA, groupes, notifications
// ============================================================

// --- Dark mode ---
function _initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}
_initTheme();

function toggleDarkMode(checkbox) {
  const theme = checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (typeof refreshCharts === 'function' && typeof chartsInitialized !== 'undefined' && chartsInitialized) refreshCharts();
}

// Collapsible state for settings sections
const _settingsCollapsed = JSON.parse(localStorage.getItem('settings_collapsed') || '{}');

function _toggleSettingsSection(key) {
  _settingsCollapsed[key] = !_settingsCollapsed[key];
  localStorage.setItem('settings_collapsed', JSON.stringify(_settingsCollapsed));
  renderSettings();
}

function _sectionHeader(key, icon, title, subtitle) {
  const open = !_settingsCollapsed[key];
  return `<div class="stg-section-header" onclick="_toggleSettingsSection('${key}')">
    <span class="stg-section-left"><span class="stg-section-arrow">${open ? '▼' : '▶'}</span>${icon} ${title}</span>
    ${subtitle ? `<span class="stg-section-sub">${subtitle}</span>` : ''}
  </div>`;
}

function renderSettings() {
  const activeTeams = new Set(_allTeams());
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const activeCount = realTeams.filter(t => activeTeams.has(t)).length;
  const inactiveCount = realTeams.length - activeCount;

  // Sync config values
  const sc = CONFIG.sync;

  document.getElementById('settings-content').innerHTML = `
  <!-- Apparence -->
  <div class="settings-section stg-compact" style="grid-column:1/-1">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:700;">🎨 Apparence</span>
      <label class="theme-toggle" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;">
        <span>${isDark ? '🌙 Sombre' : '☀️ Clair'}</span>
        <div class="toggle-track" style="position:relative;width:40px;height:22px;border-radius:99px;background:${isDark ? 'var(--primary)' : '#CBD5E1'};transition:background .3s;flex-shrink:0;">
          <div style="position:absolute;top:2px;${isDark ? 'left:20px' : 'left:2px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .3s;"></div>
          <input type="checkbox" ${isDark ? 'checked' : ''} onchange="toggleDarkMode(this);renderSettings();"
            style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;margin:0;">
        </div>
      </label>
    </div>
  </div>

  <!-- Connexion JIRA -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('jira', '🔗', 'Connexion JIRA', CONFIG.jira.url !== 'https://votre-jira.atlassian.net' ? '✅ Configuré' : '⚠️ Non configuré')}
    ${!_settingsCollapsed['jira'] ? `<div class="stg-body">
      <div class="stg-grid-3">
        <div class="form-group"><label>URL JIRA</label><input type="text" value="${CONFIG.jira.url}"/></div>
        <div class="form-group"><label>Projets (virgule)</label><input type="text" value="${(CONFIG.jira.projects || []).join(', ')}"/></div>
        <div class="form-group"><label>API Token</label><input type="password" value="${CONFIG.jira.token}" placeholder="••••••"/></div>
      </div>
      <div class="stg-grid-2" style="margin-top:6px;">
        <div class="form-group"><label>Durée Sprint (jours)</label><input type="number" value="${CONFIG.sprint.durationDays}"/></div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-primary" onclick="showToast('✅ Connexion testée avec succès !','success')" style="font-size:12px;padding:7px 14px;">🔌 Tester</button>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Paramètres de synchronisation -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('sync', '⚙️', 'Synchronisation', '')}
    ${!_settingsCollapsed['sync'] ? `<div class="stg-body">
      <div class="stg-kv-grid">
        <div class="stg-kv">
          <label>Boards par page</label>
          <input type="number" value="${sc.maxBoardsPerPage}" onchange="CONFIG.sync.maxBoardsPerPage=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Issues max / sprint</label>
          <input type="number" value="${sc.maxIssuesPerSprint}" onchange="CONFIG.sync.maxIssuesPerSprint=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Sprints historiques (vélocité)</label>
          <input type="number" value="${sc.velocityHistoryCount}" onchange="CONFIG.sync.velocityHistoryCount=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>PIs historiques</label>
          <input type="number" value="${sc.piHistoryCount}" onchange="CONFIG.sync.piHistoryCount=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Issues max vélocité (JQL)</label>
          <input type="number" value="${sc.velocityMaxIssues}" onchange="CONFIG.sync.velocityMaxIssues=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Epics orphelines max</label>
          <input type="number" value="${sc.maxEpicsResolve}" onchange="CONFIG.sync.maxEpicsResolve=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Sprints fermés (fallback)</label>
          <input type="number" value="${sc.closedSprintsFetch}" onchange="CONFIG.sync.closedSprintsFetch=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Champ Sprint</label>
          <input type="text" value="${sc.sprintField}" onchange="CONFIG.sync.sprintField=this.value" style="width:160px;">
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Alertes sprint -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('alerts', '🔔', 'Alertes Sprint', '')}
    ${!_settingsCollapsed['alerts'] ? `<div class="stg-body">
      <div class="stg-kv-grid">
        <div class="stg-kv">
          <label>🎬 Préparation démo</label>
          <div class="stg-alert-input">
            <span>J-</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.demoDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.demoDays=+this.value;" style="width:50px;">
            <span>avant fin de sprint</span>
          </div>
        </div>
        <div class="stg-kv">
          <label>😊 Mood meter (ROTI)</label>
          <div class="stg-alert-input">
            <span>J-</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.moodDays ?? 2}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.moodDays=+this.value;" style="width:50px;">
            <span>avant fin de sprint</span>
          </div>
        </div>
        <div class="stg-kv">
          <label>🗳️ Vote de confiance</label>
          <div class="stg-alert-input">
            <span>J+</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.voteDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.voteDays=+this.value;" style="width:50px;">
            <span>après début de sprint</span>
          </div>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Équipes -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('teams', '👥', 'Équipes', `${activeCount} actives · ${inactiveCount} inactives`)}
    ${!_settingsCollapsed['teams'] ? `<div class="stg-body">
      <div class="stg-teams-grid">${realTeams.map(team => {
        const cfg      = CONFIG.teams[team] || {};
        const color    = cfg.color || _teamColor(team);
        const members  = MEMBERS[team] || [];
        const velocity = cfg.velocity || CONFIG.sprint.velocityTarget || 80;
        const inactive = !activeTeams.has(team);
        const boardId  = cfg.boardId || '';
        const projKey  = cfg.projectKey || '';
        const sprintN  = cfg.sprintName || '';
        return `<div class="stg-team-card${inactive ? ' stg-inactive' : ''}" style="border-left:3px solid ${color}">
          <div class="stg-team-header">
            <span class="stg-team-name" style="color:${color}">${team}</span>
            ${inactive ? '<span class="stg-badge-inactive">inactif</span>' : ''}
            <span class="stg-team-meta">${members.length} membres · ${velocity} pts</span>
          </div>
          <div class="stg-team-details">
            <span class="stg-chip" title="Sprint">${sprintN || '-'}</span>
            <span class="stg-chip" title="Board ID">Board ${boardId || '-'}</span>
            <span class="stg-chip" title="Projet">${projKey || '-'}</span>
            <input type="color" value="${color}" style="width:24px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;vertical-align:middle;"
              onchange="if(CONFIG.teams['${team}'])CONFIG.teams['${team}'].color=this.value;" title="Couleur">
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}
  </div>

  <!-- Groupes -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('groups', '🗂️', 'Groupes', `${GROUPS.length} groupes`)}
    ${!_settingsCollapsed['groups'] ? `<div class="stg-body">
      <div id="groups-config-list">${GROUPS.map((g, gi) => `
      <div class="stg-group-card" id="group-cfg-${g.id}" style="border-left:3px solid ${g.color}">
        <div class="stg-group-header">
          <span class="group-dot" style="background:${g.color};width:10px;height:10px;border-radius:3px;"></span>
          <input type="text" class="stg-group-name-input" value="${g.name}" onchange="GROUPS[${gi}].name=this.value;renderGroupBtns();">
          <input type="color" value="${g.color}" style="width:24px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;"
            onchange="GROUPS[${gi}].color=this.value;renderGroupBtns();document.getElementById('group-cfg-${g.id}').style.borderLeftColor=this.value;">
        </div>
        <div class="stg-group-teams">
          ${realTeams.map(t =>
            `<label class="stg-team-check"><input type="checkbox" ${g.teams.includes(t) ? 'checked' : ''} onchange="toggleGroupTeam('${g.id}','${t}',this.checked)"><span>${t}</span></label>`
          ).join('')}
        </div>
      </div>`).join('')}
      </div>
      <button class="btn btn-secondary" style="margin-top:8px;font-size:12px;" onclick="addGroup()">➕ Ajouter un groupe</button>
    </div>` : ''}
  </div>

  <!-- Notifications -->
  <div class="settings-section" style="grid-column:1/-1">
    ${_sectionHeader('notif', '🔔', 'Notifications', '')}
    ${!_settingsCollapsed['notif'] ? `<div class="stg-body">
      <div class="stg-grid-2">
        <div class="form-group"><label>Canal Slack Sprint Reports</label><input type="text" value="${CONFIG.notifications.slackReports}"/></div>
        <div class="form-group"><label>Canal Slack Alertes</label><input type="text" value="${CONFIG.notifications.slackAlerts}"/></div>
        <div class="form-group"><label>Email rapports</label><input type="email" value="${CONFIG.notifications.email}"/></div>
        <div class="form-group"><label>Fréquence auto-rapport</label>
          <select><option>Fin de sprint</option><option>Hebdomadaire</option><option>Quotidien</option></select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="showToast('✅ Paramètres sauvegardés !','success')" style="margin-top:6px;font-size:12px;padding:7px 14px;">💾 Sauvegarder</button>
    </div>` : ''}
  </div>`;
}

function toggleGroupTeam(gid, team, checked) {
  const g = GROUPS.find(x => x.id === gid);
  if (!g) return;
  if (checked && !g.teams.includes(team)) g.teams.push(team);
  if (!checked) g.teams = g.teams.filter(t => t !== team);
  renderGroupBtns();
}

function addGroup() {
  const colors = ['#0E7490','#B45309','#BE185D','#065F46'];
  const idx    = GROUPS.length;
  GROUPS.push({ id: 'G-' + (idx + 1), name: 'Nouveau groupe', color: colors[idx % colors.length], teams: [] });
  renderGroupBtns();
  renderSettings();
  showToast('✅ Groupe ajouté - configurez-le ci-dessous', 'success');
}
