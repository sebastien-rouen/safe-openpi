// ============================================================
// REPORTS VIEW - Rapports multi-vues Slack / Confluence
// ============================================================

const _RPT_SECTIONS = [
  { id: 'sprint',  icon: '📋', label: 'Sprint' },
  { id: 'kanban',  icon: '🗂️', label: 'Kanban' },
  { id: 'pi',      icon: '🗓️', label: 'PI Planning' },
  { id: 'support', icon: '🎫', label: 'Support' },
  { id: 'roadmap', icon: '🗺️', label: 'Roadmap' },
  { id: 'piprep',  icon: '📋', label: 'Prépa PI' },
  { id: 'mood',    icon: '😊', label: 'Mood / Vélocité' },
  { id: 'sondage', icon: '🎲', label: 'Sondage' },
];

// ============================================================
// Rendu des onglets
// ============================================================

function renderReportSections() {
  const el = document.getElementById('report-sections');
  if (!el) return;
  el.innerHTML = _RPT_SECTIONS.map(s =>
    `<button class="report-section-btn${reportSection === s.id ? ' active' : ''}"
       onclick="selectReportSection('${s.id}')">${s.icon} ${s.label}</button>`
  ).join('');
}

function selectReportSection(s) {
  reportSection = s;
  renderReportSections();
  renderReportTabs();
  renderReport();
  _pushHash();
}

function renderReportTabs() {
  const tabsEl = document.getElementById('report-tabs');
  if (!tabsEl) return;

  // Sections sans onglets équipes
  if (['support', 'piprep', 'mood'].includes(reportSection)) {
    tabsEl.innerHTML = '';
    return;
  }

  const teams = _allTeams();
  if (!reportTeam || (reportTeam !== 'group' && !teams.includes(reportTeam))) {
    reportTeam = teams[0] || null;
  }

  const teamTabs = teams.map(t => {
    const color = _teamColor(t);
    const activeStyle = reportTeam === t ? `background:${color};color:#fff;` : '';
    return `<button class="report-tab${reportTeam === t ? ' active' : ''}" onclick="selectReportTeam('${t}')" style="${activeStyle}">${t}</button>`;
  }).join('');

  let groupTab = '';
  if (currentGroup) {
    const g = GROUPS.find(x => x.id === currentGroup);
    if (g) {
      const activeStyle = reportTeam === 'group' ? `background:${g.color};color:#fff;` : '';
      groupTab = `<button class="report-tab${reportTeam === 'group' ? ' active' : ''}" onclick="selectReportTeam('group')" style="${activeStyle}">📊 ${g.name}</button>`;
    }
  }
  tabsEl.innerHTML = teamTabs + groupTab;
}

function selectReportTeam(t) {
  reportTeam = t;
  renderReportTabs();
  renderReport();
  _pushHash();
}

function setFormat(f) {
  reportFormat = f;
  document.getElementById('fmt-slack').classList.toggle('active', f === 'slack');
  document.getElementById('fmt-conf').classList.toggle('active',  f === 'confluence');
  renderReport();
  _pushHash();
}

// ============================================================
// Dispatch vers le bon générateur
// ============================================================

function renderReport() {
  _rptDestroyCharts();
  renderReportSections();
  renderReportTabs();
  const el = document.getElementById('report-preview');
  if (!el) return;

  const isSlack = reportFormat === 'slack';
  const gen = {
    sprint:  () => _rptSprint(el, isSlack),
    kanban:  () => _rptKanban(el, isSlack),
    pi:      () => _rptPI(el, isSlack),
    support: () => _rptSupport(el, isSlack),
    roadmap: () => _rptRoadmap(el, isSlack),
    piprep:  () => _rptPIPrep(el, isSlack),
    mood:    () => _rptMoodVelocity(el, isSlack),
    sondage: () => _rptSondage(el, isSlack),
  };

  (gen[reportSection] || gen.sprint)();
}

// ============================================================
// Helpers
// ============================================================

function _rptDate()    { return new Date().toLocaleDateString('fr-FR'); }
function _rptName(tid) { return CONFIG.teams[tid]?.name || tid; }

function _rptTeamTickets(team) {
  const all = typeof TICKETS !== 'undefined' ? TICKETS : [];
  return team === 'group' && currentGroup
    ? all.filter(t => (GROUPS.find(g => g.id === currentGroup)?.teams || []).includes(t.team))
    : all.filter(t => t.team === team);
}

function _rptSlackLine(raw) {
  // Escape HTML
  let line = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Separator lines (━━━ or ───)
  if (/^[━─═]{5,}$/.test(line.trim())) return '<hr class="slack-separator">';
  // Empty line
  if (!line.trim()) return '<span class="slack-line-empty"></span>';
  // Inline formatting
  const fmt = (s) => s
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<span class="slack-italic">$1</span>')
    .replace(/&lt;(https?:\/\/[^|&]+)\|([^&]+)&gt;/g, '<a class="slack-link" href="$1" target="_blank">$2</a>')
    .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a class="slack-link" href="$1" target="_blank">$1</a>')
    .replace(/•/g, '<span class="slack-bullet">•</span>');
  // Blockquote line (> prefix)
  const qMatch = line.match(/^&gt;\s?(.*)/);
  if (qMatch) return `<span class="slack-quote">${fmt(qMatch[1])}</span>`;
  return `<span class="slack-line">${fmt(line)}</span>`;
}

function _rptSetSlack(el, text) {
  const now = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  const previewHtml = _slackToEmoji(text).split('\n').map(l => _rptSlackLine(l)).join('\n');
  el.className = 'sondage-wrap';
  el.innerHTML = `
    <div class="sondage-columns">
      <div>
        <div class="sondage-col-label">Message Slack (à copier)</div>
        <pre class="report-preview" style="margin:0;height:100%;">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
      </div>
      <div>
        <div class="sondage-col-label">Aperçu visuel</div>
        <div class="slack-preview-box">
          <div class="slack-preview-header">
            <div class="slack-preview-avatar">📊</div>
            <div><span class="slack-preview-name">JIRA Dashboard</span><span class="slack-preview-badge">APP ${now}</span></div>
          </div>
          <div class="slack-preview-body">${previewHtml}</div>
        </div>
      </div>
    </div>`;
}
function _rptSetConf(el, html) {
  el.className = 'report-preview confluence-mode';
  el.innerHTML = html;
}

// ============================================================
// 1. SPRINT
// ============================================================

