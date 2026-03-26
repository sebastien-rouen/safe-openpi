// ============================================================
// PI PLANNING VIEW - SAFe Product Increment
// Données réelles depuis TICKETS / EPICS / CONFIG.teams
// ============================================================

// ---- PI section toggle (collapse/expand) ----
window._piToggleSection = function(id) {
  const sec = document.getElementById('pi-sec-' + id);
  if (!sec) return;
  const isCollapsed = sec.classList.toggle('collapsed');
  const body = sec.querySelector('.pi-section-body');
  const arrow = sec.querySelector('.pi-section-arrow');
  if (isCollapsed) {
    if (body) body.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
    localStorage.setItem('pi_sec_' + id, '0');
  } else {
    if (body) body.style.display = '';
    if (arrow) arrow.textContent = '▼';
    localStorage.setItem('pi_sec_' + id, '1');
  }
};

// ---- PI scroll to section + open if collapsed ----
window._piScrollTo = function(id) {
  const sec = document.getElementById('pi-sec-' + id);
  if (!sec) return;
  if (sec.classList.contains('collapsed')) _piToggleSection(id);
  setTimeout(() => {
    const container = document.getElementById('content') || document.documentElement;
    const rect = sec.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const offset = (document.getElementById('pi-tabs')?.offsetHeight || 0) + (document.getElementById('topbar')?.offsetHeight || 0) + 16;
    container.scrollBy({ top: rect.top - contRect.top - offset, behavior: 'smooth' });
    // Highlight section header for 3 seconds
    sec.classList.add('pi-highlight');
    setTimeout(() => sec.classList.remove('pi-highlight'), 3000);
  }, 50);
  // Highlight active tab
  const bar = document.getElementById('pi-tabs-bar');
  if (bar) bar.querySelectorAll('.rm-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === id));
  if (typeof _pushHash === 'function') _pushHash();
};

// ---- PI scroll spy ----
let _piSpyCleanup = null;
function _piInitScrollSpy() {
  if (_piSpyCleanup) _piSpyCleanup();
  const content = document.getElementById('main') || window;
  const handler = () => {
    const bar = document.getElementById('pi-tabs-bar');
    if (!bar) return;
    const sections = document.querySelectorAll('.pi-section');
    let activeId = null;
    const offset = 120;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= offset && rect.bottom > offset) activeId = sec.id.replace('pi-sec-', '');
    });
    if (activeId) {
      const prev = bar.querySelector('.rm-tab.active')?.dataset.sec;
      if (prev !== activeId) {
        bar.querySelectorAll('.rm-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === activeId));
      }
    }
  };
  content.addEventListener('scroll', handler, { passive: true });
  _piSpyCleanup = () => content.removeEventListener('scroll', handler);
  handler();
}

