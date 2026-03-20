// ============================================================
// SCRUM VIEW - Board sprint, hiérarchie Feature>Epic, statistiques
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
    }).catch(() => { /* server unavailable - localStorage fallback */ });
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

  const ac = CONFIG.alerts || {};
  const voteDays  = ac.voteDays  ?? 1;
  const moodDays  = ac.moodDays  ?? 2;
  const demoDays  = ac.demoDays  ?? 1;

  // J+N from sprint start → confidence vote (panel like ROTI)
  if (daysFromStart >= 0 && daysFromStart <= voteDays) {
    const voteData = _voteData();
    const hasVotes = _moodTeams().some(t => { const k = `${t}__${(CONFIG.teams[t]?.sprintName || CONFIG.sprint.label || 'sprint')}`; const v = voteData[k]; return Array.isArray(v) && v.length > 0; });
    alerts.push({
      type: 'vote',
      icon: '🗳️',
      label: 'Vote de confiance PI Objectives',
      done: hasVotes,
      onclick: `_toggleVotePanel()`,
    });
  }

  // J-N → mood meter (ROTI) - opens panel like fist of five
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

  // ---- Health alerts (scope creep, blocked ratio, velocity trend) ----
  const tickets = (typeof getTickets === 'function') ? getTickets() : [];

  // Scope creep - stories added mid-sprint (detected via todayChanges or changelog)
  const scopeThreshold = ac.scopeCreepThreshold ?? 2;
  if (daysFromStart > 1 && tickets.length) {
    // Count tickets that were added after sprint start (sprint field change to current sprint)
    const addedMidSprint = tickets.filter(t => {
      if (!Array.isArray(t.todayChanges)) return false;
      return t.todayChanges.some(c => c.field && c.field.toLowerCase() === 'sprint' && c.to && c.to.includes(s.label));
    }).length;
    if (addedMidSprint >= scopeThreshold) {
      alerts.push({
        type: 'health',
        icon: '📈',
        label: `Scope creep : ${addedMidSprint} ticket${addedMidSprint > 1 ? 's' : ''} ajouté${addedMidSprint > 1 ? 's' : ''} aujourd'hui`,
      });
    }
  }

  // Blocked ratio - blocked / in-progress too high
  const blockedThreshold = ac.blockedRatioThreshold ?? 0.3;
  const inProg  = tickets.filter(t => t.status === 'inprog' || t.status === 'review').length;
  const blocked = tickets.filter(t => t.status === 'blocked').length;
  if (inProg > 0 && blocked / inProg >= blockedThreshold) {
    const pct = Math.round(blocked / inProg * 100);
    alerts.push({
      type: 'health',
      icon: '🚧',
      label: `${blocked} bloqué${blocked > 1 ? 's' : ''} / ${inProg} en cours (${pct}%)`,
    });
  }

  // Velocity dropping trend - compare last 3 sprints
  const velDropPct = ac.velocityDropPct ?? 15;
  const activeTeams = _moodTeams();
  const allVH = activeTeams.flatMap(t => CONFIG.teams[t]?.velocityHistory || []);
  if (allVH.length >= 3) {
    // Sum velocities per sprint position across teams
    const recent = allVH.slice(-3).map(v => v.velocity || 0);
    const firstV = recent[0];
    const lastV  = recent[recent.length - 1];
    if (firstV > 0 && lastV < firstV * (1 - velDropPct / 100)) {
      const drop = Math.round((1 - lastV / firstV) * 100);
      alerts.push({
        type: 'health',
        icon: '📉',
        label: `Vélocité en baisse : −${drop}% sur 3 sprints`,
      });
    }
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

// ----------- Mood meter (ROTI) panel - like fist of five -----------
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

// Build mood trend sparkline - shows average mood per sprint across teams
function _moodTrendSparkline(teams) {
  const md = _moodData();
  if (!md.votes) return '';

  // Collect all sprint keys that have votes for any of the given teams
  const sprintSet = new Map(); // sprintLabel → [votes...]
  Object.entries(md.votes).forEach(([k, votes]) => {
    if (!Array.isArray(votes) || !votes.length) return;
    const [tid, spLabel] = k.split('__');
    if (!spLabel || !teams.includes(tid)) return;
    if (!sprintSet.has(spLabel)) sprintSet.set(spLabel, []);
    sprintSet.get(spLabel).push(...votes);
  });

  if (sprintSet.size < 2) return ''; // need at least 2 sprints for a trend

  // Sort sprints (basic: by key string which includes iteration number)
  const sorted = [...sprintSet.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const last8 = sorted.slice(-8);
  const points = last8.map(([label, votes]) => ({
    label,
    avg: Math.round(votes.reduce((s, v) => s + v, 0) / votes.length * 10) / 10,
    count: votes.length,
  }));

  const maxV = 5, minV = 1;
  const w = 220, h = 40, pad = 4;
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);

  const pathPoints = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.avg - minV) / (maxV - minV)) * (h - pad * 2);
    return { x, y, ...p };
  });

  const line = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = pathPoints.map(p => {
    const c = p.avg < 2.5 ? '#DC2626' : p.avg < 3.5 ? '#F59E0B' : '#16A34A';
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${c}" stroke="white" stroke-width="1">
      <title>${p.label}: ${p.avg}/5 (${p.count} votes)</title>
    </circle>`;
  }).join('');

  const labels = pathPoints.map(p => {
    const short = p.label.replace(/.*Ité\.?\s*/, '').replace(/Sprint\s*/i, 'S');
    return `<text x="${p.x.toFixed(1)}" y="${h + 10}" text-anchor="middle" fill="var(--text-muted)" font-size="7">${short}</text>`;
  }).join('');

  const lastP = points[points.length - 1];
  const prevP = points[points.length - 2];
  const delta = lastP.avg - prevP.avg;
  const arrow = delta > 0.2 ? '↗' : delta < -0.2 ? '↘' : '→';
  const trendColor = delta > 0.2 ? '#16A34A' : delta < -0.2 ? '#DC2626' : '#F59E0B';

  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
    <span style="font-size:11px;color:var(--text-muted);font-weight:600;white-space:nowrap;">Tendance</span>
    <svg width="${w}" height="${h + 14}" style="flex-shrink:0;">
      <line x1="${pad}" y1="${h - pad - ((3 - minV) / (maxV - minV)) * (h - pad * 2)}" x2="${w - pad}" y2="${h - pad - ((3 - minV) / (maxV - minV)) * (h - pad * 2)}" stroke="var(--border)" stroke-dasharray="3,3"/>
      <path d="${line}" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>
    <span style="font-size:18px;font-weight:800;color:${trendColor};">${arrow}</span>
    <span style="font-size:11px;color:${trendColor};font-weight:600;">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>
  </div>`;
}

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
    const color = tc?.color || CLR.dark;
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
    const distribHtml = `<div style="display:flex;align-items:flex-end;gap:4px;height:36px;">
      ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <div style="width:18px;height:${count ? Math.max(3, Math.round(d / maxD * 28)) : 3}px;background:${count && d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:3px;${count ? '' : 'opacity:.4;'}"></div>
        <span style="font-size:8px;color:var(--text-muted);">${d || ''}</span>
      </div>`).join('')}
    </div>`;

    const btns = [1,2,3,4,5].map(n => `
      <button onclick="_moodVote('${tid}',${n})"
        class="sc-mood-btn"
        title="${n} - ${labels[n]}">${emojis[n-1]}</button>`
    ).join('');

    const actions = count ? `
      <button onclick="_moodUndo('${tid}')" class="sc-action-btn-sm" title="Annuler le dernier vote">↩</button>
      <button onclick="_moodReset('${tid}')" class="sc-action-btn-sm" title="Réinitialiser">✕</button>` : '';

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

  // Mood trend sparkline - historical mood averages across sprints
  const trendHtml = _moodTrendSparkline(teams);

  el.innerHTML = `<div class="mood-panel">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:14px;font-weight:700;color:var(--text);">😊 Mood Meter (ROTI)</span>
      ${avgBadge}
      <button onclick="_toggleMoodPanel()" style="margin-left:${gAvg !== null ? '8px' : 'auto'};border:none;background:none;font-size:16px;cursor:pointer;color:var(--text-muted);">✕</button>
    </div>
    ${trendHtml}
    <div style="display:flex;flex-direction:column;gap:6px;">${cards}</div>
  </div>`;
}

// ----------- Vote de confiance panel (same UX as ROTI) -----------
let _votePanelOpen = false;

function _voteKey(teamId) {
  const s = _activeSprintCtx();
  return `${teamId}__${s.label || 'sprint'}`;
}

function _voteData() {
  const md = _moodData();
  if (!md.confidence) md.confidence = {};
  return md.confidence;
}

window._toggleVotePanel = function() {
  _votePanelOpen = !_votePanelOpen;
  _renderVotePanel();
};

window._confVote = function(teamId, val) {
  const vd = _voteData();
  const key = _voteKey(teamId);
  if (!Array.isArray(vd[key])) vd[key] = [];
  vd[key].push(val);
  _moodSave();
  _renderVotePanel();
  _renderSprintAlerts();
};

window._confUndo = function(teamId) {
  const vd = _voteData();
  const key = _voteKey(teamId);
  if (Array.isArray(vd[key]) && vd[key].length) {
    vd[key].pop();
    _moodSave();
    _renderVotePanel();
    _renderSprintAlerts();
  }
};

window._confReset = function(teamId) {
  const vd = _voteData();
  const key = _voteKey(teamId);
  vd[key] = [];
  _moodSave();
  _renderVotePanel();
  _renderSprintAlerts();
};

window._confNote = function(teamId, val) {
  const md = _moodData();
  if (!md.confNotes) md.confNotes = {};
  md.confNotes[_voteKey(teamId)] = val;
  _moodSave();
};

function _renderVotePanel() {
  const el = document.getElementById('vote-panel');
  if (!el) return;
  if (!_votePanelOpen) { el.innerHTML = ''; return; }

  const teams = _moodTeams();
  const vd    = _voteData();
  const md    = _moodData();
  const fists = ['✊', '☝️', '✌️', '🤟', '🖖', '🖐️'];
  const labels = ['Pas confiant', 'Très peu confiant', 'Peu confiant', 'Modérément confiant', 'Confiant', 'Très confiant'];

  const cards = teams.map(tid => {
    const tc    = CONFIG.teams[tid];
    const color = tc?.color || CLR.dark;
    const key   = _voteKey(tid);
    const votes = Array.isArray(vd[key]) ? vd[key] : [];
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor = !count ? '#94A3B8' : avg < 2 ? '#DC2626' : avg < 3.5 ? '#D97706' : '#16A34A';
    const borderColor = !count ? 'var(--border)' : avg >= 3.5 ? '#86EFAC' : avg >= 2 ? '#FCD34D' : '#FECACA';
    const note = ((md.confNotes?.[key]) || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    // Distribution bars (0-5)
    const distrib = [0,1,2,3,4,5].map(n => votes.filter(v => v === n).length);
    const maxD = Math.max(...distrib, 1);
    const distribHtml = `<div style="display:flex;align-items:flex-end;gap:3px;height:36px;">
      ${distrib.map((d, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <div style="width:16px;height:${count ? Math.max(3, Math.round(d / maxD * 28)) : 3}px;background:${count && d ? (i < 2 ? '#FECACA' : i < 4 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};border-radius:3px;${count ? '' : 'opacity:.4;'}"></div>
        <span style="font-size:8px;color:var(--text-muted);">${d || ''}</span>
      </div>`).join('')}
    </div>`;

    const btns = [0,1,2,3,4,5].map(n => `
      <button onclick="_confVote('${tid}',${n})"
        class="sc-mood-btn"
        title="${n} - ${labels[n]}">${fists[n]}</button>`
    ).join('');

    const actions = count ? `
      <button onclick="_confUndo('${tid}')" class="sc-action-btn-sm" title="Annuler le dernier vote">↩</button>
      <button onclick="_confReset('${tid}')" class="sc-action-btn-sm" title="Réinitialiser">✕</button>` : '';

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
      <input type="text" value="${note}" placeholder="Commentaire / risque identifié…"
        onchange="_confNote('${tid}',this.value)"
        style="width:100%;border:none;border-top:1px solid var(--border);background:transparent;padding:5px 0 0;font-size:11px;color:var(--text-muted);font-style:italic;outline:none;margin-top:6px;">
    </div>`;
  }).join('');

  // Global average
  const allVotes = teams.flatMap(t => { const v = vd[_voteKey(t)]; return Array.isArray(v) ? v : []; });
  const totalV   = allVotes.length;
  const gAvg     = totalV ? Math.round(allVotes.reduce((s, v) => s + v, 0) / totalV * 10) / 10 : null;
  const teamsV   = teams.filter(t => { const v = vd[_voteKey(t)]; return Array.isArray(v) && v.length; }).length;
  const gColor   = gAvg === null ? 'var(--text-muted)' : gAvg < 2 ? '#DC2626' : gAvg < 3.5 ? '#D97706' : '#16A34A';
  const gBg      = gAvg === null ? 'var(--bg)' : gAvg < 2 ? '#FEF2F2' : gAvg < 3.5 ? '#FFFBEB' : '#F0FDF4';

  const avgBadge = gAvg !== null
    ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:8px;background:${gBg};margin-left:auto;">
        <span style="font-size:16px;font-weight:900;color:${gColor};">${gAvg}</span><span style="font-size:10px;color:${gColor};font-weight:600;">/5</span>
        <span style="font-size:10px;color:var(--text-muted);">${totalV} vote${totalV > 1 ? 's' : ''} · ${teamsV}/${teams.length} équipe${teams.length > 1 ? 's' : ''}</span>
      </div>`
    : '';

  el.innerHTML = `<div class="mood-panel">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:14px;font-weight:700;color:var(--text);">🗳️ Vote de confiance PI Objectives</span>
      ${avgBadge}
      <button onclick="_toggleVotePanel()" style="margin-left:${gAvg !== null ? '8px' : 'auto'};border:none;background:none;font-size:16px;cursor:pointer;color:var(--text-muted);">✕</button>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Échelle : ✊ 0 (pas confiant) → 🖐️ 5 (très confiant)</div>
    <div style="display:flex;flex-direction:column;gap:6px;">${cards}</div>
  </div>`;
}

// Board view mode - 'columns' | 'deadlines' | 'list'
let _boardViewMode = localStorage.getItem('board_view_mode') || 'columns';

// Quick-filter state (improvement #9) - persisted in localStorage
let _scrumFilter     = localStorage.getItem('sqf_filter') || null;
let _scrumTextFilter = localStorage.getItem('sqf_text')   || '';
let _scrumTypeFilter = localStorage.getItem('sqf_type')   || '';
let _scrumAssignee   = localStorage.getItem('sqf_assignee') || '';
let _scrumEpicFilter = localStorage.getItem('sqf_epic')   || '';

// Standalone sidebar progress - callable from any view / init
function _renderSidebarProgress() {
  const sbWrap = document.getElementById('sb-progress-wrap');
  if (!sbWrap) return;
  const tickets  = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const done     = tickets.filter(t => isDone(t.status));
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
  const sbBufDone = bufferTk.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
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
  const done    = tickets.filter(t => isDone(t.status));
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
  const startShort = s.startDate ? s.startDate.replace(/\s+\d{4}$/, '') : '-';
  const endFull    = s.endDate   || '-';
  if (_el('sprint-name'))     _el('sprint-name').textContent     = s.label || '-';
  if (_el('sprint-dates'))    _el('sprint-dates').textContent    = s.startDate ? `${startShort} – ${endFull}` : '-';
  if (_el('sprint-velocity')) _el('sprint-velocity').textContent = ptsTotal + ' pts';
  // Buffer visualization in progress bar
  const bufTickets   = tickets.filter(t => t.buffer);
  const bufDonePts   = bufTickets.filter(t => isDone(t.status)).reduce((a, t) => a + (t.points || 0), 0);
  const bufTotalPts  = bufTickets.reduce((a, t) => a + (t.points || 0), 0);
  const featDonePts  = ptsDone - bufDonePts;
  const featPct      = ptsTotal > 0 ? Math.round(featDonePts / ptsTotal * 100) : 0;
  const bufDonePct   = ptsTotal > 0 ? Math.round(bufDonePts / ptsTotal * 100) : 0;

  // WIP fill (inprog + review + test) - shown after done, before remaining
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
  if (_el('topbar-title')) _el('topbar-title').textContent = `📋 Vue Scrum - ${s.label || 'Sprint actif'}${_ctxLabel ? ` · ${_ctxLabel}` : ''}`;

  // Stat cards
  const bufferAll  = tickets.filter(t => t.buffer);
  const bufferPtsS = bufferAll.reduce((a, t) => a + (t.points || 0), 0);
  // Vélocité cumulée du PI en cours
  const _piNum = (() => {
    const m = (s.label || '').match(/(\d+)\.\d+/);
    return m ? m[1] : null;
  })();
  let piVelocity = null;
  if (_piNum) {
    const activeTeams = getActiveTeams();
    const piRegex = new RegExp('\\b' + _piNum + '\\.\\d+');
    let piHistSum = 0;
    activeTeams.forEach(tid => {
      const hist = CONFIG.teams[tid]?.velocityHistory || [];
      hist.forEach(h => { if (piRegex.test(h.name)) piHistSum += (h.velocity || 0); });
    });
    piVelocity = piHistSum + ptsDone; // sprints passés du PI + sprint courant
  }

  const statCards = [
    { num: ptsDone,                       lbl: 'Points Terminés', color: '#10B981', filter: 'done',    title: 'Tickets terminés' },
    { num: ptsRem,                        lbl: 'Points Restants', color: '#F59E0B', filter: 'remaining', title: 'Tickets restants' },
    { num: inprog.length + review.length, lbl: 'En Cours',        color: '#3B82F6', filter: 'inprog',  title: 'Tickets en cours' },
    { num: blocked.length,                lbl: 'Bloqués',         color: '#EF4444', filter: 'blocked', title: 'Tickets bloqués' },
  ];
  if (piVelocity !== null) {
    statCards.push({ num: piVelocity, lbl: `Vélocité PI${_piNum}`, color: '#7C3AED', filter: null, title: `Vélocité cumulée du PI ${_piNum} (sprints passés + courant)` });
  }
  if (bufferAll.length) {
    statCards.push({ num: bufferPtsS, lbl: '🛡️ Buffer', color: '#22C55E', filter: 'buffer', title: 'Tickets buffer (20%)' });
  }
  document.getElementById('scrum-stats').innerHTML = statCards.map(s => {
    const clickable = s.num > 0 && s.filter;
    return `<div class="stat-card${clickable ? ' stat-card--clickable' : ''}"${clickable ? ` onclick="_showScrumStatDetail('${s.filter}')" title="Voir : ${s.title}"` : (s.title ? ` title="${s.title}"` : '')}><div class="num" style="color:${s.color}">${s.num}</div><div class="lbl">${s.lbl}</div></div>`;
  }).join('');

  _renderScrumRisks(tickets, blocked);
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

// ============================================================
// Risques & Bloqués - sous les stat cards
// ============================================================

function _renderScrumRisks(tickets, blocked) {
  const el = document.getElementById('scrum-risks');
  if (!el) return;

  const items = [];

  // Blocked tickets
  if (blocked.length) {
    items.push(...blocked.map(t => ({
      icon: '🚧',
      color: '#DC2626',
      label: `${t.id} - ${(t.title || '').slice(0, 60)}`,
      sub: t.assignee ? t.assignee.split(' ')[0] : 'Non assigné',
      tid: t.id,
    })));
  }

  // Flagged tickets
  const flagged = tickets.filter(t => t.flagged && !isDone(t.status));
  flagged.forEach(t => {
    if (blocked.some(b => b.id === t.id)) return; // already shown
    items.push({ icon: '🚩', color: '#DC2626', label: `${t.id} - ${(t.title || '').slice(0, 60)}`, sub: 'Flaggé', tid: t.id });
  });

  // Unassigned active tickets
  const unassigned = tickets.filter(t => !t.assignee && !isDone(t.status) && t.status !== 'backlog');
  if (unassigned.length) {
    items.push({ icon: '👤', color: '#F59E0B', label: `${unassigned.length} ticket${unassigned.length > 1 ? 's' : ''} non assigné${unassigned.length > 1 ? 's' : ''}`, tickets: unassigned });
  }

  // Sprint end approaching
  const s = _activeSprintCtx();
  if (s.endDate) {
    const now = new Date();
    const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end - now) / 86400000);
    const notDone = tickets.filter(t => !isDone(t.status)).length;
    const total = tickets.length;
    const pctDone = total ? Math.round((total - notDone) / total * 100) : 0;
    if (daysLeft <= 3 && pctDone < 70) {
      items.push({ icon: '⏰', color: '#F59E0B', label: `Fin de sprint dans ${daysLeft}j - ${pctDone}% terminé (${notDone} restant${notDone > 1 ? 's' : ''})` });
    }
  }

  // Critical/high not done
  const critical = tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && !isDone(t.status));
  if (critical.length) {
    items.push({ icon: '🔴', color: '#F59E0B', label: `${critical.length} ticket${critical.length > 1 ? 's' : ''} critique${critical.length > 1 ? 's' : ''}/haute priorité non terminé${critical.length > 1 ? 's' : ''}`, tickets: critical });
  }

  if (!items.length) { el.innerHTML = ''; return; }

  el.innerHTML = `<div class="scrum-risks-bar">
    ${items.map(it => {
      if (it.tid) {
        return `<div class="scrum-risk-item" style="--risk-c:${it.color};" onclick="openModal('${it.tid}')" title="Voir le ticket">
          <span class="scrum-risk-icon">${it.icon}</span>
          <span class="scrum-risk-label">${it.label}</span>
          <span class="scrum-risk-sub">${it.sub || ''}</span>
        </div>`;
      }
      if (it.tickets) {
        return `<div class="scrum-risk-item" style="--risk-c:${it.color};cursor:default;">
          <span class="scrum-risk-icon">${it.icon}</span>
          <span class="scrum-risk-label">${it.label}</span>
        </div>`;
      }
      return `<div class="scrum-risk-item" style="--risk-c:${it.color};cursor:default;">
        <span class="scrum-risk-icon">${it.icon}</span>
        <span class="scrum-risk-label">${it.label}</span>
      </div>`;
    }).join('')}
  </div>`;
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
    linkEl.textContent = s.label || '-';
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

  // Dates sprint - format "06 mar. → 19 mar. 2026"
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


// ============================================================
// DAILY ACTIVITY - snapshot + changelog for PO checklist
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
  const avatarColor = MEMBER_COLORS[authorName] || CLR.slate;
  let transitionHtml;
  if (c.kind === 'status') {
    const fromS = _mapStatus(c.from) || c.from;
    const toS   = _mapStatus(c.to) || c.to;
    transitionHtml = `<span class="badge badge-${fromS}" style="font-size:10px;">${statusLabel(fromS)}</span><span class="da-arrow">→</span><span class="badge badge-${toS}" style="font-size:10px;">${statusLabel(toS)}</span>`;
  } else {
    transitionHtml = `<span class="da-field-badge">${_daFieldLabel(c.field)}</span><span class="da-field-val" title="${c.from || '-'}">${c.from || '-'}</span><span class="da-arrow">→</span><span class="da-field-val" title="${c.to || '-'}">${c.to || '-'}</span>`;
  }
  const mappedTo = c.kind === 'status' ? (_mapStatus(c.to) || c.to) : '';
  return `<div class="da-row${isDone(mappedTo) ? ' da-done' : ''}${c.kind === 'field' ? ' da-field' : ''}" onclick="openModal('${c.id}')">
    <span class="da-time">${c.time}</span>
    <span class="da-transition">${transitionHtml}</span>
    <span class="da-ticket">
      <span class="da-ticket-id">${_jiraBrowse(c.id)}</span>
      <span class="da-ticket-title">${c.title}</span>
    </span>
    <span class="da-assignee" title="${authorName}">
      ${avatarBadge(authorName, avatarColor, {w:20, fs:'9px'})}
    </span>
  </div>`;
}