function _rptSprint(el, isSlack) {
  if (!reportTeam) { el.textContent = 'Aucune équipe disponible.'; return; }

  // Rapport de groupe
  if (reportTeam === 'group' && currentGroup) {
    _rptSprintGroup(el, isSlack);
    return;
  }

  const team      = reportTeam;
  const tickets   = _rptTeamTickets(team);
  const done      = tickets.filter(t => isDone(t.status));
  const notDone   = tickets.filter(t => !isDone(t.status));
  const bugs      = tickets.filter(t => t.type === 'bug');
  const incidents = tickets.filter(t => t.type === 'incident');
  const blocked   = tickets.filter(t => t.status === 'blocked');
  const ptsDone   = done.reduce((a, t) => a + (t.points || 0), 0);
  const ptsTotal  = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const pct       = ptsTotal > 0 ? Math.round(ptsDone / ptsTotal * 100) : 0;
  const velTarget = CONFIG.teams[team]?.velocity || CONFIG.sprint.velocityTarget || 80;
  const trend     = ptsDone >= velTarget ? `📈 +${ptsDone - velTarget}` : `📉 -${velTarget - ptsDone}`;
  const members   = (MEMBERS[team] || []).join(', ') || '-';

  if (isSlack) {
    let t = `🚀 *Rapport de Fin de Sprint - ${CONFIG.sprint.label} - ${team}*\n`;
    t += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `📅 *Période :* ${CONFIG.sprint.startDate || '-'} → ${CONFIG.sprint.endDate || '-'}\n`;
    t += `👥 *Équipe :* ${team}${members !== '-' ? ` (${members})` : ''}\n\n`;
    t += `📊 *Résumé Sprint*\n`;
    t += `> Vélocité : *${ptsDone} pts* / *${ptsTotal} pts* engagés (${pct}%)\n`;
    t += `> Cible : ${velTarget} pts | Tendance : ${trend} pts\n\n`;
    t += `✅ *Stories Terminées (${done.length} - ${ptsDone} pts)*\n`;
    t += done.length ? done.map(x => { const u = _jiraBrowseUrl(x.id); return `> • *${x.id}* - ${x.title} _(${x.points} pts)_ @${x.assignee || '?'} ${statusLabel(x.status)}${u ? ` <${u}>` : ''}`; }).join('\n') : '> _Aucune_';
    t += `\n\n⏳ *Non Terminées (${notDone.length})*\n`;
    t += notDone.length ? notDone.map(x => { const u = _jiraBrowseUrl(x.id); return `> • *${x.id}* - ${x.title} _(${x.points} pts)_ ${statusLabel(x.status)}${u ? ` <${u}>` : ''}`; }).join('\n') : '> _Aucune - Félicitations ! 🎉_';
    t += `\n\n🐛 *Bugs (${bugs.length})*\n`;
    t += bugs.length ? bugs.map(x => `> • *${x.id}* - ${x.title} - ${isDone(x.status) ? '✅' : '⚠️'}`).join('\n') : '> _Aucun_';
    t += `\n\n⚡ *Incidents (${incidents.length})*\n`;
    t += incidents.length ? incidents.map(x => `> • *${x.id}* - ${x.title} - ${isDone(x.status) ? '✅' : '🔴'}`).join('\n') : '> _Aucun_';
    t += `\n\n🚫 *Bloquants (${blocked.length})*\n`;
    t += blocked.length ? blocked.map(x => `> • *${x.id}* - ${x.title} - ⚠️ BLOQUÉ`).join('\n') : '> _Aucun_';
    t += `\n\n_Rapport généré le ${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>🚀 Rapport ${CONFIG.sprint.label} - ${team}</h1>`;
    h += `<p><em>${CONFIG.sprint.startDate || '-'} → ${CONFIG.sprint.endDate || '-'} | ${_rptDate()}</em></p>`;
    h += `<h2>📊 Résumé</h2><table><tr><th>Métrique</th><th>Valeur</th><th>Tendance</th></tr>`;
    h += `<tr><td>Vélocité</td><td><strong>${ptsDone} pts</strong></td><td>${trend}</td></tr>`;
    h += `<tr><td>Engagement</td><td>${ptsTotal} pts</td><td>${pct}%</td></tr>`;
    h += `<tr><td>Done</td><td>${done.length}</td><td>-</td></tr>`;
    h += `<tr><td>Reportées</td><td>${notDone.length}</td><td>-</td></tr></table>`;
    h += `<h2>✅ Terminées</h2><table><tr><th>Clé</th><th>Titre</th><th>Pts</th><th>Assigné</th><th>Statut</th></tr>`;
    h += done.map(x => `<tr><td>${_jiraBrowse(x.id,{style:'color:#0284C7'})}</td><td>${x.title}</td><td>${x.points}</td><td>${x.assignee||'-'}</td><td>${statusLabel(x.status)}</td></tr>`).join('');
    h += done.length ? '' : '<tr><td colspan="5"><em>Aucune</em></td></tr>';
    h += `</table><h2>⏳ Non terminées</h2><table><tr><th>Clé</th><th>Titre</th><th>Pts</th><th>Statut</th></tr>`;
    h += notDone.map(x => `<tr><td>${_jiraBrowse(x.id,{style:'color:#0284C7'})}</td><td>${x.title}</td><td>${x.points}</td><td>${statusLabel(x.status)}</td></tr>`).join('');
    h += notDone.length ? '' : '<tr><td colspan="4"><em>Toutes complétées ✅</em></td></tr>';
    h += `</table>`;
    if (bugs.length || incidents.length) {
      h += `<h2>🐛 Bugs & Incidents</h2><ul>`;
      bugs.forEach(x => { h += `<li><strong>${x.id}</strong> - ${x.title} ${x.status==='done'?'✅':'⚠️'}</li>`; });
      incidents.forEach(x => { h += `<li><strong>${x.id}</strong> - ${x.title} (Incident) ${x.status==='done'?'✅':'🔴'}</li>`; });
      h += `</ul>`;
    }
    _rptSetConf(el, h);
  }
  // Charts en bas du rapport
  _rptAppendSprintCharts(el, tickets, ptsDone, ptsTotal, velTarget);
}

function _rptSprintGroup(el, isSlack) {
  const g = GROUPS.find(x => x.id === currentGroup);
  if (!g) return;
  const tickets = TICKETS.filter(t => g.teams.includes(t.team));
  const done    = tickets.filter(t => isDone(t.status));
  const blocked = tickets.filter(t => t.status === 'blocked');
  const ptsDone = done.reduce((a, t) => a + (t.points||0), 0);
  const ptsTotal= tickets.reduce((a, t) => a + (t.points||0), 0);
  const pct     = ptsTotal > 0 ? Math.round(ptsDone/ptsTotal*100) : 0;

  if (isSlack) {
    let t = `📊 *Rapport Groupe - ${g.name} - ${CONFIG.sprint.label}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `👥 *Équipes :* ${g.teams.join(', ')}\n\n`;
    t += `📊 *Résumé* : *${ptsDone}/${ptsTotal} pts* (${pct}%) | Bloquants : ${blocked.length}\n\n`;
    g.teams.forEach(team => {
      const tt = TICKETS.filter(x => x.team === team);
      const td = tt.filter(x => isDone(x.status));
      const tpd = td.reduce((a,x) => a+(x.points||0), 0);
      const tpt = tt.reduce((a,x) => a+(x.points||0), 0);
      t += `*${team}:* ${tpd}/${tpt} pts (${tpt?Math.round(tpd/tpt*100):0}%) - ${td.length}/${tt.length}\n`;
    });
    t += `\n🚫 *Bloquants*\n`;
    t += blocked.length ? blocked.map(x => `> • *${x.id}* [${x.team}] - ${x.title}`).join('\n') : '> _Aucun_';
    t += `\n\n_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>📊 Rapport Groupe ${g.name} - ${CONFIG.sprint.label}</h1>`;
    h += `<p><em>${g.teams.join(', ')} | ${_rptDate()}</em></p>`;
    h += `<h2>📊 Résumé</h2><table><tr><th>Métrique</th><th>Valeur</th></tr>`;
    h += `<tr><td>Points</td><td><strong>${ptsDone}/${ptsTotal} (${pct}%)</strong></td></tr>`;
    h += `<tr><td>Bloquants</td><td>${blocked.length}</td></tr></table>`;
    h += `<h2>📋 Par équipe</h2><table><tr><th>Équipe</th><th>Done</th><th>Total</th><th>%</th></tr>`;
    g.teams.forEach(team => {
      const tt = TICKETS.filter(x => x.team === team);
      const td = tt.filter(x => isDone(x.status));
      const tpd = td.reduce((a,x) => a+(x.points||0), 0);
      const tpt = tt.reduce((a,x) => a+(x.points||0), 0);
      h += `<tr><td><strong>${team}</strong></td><td>${tpd}</td><td>${tpt}</td><td>${tpt?Math.round(tpd/tpt*100):0}%</td></tr>`;
    });
    h += `</table>`;
    _rptSetConf(el, h);
  }
}

// ============================================================
// 2. KANBAN
// ============================================================

function _rptKanban(el, isSlack) {
  const team = reportTeam;
  if (!team) { el.textContent = 'Aucune équipe disponible.'; return; }
  const tickets = _rptTeamTickets(team);
  const cols = [
    { id:'todo',    l:'📭 À faire' },
    { id:'inprog',  l:'⏳ En cours' },
    { id:'review',  l:'👀 En revue' },
    { id:'test',    l:'🧪 En test' },
    { id:'blocked', l:'🚫 Bloqué' },
    { id:'done',    l:'✅ Terminé' },
  ];

  if (isSlack) {
    let t = `🗂️ *Rapport Kanban - ${team} - ${CONFIG.sprint.label}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    cols.forEach(c => {
      const items = tickets.filter(x => x.status === c.id);
      if (!items.length) return;
      const pts = items.reduce((s,x) => s+(x.points||0), 0);
      const wip = CONFIG.wip?.[c.id];
      const warn = wip && items.length > wip ? ' ⚠️ *WIP dépassé*' : '';
      t += `${c.l} - ${items.length} tickets, ${pts} pts${wip ? ` (WIP ${items.length}/${wip})` : ''}${warn}\n`;
      items.forEach(x => { t += `> • *${x.id}* - ${x.title} _(${x.points||0} pts)_ @${x.assignee||'?'} ${statusLabel(x.status)}\n`; });
      t += `\n`;
    });
    t += `_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>🗂️ Kanban - ${team} - ${CONFIG.sprint.label}</h1><p><em>${_rptDate()}</em></p>`;
    cols.forEach(c => {
      const items = tickets.filter(x => x.status === c.id);
      if (!items.length) return;
      const pts = items.reduce((s,x) => s+(x.points||0), 0);
      h += `<h2>${c.l} (${items.length} - ${pts} pts)</h2><table><tr><th>Clé</th><th>Titre</th><th>Pts</th><th>Assigné</th><th>Statut</th></tr>`;
      items.forEach(x => { h += `<tr><td>${_jiraBrowse(x.id,{style:'color:#0284C7'})}</td><td>${x.title}</td><td>${x.points||0}</td><td>${x.assignee||'-'}</td><td>${statusLabel(x.status)}</td></tr>`; });
      h += `</table>`;
    });
    _rptSetConf(el, h);
  }
  // Chart en bas du rapport
  _rptAppendKanbanCharts(el, tickets);
}

