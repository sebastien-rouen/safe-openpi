// ============================================================
// MOOD - Team mood / ROTI, vote de confiance, rituals persistence
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

// Key-based vote/undo/reset/note for previous sprints (PI mood)
window._moodVoteKey = function(voteKey, val) {
  const md = _moodData();
  if (!md.votes) md.votes = {};
  if (!Array.isArray(md.votes[voteKey])) md.votes[voteKey] = [];
  md.votes[voteKey].push(val);
  _moodSave();
};

window._moodUndoKey = function(voteKey) {
  const md = _moodData();
  if (Array.isArray(md.votes?.[voteKey]) && md.votes[voteKey].length) {
    md.votes[voteKey].pop();
    _moodSave();
  }
};

window._moodResetKey = function(voteKey) {
  const md = _moodData();
  if (md.votes) md.votes[voteKey] = [];
  if (md.notes) delete md.notes[voteKey];
  _moodSave();
};

window._moodNoteKey = function(voteKey, val) {
  const md = _moodData();
  if (!md.notes) md.notes = {};
  md.notes[voteKey] = val;
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
  const w = 220, h = 40, pad = 14;
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

  const labels = pathPoints.map((p, i) => {
    const short = p.label.replace(/.*Ité\.?\s*/, '').replace(/Sprint\s*/i, 'S');
    const anchor = i === 0 ? 'start' : i === pathPoints.length - 1 ? 'end' : 'middle';
    return `<text x="${p.x.toFixed(1)}" y="${h + 10}" text-anchor="${anchor}" fill="var(--text-muted)" font-size="7">${short}</text>`;
  }).join('');

  const lastP = points[points.length - 1];
  const prevP = points[points.length - 2];
  const delta = lastP.avg - prevP.avg;
  const arrow = delta > 0.2 ? '↗' : delta < -0.2 ? '↘' : '→';
  const trendColor = delta > 0.2 ? CLR.darkGrn : delta < -0.2 ? CLR.red : CLR.amber;

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
  const gBg      = gAvg === null ? 'var(--bg)' : gAvg < 2.5 ? 'var(--danger-bg)' : gAvg < 3.5 ? 'var(--warning-bg)' : 'var(--success-bg)';

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

// ============================================================
// PI PLANNING - Mood Meter section (collapsible, like Fist of Five)
// ============================================================
function _piRenderMoodSection(teams, piNum) {
  if (!teams || !teams.length) teams = Object.keys(CONFIG.teams || {});
  const md     = _moodData();
  const emojis = ['😡', '😟', '😐', '🙂', '😍'];
  const labels = ['', 'Très insatisfait', 'Insatisfait', 'Neutre', 'Satisfait', 'Très satisfait'];

  // Detect if viewing a future PI — use real detected PI, not selected
  const _detPI = typeof _ppDetectPI === 'function' ? _ppDetectPI() : null;
  const _detectedNum = _detPI ? (_detPI.match(/\d+/) || [])[0] || '' : ((CONFIG.sprint.label || '').match(/(\d+)\.\d+/) || [])[1] || '';
  const isFuturePI = piNum && _detectedNum && parseInt(piNum) > parseInt(_detectedNum);

  // Helper: mood row — current sprint gets full voting, other sprints get compact voting
  function _moodRow(tid, voteKey, spLabel, isCurrent) {
    const votes = Array.isArray(md.votes?.[voteKey]) ? md.votes[voteKey] : [];
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const vColor = !count ? '#94A3B8' : avg < 2.5 ? '#DC2626' : avg < 3.5 ? '#D97706' : '#16A34A';
    const note  = (md.notes?.[voteKey] || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeKey = voteKey.replace(/'/g, "\\'");

    if (isCurrent) {
      // Full row for current sprint
      const distrib = [1,2,3,4,5].map(n => votes.filter(v => v === n).length);
      const maxD = Math.max(...distrib, 1);
      const distribHtml = `<div class="pi-mood-distrib">
        ${distrib.map((d, i) => `<div class="pi-mood-distrib-col">
          <div class="pi-mood-distrib-bar" style="height:${count ? Math.max(3, Math.round(d / maxD * 28)) : 3}px;background:${count && d ? (i < 2 ? '#FECACA' : i === 2 ? '#FEF3C7' : '#D1FAE5') : 'var(--border)'};${count ? '' : 'opacity:.4;'}"></div>
          <span class="pi-mood-distrib-count">${d || ''}</span>
        </div>`).join('')}
      </div>`;

      const btns = [1,2,3,4,5].map(n =>
        `<button onclick="_moodVote('${tid}',${n});_piRefreshMood()" class="sc-mood-btn" title="${n} - ${labels[n]}">${emojis[n-1]}</button>`
      ).join('');

      const actions = count ? `
        <button onclick="_moodUndo('${tid}');_piRefreshMood()" class="sc-action-btn-sm" title="Annuler le dernier vote">↩</button>
        <button onclick="_moodReset('${tid}');_piRefreshMood()" class="sc-action-btn-sm" title="Réinitialiser">✕</button>` : '';

      return `<div class="pi-mood-card-row">
        <div class="pi-mood-avg">
          <span class="pi-mood-avg-val" style="color:${vColor};">${count ? avg : '—'}</span>
          <span class="pi-mood-avg-max" style="color:${vColor};">/5</span>
        </div>
        ${distribHtml}
        <div class="pi-mood-btns">${btns}</div>
        ${count ? `<span class="pi-mood-count">${count} vote${count > 1 ? 's' : ''}</span>` : ''}
        <div class="pi-mood-actions">${actions}</div>
      </div>
      <input type="text" value="${note}" placeholder="Note / commentaire…"
        onchange="_moodNote('${tid}',this.value);_piRefreshMood()"
        class="pi-mood-note">`;
    }

    // Compact row for other sprints — with voting buttons
    const emoji = !count ? '—' : avg >= 4 ? '😍' : avg >= 3 ? '🙂' : avg >= 2 ? '😟' : '😡';
    const compactBtns = [1,2,3,4,5].map(n =>
      `<button onclick="_moodVoteKey('${safeKey}',${n});_piRefreshMood()" class="sc-mood-btn sc-mood-btn-sm" title="${n} - ${labels[n]}">${emojis[n-1]}</button>`
    ).join('');

    // Always render all elements with fixed widths — placeholders when empty to avoid layout shift
    return `<div class="pi-mood-prev-row">
      <span class="pi-mood-prev-label">${spLabel}</span>
      <span class="pi-mood-prev-emoji">${emoji}</span>
      <span class="pi-mood-prev-avg" style="color:${vColor};">${count ? avg : '—'}</span>
      <span class="pi-mood-prev-avg-max">/5</span>
      <span class="pi-mood-prev-count">${count ? `${count} vote${count > 1 ? 's' : ''}` : ''}</span>
      <div class="pi-mood-prev-btns">${compactBtns}</div>
      <div class="pi-mood-prev-actions">
        <button onclick="_moodUndoKey('${safeKey}');_piRefreshMood()" class="sc-action-btn-sm${count ? '' : ' pi-mood-hidden'}" title="Annuler">↩</button>
        <button onclick="_moodResetKey('${safeKey}');_piRefreshMood()" class="sc-action-btn-sm${count ? '' : ' pi-mood-hidden'}" title="Réinitialiser">✕</button>
      </div>
    </div>`;
  }

  const cards = teams.map(tid => {
    const tc    = CONFIG.teams[tid];
    if (!tc) return '';
    const color = tc.color || CLR.dark;

    // Use _fistPISprints to enumerate ALL PI sprints for this team
    const piSprints = (typeof _fistPISprints === 'function' && piNum) ? _fistPISprints(tid, piNum) : [];

    // Determine current sprint key/label
    let currentKey, currentLabel;
    if (isFuturePI && piSprints.length) {
      currentLabel = piSprints[0];
      currentKey = `${tid}__${currentLabel}`;
    } else {
      currentKey = _moodKey(tid);
      currentLabel = tc.sprintName || CONFIG.sprint.label || 'Sprint actif';
    }

    const votes = Array.isArray(md.votes?.[currentKey]) ? md.votes[currentKey] : [];
    const count = votes.length;
    const avg   = count ? Math.round(votes.reduce((s, v) => s + v, 0) / count * 10) / 10 : 0;
    const borderColor = !count ? 'var(--border)' : avg >= 3.5 ? '#86EFAC' : avg >= 2.5 ? '#FCD34D' : '#FECACA';

    const currentRow = _moodRow(tid, currentKey, currentLabel, true);

    // Other PI sprints (all except current) — with voting capability
    // Hide for future PIs: no previous/other sprints to show
    const otherRows = isFuturePI ? [] : piSprints
      .filter(sp => `${tid}__${sp}` !== currentKey)
      .map(sp => _moodRow(tid, `${tid}__${sp}`, sp, false));
    const otherLabel = 'Sprints précédents :';

    return `<div class="pi-mood-card" style="border-left:3px solid ${color};border-color:${borderColor};border-left-color:${color};">
      <div class="pi-mood-card-header">
        <div class="pi-mood-team" style="color:${color};">
          <span class="pi-mood-team-dot" style="background:${color};"></span>
          ${tc.name || tid}
        </div>
        <span class="pi-mood-sprint-badge">${currentLabel}</span>
      </div>
      ${currentRow}
      ${otherRows.length ? `<div class="pi-mood-prev-section">
        <div class="pi-mood-prev-title">${otherLabel}</div>
        ${otherRows.join('')}
      </div>` : ''}
    </div>`;
  }).filter(Boolean).join('');

  // Global average
  const allVotes = teams.flatMap(t => { const v = md.votes?.[_moodKey(t)]; return Array.isArray(v) ? v : []; });
  const totalV   = allVotes.length;
  const gAvg     = totalV ? Math.round(allVotes.reduce((s, v) => s + v, 0) / totalV * 10) / 10 : null;
  const teamsV   = teams.filter(t => { const v = md.votes?.[_moodKey(t)]; return Array.isArray(v) && v.length; }).length;
  const gColor   = gAvg === null ? 'var(--text-muted)' : gAvg < 2.5 ? '#DC2626' : gAvg < 3.5 ? '#D97706' : '#16A34A';
  const gBg      = gAvg === null ? 'var(--bg)' : gAvg < 2.5 ? 'var(--danger-bg)' : gAvg < 3.5 ? 'var(--warning-bg)' : 'var(--success-bg)';

  const avgBadge = gAvg !== null
    ? `<div class="pi-mood-global" style="background:${gBg};">
        <span style="font-size:18px;font-weight:900;color:${gColor};">${gAvg}</span><span style="font-size:11px;color:${gColor};font-weight:600;">/5</span>
        <span style="font-size:10px;color:var(--text-muted);margin-left:4px;">${totalV} vote${totalV > 1 ? 's' : ''} · ${teamsV}/${teams.length} éq.</span>
      </div>` : '';

  const trendHtml = _moodTrendSparkline(teams);

  return `<div class="pi-mood-section">
    <div class="pi-mood-header">
      <span>Échelle : 😡 1 (insatisfait) → 😍 5 (très satisfait)</span>
      ${avgBadge}
    </div>
    ${trendHtml}
    <div class="pi-mood-cards">${cards}</div>
  </div>`;
}

// Refresh only the mood section in PI view
function _piRefreshMood() {
  const el = document.getElementById('pi-mood');
  if (!el) return;
  const teams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  // Determine piNum from the PI selector or current sprint
  const piNum = (typeof _ppPINum !== 'undefined' && _ppPINum)
    ? _ppPINum
    : ((CONFIG.sprint.label || '').match(/(\d+)\.\d+/) || [])[1] || '';
  el.innerHTML = _piRenderMoodSection(teams, piNum);
}