function _daSummary(changes) {
  const sc = changes.filter(c => c.kind === 'status');
  const fc = changes.filter(c => c.kind === 'field');
  const done = sc.filter(c => { const s = _mapStatus(c.to) || c.to; return isDone(s); }).length;
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

  // Get or create container - placed after scrum-quick-filters
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

// Get support tickets for active teams, mapped to board-compatible status
// Sources: SUPPORT_TICKETS + support-type tickets from TICKETS (deduped)
function _getSupportTicketsForBoard() {
  const teams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const seen = new Set();
  const result = [];
  // 1) From SUPPORT_TICKETS (canonical source, status open/done)
  const st = typeof SUPPORT_TICKETS !== 'undefined' ? SUPPORT_TICKETS : [];
  st.filter(t => !teams.length || teams.includes(t.team)).forEach(t => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    result.push({ ...t, _origStatus: t.status, status: t._boardStatus || (t.status === 'done' ? 'done' : 'todo'), points: t.points || 0 });
  });
  // 2) From TICKETS — support/incident type tickets that slipped into the sprint
  TICKETS.filter(t => ['support','incident'].includes(t.type))
    .filter(t => !teams.length || teams.includes(t.team)).forEach(t => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    result.push({ ...t });
  });
  return result;
}

// Set of support ticket IDs currently shown in the support swimlane
// Used to exclude them from the main board grid
let _supportTicketIds = new Set();