// ============================================================
// 3. PI PLANNING
// ============================================================

function _rptPI(el, isSlack) {
  const team = reportTeam;
  if (!team) { el.textContent = 'Aucune équipe disponible.'; return; }
  const tickets = _rptTeamTickets(team);
  const epics   = typeof EPICS !== 'undefined' ? EPICS : [];
  const done    = tickets.filter(t => isDone(t.status));
  const pts     = tickets.reduce((s,t) => s+(t.points||0), 0);
  const ptsDone = done.reduce((s,t) => s+(t.points||0), 0);
  const vel     = CONFIG.teams[team]?.velocity || 0;
  const teamEpics = epics.filter(e => e.team === team);

  if (isSlack) {
    let t = `🗓️ *Rapport PI Planning - ${team}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    t += `📊 *Résumé*\n`;
    t += `> Vélocité : ${vel} pts | Charge : ${pts} pts | Done : ${ptsDone} pts (${done.length} tickets)\n\n`;
    if (teamEpics.length) {
      t += `📦 *Epics (${teamEpics.length})*\n`;
      teamEpics.forEach(e => {
        const et = tickets.filter(x => x.epic === e.id);
        const ed = et.filter(x => isDone(x.status)).length;
        t += `> • *${e.id}* ${e.title} - ${ed}/${et.length} tickets\n`;
      });
      t += `\n`;
    }
    const blocked = tickets.filter(x => x.status === 'blocked');
    if (blocked.length) {
      t += `🚫 *Bloquants (${blocked.length})*\n`;
      blocked.forEach(x => { t += `> • *${x.id}* - ${x.title}\n`; });
    }
    t += `\n_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>🗓️ PI Planning - ${team}</h1><p><em>${_rptDate()}</em></p>`;
    h += `<h2>📊 Résumé</h2><table><tr><th>Métrique</th><th>Valeur</th></tr>`;
    h += `<tr><td>Vélocité</td><td>${vel} pts</td></tr>`;
    h += `<tr><td>Charge totale</td><td>${pts} pts</td></tr>`;
    h += `<tr><td>Réalisés</td><td>${ptsDone} pts (${done.length} tickets)</td></tr></table>`;
    if (teamEpics.length) {
      h += `<h2>📦 Epics</h2><table><tr><th>Epic</th><th>Titre</th><th>Avancement</th></tr>`;
      teamEpics.forEach(e => {
        const et = tickets.filter(x => x.epic === e.id);
        const ed = et.filter(x => isDone(x.status)).length;
        h += `<tr><td><strong>${e.id}</strong></td><td>${e.title}</td><td>${ed}/${et.length}</td></tr>`;
      });
      h += `</table>`;
    }
    _rptSetConf(el, h);
  }
}

// ============================================================
// 4. SUPPORT
// ============================================================

function _rptSupport(el, isSlack) {
  const st = typeof SUPPORT_TICKETS !== 'undefined' ? SUPPORT_TICKETS : [];
  const pLabels = { critical:'🔴 Critique', high:'🟠 Haute', medium:'🟡 Moyenne', low:'🟢 Basse' };
  const priorities = ['critical','high','medium','low'];

  if (isSlack) {
    let t = `🎫 *Rapport Support - ${st.length} tickets*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    priorities.forEach(p => {
      const items = st.filter(x => x.priority === p);
      if (!items.length) return;
      t += `${pLabels[p]} *(${items.length})*\n`;
      items.forEach(x => {
        const icon = isDone(x.status) ? '✅' : x.status === 'inprog' ? '⏳' : '📭';
        t += `> ${icon} *${x.id}* - ${x.title} @${x.assignee||'?'} [${x.team||'?'}]\n`;
      });
      t += `\n`;
    });
    const open = st.filter(x => !isDone(x.status)).length;
    const resolved = st.filter(x => isDone(x.status)).length;
    t += `📊 *Résumé* : ${open} ouverts · ${resolved} résolus\n`;
    t += `\n_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>🎫 Rapport Support</h1><p><em>${st.length} tickets | ${_rptDate()}</em></p>`;
    h += `<table><tr><th>ID</th><th>Titre</th><th>Priorité</th><th>Statut</th><th>Assigné</th><th>Équipe</th><th>Date</th></tr>`;
    st.forEach(x => {
      const sIcon = isDone(x.status) ? '✅' : x.status === 'inprog' ? '⏳' : '📭';
      h += `<tr><td><strong>${x.id}</strong></td><td>${x.title}</td><td>${pLabels[x.priority]||x.priority}</td><td>${sIcon}</td><td>${x.assignee||'-'}</td><td>${x.team||'-'}</td><td>${x.date||'-'}</td></tr>`;
    });
    h += `</table>`;
    _rptSetConf(el, h);
  }
}

// ============================================================
// 5. ROADMAP
// ============================================================

