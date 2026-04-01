// ============================================================
// INNOVATIONS - Features d'innovation
// Critère : type JIRA "Feature" + étiquette contenant "inno"
// Les tickets enfants (stories, bugs, tâches…) sont regroupés
// sous leur Feature parent et suivis par PI avec board visuel.
// Indicateurs en nombre de tickets (pas de story points).
// ============================================================

// État interne
let _innoSelectedPI = undefined; // undefined = pas encore choisi, null = tous les PIs

// --- Extraction du numéro PI depuis un ticket ou un titre ---
function _innoPINum(t) {
  if (t.piSprint) {
    const m = t.piSprint.match(/(\d+)/);
    if (m) return parseInt(m[1]);
  }
  const src = t.sprintName || '';
  const sm = src.match(/(\d{2,3})\.\d+/);
  if (sm) return parseInt(sm[1]);
  if (t.allSprints) {
    for (const s of t.allSprints) {
      const am = (s || '').match(/(\d{2,3})\.\d+/);
      if (am) return parseInt(am[1]);
    }
  }
  // Extraire depuis le titre (ex: "Journées d'Innovation - Ité 28.5" → 28)
  if (t.title) {
    const tm = t.title.match(/(\d{2,3})\.\d+/);
    if (tm) return parseInt(tm[1]);
  }
  return null;
}

// --- Détection sprint x.5 (sprint innovation/IP) ---
function _innoIsIPSprint() {
  const label = CONFIG.sprint?.label || '';
  const m = label.match(/(\d{2,3})\.(\d+)/);
  return m ? { pi: parseInt(m[1]), sprint: parseInt(m[2]), isIP: m[2] === '5' || parseInt(m[2]) === (CONFIG.sprint?.sprintsPerPI || 5) } : null;
}

// --- Collecte des tickets d'innovation ---
function _innoCollect() {
  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : Object.keys(CONFIG.teams || {});
  const teamSet = new Set(activeTeams);
  const features = typeof INNO_FEATURES !== 'undefined' ? INNO_FEATURES : [];
  const featureIds = new Set(features.map(f => f.id));

  // On lit directement TICKETS (pas getTickets()) pour inclure les tickets sans équipe
  const allTickets = [
    ...(typeof TICKETS !== 'undefined' ? TICKETS : []),
    ...(typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : []),
  ];

  const seen = new Set();
  const tickets = allTickets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return !t.team || !teamSet.size || teamSet.has(t.team);
  });

  const children = tickets.filter(t => t.epic && featureIds.has(t.epic));

  const epics = typeof EPICS !== 'undefined' ? EPICS : [];
  const innoEpicIds = new Set(featureIds);
  epics.forEach(e => {
    if ((e.title || '').toLowerCase().includes('innovation')) innoEpicIds.add(e.id);
  });
  tickets.forEach(t => {
    if (seen.has('child-' + t.id)) return;
    if (featureIds.has(t.id)) return;
    const hasInnoLabel = (t.labels || []).some(l => l === 'inno' || l === 'innovation');
    const hasInnoEpic = t.epic && innoEpicIds.has(t.epic);
    if ((hasInnoLabel || hasInnoEpic) && !children.some(c => c.id === t.id)) {
      children.push(t);
    }
  });

  const groups = {};
  features.forEach(f => {
    groups[f.id] = {
      feature: f,
      title: f.title,
      color: CONFIG.teams[f.assignee]?.color || '#6366F1',
      children: [],
    };
  });

  children.forEach(t => {
    const parentKey = t.epic;
    if (!parentKey) return;
    if (!groups[parentKey]) {
      const epic = epics.find(e => e.id === parentKey);
      groups[parentKey] = {
        feature: { id: parentKey, title: epic?.title || parentKey, status: 'todo', labels: [] },
        title: epic?.title || parentKey,
        color: epic?.color || '#6366F1',
        children: [],
      };
    }
    groups[parentKey].children.push(t);
  });

  return { features, groups, children, activeTeams };
}