// Swimlane collapse state - support
let _supportLaneCollapsed = localStorage.getItem('support_lane_collapsed') === 'true';

window._toggleSupportLane = function() {
  _supportLaneCollapsed = !_supportLaneCollapsed;
  localStorage.setItem('support_lane_collapsed', _supportLaneCollapsed);
  if (typeof currentView !== 'undefined' && currentView === 'kanban') { renderKanban(); return; }
  renderBoard(getTickets());
};

function _renderBoardColumns(filtered) {
  // Build columns dynamically from JIRA board configuration
  const cols = getBoardColumns(filtered);

  // Support tickets swimlane (collect first to exclude from main grid)
  const supportTickets = _getSupportTicketsForBoard();
  _supportTicketIds = new Set(supportTickets.map(t => t.id));

  // Separate task tickets with specific labels into their own swimlane
  // Exclude support-type tickets from main grid (they go in the support swimlane)
  const _isSwimlaneTache = (t) => t.type === 'tache' && Array.isArray(t.labels) &&
    t.labels.some(l => l.includes('onboarding') || l.includes('actionretro'));
  const _isSupport = (t) => _supportTicketIds.has(t.id) || ['support','incident'].includes(t.type);
  const taskTickets  = filtered.filter(t => _isSwimlaneTache(t) && !_isSupport(t));
  const otherTickets = filtered.filter(t => !_isSwimlaneTache(t) && !_isSupport(t));

  const board = document.getElementById('scrum-board');
  board.className = 'board board-with-lanes';

  // Count tickets per column (for headers + swimlane empty state)
  const colCounts = {};
  cols.forEach(col => {
    colCounts[col.key] = otherTickets.filter(t =>
      t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')
    ).length;
  });

  // Build grid template: empty columns shrink, others fill equally
  const gridCols = cols.map(col => colCounts[col.key] ? 'minmax(240px,1fr)' : 'minmax(110px,auto)').join(' ');

  // Sticky header bar
  const stickyHtml = `<div class="board-sticky-bar" style="grid-template-columns:${gridCols}">${cols.map(col => {
    const empty = !colCounts[col.key];
    const cat = statusCat(col.key);
    return `<div class="col-header${empty ? ' col-empty-state' : ''}" data-cat="${cat}" title="${col.label}">
      <div class="col-title"><span class="pi-status-dot" style="background:${col.color};"></span><span class="col-label">${col.label}</span></div>
      <span class="col-count">${colCounts[col.key]}</span>
    </div>`;
  }).join('')}</div>`;

  // Main board
  const mainHtml = cols.map(col => {
    const colTickets = otherTickets.filter(t =>
      t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')
    );
    const empty = !colTickets.length;
    const cat = statusCat(col.key);
    return `<div class="board-col${empty ? ' col-empty-state' : ''}">
      <div class="col-header" data-cat="${cat}" title="${col.label}">
        <div class="col-title"><span class="pi-status-dot" style="background:${col.color};"></span><span class="col-label">${col.label}</span></div>
        <span class="col-count">${colTickets.length}</span>
      </div>
      <div class="col-body">${colTickets.map(t => ticketCard(t)).join('')}</div>
    </div>`;
  }).join('');

  // Task swimlane (integrated inside main grid)
  let taskLaneHtml = '';
  if (taskTickets.length) {
    const arrow = _taskLaneCollapsed ? '▶' : '▼';
    taskLaneHtml = `<div class="board-lane-header" onclick="_toggleTaskLane()">
        <span class="swimlane-arrow">${arrow}</span>
        <span class="swimlane-icon" style="color:var(--tache);">●</span>
        <span class="swimlane-title">Tâches</span>
        <span class="col-count">${taskTickets.length}</span>
        <span class="swimlane-hint">Rétros · Onboarding · Actions</span>
      </div>`
      + (!_taskLaneCollapsed ? (() => { const _seen = new Set(); return cols.map(col => {
        const colT = taskTickets.filter(t => {
          if (_seen.has(t.id)) return false;
          if (t.status === col.key || (col.key === 'inprog' && t.status === 'blocked')) { _seen.add(t.id); return true; }
          return false;
        });
        return `<div class="board-col board-col-lane board-col-lane-task${!colT.length ? ' col-empty-state' : ''}">
          <div class="col-body">${colT.map(t => ticketCard(t)).join('') || '<div class="col-empty"></div>'}</div>
        </div>`;
      }).join(''); })() : '');
  }

  // Support swimlane (integrated inside main grid)
  let supportLaneHtml = '';
  if (supportTickets.length) {
    const arrow = _supportLaneCollapsed ? '▶' : '▼';
    const openCnt = supportTickets.filter(t => !isDone(t.status)).length;
    supportLaneHtml = `<div class="board-lane-header" onclick="_toggleSupportLane()">
        <span class="swimlane-arrow">${arrow}</span>
        <span class="swimlane-icon" style="color:var(--support, #F59E0B);">●</span>
        <span class="swimlane-title">Support</span>
        <span class="col-count">${supportTickets.length}</span>
        <span class="swimlane-hint">${openCnt} ouvert${openCnt > 1 ? 's' : ''} · Incidents & demandes</span>
      </div>`
      + (!_supportLaneCollapsed ? (() => { const _seen = new Set(); return cols.map(col => {
        const colT = supportTickets.filter(t => {
          if (_seen.has(t.id)) return false;
          if (t.status === col.key) { _seen.add(t.id); return true; }
          return false;
        });
        return `<div class="board-col board-col-lane board-col-lane-support${!colT.length ? ' col-empty-state' : ''}">
          <div class="col-body">${colT.map(t => ticketCard(t)).join('') || '<div class="col-empty"></div>'}</div>
        </div>`;
      }).join(''); })() : '');
  }

  board.innerHTML = stickyHtml + `<div class="board-main-grid" style="grid-template-columns:${gridCols}">${mainHtml}${taskLaneHtml}${supportLaneHtml}</div>`;

  // Sync sticky bar horizontal scroll with main grid
  const stickyBar = board.querySelector('.board-sticky-bar');
  const mainGrid = board.querySelector('.board-main-grid');
  if (stickyBar && mainGrid) {
    mainGrid.addEventListener('scroll', () => { stickyBar.scrollLeft = mainGrid.scrollLeft; });
  }
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
    if (isDone(t.status)) return; // skip done tickets in deadline view
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
  const doneTickets = filtered.filter(t => isDone(t.status));
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
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const isBlocked   = t.status === 'blocked';
  const isFlagged   = !!t.flagged;
  const extraCls    = isBlocked ? ' blocked' : isFlagged ? ' flagged' : '';
  return `<div class="ticket-card type-${t.type}${extraCls}" onclick="openModal('${t.id}')" data-ticket-id="${t.id}" style="flex-direction:row;align-items:center;gap:8px;padding:8px 10px;">
    <span style="font-size:11px;color:var(--text-muted);min-width:45px;flex-shrink:0;">${dateStr}</span>
    <span class="badge badge-${t.status}" style="font-size:10px;flex-shrink:0;">${statusLabel(t.status)}</span>
    <span class="ticket-prio-key">${priorityIcon(t.priority)}<span class="ticket-key">${_jiraBrowse(t.id)}</span></span>
    <span class="sc-truncate-sm">${t.title}</span>
    ${epicTag(epic, t.epic)}
    ${ptsBadge(t.points, {size:'small'})}
    ${avatarBadge(t.assignee, avatarColor, {w:22, fs:'9px'})}
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
      const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
      const _tkDone = isDone(t.status);
      const rowCls = t.status === 'blocked' ? ' bl-blocked' : t.flagged ? ' bl-flagged' : t.buffer ? ' bl-buffer' : '';
      let ddStr = '';
      if (t.dueDate) {
        const dd = new Date(t.dueDate.length === 10 ? t.dueDate + 'T00:00:00' : t.dueDate);
        if (!isNaN(dd)) ddStr = dd.toLocaleDateString('fr-FR', {day:'numeric',month:'short'});
      }
      return `<div class="bl-row${rowCls}${_tkDone ? ' bl-done' : ''}" onclick="openModal('${t.id}')" data-ticket-id="${t.id}">
        <span class="bl-cell" style="width:30px;">${priorityIcon(t.priority)}</span>
        <span class="bl-cell bl-key" style="width:70px;">${_jiraBrowse(t.id)}</span>
        <span class="bl-cell bl-title" style="flex:1;">${t.title}</span>
        <span class="bl-cell" style="width:75px;"><span class="badge badge-${t.type}" style="font-size:10px;">${typeName(t.type)}</span></span>
        <span class="bl-cell" style="width:80px;"><span class="badge badge-${t.status}" style="font-size:10px;">${statusLabel(t.status)}</span></span>
        <span class="bl-cell" style="width:55px;">${ptsBadge(t.points, {size:'small'})}</span>
        <span class="bl-cell" style="width:80px;font-size:11px;color:var(--text-muted);">${ddStr}</span>
        <span class="bl-cell" style="width:110px;">${epicTag(epic, t.epic)}</span>
        <span class="bl-cell" style="width:32px;">${avatarBadge(t.assignee, avatarColor, {w:22, fs:'9px'})}</span>
      </div>`;
    }).join('')}`;
}