function _rptRoadmap(el, isSlack) {
  const team = reportTeam;
  if (!team) { el.textContent = 'Aucune équipe disponible.'; return; }
  const tickets = _rptTeamTickets(team);
  const bl      = tickets.filter(t => t.status === 'backlog' || !t.sprint || t.sprint === 0);
  const pts     = bl.reduce((s,t) => s+(t.points||0), 0);
  const vel     = CONFIG.teams[team]?.velocity || 0;
  const cap80   = Math.round(vel * 0.8);
  const sprints = cap80 > 0 ? Math.ceil(pts / cap80) : '?';
  const pOrder  = { critical:0, high:1, medium:2, low:3 };
  const sorted  = [...bl].sort((a,b) => (pOrder[a.priority]??2) - (pOrder[b.priority]??2));

  if (isSlack) {
    let t = `🗺️ *Rapport Roadmap - ${team}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    t += `📊 *Résumé*\n`;
    t += `> Backlog : ${bl.length} tickets · ${pts} pts\n`;
    t += `> Vélocité 80% : ${cap80} pts/sprint\n`;
    t += `> Estimation : ~${sprints} sprint${sprints !== 1 ? 's' : ''}\n\n`;

    const byPrio = { critical:[], high:[], medium:[], low:[] };
    sorted.forEach(x => { (byPrio[x.priority] || byPrio.medium).push(x); });
    const pIcons = { critical:'🔴', high:'🟠', medium:'🟡', low:'🟢' };
    Object.entries(byPrio).forEach(([p, items]) => {
      if (!items.length) return;
      const ipts = items.reduce((s,x) => s+(x.points||0), 0);
      t += `${pIcons[p]} *${p.charAt(0).toUpperCase()+p.slice(1)} (${items.length} - ${ipts} pts)*\n`;
      items.slice(0, 10).forEach(x => { t += `> • *${x.id}* - ${x.title} _(${x.points||0} pts)_\n`; });
      if (items.length > 10) t += `> _… et ${items.length - 10} autres_\n`;
      t += `\n`;
    });
    t += `_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>🗺️ Roadmap - ${team}</h1><p><em>${_rptDate()}</em></p>`;
    h += `<h2>📊 Résumé</h2><table><tr><th>Métrique</th><th>Valeur</th></tr>`;
    h += `<tr><td>Backlog</td><td>${bl.length} tickets · ${pts} pts</td></tr>`;
    h += `<tr><td>Vélocité 80%</td><td>${cap80} pts/sprint</td></tr>`;
    h += `<tr><td>Estimation</td><td>~${sprints} sprints</td></tr></table>`;
    h += `<h2>📋 Backlog priorisé</h2><table><tr><th>Clé</th><th>Titre</th><th>Pts</th><th>Priorité</th><th>Epic</th></tr>`;
    sorted.slice(0, 30).forEach(x => {
      h += `<tr><td>${_jiraBrowse(x.id,{style:'color:#0284C7'})}</td><td>${x.title}</td><td>${x.points||0}</td><td>${x.priority}</td><td>${x.epic||'-'}</td></tr>`;
    });
    if (sorted.length > 30) h += `<tr><td colspan="5"><em>… et ${sorted.length-30} autres tickets</em></td></tr>`;
    h += `</table>`;
    _rptSetConf(el, h);
  }
}

// ============================================================
// 6. PRÉPA PI
// ============================================================

function _rptPIPrep(el, isSlack) {
  const objs = typeof _ppObjList === 'function' ? _ppObjList() : [];
  const roam = typeof _ppRoamList === 'function' ? _ppRoamList() : [];
  const deps = typeof _ppDepList === 'function' ? _ppDepList() : [];
  const fist = typeof _ppFistGet === 'function' ? _ppFistGet() : {};
  const cap  = typeof _ppCapGet === 'function' ? _ppCapGet() : {};
  const teams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const roamCats = { R:'✅ Resolved', O:'👤 Owned', A:'🤝 Accepted', M:'🛡️ Mitigated' };

  if (isSlack) {
    let t = `📋 *Rapport Préparation PI Planning*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Objectifs
    t += `🎯 *Objectifs PI (${objs.length})*\n`;
    if (objs.length) {
      objs.forEach(o => {
        const type = o.type === 'committed' ? '📌 Committed' : '🎯 Stretch';
        t += `> • [BV ${o.bv||'?'}] *${o.title}* - ${_rptName(o.team)} - ${type}\n`;
      });
    } else { t += `> _Aucun objectif défini_\n`; }
    t += `\n`;

    // ROAM
    t += `⚠️ *ROAM (${roam.length} risques)*\n`;
    Object.entries(roamCats).forEach(([cat, label]) => {
      const items = roam.filter(x => x.cat === cat);
      if (!items.length) return;
      t += `*${label} (${items.length})*\n`;
      items.forEach(x => { t += `> • ${x.title}${x.note ? ` - _${x.note}_` : ''}\n`; });
    });
    if (!roam.length) t += `> _Aucun risque identifié_\n`;
    t += `\n`;

    // Dépendances
    t += `🔗 *Dépendances (${deps.length})*\n`;
    if (deps.length) deps.forEach(d => { t += `> • ${_rptName(d.fromTeam)} → ${_rptName(d.toTeam)} : ${d.fromTitle||'?'} ↔ ${d.toTitle||'?'}\n`; });
    else t += `> _Aucune_\n`;
    t += `\n`;

    // Capacité
    t += `👥 *Capacité*\n`;
    let hasCap = false;
    teams.forEach(tid => {
      const tc = cap[tid];
      if (!tc) return;
      let totalDays = 0;
      Object.values(tc).forEach(sp => { Object.values(sp).forEach(d => { totalDays += (d||0); }); });
      if (totalDays > 0) { t += `> ${_rptName(tid)} : ${totalDays}j bruts → ${Math.round(totalDays*0.8)}j effectifs\n`; hasCap = true; }
    });
    if (!hasCap) t += `> _Non renseignée_\n`;
    t += `\n`;

    // Fist of Five
    t += `✋ *Fist of Five*\n`;
    let hasFist = false;
    teams.forEach(tid => {
      const fv = Array.isArray(fist[tid]) ? fist[tid] : (fist[tid] ? [fist[tid]] : []);
      if (fv.length) { const avg = Math.round(fv.reduce((s,v)=>s+v,0)/fv.length*10)/10; t += `> ${_rptName(tid)} : ${avg}/5 (${fv.length} votes)\n`; hasFist = true; }
    });
    if (!hasFist) t += `> _Non voté_\n`;
    t += `\n_${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>📋 Préparation PI Planning</h1><p><em>${_rptDate()}</em></p>`;

    // Objectifs
    h += `<h2>🎯 Objectifs PI (${objs.length})</h2>`;
    if (objs.length) {
      h += `<table><tr><th>Objectif</th><th>Équipe</th><th>Type</th><th>BV</th><th>Statut</th></tr>`;
      objs.forEach(o => { h += `<tr><td>${o.title}</td><td>${_rptName(o.team)}</td><td>${o.type==='committed'?'📌 Committed':'🎯 Stretch'}</td><td>${o.bv||'-'}</td><td>${o.status||'-'}</td></tr>`; });
      h += `</table>`;
    } else { h += `<p><em>Aucun objectif défini</em></p>`; }

    // ROAM
    h += `<h2>⚠️ ROAM (${roam.length})</h2>`;
    if (roam.length) {
      h += `<table><tr><th>Catégorie</th><th>Risque</th><th>Note</th></tr>`;
      roam.forEach(r => { h += `<tr><td>${roamCats[r.cat]||r.cat}</td><td>${r.title}</td><td>${r.note||'-'}</td></tr>`; });
      h += `</table>`;
    } else { h += `<p><em>Aucun</em></p>`; }

    // Dépendances
    h += `<h2>🔗 Dépendances (${deps.length})</h2>`;
    if (deps.length) {
      h += `<table><tr><th>De</th><th>Livrable</th><th>→</th><th>Vers</th><th>Attend</th></tr>`;
      deps.forEach(d => { h += `<tr><td>${_rptName(d.fromTeam)}</td><td>${d.fromTitle||'-'}</td><td>→</td><td>${_rptName(d.toTeam)}</td><td>${d.toTitle||'-'}</td></tr>`; });
      h += `</table>`;
    } else { h += `<p><em>Aucune</em></p>`; }

    // Capacité
    h += `<h2>👥 Capacité</h2><table><tr><th>Équipe</th><th>Jours bruts</th><th>Effectif (×0.8)</th></tr>`;
    teams.forEach(tid => {
      const tc = cap[tid]; if (!tc) return;
      let totalDays = 0;
      Object.values(tc).forEach(sp => { Object.values(sp).forEach(d => { totalDays += (d||0); }); });
      if (totalDays > 0) h += `<tr><td>${_rptName(tid)}</td><td>${totalDays}j</td><td>${Math.round(totalDays*0.8)}j</td></tr>`;
    });
    h += `</table>`;

    // Fist
    h += `<h2>✋ Fist of Five</h2><table><tr><th>Équipe</th><th>Vote</th></tr>`;
    teams.forEach(tid => { const fv = Array.isArray(fist[tid]) ? fist[tid] : (fist[tid] ? [fist[tid]] : []); if (fv.length) { const avg = Math.round(fv.reduce((s,v)=>s+v,0)/fv.length*10)/10; h += `<tr><td>${_rptName(tid)}</td><td>${avg}/5 (${fv.length} votes)</td></tr>`; } });
    h += `</table>`;

    _rptSetConf(el, h);
  }
}

