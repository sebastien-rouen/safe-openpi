// ============================================================
// RELEASES VIEW — Gantt timeline, burnup par feature, projection
// ============================================================

function renderReleases() {
  const el = document.getElementById('releases-content');
  if (!el) return;

  const tickets = getTickets();
  if (!tickets.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Synchronisez les donn\u00e9es JIRA pour afficher les releases.</div>';
    return;
  }

  const now = new Date();
  const s = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  const teams = getActiveTeams();

  // ---- Data aggregation ----
  const epics = (typeof EPICS !== 'undefined' ? EPICS : []).filter(e => !e.team || teams.includes(e.team));
  const features = (typeof FEATURES !== 'undefined' ? FEATURES : []).slice();

  // Build feature progress map
  const featureData = features.map(f => {
    const fEpics = epics.filter(e => e.feature === f.id);
    const epicIds = new Set(fEpics.map(e => e.id));
    const fTickets = tickets.filter(t => epicIds.has(t.epic));
    const totalPts = fTickets.reduce((a, t) => a + (t.points || 0), 0);
    const donePts = fTickets.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
    const pct = totalPts ? Math.round(donePts / totalPts * 100) : 0;
    const total = fTickets.length;
    const done = fTickets.filter(t => t.status === 'done').length;
    const blocked = fTickets.filter(t => t.status === 'blocked').length;
    const inprog = fTickets.filter(t => t.status === 'inprog' || t.status === 'review').length;
    return { ...f, epics: fEpics, tickets: fTickets, totalPts, donePts, pct, total, done, blocked, inprog };
  }).filter(f => f.tickets.length > 0);

  // ---- Sprint timeline for Gantt ----
  const velHistory = [];
  const allTeams = _allTeams();
  allTeams.forEach(t => {
    const hist = CONFIG.teams[t]?.velocityHistory || [];
    hist.forEach((h, i) => {
      if (!velHistory[i]) velHistory[i] = { name: h.name, velocity: 0 };
      velHistory[i].velocity += h.velocity || 0;
    });
  });

  // Current sprint info
  const currentVel = tickets.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const avgVelocity = velHistory.length
    ? Math.round(velHistory.reduce((a, v) => a + v.velocity, 0) / velHistory.length)
    : (currentVel || 40);

  // Projection: remaining pts per feature, sprints needed
  const projections = featureData.map(f => {
    const remaining = f.totalPts - f.donePts;
    const sprintsNeeded = avgVelocity > 0 ? Math.ceil(remaining / (avgVelocity * (f.totalPts / Math.max(1, tickets.reduce((a, t) => a + (t.points || 0), 0))))) : 0;
    return { ...f, remaining, sprintsNeeded };
  });

  // ---- Overall metrics ----
  const totalPtsAll = tickets.reduce((a, t) => a + (t.points || 0), 0);
  const donePtsAll = tickets.filter(t => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const pctAll = totalPtsAll ? Math.round(donePtsAll / totalPtsAll * 100) : 0;
  const remainingPts = totalPtsAll - donePtsAll;
  const sprintsToComplete = avgVelocity > 0 ? Math.ceil(remainingPts / avgVelocity) : '?';

  // ---- Render ----
  el.innerHTML = `
    <div class="rel-header">
      <div class="rel-kpi">
        <div class="rel-kpi-val">${pctAll}%</div>
        <div class="rel-kpi-label">Avancement global</div>
      </div>
      <div class="rel-kpi">
        <div class="rel-kpi-val">${donePtsAll}<small>/${totalPtsAll} pts</small></div>
        <div class="rel-kpi-label">Points termin\u00e9s</div>
      </div>
      <div class="rel-kpi">
        <div class="rel-kpi-val">${avgVelocity}<small> pts/sprint</small></div>
        <div class="rel-kpi-label">V\u00e9locit\u00e9 moyenne</div>
      </div>
      <div class="rel-kpi">
        <div class="rel-kpi-val">${sprintsToComplete}<small> sprints</small></div>
        <div class="rel-kpi-label">Estimation restante</div>
      </div>
      <div class="rel-kpi">
        <div class="rel-kpi-val">${featureData.length}</div>
        <div class="rel-kpi-label">Features actives</div>
      </div>
    </div>

    <div class="section-header" style="margin-top:20px;">
      <div class="section-title">\ud83d\udcc5 Gantt Features</div>
      <span style="font-size:12px;color:var(--text-muted)">Avancement par feature \u00b7 cliquer pour d\u00e9tail</span>
    </div>
    <div class="rel-gantt-wrap">
      ${_relGanttChart(featureData)}
    </div>

    <div class="section-header" style="margin-top:20px;">
      <div class="section-title">\ud83d\udcc8 Burnup par Feature</div>
    </div>
    <div class="rel-burnup-grid">
      ${featureData.slice(0, 8).map(f => _relBurnupCard(f)).join('')}
    </div>

    <div class="section-header" style="margin-top:20px;">
      <div class="section-title">\ud83d\udd2e Projection</div>
      <span style="font-size:12px;color:var(--text-muted)">Bas\u00e9e sur la v\u00e9locit\u00e9 moyenne (${avgVelocity} pts/sprint)</span>
    </div>
    <div class="rel-projection-table">
      ${_relProjectionTable(projections, avgVelocity, s)}
    </div>
  `;

  // Render burnup mini-charts
  setTimeout(() => _relRenderBurnupCharts(featureData.slice(0, 8)), 50);
}

// ============================================================
// Gantt horizontal bar chart
// ============================================================
function _relGanttChart(features) {
  if (!features.length) return '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Aucune feature avec des tickets</div>';

  const maxPts = Math.max(...features.map(f => f.totalPts), 1);

  return `<div class="rel-gantt">
    ${features.map(f => {
      const w = Math.max(8, Math.round(f.totalPts / maxPts * 100));
      const donePct = f.pct;
      const wipPct = f.totalPts ? Math.round(f.inprog / f.total * 100) : 0;
      const blockedPct = f.totalPts ? Math.round(f.blocked / f.total * 100) : 0;
      const color = CONFIG.typeColors.feature || '#B45309';
      const statusColor = donePct === 100 ? '#16A34A' : donePct > 50 ? '#2563EB' : donePct > 0 ? '#F59E0B' : '#94A3B8';

      return `<div class="rel-gantt-row">
        <div class="rel-gantt-label" title="${f.title || f.id}">
          <span class="rel-gantt-id" style="color:${color}">${f.id}</span>
          <span class="rel-gantt-title">${(f.title || '').slice(0, 40)}${(f.title || '').length > 40 ? '\u2026' : ''}</span>
        </div>
        <div class="rel-gantt-bar-wrap">
          <div class="rel-gantt-bar" style="width:${w}%;">
            <div class="rel-gantt-fill rel-gantt-fill-done" style="width:${donePct}%;background:${statusColor};"></div>
            <div class="rel-gantt-fill rel-gantt-fill-wip" style="width:${wipPct}%;background:${statusColor};opacity:.35;"></div>
            ${blockedPct > 0 ? `<div class="rel-gantt-fill rel-gantt-fill-blocked" style="width:${blockedPct}%;background:#DC2626;opacity:.5;"></div>` : ''}
          </div>
          <span class="rel-gantt-pct" style="color:${statusColor}">${donePct}%</span>
        </div>
        <div class="rel-gantt-meta">
          <span title="Termin\u00e9s">\u2705 ${f.done}</span>
          <span title="En cours">\ud83d\udd04 ${f.inprog}</span>
          ${f.blocked ? `<span title="Bloqu\u00e9s" style="color:#DC2626">\ud83d\udea7 ${f.blocked}</span>` : ''}
          <span style="color:var(--text-muted)">${f.donePts}/${f.totalPts}pts</span>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:16px;padding:8px 0 0 140px;font-size:10px;color:var(--text-muted);">
      <span>\u2588 Termin\u00e9</span>
      <span style="opacity:.5">\u2588 En cours</span>
      <span style="color:#DC2626">\u2588 Bloqu\u00e9</span>
    </div>
  </div>`;
}

// ============================================================
// Burnup mini-cards (canvas rendered after DOM insert)
// ============================================================
function _relBurnupCard(f) {
  const color = CONFIG.typeColors.feature || '#B45309';
  const statusColor = f.pct === 100 ? '#16A34A' : f.pct > 50 ? '#2563EB' : '#F59E0B';
  return `<div class="rel-burnup-card">
    <div class="rel-burnup-header">
      <span style="font-weight:700;color:${color};font-size:11px;">${f.id}</span>
      <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.title || ''}</span>
      <span style="font-weight:700;color:${statusColor};font-size:12px;">${f.pct}%</span>
    </div>
    <div class="rel-burnup-chart-wrap"><canvas id="rel-burnup-${f.id.replace(/[^a-zA-Z0-9]/g, '_')}" height="100"></canvas></div>
    <div class="rel-burnup-footer">
      <span>${f.donePts}/${f.totalPts} pts</span>
      <span>${f.done}/${f.total} tickets</span>
      ${f.blocked ? `<span style="color:#DC2626">${f.blocked} bloqu\u00e9${f.blocked > 1 ? 's' : ''}</span>` : ''}
    </div>
  </div>`;
}

function _relRenderBurnupCharts(features) {
  features.forEach(f => {
    const canvasId = `rel-burnup-${f.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Simulate burnup data from ticket statuses (simplified: scope line + done line)
    const total = f.totalPts;
    const done = f.donePts;
    const steps = 10;
    const scopeData = Array.from({ length: steps }, () => total);
    const doneData = Array.from({ length: steps }, (_, i) => Math.round(done * (i + 1) / steps));
    const labels = Array.from({ length: steps }, (_, i) => `S${i + 1}`);

    const statusColor = f.pct === 100 ? '#16A34A' : f.pct > 50 ? '#2563EB' : '#F59E0B';

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Scope',
            data: scopeData,
            borderColor: '#94A3B8',
            borderDash: [4, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Done',
            data: doneData,
            borderColor: statusColor,
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            backgroundColor: statusColor + '18',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,.94)',
            titleFont: { size: 11 },
            bodyFont: { size: 11 },
            padding: 8,
            cornerRadius: 6,
          },
        },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true },
        },
      },
    });
  });
}