// --- PIs disponibles ---
function _innoAvailablePIs(groups) {
  const pis = new Set();
  Object.values(groups).forEach(g => {
    g.children.forEach(t => {
      const pi = _innoPINum(t);
      if (pi) pis.add(pi);
    });
    const fpi = _innoPINum(g.feature);
    if (fpi) pis.add(fpi);
  });
  const sprintInfo = _innoIsIPSprint();
  if (sprintInfo) pis.add(sprintInfo.pi);
  return [...pis].sort((a, b) => b - a);
}

// --- Rendu principal ---
function renderInno() {
  const el = document.getElementById('inno-content');
  if (!el) return;

  const { features, groups } = _innoCollect();
  const sprintInfo = _innoIsIPSprint();
  const availablePIs = _innoAvailablePIs(groups);

  if (_innoSelectedPI === undefined && sprintInfo) _innoSelectedPI = sprintInfo.pi;

  // Filtrer par PI sélectionné (basé sur le PI de la Feature parent)
  const filteredGroups = {};
  Object.entries(groups).forEach(([key, g]) => {
    if (!_innoSelectedPI) { filteredGroups[key] = g; return; }
    // Le PI du groupe est celui de la Feature (extrait du titre, ex: "Ité 28.5" → 28)
    const groupPI = _innoPINum(g.feature);
    if (groupPI === _innoSelectedPI || groupPI === null) {
      filteredGroups[key] = g;
    }
  });

  const groupKeys = Object.keys(filteredGroups);

  // Stats globales — en nombre de tickets
  const allTix = [];
  groupKeys.forEach(k => filteredGroups[k].children.forEach(t => allTix.push(t)));
  const total    = allTix.length;
  const todoTix  = allTix.filter(t => t.status === 'todo' || t.status === 'backlog').length;
  const wipTix   = allTix.filter(t => ['inprog', 'review', 'test'].includes(t.status)).length;
  const doneTix  = allTix.filter(t => isDone(t.status)).length;
  const donePct  = total ? Math.round(doneTix / total * 100) : 0;

  // --- PI selector sticky bar ---
  const piOptions = typeof _piSelectOptions === 'function'
    ? _piSelectOptions(String(_innoSelectedPI || ''), { allOption: 'Tous les PIs' })
    : availablePIs.map(pi => `<option value="${pi}" ${pi === _innoSelectedPI ? 'selected' : ''}>PI ${pi}</option>`).join('');

  const isIP = sprintInfo?.isIP;
  const ipBanner = isIP ? `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#F59E0B20,#F59E0B10);border:1px solid #F59E0B40;font-size:12px;font-weight:600;color:#D97706;">
      🔥 Sprint IP ${sprintInfo.pi}.${sprintInfo.sprint} actif — Innovation en cours
    </div>` : '';

  const stickyBar = `
    <div style="position:sticky;top:0;z-index:10;background:var(--bg-main);padding:12px 0 8px;border-bottom:1px solid var(--border);margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <select onchange="_innoSelectPI(this.value)" style="padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;">
        ${piOptions}
      </select>
      ${ipBanner}
      <div style="flex:1"></div>
      <span style="font-size:11px;color:var(--text-muted);">${groupKeys.length} initiative${groupKeys.length > 1 ? 's' : ''} · ${total} tickets</span>
    </div>`;

  // --- Progress bar pleine largeur ---
  const wipPct  = total ? Math.round(wipTix / total * 100) : 0;
  const pctColor = donePct >= 80 ? CLR.darkGrn : donePct >= 50 ? CLR.darkAmber : CLR.purple;
  const progressBar = `
    <div style="position:relative;height:22px;border-radius:6px;overflow:hidden;background:var(--border);margin-bottom:16px;">
      <div style="height:100%;width:${donePct}%;background:#16A34A;float:left;transition:width .3s"></div>
      <div style="height:100%;width:${wipPct}%;background:#3B82F6;float:left;transition:width .3s"></div>
      <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);">${donePct}% — ${doneTix}/${total} tickets</span>
    </div>`;

  // --- KPI cards : À faire / En cours / Terminé ---
  const kpis = `
    <div class="rel-header" style="margin-top:0;">
      <div class="rel-kpi" style="cursor:default"><div class="rel-kpi-val" style="color:#94A3B8">⬜ ${todoTix}</div><div class="rel-kpi-label">À faire</div></div>
      <div class="rel-kpi" style="cursor:default"><div class="rel-kpi-val" style="color:#3B82F6">🔵 ${wipTix}</div><div class="rel-kpi-label">En cours</div></div>
      <div class="rel-kpi" style="cursor:default"><div class="rel-kpi-val" style="color:#16A34A">✅ ${doneTix}</div><div class="rel-kpi-label">Terminé</div></div>
    </div>`;

  // --- Empty state ---
  if (!groupKeys.length && !features.length) {
    el.innerHTML = `
      ${stickyBar}${progressBar}${kpis}
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
        <div style="font-size:48px;margin-bottom:16px;">💡</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Aucune initiative d'innovation</div>
        <div style="font-size:13px;">Créez une <strong>Feature</strong> JIRA avec l'étiquette <code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px;">Inno</code> et ajoutez-y des tickets enfants.</div>
      </div>`;
    return;
  }

  if (!groupKeys.length) {
    el.innerHTML = `
      ${stickyBar}${progressBar}${kpis}
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:32px;margin-bottom:12px;">📭</div>
        <div style="font-size:14px;font-weight:600;">Aucun ticket pour PI ${_innoSelectedPI}</div>
        <div style="font-size:12px;margin-top:4px;">Sélectionnez un autre PI ou vérifiez les sprints associés.</div>
      </div>`;
    return;
  }

  // --- Initiative cards with mini-board ---
  const cards = groupKeys.map(key => {
    const g = filteredGroups[key];
    const all = g.children;
    const gTotal = all.length;
    const gDone  = all.filter(t => isDone(t.status)).length;
    const gWip   = all.filter(t => ['inprog', 'review', 'test'].includes(t.status)).length;
    const gTodo  = all.filter(t => t.status === 'todo' || t.status === 'backlog').length;
    const gPct   = gTotal ? Math.round(gDone / gTotal * 100) : 0;
    const gDoneW = gTotal ? Math.round(gDone / gTotal * 100) : 0;
    const gWipW  = gTotal ? Math.round(gWip / gTotal * 100) : 0;
    const gColor = gPct >= 80 ? '#16A34A' : gPct >= 50 ? '#D97706' : '#6366F1';

    // Colonnes du board
    const colTodo  = all.filter(t => t.status === 'todo' || t.status === 'backlog');
    const colWip   = all.filter(t => ['inprog', 'review', 'test'].includes(t.status));
    const colBlk   = all.filter(t => t.status === 'blocked');
    const colDone  = all.filter(t => isDone(t.status));

    // Teams impliquées
    const teamIds = [...new Set(all.map(t => t.team).filter(Boolean))];
    const teamBadges = teamIds.map(tid => {
      const tc = CONFIG.teams[tid];
      if (!tc) return '';
      return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:${tc.color || 'var(--text-muted)'};font-weight:600;">
        <span style="width:7px;height:7px;border-radius:50%;background:${tc.color || '#94A3B8'}"></span>${tc.name || tid}
      </span>`;
    }).filter(Boolean).join(' ');

    // Sprints impliqués
    const sprints = [...new Set(all.map(t => {
      const sm = (t.sprintName || '').match(/(\d{2,3}\.\d+)/);
      return sm ? sm[1] : null;
    }).filter(Boolean))].sort();
    const sprintBadges = sprints.map(s => {
      const isCurrentSprint = (CONFIG.sprint?.label || '').includes(s);
      return `<span style="font-size:9px;padding:2px 5px;border-radius:3px;${isCurrentSprint ? 'background:#3B82F620;color:#3B82F6;border:1px solid #3B82F640;font-weight:700;' : 'background:var(--bg);color:var(--text-muted);border:1px solid var(--border);'}">${s}</span>`;
    }).join(' ');

    const renderTicketCard = (t) => {
      const done = isDone(t.status);
      const statusIcon = done ? '✅' : t.status === 'blocked' ? '🚧' : t.status === 'review' ? '👀' : t.status === 'test' ? '🧪' : t.status === 'inprog' ? '🔵' : '⬜';
      const tc = t.team ? CONFIG.teams[t.team] : null;
      return `
        <div onclick="openModal('${t.id}')" style="padding:6px 8px;margin-bottom:4px;border-radius:6px;background:var(--bg);border:1px solid var(--border);cursor:pointer;font-size:11px;transition:box-shadow .15s;${done ? 'opacity:.6;' : ''}" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.1)'" onmouseout="this.style.boxShadow='none'">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">
            <span>${statusIcon}</span>
            <span class="badge badge-${t.type}" style="font-size:8px;padding:1px 4px;">${typeName(t.type)}</span>
            <span style="font-size:9px;color:var(--text-muted);font-weight:600;">${t.id}</span>
          </div>
          <div style="font-size:11px;color:var(--text);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.title)}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:3px;">
            ${tc ? `<span style="width:6px;height:6px;border-radius:50%;background:${tc.color || '#94A3B8'};flex-shrink:0;"></span>` : ''}
            ${t.assignee ? `<span style="font-size:9px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.assignee.split(' ')[0])}</span>` : '<span style="font-size:9px;color:var(--text-muted);font-style:italic;">Non assigné</span>'}
          </div>
        </div>`;
    };

    const renderColumn = (title, icon, tickets, color, count) => `
      <div style="flex:1;min-width:140px;">
        <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;margin-bottom:6px;font-size:11px;font-weight:700;color:${color};">
          ${icon} ${title} <span style="font-weight:400;color:var(--text-muted);font-size:10px;">(${count})</span>
        </div>
        <div style="min-height:40px;">
          ${tickets.length ? tickets.map(renderTicketCard).join('') : `<div style="padding:12px;text-align:center;font-size:10px;color:var(--text-muted);font-style:italic;">—</div>`}
        </div>
      </div>`;

    return `
      <div class="card" style="margin-bottom:16px;border-left:3px solid ${gColor};overflow:hidden;">
        <!-- Header -->
        <div style="padding:14px 16px 10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:20px;">💡</span>
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;font-size:14px;color:var(--text);">${escapeHtml(g.title)}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
              ${teamBadges} ${sprintBadges}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:11px;color:var(--text-muted);line-height:1.3;">
              <span style="color:#94A3B8;">${gTodo} à faire</span> · <span style="color:#3B82F6;">${gWip} en cours</span> · <span style="color:#16A34A;">${gDone} terminé${gDone > 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>
        <!-- Progress bar pleine largeur -->
        <div style="position:relative;height:16px;background:var(--border);display:flex;overflow:hidden;">
          <div style="width:${gDoneW}%;background:#16A34A;transition:width .3s"></div>
          <div style="width:${gWipW}%;background:#3B82F6;transition:width .3s"></div>
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);">${gPct}%</span>
        </div>
        <!-- Mini board -->
        <div style="display:flex;gap:8px;padding:10px 12px;overflow-x:auto;">
          ${renderColumn('À faire', '⬜', colTodo, '#94A3B8', colTodo.length)}
          ${renderColumn('En cours', '🔵', colWip, '#3B82F6', colWip.length)}
          ${colBlk.length ? renderColumn('Bloqué', '🚧', colBlk, '#EF4444', colBlk.length) : ''}
          ${renderColumn('Terminé', '✅', colDone, '#16A34A', colDone.length)}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `${stickyBar}${progressBar}${kpis}${cards}`;
}

// --- Sélection PI ---
function _innoSelectPI(val) {
  _innoSelectedPI = val ? parseInt(val) : null; // null = tous les PIs
  renderInno();
}