// ============================================================
// 7. SONDAGE - Message Slack d'humeur de sprint
// ============================================================

const _SONDAGE_TEMPLATES = [
  {
    theme: ':roller_coaster: Votre humeur en 1 emoji ?',
    responses: [
      { emoji: ':one:', text: `"J'ai passé plus de temps à éteindre des feux qu'à coder…" :fire::fire_extinguisher:` },
      { emoji: ':two:', text: `"J'ai survécu… mais j'ai besoin de vacances" :weary:` },
      { emoji: ':three:', text: `"Mitigé : entre les bugs et les post-its qui collent mal" :shrug:` },
      { emoji: ':four:', text: `"Plutôt cool ! On a avancé malgré tout" :sunglasses:` },
      { emoji: ':five:', text: `"SPLASH !" :ocean: "Sprint de ouf, équipe de ouf !"` },
    ],
    footer: `Votez avec un emoji ou un chiffre ! (Anonyme, promis :shushing_face:)`,
  },
  {
    theme: ':crystal_ball: Si ce sprint était un film, ce serait… ?',
    responses: [
      { emoji: ':one:', text: `"Titanic" - on a foncé droit dans l'iceberg :iceberg:` },
      { emoji: ':two:', text: `"Survivor" - j'ai tenu mais à quel prix :desert_island:` },
      { emoji: ':three:', text: `"Groundhog Day" - j'ai l'impression d'avoir fait la même chose en boucle :arrows_counterclockwise:` },
      { emoji: ':four:', text: `"Ocean's Eleven" - plan exécuté, objectif atteint :dark_sunglasses:` },
      { emoji: ':five:', text: `"Avengers Endgame" - ÉPIQUE. On a tout déchiré :zap:` },
    ],
    footer: `Répondez par un chiffre ! Le pop-corn est offert :popcorn:`,
  },
  {
    theme: ':space_invader: Votre niveau d\'énergie en fin de sprint ?',
    responses: [
      { emoji: ':one:', text: `Batterie 1% - "Quelqu'un a un chargeur ?" :low_battery:` },
      { emoji: ':two:', text: `Mode veille activé :zzz: "Je fonctionne en automatique"` },
      { emoji: ':three:', text: `50/50 - "Ça dépend des jours (et du café)" :coffee:` },
      { emoji: ':four:', text: `Bien chargé ! :battery: "On refait un tour ?"` },
      { emoji: ':five:', text: `OVER 9000 :zap::muscle: "Qui veut un sprint de plus ?!"` },
    ],
    footer: `Votez ! Et n'oubliez pas de recharger vos batteries ce week-end :electric_plug:`,
  },
  {
    theme: ':cook: Si ce sprint était un plat, ce serait… ?',
    responses: [
      { emoji: ':one:', text: `"Des pâtes trop cuites" - c'est passé, mais c'était pas ouf :spaghetti:` },
      { emoji: ':two:', text: `"Un sandwich triangle" - ça fait le taf, sans plus :sandwich:` },
      { emoji: ':three:', text: `"Un kebab" - un peu de tout, pas sûr de ce qu'il y a dedans :stuffed_flatbread:` },
      { emoji: ':four:', text: `"Un bon burger maison" - solide, bien garni :hamburger:` },
      { emoji: ':five:', text: `"Un repas étoilé" - exceptionnel, chef ! :star2::kissing_chef:` },
    ],
    footer: `Bon appétit et bon vote ! :fork_and_knife:`,
  },
  {
    theme: ':musical_note: La bande-son de ce sprint ?',
    responses: [
      { emoji: ':one:', text: `"Highway to Hell" - AC/DC savait :guitar::fire:` },
      { emoji: ':two:', text: `"Bohemian Rhapsody" - du chaos, mais artistique :art:` },
      { emoji: ':three:', text: `"Hotel California" - tu peux entrer mais jamais sortir :hotel:` },
      { emoji: ':four:', text: `"Don't Stop Me Now" - Queen mode activé :crown:` },
      { emoji: ':five:', text: `"We Are The Champions" - pas besoin d'expliquer :trophy:` },
    ],
    footer: `Montez le volume et votez ! :loud_sound:`,
  },
  {
    theme: ':video_game: Ce sprint en mode jeu vidéo ?',
    responses: [
      { emoji: ':one:', text: `"Dark Souls" - j'ai ragequit 3 fois :skull:` },
      { emoji: ':two:', text: `"Tetris en mode expert" - les blocs tombent trop vite :bricks:` },
      { emoji: ':three:', text: `"Minecraft" - j'ai crafté des trucs, mais j'sais pas trop quoi :pick:` },
      { emoji: ':four:', text: `"Mario Kart" - quelques carapaces bleues mais on s'en sort :racing_car:` },
      { emoji: ':five:', text: `"GG EZ" - speed run validé, pas de game over :joystick::tada:` },
    ],
    footer: `Insert coin et votez ! :coin:`,
  },
  {
    theme: ':sun_behind_rain_cloud: La météo de ce sprint ?',
    responses: [
      { emoji: ':one:', text: `"Tempête de catégorie 5" - sortez les gilets de sauvetage :tornado:` },
      { emoji: ':two:', text: `"Pluie fine et continue" - pas dramatique mais déprimant :cloud_with_rain:` },
      { emoji: ':three:', text: `"Nuageux avec éclaircies" - on a vu le soleil… 2 fois :partly_sunny:` },
      { emoji: ':four:', text: `"Beau temps !" - lunettes de soleil requises :sunny:` },
      { emoji: ':five:', text: `"Arc-en-ciel permanent" :rainbow: - un sprint magique !" :sparkles:` },
    ],
    footer: `Donnez-nous la météo du sprint ! :thermometer:`,
  },
  {
    theme: ':clapper: Ce sprint résumé en un GIF ?',
    responses: [
      { emoji: ':one:', text: `"This is fine" :fire::dog: - tout brûle mais je souris` },
      { emoji: ':two:', text: `"Confused Travolta" :man_in_tuxedo: - j'ai cherché des specs qui n'existent pas` },
      { emoji: ':three:', text: `"Shrug" :person_shrugging: - ni bien ni mal, ça existe` },
      { emoji: ':four:', text: `"Thumbs up kid" :+1: - solide, je recommande` },
      { emoji: ':five:', text: `"Leonardo DiCaprio champagne" :champagne::raised_hands: - on fête ça !"` },
    ],
    footer: `Votez avec votre GIF intérieur ! :frame_with_picture:`,
  },
  {
    theme: ':racing_car: Ce sprint sur un circuit ?',
    responses: [
      { emoji: ':one:', text: `"Panne sèche au premier virage" :fuelpump: - on n'est pas allés loin` },
      { emoji: ':two:', text: `"Crevaison au 3e tour" - ça roulait… puis non :tire:` },
      { emoji: ':three:', text: `"Milieu de peloton" - régulier, pas spectaculaire :checkered_flag:` },
      { emoji: ':four:', text: `"Podium !" :sports_medal: - top 3, on prend` },
      { emoji: ':five:', text: `"Pole position + meilleur tour" :trophy: - Hamilton qui ?" :racing_car::dash:` },
    ],
    footer: `Gentlemen, start your votes ! :traffic_light:`,
  },
  {
    theme: ':airplane: Ce sprint en classe de vol ?',
    responses: [
      { emoji: ':one:', text: `"Siège du milieu, pas de hublot, bébé qui pleure" :baby::cry:` },
      { emoji: ':two:', text: `"Eco - les genoux dans le siège de devant" :leg:` },
      { emoji: ':three:', text: `"Eco+ - un peu de place, un café tiède" :coffee:` },
      { emoji: ':four:', text: `"Business - je gère, j'ai de la place" :briefcase:` },
      { emoji: ':five:', text: `"First class + champagne" :champagne::airplane: - on plane !"` },
    ],
    footer: `Attachez vos ceintures et votez ! :seat:`,
  },
];

