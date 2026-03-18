// ============================================================
// ROADMAP — Planification charge / vélocité / règle 80/20
// ============================================================

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

function renderRoadmap() {
  _capTicketsMode = null;
  document.getElementById('topbar-title').textContent = '🗺️ Roadmap & Planification';
  const el = document.getElementById('roadmap-content');
  if (!el) return;

  const velRef = _roadmapVelocity();
  const cap80  = Math.round(velRef.avg * 0.8);
  const cap20  = velRef.avg - cap80;

  // Backlog : BACKLOG_TICKETS (tickets sprints futurs JIRA) + fallback sprint:0 dans TICKETS (démo)
  const pOrder      = { critical: 0, high: 1, medium: 2, low: 3 };
  const activeTeams = getActiveTeams();
  const _filterBacklog = t =>
    t.type !== 'support' && t.type !== 'incident' &&
    t.status !== 'done' &&
    (!activeTeams.length || activeTeams.includes(t.team));

  const fromBacklog = (typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [])
    .filter(_filterBacklog);
  const seenIds     = new Set(fromBacklog.map(t => t.id));
  const fromSprint  = getTickets()
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

  el.innerHTML = `
    <div class="rm-top-grid">
      ${_roadmapVelocityCard(velRef, cap80, cap20)}
      ${_roadmapBufferCard(velRef.avg, cap20)}
      ${_roadmapPresentielCard(velRef, sprintPlan)}
    </div>
    ${_roadmapTimeline(velRef, cap80, sprintPlan)}
    ${_roadmapSprintPlan(sprintPlan, cap80, cap20)}
    ${_roadmapBacklogHealth(backlog)}
    ${_roadmapBacklogTable(backlog, cap80)}
  `;
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
  activeTeams.forEach(tid => {
    const tc = CONFIG.teams[tid];
    if (!tc || !Array.isArray(tc.velocityHistory) || !tc.velocityHistory.length) return;
    _sortVH(tc.velocityHistory).slice(-maxLen).forEach((e, i) => {
      byPos[i] = (byPos[i] || 0) + (e.velocity || 0);
      if (!names[i] && e.name) names[i] = e.name;
    });
  });

  if (!byPos.length) {
    const target = activeTeams.reduce((s, tid) => s + (CONFIG.teams[tid]?.velocity || 0), 0);
    const v = target || 80;
    return { avg: v, min: v, max: v, history: [], hasHistory: false };
  }

  // Moyenne sur les sprints avec velocite > 0 (exclure les sprints vides)
  const nonZero = byPos.filter(v => v > 0);
  const avg     = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
  const min     = Math.min(...byPos);
  const max     = Math.max(...byPos);
  const history = byPos.map((v, i) => ({
    vel:  v,
    name: names[i] || `S-${byPos.length - i}`,
  }));
  return { avg, min, max, history, hasHistory: true };
}

// ============================================================
// Carte vélocité + barre 80/20
// ============================================================