// ============================================================
// Projection table
// ============================================================
function _relProjectionTable(projections, avgVelocity, sprint) {
  if (!projections.length) return '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Aucune donn\u00e9e de projection</div>';

  const durationDays = CONFIG.sprint.durationDays || 14;

  return `<table class="rel-proj-table">
    <thead>
      <tr>
        <th>Feature</th>
        <th>Total</th>
        <th>Done</th>
        <th>Restant</th>
        <th>Avancement</th>
        <th>Sprints estim\u00e9s</th>
        <th>Date estim\u00e9e</th>
      </tr>
    </thead>
    <tbody>
      ${projections.map(f => {
        const remaining = f.totalPts - f.donePts;
        // Share of velocity proportional to feature weight
        const featureShare = f.totalPts / Math.max(1, projections.reduce((a, p) => a + p.totalPts, 0));
        const featureVel = Math.max(1, Math.round(avgVelocity * featureShare));
        const sprints = remaining > 0 ? Math.ceil(remaining / featureVel) : 0;
        const estDate = sprint.endDate ? (() => {
          const d = new Date(sprint.endDate);
          d.setDate(d.getDate() + sprints * durationDays);
          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        })() : '—';
        const color = f.pct === 100 ? '#16A34A' : f.pct > 70 ? '#2563EB' : f.pct > 30 ? '#F59E0B' : '#DC2626';
        const barColor = color;

        return `<tr>
          <td>
            <span style="font-weight:700;color:${CONFIG.typeColors.feature || '#B45309'};font-size:11px;">${f.id}</span>
            <span style="font-size:11px;color:var(--text);margin-left:4px;">${(f.title || '').slice(0, 30)}${(f.title || '').length > 30 ? '\u2026' : ''}</span>
          </td>
          <td style="text-align:center;font-weight:600;">${f.totalPts}</td>
          <td style="text-align:center;color:#16A34A;font-weight:600;">${f.donePts}</td>
          <td style="text-align:center;color:${remaining > 0 ? '#F59E0B' : '#16A34A'};font-weight:600;">${remaining}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${f.pct}%;background:${barColor};border-radius:3px;"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${color};min-width:32px;text-align:right;">${f.pct}%</span>
            </div>
          </td>
          <td style="text-align:center;font-weight:700;">${f.pct === 100 ? '\u2705' : sprints}</td>
          <td style="text-align:center;font-size:11px;color:var(--text-muted);">${f.pct === 100 ? 'Termin\u00e9' : estDate}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}