// Mapping Slack emoji codes → Unicode pour la preview
const _SLACK_EMOJI = {
  ':one:':'1️⃣',':two:':'2️⃣',':three:':'3️⃣',':four:':'4️⃣',':five:':'5️⃣',
  ':fire:':'🔥',':fire_extinguisher:':'🧯',':weary:':'😩',':shrug:':'🤷',':sunglasses:':'😎',
  ':ocean:':'🌊',':shushing_face:':'🤫',':roller_coaster:':'🎢',':crystal_ball:':'🔮',
  ':iceberg:':'🧊',':desert_island:':'🏝️',':arrows_counterclockwise:':'🔄',':dark_sunglasses:':'🕶️',
  ':zap:':'⚡',':popcorn:':'🍿',':space_invader:':'👾',':low_battery:':'🪫',':zzz:':'💤',
  ':coffee:':'☕',':battery:':'🔋',':muscle:':'💪',':electric_plug:':'🔌',':cook:':'👨‍🍳',
  ':spaghetti:':'🍝',':sandwich:':'🥪',':stuffed_flatbread:':'🥙',':hamburger:':'🍔',
  ':star2:':'🌟',':kissing_chef:':'😘',':fork_and_knife:':'🍴',':musical_note:':'🎵',
  ':guitar:':'🎸',':art:':'🎨',':hotel:':'🏨',':crown:':'👑',':trophy:':'🏆',
  ':video_game:':'🎮',':skull:':'💀',':bricks:':'🧱',':pick:':'⛏️',':racing_car:':'🏎️',
  ':joystick:':'🕹️',':tada:':'🎉',':coin:':'🪙',':sun_behind_rain_cloud:':'🌦️',
  ':tornado:':'🌪️',':cloud_with_rain:':'🌧️',':partly_sunny:':'⛅',':sunny:':'☀️',
  ':rainbow:':'🌈',':sparkles:':'✨',':thermometer:':'🌡️',':clapper:':'🎬',
  ':dog:':'🐶',':man_in_tuxedo:':'🤵',':person_shrugging:':'🤷',':+1:':'👍',
  ':champagne:':'🍾',':raised_hands:':'🙌',':frame_with_picture:':'🖼️',
  ':fuelpump:':'⛽',':tire:':'🛞',':checkered_flag:':'🏁',':sports_medal:':'🏅',
  ':dash:':'💨',':traffic_light:':'🚦',':airplane:':'✈️',':baby:':'👶',':cry:':'😢',
  ':leg:':'🦵',':briefcase:':'💼',':seat:':'💺',
};

function _slackToEmoji(text) {
  return text.replace(/:[a-z_+]+:/g, m => _SLACK_EMOJI[m] || m);
}

function _rptSondage(el, isSlack) {
  const label  = CONFIG.sprint.label || 'Sprint actif';
  const start  = CONFIG.sprint.startDate || '';
  const end    = CONFIG.sprint.endDate || '';
  const period = start && end ? ` (${start} → ${end})` : '';
  const team   = reportTeam || '';
  const teamLabel = team === 'group'
    ? (GROUPS.find(g => g.id === currentGroup)?.name || 'Groupe')
    : (_rptName(team));

  // Date limite d'envoi : 2 jours ouvrés avant la fin du sprint
  let sendByLabel = '';
  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime())) {
      let daysBack = 0;
      const cur = new Date(endDate);
      while (daysBack < 2) {
        cur.setDate(cur.getDate() - 1);
        if (cur.getDay() !== 0 && cur.getDay() !== 6) daysBack++;
      }
      sendByLabel = cur.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
  }

  // Sélection du template basée sur le numéro de sprint
  const sprintNum = CONFIG.sprint.current || 0;
  const tpl = _SONDAGE_TEMPLATES[sprintNum % _SONDAGE_TEMPLATES.length];

  // Retirer le préfixe board du label ("Estafette - Ité 28.4" → "Ité 28.4")
  const shortLabel = label.replace(/^.+?\s*[-–-]\s*/, '') || label;

  // Construire le message Slack brut (avec codes emoji Slack)
  let slackMsg = `${tpl.theme}\n*[SONDAGE] ${shortLabel}${period} - ${teamLabel}*\n\n`;
  tpl.responses.forEach(r => { slackMsg += `${r.emoji} = ${r.text}\n`; });
  slackMsg += `\n→ ${tpl.footer}`;

  // Info banner
  const infoBox = sendByLabel
    ? `<div class="sondage-info">
        <span class="si-icon">💡</span>
        <div class="si-text">Envoyer au plus tard le <strong>${sendByLabel}</strong><small>2 jours ouvrés avant la fin du sprint</small></div>
      </div>`
    : '';

  // Preview Slack visuelle (emoji Unicode)
  const previewText = _slackToEmoji(slackMsg)
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  const now = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  const slackPreview = `
    <div class="slack-preview-box">
      <div class="slack-preview-header">
        <div class="slack-preview-avatar">📊</div>
        <div><span class="slack-preview-name">JIRA Dashboard</span><span class="slack-preview-badge">APP ${now}</span></div>
      </div>
      <div class="slack-preview-body">${previewText}</div>
    </div>`;

  // Rendu - 2 colonnes : message brut | aperçu visuel
  el.className = 'sondage-wrap';
  if (isSlack) {
    el.innerHTML = `
      ${infoBox}
      <div class="sondage-columns">
        <div>
          <div class="sondage-col-label">Message Slack (à copier)</div>
          <pre class="report-preview" style="margin:0;height:100%;">${slackMsg.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
        </div>
        <div>
          <div class="sondage-col-label">Aperçu visuel</div>
          ${slackPreview}
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      ${infoBox}
      <div class="sondage-columns">
        <div>
          <div class="sondage-col-label">Confluence</div>
          <div class="report-preview confluence-mode" style="margin:0;">
            <h1>${_slackToEmoji(tpl.theme)}</h1>
            <p><strong>Sondage - ${shortLabel}${period} - ${teamLabel}</strong></p>
            <table><tr><th>Vote</th><th>Réponse</th></tr>
            ${tpl.responses.map((r, i) =>
              `<tr><td style="text-align:center;font-size:18px;font-weight:700;">${i+1}</td><td>${_slackToEmoji(r.text)}</td></tr>`
            ).join('')}
            </table>
            <p><em>${_slackToEmoji(tpl.footer)}</em></p>
          </div>
        </div>
        <div>
          <div class="sondage-col-label">Aperçu Slack</div>
          ${slackPreview}
        </div>
      </div>`;
  }
}

// ============================================================
// Charts inline pour les rapports Sprint & Kanban
// ============================================================

let _rptCharts = [];

function _rptDestroyCharts() {
  _rptCharts.forEach(c => c.destroy());
  _rptCharts = [];
  const old = document.getElementById('rpt-charts-container');
  if (old) old.remove();
}