function _showScrumBlockedDetail() { _showScrumStatDetail('blocked'); }

function _showScrumStatDetail(filter) {
  const all = getTickets();
  const cfg = {
    done:      { icon: '✅', label: 'Tickets terminés',  list: all.filter(t => isDone(t.status)) },
    remaining: { icon: '🔶', label: 'Tickets restants',  list: all.filter(t => !isDone(t.status)) },
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
    const c = CONFIG.typeColors[type] || CLR.dark;
    return `<span class="sc-type-pill" style="background:${c}18;border:1px solid ${c}40;color:${c};">${typeName(type)} ×${byType[type].length}</span>`;
  }).join('');

  // Points total
  const totalPts = cfg.list.reduce((a, t) => a + (t.points || 0), 0);

  document.getElementById('modal-title').innerHTML = `${cfg.icon} ${cfg.label} <span style="font-size:14px;font-weight:400;color:#94A3B8;">(${cfg.list.length} · ${totalPts} pts)</span>`;
  document.getElementById('modal-body').innerHTML = `
    <div class="sc-pills-bar">${typePills}</div>
    ${cfg.list.map(t => {
      const epic        = EPICS.find(e => e.id === t.epic);
      const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
      const _tkDone     = isDone(t.status);
      const strike      = _tkDone ? 'text-decoration:line-through;opacity:.5;' : '';
      const flagBadge   = t.flagged ? '<span class="sc-flag-badge">🚩</span>' : '';
      const rowBg = t.flagged ? 'background:#FEF2F2;' : t.buffer ? 'background:#F0FDF4;' : '';
      return `<div class="sc-ticket-row" style="${rowBg}${_tkDone ? 'opacity:.6;' : ''}" onclick="closeModalDirect();openModal('${t.id}')">
        ${flagBadge}
        <span style="flex-shrink:0;width:20px;text-align:center;">${priorityIcon(t.priority)}</span>
        <span class="badge badge-${t.type}" style="white-space:nowrap;flex-shrink:0;">${typeName(t.type)}</span>
        <span class="sc-truncate-title" style="${strike}">${_jiraBrowse(t.id)} - ${t.title}</span>
        <span class="badge badge-${t.status}" style="white-space:nowrap;font-size:10px;flex-shrink:0;">${statusLabel(t.status)}</span>
        ${epicTag(epic, t.epic)}
        ${ptsBadge(t.points)}
        ${avatarBadge(t.assignee, avatarColor)}
      </div>`;
    }).join('')}`;

  window._modalTicketList = [];
  window._modalCurrentIdx = 0;
  if (typeof _updateModalNavButtons === 'function') _updateModalNavButtons();
  document.getElementById('modal-overlay').classList.add('open');
}