function _roadmapVelocityCard(vel, cap80, cap20) {
  const bars = vel.history.map(h => {
    const pct = vel.max ? Math.round((h.vel / vel.max) * 100) : 0;
    // Short label: extract iteration number (e.g. "Fuego - Ité. 27.4" → "27.4")
    const short = (h.name.match(/(\d+\.\d+|\d+)\s*$/) || [])[1] || h.name;
    return `<div class="rm-hist-bar-wrap" title="${h.name}: ${h.vel} pts">
      <div class="rm-hist-bar-zone"><div class="rm-hist-bar-inner" style="height:${Math.max(pct, 4)}%"></div></div>
      <div class="rm-hist-bar-val">${h.vel}</div>
      <div class="rm-hist-bar-label">${short}</div>
    </div>`;
  }).join('');

  return `
    <div class="card rm-vel-card">
      <div class="rm-card-title">⚡ Vélocité de référence</div>
      <div class="rm-vel-main">
        <div class="rm-vel-big">${vel.avg}<small> pts/sprint</small></div>
        <div class="rm-vel-sub">${vel.hasHistory ? `Min: <b>${vel.min}</b> — Max: <b>${vel.max}</b>` : 'Cible config (pas d\'historique)'}</div>
      </div>
      ${vel.history.length ? `<div class="rm-hist-bars">${bars}</div>` : ''}
      <div class="rm-cap-split">
        <div class="rm-cap-block rm-cap-feat" onclick="_toggleCapTickets('feat')">
          <div class="rm-cap-val">${cap80} pts</div>
          <div class="rm-cap-label">80% · Features &amp; Stories</div>
        </div>
        <div class="rm-cap-block rm-cap-buf" onclick="_toggleCapTickets('buf')">
          <div class="rm-cap-val">${cap20} pts</div>
          <div class="rm-cap-label">20% · Buffer</div>
        </div>
      </div>
      <div class="rm-bar-split">
        <div class="rm-bar-feat" style="width:80%">80%</div>
        <div class="rm-bar-buf"  style="width:20%">20%</div>
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

  const tickets = getTickets().filter(t => t.sprint);
  let filtered;
  if (mode === 'buf') {
    filtered = tickets.filter(t => t.buffer);
    document.querySelector('.rm-cap-buf')?.classList.add('active');
  } else {
    filtered = tickets.filter(t => !t.buffer);
    document.querySelector('.rm-cap-feat')?.classList.add('active');
  }

  if (!filtered.length) {
    el.innerHTML = `<div class="rm-cap-tickets"><div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">Aucun ticket ${mode === 'buf' ? 'buffer' : 'feature'} dans le sprint actif</div></div>`;
    return;
  }

  filtered.sort((a, b) => (b.points || 0) - (a.points || 0) || a.title.localeCompare(b.title));
  const totalPts = filtered.reduce((s, t) => s + (t.points || 0), 0);
  const rows = filtered.map(t => {
    const done = t.status === 'done';
    return `<div class="rm-cap-row${done ? ' rm-cap-done' : ''}" onclick="openModal('${t.id}')">
      <span class="badge badge-${t.type}" style="font-size:9px;flex-shrink:0;">${typeName(t.type)}</span>
      <span style="font-size:10px;color:var(--text-muted);font-weight:600;flex-shrink:0;">${t.id}</span>
      <span class="rm-cap-row-title">${t.title}</span>
      ${ptsBadge(t.points, {size:'small'})}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="rm-cap-tickets">
    <div style="padding:6px 10px;font-size:10px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);">
      ${mode === 'buf' ? '🛡️ Buffer' : '📦 Features & Stories'} — ${filtered.length} ticket${filtered.length > 1 ? 's' : ''} · ${totalPts} pts
    </div>
    ${rows}
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

function _roadmapPresentielCard(velRef, sprintPlan) {
  const sprintsPerPI    = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI)    || 5;
  const presentielPerPI = (CONFIG.sprint && CONFIG.sprint.presentielPerPI) || 2;
  const piHistoryCount  = (CONFIG.sync   && CONFIG.sync.piHistoryCount)    || 3;

  // Grouper l'historique de sprints en PIs (les plus récents en premier)
  // velRef.history[0] = sprint le plus ancien → on renverse pour prendre les PIs récents
  const histRev = velRef.history.slice().reverse(); // [recent, ..., ancien]
  const piVelocities = [];
  for (let i = 0; i < piHistoryCount; i++) {
    const slice = histRev.slice(i * sprintsPerPI, (i + 1) * sprintsPerPI);
    if (!slice.length) break;
    piVelocities.push(slice.reduce((s, h) => s + h.vel, 0));
  }

  // Vélocité PI empirique = moyenne sur les PIs disponibles
  const avgPIVel = piVelocities.length
    ? Math.round(piVelocities.reduce((a, b) => a + b, 0) / piVelocities.length)
    : Math.round(velRef.avg * sprintsPerPI);

  // PIs nécessaires pour résorber le backlog simulé
  const pisNeeded     = Math.max(1, Math.ceil(sprintPlan.length / sprintsPerPI));
  const presentiels   = pisNeeded * presentielPerPI;
  const pisUsed       = piVelocities.length;

  // Barre PI empirique (mini histogram)
  const piMax = Math.max(...piVelocities, 1);
  const piBars = piVelocities.map((v, i) => {
    const pct = Math.round((v / piMax) * 100);
    return `<div class="rm-hist-bar-wrap" title="PI-${pisUsed - i}: ${v} pts">
      <div class="rm-hist-bar-zone"><div class="rm-hist-bar-inner" style="height:${Math.max(pct, 4)}%"></div></div>
      <div class="rm-hist-bar-val">${v}</div>
    </div>`;
  }).reverse().join(''); // Plus ancien → plus récent

  // Types de présentiels (2 par défaut)
  const _PRESENTIEL_TYPES = [
    { icon: '🗓️', label: 'PI Planning',      desc: '2 jours · alignment stratégique + backlog' },
    { icon: '🔍', label: 'Mid-PI Review',     desc: '½ jour · inspection + ajustements' },
    { icon: '🎯', label: 'PI Demo & Retro',   desc: '1 jour · démo système + rétrospective PI' },
    { icon: '🤝', label: 'Innovation Sprint', desc: '1 jour · IP Sprint planning présentiel' },
  ].slice(0, presentielPerPI);

  const typeRows = _PRESENTIEL_TYPES.map(pt => `
    <div class="rm-buf-row" style="padding:6px 0;border-bottom:1px solid var(--border);">
      <span class="rm-buf-icon">${pt.icon}</span>
      <div class="rm-buf-info">
        <div class="rm-buf-label">${pt.label}</div>
        <div class="rm-buf-desc">${pt.desc}</div>
      </div>
      <div class="rm-buf-right">
        <span class="rm-buf-pct" style="font-size:13px;font-weight:700;color:var(--primary);">×${pisNeeded}</span>
      </div>
    </div>`).join('');

  const confLabel = pisUsed
    ? `Empirique sur ${pisUsed} PI${pisUsed > 1 ? 's' : ''} (${pisUsed * sprintsPerPI} sprints)`
    : 'Cible config (pas d\'historique PI)';

  return `
    <div class="card rm-buf-card">
      <div class="rm-card-title">📍 Présentiels simulés
        <small class="rm-card-sub">${confLabel}</small>
      </div>
      <div class="rm-vel-main" style="margin-bottom:10px;">
        <div class="rm-vel-big">${presentiels}<small> sessions</small></div>
        <div class="rm-vel-sub">${pisNeeded} PI${pisNeeded > 1 ? 's' : ''} estimé${pisNeeded > 1 ? 's' : ''} · ${presentielPerPI} présentiel${presentielPerPI > 1 ? 's' : ''}/PI</div>
      </div>
      ${piBars ? `<div class="rm-hist-bars" style="margin-bottom:12px;">${piBars}</div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Vélocité PI empirique : <strong style="color:var(--text);">${avgPIVel} pts/PI</strong></div>
      <div class="rm-buf-rows">${typeRows}</div>
    </div>`;
}

// ============================================================
// Helper — ticket rows pour timeline avec expand + onclick modal
// ============================================================

let _rmTlUid = 0;

function _rmTicketRow(t) {
  return `<div class="rm-tl-ticket" onclick="openModal('${t.id}')" style="cursor:pointer;" title="${(t.title || '').replace(/"/g, '&quot;')}">
    ${priorityIcon(t.priority)}
    <span class="rm-tl-tid">${_jiraBrowse(t.id)}</span>
    <span class="rm-tl-ticket-title">${t.title || t.id}</span>
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
  // Label du sprint actif : nom du board de l'équipe sélectionnée si une seule équipe active
  const _activeTeams = getActiveTeams();
  const currentLabel = (_activeTeams.length === 1 && CONFIG.teams[_activeTeams[0]]?.sprintName)
    ? CONFIG.teams[_activeTeams[0]].sprintName
    : CONFIG.sprint.label || `Sprint ${CONFIG.sprint.current || 'Actif'}`;
  const tickets  = getTickets();
  const ptsDone  = tickets.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const ptsTotal = tickets.reduce((a, t) => a + (t.points || 0), 0) || 1;
  const pctDone  = Math.round(ptsDone / ptsTotal * 100);

  // Carte sprint passé : uniquement le dernier (sprint immédiatement précédent)
  const lastPast  = velRef.history.length ? [velRef.history[velRef.history.length - 1]] : [];
  const pastCards = lastPast.map(h => {
    const pct    = velRef.max ? Math.round(h.vel / velRef.max * 100) : 80;
    const target = Math.round(velRef.max || velRef.avg);
    return `<div class="rm-tl-card rm-tl-past">
      <div class="rm-tl-dot rm-tl-dot-past"></div>
      <div class="rm-tl-name">${h.name.replace(/sprint\s*/i, 'S ')}</div>
      <div class="rm-tl-pts">${h.vel} pts réalisés</div>
      <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-past" style="width:${pct}%"></div></div></div>
      <div class="rm-tl-badge rm-tl-badge-past">✓ Terminé</div>
    </div>`;
  });

  // Carte sprint actuel
  const pctBar = Math.min(100, pctDone);
  const currentCard = `<div class="rm-tl-card rm-tl-current">
    <div class="rm-tl-dot rm-tl-dot-current"></div>
    <div class="rm-tl-name">${currentLabel}</div>
    <div class="rm-tl-pts">${ptsDone} / ${ptsTotal} pts</div>
    <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-current" style="width:${pctBar}%"></div></div></div>
    <div class="rm-tl-badge rm-tl-badge-current">⚡ En cours</div>
    <div class="rm-tl-pct">${pctDone}%</div>
  </div>`;

  // Cartes sprints futurs simulés
  const futureCards = sprintPlan.map(sp => {
    const pct = cap80 ? Math.min(100, Math.round(sp.pts / cap80 * 100)) : 0;
    const ticketList = _rmTicketList(sp.tickets, 3);

    if (sp.isIP) {
      const ipTypes = {};
      sp.tickets.forEach(t => { ipTypes[t.type] = (ipTypes[t.type] || 0) + 1; });
      const ipPills = Object.entries(ipTypes).map(([type, cnt]) => {
        const c = CONFIG.typeColors[type] || '#475569';
        return `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${c}22;color:${c};border:1px solid ${c}44;font-weight:600;">${typeName(type)}×${cnt}</span>`;
      }).join(' ');
      return `<div class="rm-tl-card" style="border:2px solid #86EFAC;background:#F0FDF4;">
        <div class="rm-tl-dot" style="background:#22C55E;border-color:#fff;"></div>
        <div class="rm-tl-name">🍃 ${sp.name || 'IP Sprint'}</div>
        <div class="rm-tl-pts">${sp.pts} pts · dette, bugs, ops</div>
        <div class="rm-tl-badge rm-tl-badge-past" style="background:#D1FAE5;color:#065F46;">🍃 Innovation</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;">${ipPills}</div>
        ${ticketList}
      </div>`;
    }

    return `<div class="rm-tl-card rm-tl-future">
      <div class="rm-tl-dot rm-tl-dot-future"></div>
      <div class="rm-tl-name">${sp.name || 'Sprint +' + sp.idx}</div>
      <div class="rm-tl-pts">${sp.pts} / ${cap80} pts</div>
      <div class="rm-tl-bar-wrap"><div class="rm-tl-bar"><div class="rm-tl-fill rm-tl-fill-future" style="width:${pct}%"></div></div></div>
      <div class="rm-tl-badge rm-tl-badge-future">🗓️ Planifié</div>
      ${ticketList}
    </div>`;
  });

  if (!pastCards.length && !futureCards.length) return '';

  const allCards = [...pastCards, currentCard, ...futureCards].join('');
  const label = `${pastCards.length} passé${pastCards.length > 1 ? 's' : ''} · sprint actuel · ${futureCards.length} planifié${futureCards.length > 1 ? 's' : ''}`;

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📅 Chronologie des sprints</div>
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
          <span class="rm-sprint-pts" style="color:var(--text-muted)">— / ${cap80} pts</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Backlog insuffisant</div>
      </div>`;
    }

    const pct   = cap80 ? Math.min(100, Math.round(s.pts / cap80 * 100)) : 0;
    const color = pct >= 95 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)';

    const typeGroups = {};
    s.tickets.forEach(t => { typeGroups[t.type] = (typeGroups[t.type] || 0) + 1; });
    const typePills = Object.entries(typeGroups).map(([type, cnt]) => {
      const c = CONFIG.typeColors[type] || '#475569';
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

  // Sprint 5 — Innovation & Planning (IP sprint SAFe)
  const ipRows = _BUFFER_CATS.map(cat => {
    const pts = Math.round((cap20 || 0) * cat.pct / 20); // pct sur les 20% du buffer
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid #D1FAE5">
      <span>${cat.icon}</span>
      <span style="flex:1;color:var(--text)">${cat.label}</span>
      <span style="font-weight:700;color:#15803D">~${pts} pts</span>
    </div>`;
  }).join('');

  const ipCard = `<div class="rm-sprint-card rm-sprint-card-ip">
    <div class="rm-sprint-header">
      <span class="rm-sprint-label" style="color:#15803D">🍃 Innovation &amp; Planning</span>
    </div>
    <div style="font-size:11px;color:#15803D;font-weight:600;margin-bottom:8px">${cap20} pts · buffer PI</div>
    <div>${ipRows}</div>
    <div style="font-size:10px;color:#6B7280;margin-top:8px;font-style:italic">Retrospective · PI Planning · Exploration · Réduction dette</div>
  </div>`;

  const overflowCount = Math.max(0, plan.length - PI_SPRINTS);
  const subtitle = overflowCount
    ? `Capacité feature: ${cap80} pts/sprint · ${overflowCount} sprint${overflowCount > 1 ? 's' : ''} supplémentaire${overflowCount > 1 ? 's' : ''} dans le backlog`
    : `Capacité feature: ${cap80} pts/sprint · priorité critique → haute → moyenne → basse`;

  return `
    <div style="margin-bottom:20px;">
      <div class="section-header">
        <div class="section-title">📋 Simulation — PI Suivant</div>
        <span style="font-size:12px;color:var(--text-muted)">${subtitle}</span>
      </div>
      <div class="rm-sprint-grid">${featureCards}${ipCard}</div>
    </div>`;
}