function _rptCard(title, id) {
  return `<div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:16px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;">${title}</div>
    <div style="position:relative;height:220px;"><canvas id="${id}"></canvas></div>
  </div>`;
}

function _rptAppendSprintCharts(container, tickets, ptsDone, ptsTotal, velTarget) {
  const wrap = document.createElement('div');
  wrap.id = 'rpt-charts-container';
  wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;';
  wrap.innerHTML =
    _rptCard('📉 Burndown Chart', 'rpt-burndown') +
    _rptCard('📈 Burnup Chart', 'rpt-burnup') +
    _rptCard('🍩 Répartition par type', 'rpt-sprint-donut') +
    _rptCard('📊 Vélocité Sprint', 'rpt-sprint-bar');
  container.appendChild(wrap);

  // --- Burndown ---
  const days   = CONFIG.sprint.durationDays || 14;
  const labels = Array.from({ length: days }, (_, i) => `J${i + 1}`);
  const idealData = Array.from({ length: days }, (_, i) => Math.round(ptsTotal * (1 - i / (days - 1))));
  const currentDay = _sprintCurrentDay(days, CONFIG.sprint);
  const realData = Array.from({ length: days }, (_, i) => {
    if (i > currentDay) return null;
    if (currentDay === 0) return ptsTotal;
    return Math.round(ptsTotal - (ptsDone * i / currentDay));
  });

  const bdCtx = document.getElementById('rpt-burndown');
  if (bdCtx) {
    _rptCharts.push(new Chart(bdCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Idéal', data: idealData, borderColor: '#94A3B8', borderDash: [5, 5], pointRadius: 0, tension: .3 },
          { label: 'Réel', data: realData, borderColor: '#0284C7', backgroundColor: 'rgba(2,132,199,.1)', fill: true, tension: .3, pointBackgroundColor: '#0284C7', pointRadius: 3, spanGaps: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { font: { size: 11 } } },
          tooltip: { ..._TOOLTIP, callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw} pts`,
            footer: items => {
              const real = items.find(i => i.dataset.label === 'Réel' && i.raw != null);
              const ideal = items.find(i => i.dataset.label === 'Idéal' && i.raw != null);
              if (!real || !ideal) return [];
              const d = real.raw - ideal.raw;
              return d > 0 ? [`⚠️  Retard : +${d} pts`] : d < 0 ? [`✅  Avance : ${Math.abs(d)} pts`] : [`=  Dans les clous`];
            },
          }},
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Points restants', font: { size: 10 } } } },
      },
    }));
  }

  // --- Burnup ---
  const scopeData = Array.from({ length: days }, () => ptsTotal);
  const doneData  = Array.from({ length: days }, (_, i) => {
    if (i > currentDay) return null;
    if (currentDay === 0) return ptsDone;
    return Math.round(ptsDone * i / currentDay);
  });

  const buCtx = document.getElementById('rpt-burnup');
  if (buCtx) {
    _rptCharts.push(new Chart(buCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Scope', data: scopeData, borderColor: '#94A3B8', borderDash: [5, 5], pointRadius: 0, tension: 0, fill: false },
          { label: 'Terminé', data: doneData, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.15)', fill: true, tension: .3, pointBackgroundColor: '#10B981', pointRadius: 3, spanGaps: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { font: { size: 11 } } },
          tooltip: { ..._TOOLTIP, callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw} pts`,
            footer: items => {
              const done = items.find(i => i.dataset.label === 'Terminé' && i.raw != null);
              const scope = items.find(i => i.dataset.label === 'Scope' && i.raw != null);
              if (!done || !scope || !scope.raw) return [];
              const pct = Math.round(done.raw / scope.raw * 100);
              return [`${pct >= 80 ? '✅' : pct >= 50 ? '🟡' : '📍'}  Avancement : ${pct}%`];
            },
          }},
        },
        scales: { y: { beginAtZero: true, max: Math.ceil(ptsTotal * 1.1) || undefined, title: { display: true, text: 'Points', font: { size: 10 } } } },
      },
    }));
  }

  // --- Donut - type distribution ---
  const types = {};
  tickets.forEach(t => { const ty = t.type || 'autre'; types[ty] = (types[ty] || 0) + 1; });
  const typeLabels = Object.keys(types).map(t => typeName ? typeName(t) : t);
  const typeData   = Object.values(types);
  const typeColors = Object.keys(types).map(t => CONFIG.typeColors[t] || CLR.muted);

  const donutCtx = document.getElementById('rpt-sprint-donut');
  if (donutCtx) {
    _rptCharts.push(new Chart(donutCtx, {
      type: 'doughnut',
      data: { labels: typeLabels, datasets: [{ data: typeData, backgroundColor: typeColors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, padding: 8, usePointStyle: true, pointStyleWidth: 8 } },
          tooltip: { ..._TOOLTIP },
        },
        cutout: '55%',
      },
    }));
  }

  // --- Bar - velocity ---
  const ptsNotDone = tickets.filter(t => !isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const barCtx = document.getElementById('rpt-sprint-bar');
  if (barCtx) {
    _rptCharts.push(new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Terminés', 'Restants', 'Cible'],
        datasets: [{
          data: [ptsDone, ptsNotDone, velTarget],
          backgroundColor: ['#059669', '#F59E0B', '#3B82F6'],
          borderRadius: 6, barPercentage: 0.6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { ..._TOOLTIP, callbacks: { label: ctx => `${ctx.raw} pts` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
        },
      },
    }));
  }
}