function ticketCard(t) {
  const epic        = EPICS.find(e => e.id === t.epic);
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const isBlocked   = t.status === 'blocked';
  const isFlagged   = !!t.flagged;
  const isBuffer    = !!t.buffer;
  const statusBadge = isBlocked
    ? '<span class="sc-flag-badge">⚠ Bloqué</span>'
    : isFlagged ? '<span class="sc-flag-badge">🚩 Flaggé</span>' : '';
  const bufferBadge = isBuffer ? '<span class="buffer-badge">🛡️ Buffer</span>' : '';
  const extraCls    = isBlocked ? ' blocked' : isFlagged ? ' flagged' : isBuffer ? ' buffer' : '';
  // Daily mode: dimmed if not focused, "discussed" badge
  let dailyDim = '';
  let dailyFocus = '';
  if (_dailyActive) {
    if (_dailyMode === 'person') {
      const _pList = _dailyPersonList();
      const _curPerson = _pList[_dailyPersonIdx];
      const isPersonTicket = _curPerson && _curPerson.tickets.some(pt => pt.id === t.id);
      dailyFocus = isPersonTicket ? ' daily-focus-person' : '';
      dailyDim = !isPersonTicket && !isDone(t.status) ? ' daily-dimmed' : '';
    } else {
      dailyDim = _dailyFocusId && _dailyFocusId !== t.id ? ' daily-dimmed' : '';
      dailyFocus = _dailyFocusId === t.id ? ' daily-focus' : '';
    }
  }
  const dailyDone = _dailyActive && _dailyDiscussed.has(t.id) && _dailyFocusId !== t.id ? '<span class="daily-done-badge">✓</span>' : '';
  return `<div class="ticket-card type-${t.type}${extraCls}${dailyDim}${dailyFocus}" onclick="openModal('${t.id}')" data-ticket-id="${t.id}">
    <div class="ticket-top">
      <span class="ticket-prio-key">${priorityIcon(t.priority)}<span class="ticket-key">${_jiraBrowse(t.id)}</span></span>
      ${ptsBadge(t.points, {size:'small'})}
      ${dailyDone}
    </div>
    <div class="ticket-title">${t.title}</div>
    <div class="ticket-meta">
      <span class="badge badge-${t.type}">${typeName(t.type)}</span>
      ${epicTag(epic, t.epic)}
      ${avatarBadge(t.assignee, avatarColor)}
      ${statusBadge}
      ${bufferBadge}
    </div>
  </div>`;
}