// ============================================================
// Calendrier PI Suivant — jours ouvrés & présentiels
// ============================================================

// Détecte automatiquement la date de début du PI Suivant depuis les données JIRA
// Priorité 1 : tickets backlog avec sprintName "PI#29" → utilise sprintStart si dispo
// Priorité 2 : parse le nom du sprint actif "Ité 28.4" → calcule le reste du PI courant
function _detectNextPIStart() {
  const sprintsPerPI   = (CONFIG.sprint && CONFIG.sprint.sprintsPerPI)                               || 5;
  const durationDays   = (CONFIG.sprint && CONFIG.sprint.durationDays)                               || 14;
  const sprintStartDay = (CONFIG.sprint && CONFIG.sprint.sprintStartDay != null ? CONFIG.sprint.sprintStartDay : 5);

  // Priorité 1 — sprints nommés "PI#xx" / "#PIxx" / "PI xx" dans BACKLOG_TICKETS
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

  // Priorité 2 — parse "Ité 28.4" depuis CONFIG.teams[X].sprintName
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
  renderPIPrep();
}
function _setPISprintPres(v, i) {
  try {
    const a = JSON.parse(localStorage.getItem('rm_pi_pres') || '[]');
    while (a.length <= i) a.push(0);
    a[i] = Math.max(0, parseInt(v, 10) || 0);
    localStorage.setItem('rm_pi_pres', JSON.stringify(a));
  } catch (e) { /* ignore */ }
  renderPIPrep();
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

    const borderColor = s.isIP ? '#86EFAC' : isSugg ? '#FCD34D' : 'var(--border)';
    const bgColor     = s.isIP ? '#F0FDF4' : isSugg   ? '#FFFBEB' : 'var(--card)';
    const wdColor     = s.workDays < 8 ? '#DC2626' : s.workDays < 10 ? '#D97706' : '#16A34A';
    const capColor    = s.workDays < 8 ? '#DC2626' : s.workDays < 10 ? '#D97706' : 'var(--text-muted)';
    const inputBorder = s.pres > 0 ? '#F59E0B' : 'var(--border)';
    const inputBg     = s.pres > 0 ? '#FFFBEB' : 'var(--card)';
    const inputClr    = s.pres > 0 ? '#92400E' : 'var(--text)';

    const holBadges = s.inPeriod.map(h =>
      `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:500;background:#FEE2E2;color:#991B1B;border:1px solid #FECACA;padding:2px 7px;border-radius:20px;margin:2px 3px 2px 0;">🇫🇷 ${h.name}</span>`
    ).join('');

    const bottomBadge = s.isIP
      ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0;padding:2px 9px;border-radius:20px;">🍃 Innovation &amp; Planning</div>`
      : isSugg && presType
        ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;padding:2px 9px;border-radius:20px;">${presType.icon} ${presType.label} <span style="font-weight:400;opacity:.7">${presType.note}</span></div>`
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
            ${storedStart ? `<button onclick="localStorage.removeItem('rm_pi_start');renderPIPrep();" style="font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text-muted);cursor:pointer;" title="Revenir à la détection automatique">↺ auto</button>` : ''}
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
  const healthBg    = healthPct >= 80 ? '#F0FDF4' : healthPct >= 50 ? '#FFFBEB' : '#FEF2F2';
  const healthIcon  = healthPct >= 80 ? '✅' : healthPct >= 50 ? '⚠️' : '🔴';

  const kpi = (icon, label, count, color) => count > 0 ? `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:${color}11;border:1px solid ${color}33;border-radius:8px;">
      <span style="font-size:14px">${icon}</span>
      <span style="font-size:20px;font-weight:800;color:${color}">${count}</span>
      <span style="font-size:11px;color:var(--text-muted)">${label}</span>
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
        ${kpi('📭', 'sans Epic', noEpic.length, '#DC2626')}
        ${kpi('🔢', 'sans points', noPoints.length, '#F59E0B')}
        ${kpi('⚖️', 'sans priorité', noPriority.length, '#D97706')}
        ${kpi('⏳', `inactif >${agingSprints} sprints`, aging.length, '#64748B')}
      </div>
    </div>`;
}