function _rptAppendKanbanCharts(container, tickets) {
  const wrap = document.createElement('div');
  wrap.id = 'rpt-charts-container';
  wrap.style.cssText = 'margin-top:20px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:16px;';
  wrap.innerHTML = `
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;">📊 Tickets par statut</div>
    <div style="position:relative;height:200px;"><canvas id="rpt-kanban-bar"></canvas></div>`;
  container.appendChild(wrap);

  const cols = [
    { id:'todo',    l:'À faire',  c:'#94A3B8' },
    { id:'inprog',  l:'En cours', c:'#3B82F6' },
    { id:'review',  l:'En revue', c:'#8B5CF6' },
    { id:'test',    l:'En test',  c:'#F59E0B' },
    { id:'blocked', l:'Bloqué',   c:'#DC2626' },
    { id:'done',    l:'Terminé',  c:'#059669' },
  ];
  const labels = [];
  const data   = [];
  const colors = [];
  cols.forEach(c => {
    const count = tickets.filter(t => t.status === c.id).length;
    if (count > 0 || c.id === 'todo' || c.id === 'done') {
      labels.push(c.l);
      data.push(count);
      colors.push(c.c);
    }
  });

  const ctx = document.getElementById('rpt-kanban-bar');
  if (ctx) {
    _rptKanbanBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderRadius: 6,
          barPercentage: 0.6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ..._TOOLTIP, callbacks: { label: ctx => `${ctx.raw} ticket${ctx.raw > 1 ? 's' : ''}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
          y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 11 }, stepSize: 1 } },
        },
      },
    });
  }
}

// ============================================================
// 8. MOOD / VÉLOCITÉ - Corrélation satisfaction × performance
// ============================================================

function _rptMoodVelocity(el, isSlack) {
  const allTeams = _allTeams();
  const moodVotes = (typeof _moodData === 'function') ? (_moodData().votes || {}) : {};

  // Collect mood + velocity data per team per sprint
  const rows = [];
  allTeams.forEach(team => {
    const hist = CONFIG.teams[team]?.velocityHistory || [];
    hist.forEach(h => {
      const key = `${team}__${h.name}`;
      const votes = moodVotes[key];
      const avg = Array.isArray(votes) && votes.length ? Math.round(votes.reduce((a, v) => a + v, 0) / votes.length * 10) / 10 : null;
      rows.push({ team, sprint: h.name, velocity: h.velocity || 0, mood: avg });
    });
  });

  // Filter rows with mood data
  const withMood = rows.filter(r => r.mood !== null);

  // Compute correlation if enough data
  let correlation = null;
  let trend = '';
  if (withMood.length >= 3) {
    const n = withMood.length;
    const sumX = withMood.reduce((a, r) => a + r.mood, 0);
    const sumY = withMood.reduce((a, r) => a + r.velocity, 0);
    const sumXY = withMood.reduce((a, r) => a + r.mood * r.velocity, 0);
    const sumX2 = withMood.reduce((a, r) => a + r.mood * r.mood, 0);
    const sumY2 = withMood.reduce((a, r) => a + r.velocity * r.velocity, 0);
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    correlation = denom ? Math.round((n * sumXY - sumX * sumY) / denom * 100) / 100 : 0;
    trend = correlation > 0.5 ? '📈 Forte corrélation positive' :
            correlation > 0.2 ? '📊 Corrélation modérée' :
            correlation > -0.2 ? '➡️ Pas de corrélation claire' :
            correlation > -0.5 ? '📉 Corrélation négative modérée' : '⚠️ Forte corrélation négative';
  }

  // Per-team summary
  const teamSummary = allTeams.map(team => {
    const teamRows = rows.filter(r => r.team === team);
    const moods = teamRows.filter(r => r.mood !== null);
    const avgMood = moods.length ? Math.round(moods.reduce((a, r) => a + r.mood, 0) / moods.length * 10) / 10 : null;
    const avgVel = teamRows.length ? Math.round(teamRows.reduce((a, r) => a + r.velocity, 0) / teamRows.length) : 0;
    const velTarget = CONFIG.teams[team]?.velocity || CONFIG.sprint.velocityTarget || 80;
    return { team, avgMood, avgVel, velTarget, dataPoints: moods.length };
  });

  if (isSlack) {
    let t = `😊 *Rapport Mood / Vélocité*\n`;
    t += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (correlation !== null) {
      t += `📊 *Corrélation globale :* r = ${correlation} - ${trend}\n\n`;
    }

    t += `*Synthèse par équipe :*\n`;
    teamSummary.forEach(ts => {
      const moodStr = ts.avgMood !== null ? `${ts.avgMood}/5` : 'N/A';
      const emoji = ts.avgMood >= 4 ? '😊' : ts.avgMood >= 3 ? '😐' : ts.avgMood !== null ? '😟' : '❓';
      const velDelta = ts.avgVel - ts.velTarget;
      const velEmoji = velDelta >= 0 ? '📈' : '📉';
      t += `> ${emoji} *${ts.team}* - Mood: ${moodStr} | Vélocité: ${ts.avgVel} pts (cible ${ts.velTarget}) ${velEmoji} ${velDelta >= 0 ? '+' : ''}${velDelta}\n`;
    });

    if (withMood.length) {
      t += `\n*Détail par sprint :*\n`;
      withMood.slice(-10).forEach(r => {
        const moodBar = '█'.repeat(Math.round(r.mood)) + '░'.repeat(5 - Math.round(r.mood));
        t += `> • *${r.team}* ${r.sprint} - Mood: ${moodBar} ${r.mood}/5 | Vélo: ${r.velocity} pts\n`;
      });
    } else {
      t += `\n> _Aucune donnée mood disponible. Utilisez le mood meter (ROTI) en fin de sprint._\n`;
    }

    t += `\n_Rapport généré le ${_rptDate()} - JIRA Dashboard_`;
    _rptSetSlack(el, t);
  } else {
    let h = `<h1>😊 Rapport Mood / Vélocité</h1>`;

    if (correlation !== null) {
      const corrColor = correlation > 0.3 ? '#16A34A' : correlation > -0.3 ? '#F59E0B' : '#DC2626';
      h += `<div style="margin:12px 0;padding:12px 16px;background:${corrColor}12;border:1px solid ${corrColor}33;border-radius:8px;">
        <strong style="color:${corrColor}">Corrélation : r = ${correlation}</strong> - ${trend}
      </div>`;
    }

    h += `<h2>Synthèse par équipe</h2>`;
    h += `<table><thead><tr><th>Équipe</th><th>Mood moy.</th><th>Vélocité moy.</th><th>Cible</th><th>Écart</th><th>Données</th></tr></thead><tbody>`;
    teamSummary.forEach(ts => {
      const moodStr = ts.avgMood !== null ? `${ts.avgMood}/5` : '-';
      const delta = ts.avgVel - ts.velTarget;
      const deltaColor = delta >= 0 ? '#16A34A' : '#DC2626';
      h += `<tr><td><strong>${ts.team}</strong></td><td>${moodStr}</td><td>${ts.avgVel} pts</td><td>${ts.velTarget} pts</td><td style="color:${deltaColor};font-weight:700">${delta >= 0 ? '+' : ''}${delta}</td><td>${ts.dataPoints} sprints</td></tr>`;
    });
    h += `</tbody></table>`;

    if (withMood.length) {
      h += `<h2>Détail sprints avec données mood</h2>`;
      h += `<table><thead><tr><th>Équipe</th><th>Sprint</th><th>Mood</th><th>Vélocité</th></tr></thead><tbody>`;
      withMood.slice(-15).forEach(r => {
        const moodColor = r.mood >= 4 ? '#16A34A' : r.mood >= 3 ? '#F59E0B' : '#DC2626';
        h += `<tr><td>${r.team}</td><td>${r.sprint}</td><td style="color:${moodColor};font-weight:700">${r.mood}/5</td><td>${r.velocity} pts</td></tr>`;
      });
      h += `</tbody></table>`;
    }

    _rptSetConf(el, h);
  }

  // Render scatter chart after DOM
  setTimeout(() => _rptMoodVelocityChart(el, withMood, correlation), 50);
}

function _rptMoodVelocityChart(container, data, correlation) {
  if (data.length < 2) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:20px;background:var(--card,#fff);border:1.5px solid var(--border);border-radius:10px;padding:16px;';
  wrap.innerHTML = `
    <div style="font-weight:700;font-size:13px;margin-bottom:4px;">📊 Corrélation Mood × Vélocité${correlation !== null ? ` (r=${correlation})` : ''}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">Chaque point = 1 équipe × 1 sprint</div>
    <div style="position:relative;height:250px;"><canvas id="rpt-mood-vel-scatter"></canvas></div>`;
  container.appendChild(wrap);

  const ctx = document.getElementById('rpt-mood-vel-scatter');
  if (!ctx) return;

  const colors = {};
  const allTeams = _allTeams();
  allTeams.forEach(t => { colors[t] = _teamColor(t); });

  const datasets = allTeams.map(team => {
    const teamData = data.filter(d => d.team === team);
    if (!teamData.length) return null;
    return {
      label: team,
      data: teamData.map(d => ({ x: d.mood, y: d.velocity })),
      backgroundColor: colors[team] || CLR.dark,
      borderColor: colors[team] || CLR.dark,
      pointRadius: 6,
      pointHoverRadius: 8,
    };
  }).filter(Boolean);

  new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,.94)',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: Mood ${ctx.parsed.x}/5 → ${ctx.parsed.y} pts`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Mood (1-5)', font: { size: 11, weight: 'bold' } },
          min: 0.5, max: 5.5,
          grid: { color: 'rgba(0,0,0,.06)' },
          ticks: { font: { size: 11 } },
        },
        y: {
          title: { display: true, text: 'Vélocité (pts)', font: { size: 11, weight: 'bold' } },
          grid: { color: 'rgba(0,0,0,.06)' },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// ============================================================
// Copier le rapport
// ============================================================

function copyReport() {
  const wrap = document.getElementById('report-preview');
  const el = wrap.querySelector('.report-preview') || wrap;
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Rapport copié dans le presse-papiers !', 'success'));
}