// ============================================================
// DAILY MODE - Système complet pour faciliter le daily standup
// 3 modes : Walk the Board, Vue par Personne, + Parking Lot
// ============================================================

let _dailyActive   = false;
let _dailyMode     = 'board';        // 'board' | 'person' - restored per team from localStorage
let _dailyFocusId  = null;           // ticket id currently focused
let _dailyFocusIdx = -1;             // index in ordered list
let _dailyDiscussed = new Set();     // tickets already discussed
let _dailyTimer    = null;           // interval id
let _dailyStartMs  = 0;             // global timer start
let _dailyTicketMs = 0;             // per-ticket timer start
let _dailyPersonIdx = 0;            // current person index (person mode)
let _dailyPersonStartMs = 0;        // per-person timer start
let _dailyParkingLot = [];          // parking lot items

// Ordered ticket list for walk-the-board (right to left: blocked → review → inprog → todo)
function _dailyBoardOrder() {
  const tickets = getTickets().filter(t => !isDone(t.status));
  const order = ['blocked', 'review', 'inprog', 'todo'];
  return tickets.sort((a, b) => {
    const ai = order.indexOf(a.status); const bi = order.indexOf(b.status);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    // Within same status: high priority first
    const prio = { critical: 0, high: 1, medium: 2, low: 3 };
    return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
  });
}

// Ordered person list for person mode
// Seeded shuffle - deterministic per day, different each day
function _dailyShuffle(arr) {
  const d = new Date();
  let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 16807 + 11) % 2147483647; // LCG
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function _dailyPersonList() {
  const tickets = getTickets().filter(t => !isDone(t.status));
  const members = [...new Set(tickets.map(t => t.assignee).filter(Boolean))].sort();
  // Shuffle based on today's date - stable within a day, different each day
  const shuffled = _dailyShuffle(members);
  // Add "Non assigné" at the end if any
  if (tickets.some(t => !t.assignee)) shuffled.push(null);
  return shuffled.map(m => ({
    name: m || 'Non assigné',
    tickets: tickets.filter(t => (t.assignee || null) === m)
      .sort((a, b) => {
        const order = ['blocked', 'review', 'inprog', 'todo'];
        return (order.indexOf(a.status) ?? 99) - (order.indexOf(b.status) ?? 99);
      }),
  }));
}

// ---- Toggle daily mode ON/OFF ----
window._dailyToggle = function() {
  _dailyActive = !_dailyActive;
  if (_dailyActive) {
    // Restore per-team daily mode from localStorage
    const savedMode = localStorage.getItem('daily_mode_' + (currentTeam || 'all'));
    if (savedMode === 'board' || savedMode === 'person') _dailyMode = savedMode;
    document.body.classList.add('daily-active');
    _dailyDiscussed = new Set();
    _dailyFocusId = null;
    _dailyFocusIdx = -1;
    _dailyStartMs = Date.now();
    _dailyTicketMs = 0;
    _dailyPersonIdx = 0;
    _dailyPersonStartMs = Date.now();
    _dailyParkingLot = JSON.parse(localStorage.getItem('daily_parking') || '[]');
    _dailyFinishShown = false;
    _dailyTimer = setInterval(_dailyUpdateTimers, 1000);
    // Auto-focus first ticket in board mode
    if (_dailyMode === 'board') {
      const ordered = _dailyBoardOrder();
      if (ordered.length) { _dailyFocusIdx = 0; _dailyFocusId = ordered[0].id; _dailyTicketMs = Date.now(); }
    }
  } else {
    document.body.classList.remove('daily-active');
    clearInterval(_dailyTimer);
    _dailyTimer = null;
    _dailyFocusId = null;
  }
  renderBoard(getTickets());
  _dailyRenderPanel();
};

// ---- Switch daily sub-mode ----
window._dailySetMode = function(mode) {
  _dailyMode = mode;
  localStorage.setItem('daily_mode_' + (currentTeam || 'all'), mode);
  if (mode === 'person') { _dailyPersonIdx = 0; _dailyPersonStartMs = Date.now(); _dailyFocusId = null; }
  if (mode === 'board') {
    const ordered = _dailyBoardOrder();
    _dailyFocusIdx = _dailyDiscussed.size < ordered.length ? 0 : -1;
    _dailyFocusId = ordered[_dailyFocusIdx]?.id || null;
    _dailyTicketMs = Date.now();
  }
  renderBoard(getTickets());
  _dailyRenderPanel();
};

// ---- Navigate tickets (board mode) ----
window._dailyNext = function() {
  if (_dailyMode === 'person') { _dailyNextPerson(); return; }
  const ordered = _dailyBoardOrder();
  if (!ordered.length) return;
  // Mark current as discussed
  if (_dailyFocusId) _dailyDiscussed.add(_dailyFocusId);
  _dailyFocusIdx++;
  if (_dailyFocusIdx >= ordered.length) {
    _dailyFocusId = null; _dailyFocusIdx = ordered.length;
    _dailyRenderPanel(); renderBoard(getTickets()); _dailyShowFinish(); return;
  }
  _dailyFocusId = ordered[_dailyFocusIdx].id;
  _dailyTicketMs = Date.now();
  renderBoard(getTickets());
  _dailyRenderPanel();
  _dailyScrollToFocus();
};

window._dailyPrev = function() {
  if (_dailyMode === 'person') { _dailyPrevPerson(); return; }
  const ordered = _dailyBoardOrder();
  if (_dailyFocusIdx > 0) {
    _dailyFocusIdx--;
    _dailyFocusId = ordered[_dailyFocusIdx].id;
    _dailyTicketMs = Date.now();
  }
  renderBoard(getTickets());
  _dailyRenderPanel();
  _dailyScrollToFocus();
};

// ---- Navigate persons (person mode) ----
let _dailyFinishShown = false;

function _dailyNextPerson() {
  const persons = _dailyPersonList();
  if (_dailyPersonIdx < persons.length - 1) {
    persons[_dailyPersonIdx].tickets.forEach(t => _dailyDiscussed.add(t.id));
    _dailyPersonIdx++;
    _dailyPersonStartMs = Date.now();
  } else if (_dailyPersonIdx === persons.length - 1 && !_dailyFinishShown) {
    // Last person done
    persons[_dailyPersonIdx].tickets.forEach(t => _dailyDiscussed.add(t.id));
    renderBoard(getTickets());
    _dailyRenderPanel();
    _dailyShowFinish();
    return;
  }
  renderBoard(getTickets());
  _dailyRenderPanel();
}

function _dailyPrevPerson() {
  if (_dailyPersonIdx > 0) { _dailyPersonIdx--; _dailyPersonStartMs = Date.now(); }
  renderBoard(getTickets());
  _dailyRenderPanel();
}

// ---- Parking lot ----
let _dailyParkingOpen = false;

window._dailyToggleParking = function() {
  _dailyParkingOpen = !_dailyParkingOpen;
  _dailyRenderPanel();
};