function _roadmapBacklogTable(backlog, cap80) {
  if (!backlog.length) return '';

  const totalPts  = backlog.reduce((s, t) => s + (t.points || 0), 0);
  const sprintEst = cap80 ? Math.ceil(totalPts / cap80) : '—';
  const unpointed = backlog.filter(t => !t.points).length;

  const rows = backlog.map(t => {
    const epic = EPICS.find(e => e.id === t.epic);
    const tc   = CONFIG.typeColors[t.type] || '#475569';
    const sn = t.sprintName || '';
    // Short sprint label: remove team prefix (e.g. "Fuego - Ité. 28.4" → "Ité. 28.4")
    const snShort = sn.replace(/^[^-]+-\s*/, '') || '—';
    return `<tr class="rm-backlog-row" onclick="openModal('${t.id}')" style="cursor:pointer">
      <td style="width:28px">${priorityIcon(t.priority)}</td>
      <td style="white-space:nowrap">${_jiraBrowse(t.id)}</td>
      <td class="rm-bt-title">${t.title || '—'}</td>
      <td><span class="badge" style="background:${tc}22;color:${tc};border:1px solid ${tc}44">${typeName(t.type)}</span></td>
      <td>${epic ? `<span style="background:${epic.color || '#2563eb'}22;color:${epic.color || '#2563eb'};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;display:inline-block">${epic.title}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-muted)" title="${sn}">${snShort}</td>
      <td style="text-align:right">${ptsBadge(t.points, {size:'small'})}</td>
    </tr>`;
  }).join('');

  return `
    <div>
      <div class="section-header">
        <div class="section-title">📋 Backlog non planifié — ${backlog.length} ticket${backlog.length > 1 ? 's' : ''} · ${totalPts} pts · ~${sprintEst} sprint${sprintEst > 1 ? 's' : ''}</div>
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