function renderPI() {
  // Determine selected PI (from piprep selector or fallback to current sprint)
  const _ppPI      = typeof _ppCurrentPI === 'function' ? _ppCurrentPI() : null;
  const _ppPINum   = _ppPI ? (_ppPI.match(/\d+/) || [])[0] || '' : '';
  const _detectedPI = typeof _ppDetectPI === 'function' ? _ppDetectPI() : null;
  const _detectedNum = _detectedPI ? (_detectedPI.match(/\d+/) || [])[0] || '' : '';
  // Fallback: derive from CONFIG.sprint.label
  const _fallbackMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const _piViewNum = _ppPINum || (_fallbackMatch ? _fallbackMatch[1] : '');
  const _piViewIsCurrentPI = _piViewNum === (_detectedNum || (_fallbackMatch ? _fallbackMatch[1] : ''));

  // PI Tabs definition
  const _piTag = _piViewNum ? ` · PI ${_piViewNum}` : '';
  const _piTabs = [
    { id: 'objectifs', icon: '🎯', label: 'Objectifs' },
    { id: 'buffer',    icon: '🛡️', label: 'Buffer' },
    { id: 'capacite',  icon: '📊', label: 'Capacité' },
    { id: 'velocite',  icon: '📈', label: 'Vélocité' },
    { id: 'roam',      icon: '⚡', label: 'ROAM' },
    { id: 'fist',      icon: '✋', label: 'Fist of Five' },
    { id: 'mood',      icon: '😊', label: 'Mood Meter' },
    { id: 'metriques', icon: '📈', label: 'Métriques' },
  ];

  // Render tabs bar with PI selector
  const _piTabsEl = document.getElementById('pi-tabs');
  if (_piTabsEl) {
    const piLabel = _piViewNum ? `PI ${_piViewNum}` : 'PI';
    const ppSel   = typeof _ppPISelector === 'function' ? _ppPISelector() : '';
    const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
    const teamCount = typeof getActiveTeams === 'function' ? getActiveTeams().length : Object.keys(CONFIG.teams || {}).length;
    _piTabsEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0 4px;">
        <div class="section-title">🗓️ PI Planning - ${piLabel}</div>
        <span style="font-size:12px;color:var(--text-muted)">${sprintsPerPI} Sprints × ${teamCount} Équipes</span>
        <span style="flex:1"></span>
        ${ppSel}
      </div>
      <div class="rm-tabs" id="pi-tabs-bar">
        ${_piTabs.map(t => `<button class="rm-tab" data-sec="${t.id}" onclick="_piScrollTo('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
      </div>`;
  }

  // Update section titles with PI tag
  const _piSecTitles = {
    'objectifs': `Objectifs PI${_piTag}`,
    'buffer':    `Suivi Buffer${_piTag}`,
    'capacite':  `Vélocité réelle vs estimée${_piTag}`,
    'velocite':  `Vélocité historique${_piTag}`,
    'roam':      `ROAM Board${_piTag}`,
    'fist':      `Fist of Five${_piTag}`,
    'mood':      `Mood Meter (ROTI)${_piTag}`,
    'metriques': `Métriques${_piTag}`,
  };
  Object.entries(_piSecTitles).forEach(([id, title]) => {
    const sec = document.getElementById('pi-sec-' + id);
    if (sec) {
      const titleEl = sec.querySelector('.pi-section-title');
      if (titleEl) titleEl.textContent = title;
    }
  });

  // Restore collapsed state from localStorage
  _piTabs.forEach(t => {
    const stored = localStorage.getItem('pi_sec_' + t.id);
    const sec = document.getElementById('pi-sec-' + t.id);
    if (sec && stored === '0') {
      sec.classList.add('collapsed');
      const arrow = sec.querySelector('.pi-section-arrow');
      if (arrow) arrow.textContent = '▶';
      const body = sec.querySelector('.pi-section-body');
      if (body) body.style.display = 'none';
    }
  });

  // Add "+ Ajouter" button to Objectifs section header
  const _ppObjSec = document.getElementById('pi-sec-objectifs');
  if (_ppObjSec) {
    const hdr = _ppObjSec.querySelector('.pi-section-header');
    if (hdr && !hdr.querySelector('.pp-btn-add')) {
      const btn = document.createElement('button');
      btn.className = 'pp-btn-add';
      btn.textContent = '+ Ajouter';
      btn.onclick = (e) => { e.stopPropagation(); if (typeof _ppObjAdd === 'function') _ppObjAdd(); };
      hdr.appendChild(btn);
    }
  }

  // Init scroll spy
  _piInitScrollSpy();

  // Build PI regex for matching sprint names (e.g. "28.1", "28.2")
  const _piViewRe = _piViewNum ? new RegExp(`(^|\\D)${_piViewNum}\\.\\d+`) : null;

  // Tickets: for the current PI use getTickets(), for other PIs use BACKLOG_TICKETS
  const activeTeamFilter = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  let tickets;
  if (_piViewIsCurrentPI) {
    tickets = getTickets(); // sprint actif
  } else {
    // Non-current PI: gather tickets from BACKLOG_TICKETS + velocityHistory
    const _blAll = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : []);
    tickets = _blAll.filter(bt => {
      if (!_piViewNum) return false;
      if (activeTeamFilter.length && !activeTeamFilter.includes(bt.team)) return false;
      return (bt.piSprint || '').includes(_piViewNum) ||
             (_piViewRe && _piViewRe.test(bt.sprintName || ''));
    });
  }
  // Include teams from backlog PI tickets too (e.g. teams with no active sprint tickets)
  const _blTeams = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(bt => {
      if (activeTeamFilter.length && !activeTeamFilter.includes(bt.team)) return false;
      if (!_piViewNum) return false;
      return (bt.piSprint || '').includes(_piViewNum) ||
             (_piViewRe && _piViewRe.test(bt.sprintName || ''));
    })
    .map(bt => bt.team).filter(Boolean);
  const allTeams = [...new Set([...tickets.map(t => t.team).filter(Boolean), ..._blTeams])].sort();
  if (!allTeams.length) {
    const _piVelEl = document.getElementById('pi-velocity');
    if (_piVelEl) _piVelEl.innerHTML = `<div class="pi-empty">
      <div class="pi-empty-icon">📈</div>
      <div class="pi-empty-title">Vélocité non disponible</div>
      <div class="pi-empty-desc">L'historique de vélocité est alimenté par les sprints fermés chargés lors de la synchronisation JIRA.</div>
    </div>`;
    const _piCapCtx = document.getElementById('piCapacityChart');
    if (_piCapCtx) { if (_piCapCtx._chart) _piCapCtx._chart.destroy(); _piCapCtx._chart = null; }
    const _piCapCard = _piCapCtx?.closest('.chart-card');
    if (_piCapCard) _piCapCard.insertAdjacentHTML('afterbegin', `<div class="pi-empty" id="pi-cap-empty" style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--card)">
      <div class="pi-empty-icon">📊</div>
      <div class="pi-empty-title">Vélocité réelle vs estimée indisponible</div>
      <div class="pi-empty-desc">Ce graphique nécessite l'historique de vélocité et les données de capacité (membres, absences) des PI précédents.</div>
    </div>`);
    const _piProgEl = document.getElementById('pi-progress-bar');
    if (_piProgEl) _piProgEl.innerHTML = '';
    // PI Objectives (piprep) — render for future PIs too
    const _piPPObjEmpty = document.getElementById('pi-pp-objectives');
    if (_piPPObjEmpty && typeof _ppObjectivesSection === 'function') {
      const _atObj = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
      _piPPObjEmpty.innerHTML = _ppObjectivesSection(_atObj.length ? _atObj : Object.keys(CONFIG.teams || {}));
    }
    // Buffer — empty state for future PIs
    const _piBufEmpty = document.getElementById('pi-buffer');
    if (_piBufEmpty) _piBufEmpty.innerHTML = `<div class="pi-empty">
      <div class="pi-empty-icon">🛡️</div>
      <div class="pi-empty-title">Suivi buffer indisponible</div>
      <div class="pi-empty-desc">Le suivi buffer nécessite les tickets du PI avec le flag ou label <em>buffer</em>.</div>
    </div>`;
    // ROAM + Fist + Métriques still render even without ticket data
    const _at = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
    const _piRoamEl = document.getElementById('pi-roam');
    if (_piRoamEl) {
      _piRoamEl.innerHTML = typeof _ppROAMSection === 'function' ? _ppROAMSection(_at) : '';
    }
    const _piF = document.getElementById('pi-fist');
    if (_piF) _piF.innerHTML = typeof _ppFistSection === 'function' ? _ppFistSection(_at, _piViewNum) : '';
    if (typeof _renderFistChart === 'function') _renderFistChart('fistChartPI', _at);
    const _piM = document.getElementById('pi-mood');
    if (_piM) _piM.innerHTML = typeof _piRenderMoodSection === 'function' ? _piRenderMoodSection(_at, _piViewNum) : '';
    // Métriques — skeleton
    const _piMetEmpty = document.getElementById('pi-metriques');
    if (_piMetEmpty) _piMetEmpty.innerHTML = `<div class="pi-empty">
      <div class="pi-empty-icon">📈</div>
      <div class="pi-empty-title">Métriques indisponibles</div>
      <div class="pi-empty-desc">Les graphiques de métriques nécessitent des données de tickets et de vélocité pour ce PI.<br>Synchronisez les données ou sélectionnez un PI avec des sprints fermés.</div>
    </div>`;
    return;
  }
  // Clear any previous empty overlay on capacity chart
  const _prevCapEmpty = document.getElementById('pi-cap-empty');
  if (_prevCapEmpty) _prevCapEmpty.remove();

  // PI Sprint columns — one column per sprint in the PI (e.g. 28.1, 28.2, …, 28.5)
  const sprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const _piReSprint = /(\d{2,3})\.(\d+)/;
  // Detect current sprint index within PI (for highlighting)
  const _curSprintMatch = (CONFIG.sprint.label || '').match(_piReSprint);
  const _curSprintIdx = (_piViewIsCurrentPI && _curSprintMatch) ? parseInt(_curSprintMatch[2]) - 1 : -1;

  // Map a ticket to its sprint index within the selected PI
  const _ticketSprintIdx = (t) => {
    const sources = [t.sprintName, ...(t.allSprints || []), t.piSprint || ''];
    for (const s of sources) {
      if (!s) continue;
      const m = s.match(_piReSprint);
      if (m && m[1] === _piViewNum) return parseInt(m[2]) - 1;
    }
    return null;
  };

  // Build sprint columns metadata
  const sprintCols = Array.from({ length: sprintsPerPI }, (_, i) => {
    const label = _piViewNum ? `${_piViewNum}.${i + 1}` : `S${i + 1}`;
    const isIP = i === sprintsPerPI - 1;
    const isCurrent = i === _curSprintIdx;
    const isPast = _curSprintIdx >= 0 && i < _curSprintIdx;
    const isFuture = _curSprintIdx >= 0 && i > _curSprintIdx;
    return {
      idx: i, label: isIP ? `${label} (IP)` : label,
      isCurrent, isPast, isFuture, isIP,
      hint: isCurrent
        ? `<strong>${label}</strong> — sprint actif<br>Epics du sprint en cours, données réelles JIRA.`
        : isPast
        ? `<strong>${label}</strong> — sprint terminé<br>Epics des tickets livrés sur ce sprint.`
        : `<strong>${label}</strong> — sprint ${isIP ? 'IP (Innovation & Planning)' : 'à venir'}<br>Epics planifiés pour ce sprint.`,
    };
  });

  // Combine all PI tickets (active + backlog + closed buffer) for epic mapping
  const _piNum   = _piViewNum || null;
  const _piRe    = _piNum ? new RegExp(`(^|\\D)${_piNum}\\.\\d+`) : null;
  const _activeIds = new Set(tickets.map(t => t.id));
  const _blPIAll = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(bt => !_activeIds.has(bt.id))
    .filter(bt => _piNum && (
      (bt.piSprint || '').includes(_piNum) ||
      (_piRe && _piRe.test(bt.sprintName || ''))
    ));
  const _closedPIBuf = [];
  if (_piRe) {
    Object.entries(CONFIG.teams || {}).forEach(([tid, tc]) => {
      (tc.velocityHistory || []).forEach(vh => {
        if (!_piRe.test(vh.name || '')) return;
        (vh.bufferTickets || []).forEach(bt => {
          if (!_activeIds.has(bt.id) && !_closedPIBuf.some(x => x.id === bt.id)) _closedPIBuf.push(bt);
        });
      });
    });
  }
  const _allPITix = tickets.concat(_blPIAll, _closedPIBuf);

  // ---- Progress bar globale du PI (basée sur vélocité historique centralisée) ----
  const _progEl = document.getElementById('pi-progress-bar');
  if (_progEl) {
    const _vs = _piVelocityStats(allTeams, _piViewNum);
    const _totalTix = _allPITix.length;
    const _doneTix  = _allPITix.filter(t => isDone(t.status)).length;
    const _inpTix   = _allPITix.filter(t => ['inprog','review','test'].includes(t.status)).length;
    const _blkTix   = _allPITix.filter(t => t.status === 'blocked').length;
    const _todoTix  = _totalTix - _doneTix - _inpTix - _blkTix;
    const _totalPts = _allPITix.reduce((s, t) => s + (t.points || 0), 0);
    const _donePts  = _allPITix.filter(t => isDone(t.status)).reduce((s, t) => s + (t.points || 0), 0);
    const _inpPts   = _allPITix.filter(t => ['inprog','review','test'].includes(t.status)).reduce((s, t) => s + (t.points || 0), 0);
    const _blkPts   = _allPITix.filter(t => t.status === 'blocked').reduce((s, t) => s + (t.points || 0), 0);
    const _bufTix   = _allPITix.filter(t => t.buffer);
    const _bufPts   = _bufTix.reduce((s, t) => s + (t.points || 0), 0);
    const _todoPts  = _totalPts - _donePts - _inpPts - _blkPts;
    const _piLbl    = _piViewNum ? `PI ${_piViewNum}` : 'PI';

    const _velCapacity   = _vs.capacity;
    const _velDelivered  = _vs.delivered;
    const _velSprintsDone = _vs.sprintsDone;
    const _base      = _velCapacity || _totalPts || 1;
    const _pct       = Math.round(_donePts / _base * 100);
    const _pctInp    = Math.round(_inpPts / _base * 100);
    const _pctBlk    = Math.round(_blkPts / _base * 100);
    const _pctBuf    = Math.round(_bufPts / _base * 100);
    const _remaining = Math.max(0, _velCapacity - _donePts - _inpPts);

    const _velTeamTip = _vs.teamDetails.filter(r => r.avgVel || r.delivered).map(r =>
      `<tr><td style="color:${r.color};font-weight:600">${r.name}</td><td style="text-align:right"><strong>${r.delivered}</strong> / ${r.teamCap} pts</td><td style="text-align:right;color:var(--text-muted)">${r.sprintsDone} spr.</td></tr>`
    ).join('');

    const _progTip = `<div style="min-width:260px">
      <div style="font-weight:700;margin-bottom:6px">${_piLbl} — État des lieux</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:6px">
        <tr><td style="color:#22C55E">✅ Terminé</td><td style="text-align:right;font-weight:600">${_donePts} pts</td><td style="text-align:right;color:var(--text-muted)">${_doneTix} tix</td></tr>
        <tr><td style="color:#3B82F6">🔄 En cours</td><td style="text-align:right;font-weight:600">${_inpPts} pts</td><td style="text-align:right;color:var(--text-muted)">${_inpTix} tix</td></tr>
        ${_blkTix ? `<tr><td style="color:#EF4444">🚫 Bloqué</td><td style="text-align:right;font-weight:600">${_blkPts} pts</td><td style="text-align:right;color:var(--text-muted)">${_blkTix} tix</td></tr>` : ''}
        <tr><td style="color:#94A3B8">📋 À faire</td><td style="text-align:right;font-weight:600">${_todoPts} pts</td><td style="text-align:right;color:var(--text-muted)">${_todoTix} tix</td></tr>
        ${_bufPts ? `<tr><td style="color:#8B5CF6">🛡️ Buffer</td><td style="text-align:right;font-weight:600">${_bufPts} pts</td><td style="text-align:right;color:var(--text-muted)">${_bufTix.length} tix</td></tr>` : ''}
      </table>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,.15);margin:6px 0">
      <div style="font-weight:700;margin-bottom:4px;font-size:11px">📈 Vélocité — Capacité PI</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:4px">${_velTeamTip}</table>
      <div style="font-size:11px;display:flex;justify-content:space-between;margin-top:4px">
        <span>Capacité totale : <strong>${_velCapacity} pts</strong></span>
        <span>Livré : <strong style="color:#22C55E">${_velDelivered} pts</strong></span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Reste estimé : <strong>${_remaining} pts</strong> · ${sprintsPerPI - _velSprintsDone} sprint${sprintsPerPI - _velSprintsDone > 1 ? 's' : ''} restant${sprintsPerPI - _velSprintsDone > 1 ? 's' : ''}</div>
    </div>`.replace(/"/g, '&quot;');

    const _pctColor = _pct >= 80 ? '#22C55E' : _pct >= 40 ? '#F59E0B' : '#94A3B8';
    const _capLabel = _velCapacity ? `${_donePts}/${_velCapacity} pts` : `${_donePts}/${_totalPts} pts`;

    _progEl.innerHTML = `<div class="pi-prog" data-tip-prog="${_progTip}">
      <div class="pi-prog-info">
        <span class="pi-prog-label">${_piLbl}</span>
        <span class="pi-prog-pct" style="color:${_pctColor}">${_pct}%</span>
        <span class="pi-prog-detail">${_capLabel} · ${_totalTix} tickets${_velCapacity ? ` · capacité ${_velCapacity} pts` : ''}</span>
      </div>
      <div class="pi-prog-track">
        <div class="pi-prog-fill" style="width:${_pct}%;background:#22C55E"></div>
        <div class="pi-prog-fill" style="width:${_pctInp}%;background:#3B82F6"></div>
        <div class="pi-prog-fill" style="width:${_pctBlk}%;background:#EF4444"></div>
        ${_pctBuf ? `<div class="pi-prog-fill" style="width:${_pctBuf}%;background:#8B5CF6;opacity:.5"></div>` : ''}
      </div>
    </div>`;

    // Tooltip on progress bar
    const _progBar = _progEl.querySelector('.pi-prog');
    if (_progBar) {
      let _tipEl = document.getElementById('_pi-chip-tip');
      if (!_tipEl) { _tipEl = document.createElement('div'); _tipEl.id = '_pi-chip-tip'; _tipEl.className = 'pi-tooltip'; _tipEl.style.maxWidth = '300px'; document.body.appendChild(_tipEl); }
      _progBar.addEventListener('mouseenter', e => { _tipEl.innerHTML = _progBar.dataset.tipProg.replace(/&quot;/g, '"'); _tipEl.style.display = 'block'; _tipEl.style.left = (e.clientX + 14) + 'px'; _tipEl.style.top = (e.clientY - 80) + 'px'; });
      _progBar.addEventListener('mousemove', e => { _tipEl.style.left = (e.clientX + 14) + 'px'; _tipEl.style.top = (e.clientY - _tipEl.offsetHeight - 10) + 'px'; });
      _progBar.addEventListener('mouseleave', () => { _tipEl.style.display = 'none'; });
    }
  }

  // Buffer tracking — reuse _allPITix computed earlier (active + backlog + closed buffer)
  _renderPIBuffer(_allPITix, allTeams);


  // Velocity chart - réelle vs estimée (basée sur la capacité membres des 2 derniers PI)
  setTimeout(() => {
    const ctx = document.getElementById('piCapacityChart');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();

    const _capPiNum = _piViewNum || null;
    const _capCurrentIdx = _curSprintIdx >= 0 ? _curSprintIdx : 0;
    const sprintLabels = sprintCols.map(s => s.label);

    // ---- Vélocité réelle par sprint (somme des équipes) ----
    const realVel = Array(sprintsPerPI).fill(0);
    allTeams.forEach(t => {
      const hist = CONFIG.teams[t]?.velocityHistory || [];
      for (let si = 0; si < sprintsPerPI; si++) {
        const suffix = _capPiNum ? `${_capPiNum}.${si + 1}` : null;
        if (!suffix) continue;
        const entry = hist.find(h => h.name && h.name.includes(suffix));
        if (entry) realVel[si] += entry.velocity || 0;
      }
    });
    // Sprint actif : compter les pts du sprint courant
    if (_capCurrentIdx >= 0 && _capCurrentIdx < sprintsPerPI) {
      const curPts = _allPITix
        .filter(t => { const si = _ticketSprintIdx(t); return si === _capCurrentIdx; })
        .reduce((s, t) => s + (t.points || 0), 0);
      if (curPts > realVel[_capCurrentIdx]) realVel[_capCurrentIdx] = curPts;
    }

    // ---- Vélocité estimée : ratio capacité actuelle / capacité historique × vélocité historique ----
    const _piOffset = typeof _ppPIOffset === 'function' ? _ppPIOffset() : 0;
    const focusFactor = 0.8;

    // Capacité disponible (jours ouvrés - absences - fériés) par sprint du PI courant
    const _computeCapPerSprint = (piOff) => {
      const wInfos = typeof _rotWeekInfos === 'function' ? _rotWeekInfos(piOff) : [];
      return Array.from({ length: sprintsPerPI }, (_, si) => {
        let totalDays = 0;
        const sprintWeeks = wInfos.filter(w => w.sprintIdx === si);
        allTeams.forEach(tid => {
          const members = (typeof MEMBERS !== 'undefined' ? MEMBERS[tid] : null) || [];
          members.forEach(m => {
            sprintWeeks.forEach(w => {
              const wd = w.workDays ?? 5;
              const abs = typeof _getAbsDaysForRange === 'function'
                ? _getAbsDaysForRange(m, w._start, w._end) : 0;
              totalDays += Math.max(0, wd - abs);
            });
          });
        });
        return Math.round(totalDays * focusFactor);
      });
    };

    const currentCap = _computeCapPerSprint(_piOffset);

    // Historique des 2 derniers PI : vélocité moyenne par sprint et capacité moyenne
    const _prevPIs = [_piOffset - 1, _piOffset - 2];
    let histAvgVelPerSprint = 0;
    let histAvgCapPerSprint = 0;
    let histPICount = 0;
    _prevPIs.forEach(off => {
      const prevWInfos = typeof _rotWeekInfos === 'function' ? _rotWeekInfos(off) : [];
      if (!prevWInfos.length || !prevWInfos._piNum) return;
      const prevPiNum = prevWInfos._piNum;
      const prevRe = new RegExp(`\\b${prevPiNum}\\.\\d+`);
      // Vélocité totale de ce PI
      let prevTotalVel = 0, prevSprintCount = 0;
      allTeams.forEach(t => {
        const hist = CONFIG.teams[t]?.velocityHistory || [];
        hist.filter(s => prevRe.test(s.name)).forEach(s => {
          prevTotalVel += s.velocity || 0;
        });
        prevSprintCount = Math.max(prevSprintCount, hist.filter(s => prevRe.test(s.name)).length);
      });
      if (!prevSprintCount) return;
      // Capacité de ce PI
      const prevCap = _computeCapPerSprint(off);
      const prevTotalCap = prevCap.reduce((s, v) => s + v, 0);
      histAvgVelPerSprint += prevTotalVel / prevSprintCount;
      histAvgCapPerSprint += prevTotalCap / prevSprintCount;
      histPICount++;
    });

    // Estimation : vélocité projetée = (capacité sprint courant / capacité moy historique) × vélocité moy historique
    const estimatedVel = Array(sprintsPerPI).fill(null);
    if (histPICount > 0) {
      const avgVel = histAvgVelPerSprint / histPICount;
      const avgCap = histAvgCapPerSprint / histPICount;
      for (let si = 0; si < sprintsPerPI; si++) {
        const ratio = avgCap > 0 ? currentCap[si] / avgCap : 1;
        estimatedVel[si] = Math.round(avgVel * ratio);
      }
    }

    // Holiday warnings in labels
    const wInfosCurrent = typeof _rotWeekInfos === 'function' ? _rotWeekInfos(_piOffset) : [];
    sprintLabels.forEach((lbl, si) => {
      const sprintWeeks = wInfosCurrent.filter(w => w.sprintIdx === si);
      const holSet = new Set();
      sprintWeeks.forEach(w => (w.holidays || []).forEach(h => holSet.add(h)));
      if (holSet.size) sprintLabels[si] = lbl + ` ⚠️${holSet.size}j`;
    });

    // Bar: réelle, Line: estimée
    const datasets = [
      {
        label: 'Vélocité réelle',
        data: realVel.map((v, i) => i <= _capCurrentIdx ? v : null),
        backgroundColor: realVel.map((v, i) => {
          if (i > _capCurrentIdx) return 'transparent';
          if (estimatedVel[i] && v >= estimatedVel[i]) return 'rgba(34,197,94,.7)';
          if (estimatedVel[i] && v >= estimatedVel[i] * 0.8) return 'rgba(245,158,11,.7)';
          return 'rgba(239,68,68,.6)';
        }),
        borderColor: realVel.map((v, i) => {
          if (i > _capCurrentIdx) return 'transparent';
          if (estimatedVel[i] && v >= estimatedVel[i]) return '#22C55E';
          if (estimatedVel[i] && v >= estimatedVel[i] * 0.8) return '#F59E0B';
          return '#EF4444';
        }),
        borderWidth: 2,
        borderRadius: 3,
      },
      {
        label: 'Vélocité estimée (2 PI préc.)',
        data: estimatedVel,
        type: 'line',
        borderColor: '#6366F1',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 4,
        pointBackgroundColor: '#6366F1',
        fill: false,
      },
    ];

    const _tooltipStyle = {
      backgroundColor: 'rgba(15,23,42,.94)',
      titleColor: '#F8FAFC', bodyColor: '#CBD5E1',
      borderColor: 'rgba(255,255,255,.10)', borderWidth: 1,
      padding: 12, cornerRadius: 10,
      titleFont: { size: 12, weight: 'bold' }, bodyFont: { size: 11 },
    };

    ctx._chart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: sprintLabels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { font: { size: 11 } } },
          tooltip: {
            ..._tooltipStyle, mode: 'index', intersect: false,
            callbacks: {
              label: item => {
                if (item.raw == null) return null;
                return ` ${item.dataset.label}: ${item.raw} pts`;
              },
              footer: items => {
                const real = items.find(i => i.dataset.label === 'Vélocité réelle' && i.raw != null);
                const est  = items.find(i => i.dataset.label?.includes('estimée') && i.raw != null);
                if (!real || !est || !est.raw) return [];
                const pct = Math.round(real.raw / est.raw * 100);
                const icon = pct >= 100 ? '✅' : pct >= 80 ? '🟡' : '⚠️';
                const capDay = currentCap[items[0]?.dataIndex] || 0;
                return [`${icon}  ${pct}% de l'estimation`, `📅 Capacité : ${capDay} j/h dispo`];
              },
            },
            footerColor: '#6366F1', footerFont: { size: 11, weight: '600' },
          },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Story Points' } },
        },
      },
    });
  }, 100);

  // Dependency deadline alerts
  _renderPIDepAlerts();

  // Vélocité historique - sprints fermés récents (stockés dans CONFIG.teams après sync)
  _renderVelocityHistory(allTeams);

  // PI Objectives (from piprep) — moved from Roadmap to PI Planning
  const _piPPObjEl = document.getElementById('pi-pp-objectives');
  if (_piPPObjEl && typeof _ppObjectivesSection === 'function') {
    _piPPObjEl.innerHTML = _ppObjectivesSection(activeTeamFilter.length ? activeTeamFilter : Object.keys(CONFIG.teams || {}));
  }

  // ROAM Board — moved from Roadmap to PI Planning
  const _piRoamEl = document.getElementById('pi-roam');
  if (_piRoamEl && typeof _ppROAMSection === 'function') {
    _piRoamEl.innerHTML = _ppROAMSection(activeTeamFilter.length ? activeTeamFilter : Object.keys(CONFIG.teams || {}));
  }

  // Fist of Five — moved from Roadmap to PI Planning
  const _piFistTeams = activeTeamFilter.length ? activeTeamFilter : Object.keys(CONFIG.teams || {});
  const _piFistEl = document.getElementById('pi-fist');
  if (_piFistEl && typeof _ppFistSection === 'function') {
    _piFistEl.innerHTML = _ppFistSection(_piFistTeams, _piViewNum);
  }
  if (typeof _renderFistChart === 'function') _renderFistChart('fistChartPI', _piFistTeams);

  // Mood Meter (ROTI)
  const _piMoodEl = document.getElementById('pi-mood');
  if (_piMoodEl && typeof _piRenderMoodSection === 'function') {
    _piMoodEl.innerHTML = _piRenderMoodSection(_piFistTeams, _piViewNum);
  }

  // Métriques section
  const _piMetEl = document.getElementById('pi-metriques');
  if (_piMetEl && typeof _metricsChartsHTML === 'function') {
    _piMetEl.innerHTML = _metricsChartsHTML('piM');
    if (typeof _renderMetricsCharts === 'function') _renderMetricsCharts('piM', _piFistTeams);
  }
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

  // Extract iteration key from sprint name: "Fuego - Ité 29.1" → "29.1"
  function _iterKey(spName) {
    const m = spName.match(/(\d+\.\d+|\d+)\s*$/);
    return m ? m[1] : spName;
  }
  // Short label for header: "29.1" → "Ité 29.1"
  function _iterLabel(key) {
    return /^\d/.test(key) ? `Ité ${key}` : key;
  }

  // Collect unique iteration keys, sorted numerically
  const iterSet = new Map(); // iterKey → { key, startDate }
  allTeams.forEach(t => {
    (CONFIG.teams[t]?.velocityHistory || []).forEach(s => {
      const k = _iterKey(s.name);
      if (!iterSet.has(k) || (s.startDate && (!iterSet.get(k).startDate || s.startDate < iterSet.get(k).startDate))) {
        iterSet.set(k, { key: k, startDate: s.startDate });
      }
    });
  });
  const allIters = [...iterSet.values()]
    .sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      const na = parseFloat(a.key), nb = parseFloat(b.key);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.key.localeCompare(b.key);
    })
    .map(s => s.key);

  if (!allIters.length) {
    el.innerHTML = `<div class="pi-empty">
      <div class="pi-empty-icon">📈</div>
      <div class="pi-empty-title">Historique de vélocité vide</div>
      <div class="pi-empty-desc">Les sprints fermés n'ont pas encore été chargés depuis JIRA.<br>Lancez une synchronisation pour récupérer l'historique de vélocité par équipe.</div>
    </div>`;
    return;
  }

  // Build per-team lookup: iterKey → velocity entry
  const teamIterMap = {};
  allTeams.forEach(t => {
    const map = {};
    (CONFIG.teams[t]?.velocityHistory || []).forEach(s => { map[_iterKey(s.name)] = s; });
    teamIterMap[t] = map;
  });

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

    const cells   = allIters.map(iterKey => {
      const entry = teamIterMap[t][iterKey];
      if (!entry) return `<td style="color:var(--text-muted);text-align:center">-</td>`;
      const pct   = empirical ? Math.round(entry.velocity / empirical * 100) : null;
      const color2 = pct === null ? '' : pct >= 90 ? '#22C55E' : pct >= 70 ? '#F59E0B' : '#EF4444';
      return `<td class="pi-vel-cell" data-vel-detail="${t}|${entry.name}" style="cursor:pointer">
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
      <td class="pi-vel-target" data-vel-team="${t}" style="cursor:default">${empirical ? `<strong>${empirical}</strong> <span style="font-size:10px;color:var(--text-muted)">pts/sprint</span>${histVals.length >= 2 ? `<br><span style="font-size:10px;color:var(--text-muted)">Min: ${minVal} · Max: ${maxVal}</span>` : ''}` : '-'}</td>
    </tr>`;
  }).join('');

  // Total row
  const _vsTotals = _piVelocityStats(allTeams, _piDetect().piNum || '');
  const totalCells = allIters.map(iterKey => {
    let sum = 0;
    allTeams.forEach(t => { const e = teamIterMap[t][iterKey]; if (e) sum += e.velocity; });
    return sum ? `<td style="text-align:center;font-weight:700">${sum}</td>` : `<td style="color:var(--text-muted);text-align:center">-</td>`;
  }).join('');
  const totalCurrentPts = getTickets().reduce((a, x) => a + x.points, 0);
  const totalRow = `<tr style="border-top:2px solid var(--border);background:rgba(0,0,0,.02)">
    <td class="pi-vel-team" style="font-weight:700;color:var(--text)">Total</td>
    ${totalCells}
    <td class="pi-vel-cell" style="font-weight:700"><strong>${totalCurrentPts}</strong></td>
    <td class="pi-vel-target" style="font-weight:700">${_vsTotals.avg ? `<strong>${_vsTotals.avg}</strong> <span style="font-size:10px;color:var(--text-muted)">pts/sprint</span>${_vsTotals.piSprints.length >= 2 ? `<br><span style="font-size:10px;color:var(--text-muted)">Min: ${_vsTotals.min} · Max: ${_vsTotals.max}</span>` : ''}` : '-'}</td>
  </tr>`;

  el.innerHTML = `
    <div class="card pi-vel-wrap">
      <table class="pi-vel-table">
        <thead><tr>
          <th class="pi-vel-sticky-col">Équipe</th>
          ${allIters.map(k => `<th>${_iterLabel(k)}</th>`).join('')}
          <th style="background:rgba(2,132,199,.08)">Sprint actif</th>
          <th title="Moyenne empirique des sprints fermés">Cible (moy.)</th>
        </tr></thead>
        <tbody>${teamRows}${totalRow}</tbody>
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
        const data  = allIters.map(iterKey => {
          const e = teamIterMap[t]?.[iterKey];
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
      data: { labels: allIters.map(k => _iterLabel(k)), datasets },
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

  // PI context — use selected PI from piprep selector
  const _ppPI2     = typeof _ppCurrentPI === 'function' ? _ppCurrentPI() : null;
  const _bufPiNum  = _ppPI2 ? (_ppPI2.match(/\d+/) || [])[0] || null : null;
  const _fallback2 = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const _piNum     = _bufPiNum || (_fallback2 ? _fallback2[1] : null);
  const _piRe      = _piNum ? new RegExp(`(^|\\D)${_piNum}\\.\\d+`) : null;

  const _teamSet = new Set(allTeams);
  const bufferTickets = tickets.filter(t => t.buffer && (!_teamSet.size || _teamSet.has(t.team)));
  if (!bufferTickets.length) {
    const _bufLabel = _piNum ? `PI ${_piNum}` : 'ce PI';
    el.innerHTML = `<div class="pi-empty">
      <div class="pi-empty-icon">🛡️</div>
      <div class="pi-empty-title">Aucun ticket buffer sur ${_bufLabel}</div>
      <div class="pi-empty-desc">Les tickets buffer sont détectés via le label <em>buffer</em> ou un epic parent contenant "buffer" dans son titre.<br>Aucun ticket correspondant n'a été trouvé pour ce PI.</div>
    </div>`;
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

  // Sprint columns for the PI
  const _bufSprintsPerPI = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI) || 5;
  const _bufReSprint = /(\d{2,3})\.(\d+)/;
  const _bufTicketSprintIdx = (t) => {
    const sources = [t.sprintName, ...(t.allSprints || []), t.piSprint || ''];
    for (const s of sources) {
      if (!s) continue;
      const m = s.match(_bufReSprint);
      if (m && m[1] === _piNum) return parseInt(m[2]) - 1;
    }
    return null;
  };
  const _bufSprintLabels = Array.from({ length: _bufSprintsPerPI }, (_, i) =>
    _piNum ? `${_piNum}.${i + 1}` : `S${i + 1}`
  );

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
    const pctColor   = tDonePct >= 80 ? '#22C55E' : tDonePct >= 50 ? '#F59E0B' : '#94A3B8';
    // Per-sprint cells
    const sprintCells = _bufSprintLabels.map((_, si) => {
      const sBuf  = tBuf.filter(t => _bufTicketSprintIdx(t) === si);
      if (!sBuf.length) return `<td style="text-align:center;font-size:11px;color:var(--text-muted)">-</td>`;
      const sDone = sBuf.filter(t => isDone(t.status)).length;
      const sClr  = sDone === sBuf.length ? '#22C55E' : sDone > 0 ? '#F59E0B' : '#94A3B8';
      return `<td style="text-align:center;font-size:11px;font-weight:600;color:${sClr}">${sDone}/${sBuf.length}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:600;color:${color};font-size:12px;white-space:nowrap">${name}</td>
      <td style="text-align:center;font-size:12px">${tBuf.length}</td>
      <td style="text-align:center;font-size:12px;font-weight:600">${tTotal} pts</td>
      <td style="text-align:center;font-size:12px;font-weight:600;color:#22C55E">${tDone} pts</td>
      <td style="min-width:100px">
        <div style="position:relative;height:14px;border-radius:4px;overflow:hidden;background:#F1F5F9">
          <div style="height:100%;width:${tDonePct}%;background:#22C55E;float:left"></div>
          <div style="height:100%;width:${tInprogPct}%;background:#3B82F6;float:left"></div>
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${tDonePct > 40 ? '#fff' : pctColor}">${tDonePct}%</span>
        </div>
      </td>
      ${sprintCells}
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
          <th class="pi-table-th" style="text-align:center">Total</th>
          <th class="pi-table-th" style="text-align:center">Done</th>
          <th class="pi-table-th" style="text-align:center">Progression</th>
          ${_bufSprintLabels.map(l => `<th class="pi-table-th" style="text-align:center;font-size:10px">${l}</th>`).join('')}
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