window._dailyAddParking = function() {
  const input = document.getElementById('daily-parking-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  // Resolve assignee from focused ticket
  const focusTicket = _dailyFocusId ? getTickets().find(t => t.id === _dailyFocusId) : null;
  const assignee = focusTicket?.assignee || null;
  // In person mode, use current person
  let person = assignee;
  if (_dailyMode === 'person') {
    const persons = _dailyPersonList();
    person = persons[_dailyPersonIdx]?.name || assignee;
  }
  _dailyParkingLot.push({ text, time: _dailyElapsed(_dailyStartMs), ticket: _dailyFocusId || null, assignee: person });
  input.value = '';
  localStorage.setItem('daily_parking', JSON.stringify(_dailyParkingLot));
  _dailyRenderPanel();
};

window._dailyRemoveParking = function(i) {
  _dailyParkingLot.splice(i, 1);
  localStorage.setItem('daily_parking', JSON.stringify(_dailyParkingLot));
  _dailyRenderPanel();
};

window._dailyCopyParking = function() {
  if (!_dailyParkingLot.length) return;
  const allTickets = getTickets();
  let slack = `[DAILY] 🅿️ Parking Lot - Daily ${new Date().toLocaleDateString('fr-FR')}\n\n`;
  _dailyParkingLot.forEach((p, i) => {
    slack += `${i + 1}. 🔳 ${p.text}`;
    if (p.assignee) slack += ` - @${p.assignee.replace(' ', '-')}`;
    if (p.ticket) {
      const t = allTickets.find(x => x.id === p.ticket);
      const url = typeof _jiraBrowseUrl === 'function' ? _jiraBrowseUrl(p.ticket) : null;
      const title = t?.title || '';
      if (url) {
        slack += ` (<${url}|${p.ticket}>${title ? ' - ' + title : ''})`;
      } else {
        slack += ` (${p.ticket}${title ? ' - ' + title : ''})`;
      }
    }
    slack += `\n`;
  });
  navigator.clipboard.writeText(slack).then(() => showToast('📋 Parking lot copié pour Slack !', 'success'));
};

// Is the tour done? (all tickets discussed or past last person)
function _dailyIsTourDone() {
  if (_dailyMode === 'board') {
    const ordered = _dailyBoardOrder();
    return ordered.length > 0 && _dailyFocusIdx >= ordered.length;
  }
  if (_dailyMode === 'person') {
    const persons = _dailyPersonList();
    return persons.length > 0 && _dailyPersonIdx >= persons.length - 1 && _dailyDiscussed.size > 0;
  }
  return false;
};

// ---- Timers ----
function _dailyElapsed(startMs) {
  const s = Math.floor((Date.now() - startMs) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function _dailyUpdateTimers() {
  const globalEl = document.getElementById('daily-timer-global');
  if (globalEl) globalEl.textContent = _dailyElapsed(_dailyStartMs);
  const ticketEl = document.getElementById('daily-timer-ticket');
  if (ticketEl && _dailyTicketMs) {
    const s = Math.floor((Date.now() - _dailyTicketMs) / 1000);
    ticketEl.textContent = _dailyElapsed(_dailyTicketMs);
    ticketEl.className = 'daily-timer-ticket' + (s > 120 ? ' daily-timer-warn' : '');
  }
  const personEl = document.getElementById('daily-timer-person');
  if (personEl && _dailyPersonStartMs) {
    const s = Math.floor((Date.now() - _dailyPersonStartMs) / 1000);
    personEl.textContent = _dailyElapsed(_dailyPersonStartMs);
    personEl.className = 'daily-timer-person' + (s > 120 ? ' daily-timer-warn' : '');
  }
}

// ---- Scroll to focused ticket ----
function _dailyScrollToFocus() {
  if (!_dailyFocusId) return;
  // If the focused ticket is in the collapsed task swimlane, unfold it
  const t = getTickets().find(x => x.id === _dailyFocusId);
  if (t && _taskLaneCollapsed && t.type === 'tache' && Array.isArray(t.labels) &&
      t.labels.some(l => l.includes('onboarding') || l.includes('actionretro'))) {
    _taskLaneCollapsed = false;
    localStorage.setItem('task_lane_collapsed', 'false');
    renderBoard(getTickets());
  }
  setTimeout(() => {
    const card = document.querySelector(`[data-ticket-id="${_dailyFocusId}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ---- Render the daily control panel ----
function _dailyRenderPanel() {
  let panel = document.getElementById('daily-panel');
  if (!_dailyActive) { if (panel) panel.remove(); return; }

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'daily-panel';
    const alerts = document.getElementById('sprint-alerts');
    if (alerts) alerts.parentNode.insertBefore(panel, alerts.nextSibling);
    else document.getElementById('view-scrum')?.prepend(panel);
  }

  const ordered = _dailyMode === 'board' ? _dailyBoardOrder() : [];
  const persons = _dailyMode === 'person' ? _dailyPersonList() : [];

  // Progress counter: tickets in board mode, persons in person mode
  let progressLabel = '';
  if (_dailyMode === 'board') {
    progressLabel = `${_dailyDiscussed.size} / ${ordered.length}`;
  } else {
    progressLabel = `${_dailyPersonIdx + 1} / ${persons.length}`;
  }

  // Current focus info
  let focusInfo = '';
  if (_dailyMode === 'board' && _dailyFocusId) {
    const t = getTickets().find(x => x.id === _dailyFocusId);
    if (t) {
      const sc = STATUS_HEX;
      focusInfo = `<div class="daily-focus-info">
        <span class="daily-focus-status" style="background:${(sc[t.status] || CLR.muted)}18;color:${sc[t.status] || CLR.muted};border:1px solid ${(sc[t.status] || CLR.muted)}33;">${statusLabel(t.status)}</span>
        <strong>${t.id}</strong> - ${(t.title || '').slice(0, 60)}
        ${t.assignee ? `<span class="daily-focus-assignee">@${t.assignee.split(' ')[0]}</span>` : ''}
        <span id="daily-timer-ticket" class="daily-timer-ticket">${_dailyTicketMs ? _dailyElapsed(_dailyTicketMs) : ''}</span>
      </div>`;
    }
  }

  // Person mode info
  let personInfo = '';
  if (_dailyMode === 'person' && persons.length) {
    const p = persons[_dailyPersonIdx];
    const avatarColor = MEMBER_COLORS[p.name] || CLR.slate;
    const blocked = p.tickets.filter(t => t.status === 'blocked');
    const inprog = p.tickets.filter(t => t.status === 'inprog' || t.status === 'review');
    const todo = p.tickets.filter(t => t.status === 'todo');

    personInfo = `<div class="daily-person-card">
      <div class="daily-person-header">
        ${avatarBadge(p.name, avatarColor, {w:28, fs:'11px'})}
        <strong style="font-size:14px;">${p.name}</strong>
        <span style="font-size:11px;color:var(--text-muted);">${p.tickets.length} ticket${p.tickets.length > 1 ? 's' : ''}</span>
        <span id="daily-timer-person" class="daily-timer-person">${_dailyElapsed(_dailyPersonStartMs)}</span>
      </div>
      <div class="daily-person-tickets">
        ${blocked.length ? `<div class="daily-person-group"><span class="daily-pg-label" style="color:#DC2626">🚧 Bloqué (${blocked.length})</span>${blocked.map(t => _dailyTicketMini(t)).join('')}</div>` : ''}
        ${inprog.length ? `<div class="daily-person-group"><span class="daily-pg-label" style="color:#2563EB">🔄 En cours (${inprog.length})</span>${inprog.map(t => _dailyTicketMini(t)).join('')}</div>` : ''}
        ${todo.length ? `<div class="daily-person-group"><span class="daily-pg-label" style="color:#94A3B8">📋 À faire (${todo.length})</span>${todo.map(t => _dailyTicketMini(t)).join('')}</div>` : ''}
        ${!p.tickets.length ? '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">Aucun ticket en cours</div>' : ''}
      </div>
    </div>`;
  }

  // Person progress dots
  let personDots = '';
  if (_dailyMode === 'person' && persons.length) {
    personDots = `<div class="daily-person-dots">${persons.map((p, i) => {
      const cls = i < _dailyPersonIdx ? 'done' : i === _dailyPersonIdx ? 'current' : '';
      return `<span class="daily-dot ${cls}" title="${p.name}" onclick="_dailyPersonIdx=${i};_dailyPersonStartMs=Date.now();renderBoard(getTickets());_dailyRenderPanel();">${initials(p.name)}</span>`;
    }).join('')}</div>`;
  }

  // Parking lot
  const tourDone = _dailyIsTourDone();
  // Auto-open when tour ends
  const parkingVisible = _dailyParkingOpen || tourDone;
  const parkingCount = _dailyParkingLot.length;
  const parkingArrow = parkingVisible ? '▼' : '▶';

  const parkingHtml = `<div class="daily-parking${tourDone ? ' daily-parking-highlight' : ''}">
    <div class="daily-parking-header" onclick="_dailyToggleParking()" style="cursor:pointer;">
      <span style="font-size:10px;color:var(--text-muted);">${parkingArrow}</span>
      <span style="font-size:13px;">🅿️</span>
      <strong style="font-size:12px;">Parking Lot</strong>
      <span style="font-size:11px;color:var(--text-muted);">${parkingCount} sujet${parkingCount > 1 ? 's' : ''}</span>
      ${tourDone && parkingCount ? `<button class="daily-parking-copy" onclick="event.stopPropagation();_dailyCopyParking()" title="Copier pour Slack">📋 Copier Slack</button>` : ''}
    </div>
    ${parkingVisible ? `
      <div class="daily-parking-input-wrap">
        <input id="daily-parking-input" type="text" placeholder="Sujet à creuser après le daily…" onkeydown="if(event.key==='Enter')_dailyAddParking()">
        <button onclick="_dailyAddParking()">+</button>
      </div>
      ${parkingCount ? `<div class="daily-parking-items">${_dailyParkingLot.map((p, i) =>
        `<div class="daily-parking-item">
          <span class="daily-parking-text">${p.text}</span>
          ${p.assignee ? `<span class="daily-parking-assignee">@${p.assignee}</span>` : ''}
          ${p.ticket ? `<span class="daily-parking-ref">${p.ticket}</span>` : ''}
          <span class="daily-parking-time">${p.time}</span>
          <button class="daily-parking-del" onclick="_dailyRemoveParking(${i})">✕</button>
        </div>`
      ).join('')}</div>` : ''}
    ` : ''}
  </div>`;

  panel.innerHTML = `
    <div class="daily-toolbar">
      <div class="daily-toolbar-left">
        <span style="font-size:16px;">☀️</span>
        <strong style="font-size:13px;">Daily Mode</strong>
        <div class="daily-mode-btns">
          <button class="${_dailyMode === 'board' ? 'active' : ''}" onclick="_dailySetMode('board')" title="Walk the board">▤ Board</button>
          <button class="${_dailyMode === 'person' ? 'active' : ''}" onclick="_dailySetMode('person')" title="Par personne">👤 Personne</button>
        </div>
      </div>
      <div class="daily-toolbar-center">
        <button class="daily-nav-btn" onclick="_dailyPrev()" title="Précédent">◀</button>
        <span class="daily-progress">${progressLabel}</span>
        <button class="daily-nav-btn daily-nav-next" onclick="_dailyNext()" title="Suivant">▶</button>
      </div>
      <div class="daily-toolbar-right">
        <span class="daily-timer-global" id="daily-timer-global">${_dailyElapsed(_dailyStartMs)}</span>
        <button class="daily-end-btn" onclick="_dailyToggle()" title="Terminer le daily">✕ Fin</button>
      </div>
    </div>
    <div class="daily-body">
      <div class="daily-body-main">
        ${focusInfo}
        ${personInfo}
        ${personDots}
      </div>
      <div class="daily-body-parking">
        ${parkingHtml}
      </div>
    </div>
  `;
}

function _dailyTicketMini(t) {
  const sc = STATUS_HEX;
  const color = sc[t.status] || CLR.muted;
  return `<div class="daily-ticket-mini" onclick="openModal('${t.id}')">
    <span style="font-weight:700;color:${color};font-size:11px;">${t.id}</span>
    <span style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title || ''}</span>
    ${t.points ? `<span style="font-size:10px;color:var(--text-muted);font-weight:700;">${t.points}pts</span>` : ''}
  </div>`;
}

// ============================================================
// Daily finish - celebration or encouragement
// ============================================================
function _dailyShowFinish() {
  _dailyFinishShown = true;
  // Stop timers on finish
  if (_dailyTimer) { clearInterval(_dailyTimer); _dailyTimer = null; }
  const elapsedSec = Math.floor((Date.now() - _dailyStartMs) / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedStr = `${elapsedMin}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const underTime = elapsedSec <= 15 * 60;

  // Build parking recap HTML
  const parkingRecap = _dailyParkingLot.length ? `
    <div class="daily-finish-parking">
      <div class="daily-finish-parking-title">🅿️ Parking Lot</div>
      <div class="daily-finish-parking-list">${_dailyParkingLot.map((p, i) =>
        `<div class="daily-finish-parking-item">
          <span>${i + 1}. ${p.text}</span>
          ${p.assignee ? `<span class="daily-parking-assignee">@${p.assignee}</span>` : ''}
          ${p.ticket ? `<span class="daily-parking-ref">${p.ticket}</span>` : ''}
        </div>`
      ).join('')}</div>
      <button class="daily-finish-copy-btn" onclick="event.stopPropagation();_dailyCopyParking();this.textContent='✅ Copié';">📋 Copier pour Slack</button>
    </div>` : '';

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'daily-finish-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  if (underTime) {
    // Confetti animation + celebration
    overlay.innerHTML = `
      <div class="daily-finish-card daily-finish-success">
        <div class="daily-finish-confetti" id="daily-confetti"></div>
        <div class="daily-finish-emoji">🎉</div>
        <div class="daily-finish-title">Daily en ${elapsedStr} !</div>
        <div class="daily-finish-sub">${elapsedMin <= 10 ? 'Impressionnant, ultra-efficace !' : 'Bien joué, dans les temps !'}</div>
        <div class="daily-finish-stats">
          <span>✅ ${_dailyDiscussed.size} tickets</span>
          <span>🅿️ ${_dailyParkingLot.length} parking</span>
        </div>
        ${parkingRecap}
        <div class="daily-finish-actions">
          <button class="daily-finish-btn" onclick="this.closest('.daily-finish-overlay').remove()">Fermer</button>
          <button class="daily-end-btn" onclick="_dailyToggle();this.closest('.daily-finish-overlay').remove()">✕ Fin du daily</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    _dailySpawnConfetti(document.getElementById('daily-confetti'));
  } else {
    // Encouragement
    const overMin = elapsedMin - 15;
    const tips = [
      'Essayez le mode "Walk the Board" pour rester focalisé sur les tickets.',
      'Utilisez le Parking Lot pour reporter les discussions longues.',
      'Limitez-vous à 30 secondes par ticket max.',
      'Commencez par les bloquants, ils sont souvent les plus urgents.',
      'Si un sujet dépasse 1 min, direction le Parking Lot !',
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    overlay.innerHTML = `
      <div class="daily-finish-card daily-finish-overtime">
        <div class="daily-finish-emoji">⏱️</div>
        <div class="daily-finish-title">Daily en ${elapsedStr}</div>
        <div class="daily-finish-sub">${overMin} min au-delà des 15 min - on fera mieux demain !</div>
        <div class="daily-finish-tip">💡 ${tip}</div>
        <div class="daily-finish-stats">
          <span>✅ ${_dailyDiscussed.size} tickets</span>
          <span>🅿️ ${_dailyParkingLot.length} parking</span>
        </div>
        ${parkingRecap}
        <div class="daily-finish-actions">
          <button class="daily-finish-btn" onclick="this.closest('.daily-finish-overlay').remove()">Fermer</button>
          <button class="daily-end-btn" onclick="_dailyToggle();this.closest('.daily-finish-overlay').remove()">✕ Fin du daily</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
}

// Mini confetti burst (pure CSS + JS, no lib)
function _dailySpawnConfetti(container) {
  if (!container) return;
  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('span');
    dot.className = 'daily-confetti-dot';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = 50 + (Math.random() - 0.5) * 80;
    const angle = (Math.random() - 0.5) * 120;
    const dist = 80 + Math.random() * 180;
    const size = 5 + Math.random() * 6;
    const dur = 0.8 + Math.random() * 0.8;
    const delay = Math.random() * 0.3;
    dot.style.cssText = `
      left:${left}%;top:40%;width:${size}px;height:${size}px;background:${color};
      --tx:${angle}px;--ty:${-dist}px;--rot:${Math.random() * 720}deg;
      animation-duration:${dur}s;animation-delay:${delay}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(dot);
  }
}
