// ============================================================
// KANBAN VIEW — Flux continu, limites WIP, répartition, cycle time
// ============================================================

function renderKanban() {
  const tickets = getTickets();

  const cols = [
    { key: 'backlog', label: 'Backlog',   wip: CONFIG.wip.backlog, color: '#94A3B8' },
    { key: 'todo',    label: 'À faire',   wip: CONFIG.wip.todo,    color: '#64748B' },
    { key: 'inprog',  label: 'En cours',  wip: CONFIG.wip.inprog,  color: '#3B82F6' },
    { key: 'review',  label: 'En review', wip: CONFIG.wip.review,  color: '#06B6D4' },
    { key: 'test',    label: 'En test',   wip: CONFIG.wip.test,    color: '#F59E0B' },
    { key: 'done',    label: 'Terminé',   wip: CONFIG.wip.done,    color: '#10B981' },
  ];

  // Métriques réelles
  const doneCnt    = tickets.filter(t => t.status === 'done').length;
  const inprogCnt  = tickets.filter(t => t.status === 'inprog').length;
  const reviewCnt  = tickets.filter(t => t.status === 'review').length;
  const blockedCnt = blocked_count(tickets);
  const bufferTk   = tickets.filter(t => t.buffer);
  const bufferPts  = bufferTk.reduce((a, t) => a + (t.points || 0), 0);

  const kanbanStats = [
    { num: doneCnt,    lbl: 'Tickets terminés', color: '#10B981' },
    { num: inprogCnt,  lbl: 'En cours',          color: '#3B82F6' },
    { num: reviewCnt,  lbl: 'En review',          color: '#06B6D4' },
    { num: blockedCnt, lbl: 'Bloqués',            color: '#EF4444' },
  ];
  if (bufferTk.length) {
    kanbanStats.push({ num: bufferPts, lbl: '🛡️ Buffer', color: '#22C55E' });
  }
  document.getElementById('kanban-metrics').innerHTML = kanbanStats.map(m =>
    `<div class="stat-card"><div class="num" style="color:${m.color}">${m.num}</div><div class="lbl">${m.lbl}</div></div>`
  ).join('');

  // Set modal navigation context to all visible kanban tickets
  window._modalTicketList = tickets.map(t => t.id);

  document.getElementById('kanban-board').innerHTML = cols.map(col => {
    const colT   = tickets.filter(t => t.status === col.key);
    const over   = col.wip > 0 && colT.length > col.wip;
    const wipCls  = col.wip === 0 ? 'wip-ok' : (over ? 'wip-over' : 'wip-ok');
    const wipText = col.wip > 0 ? `${colT.length}/${col.wip}` : '∞';
    return `<div class="kanban-col">
      <div class="col-header">
        <div class="col-title"><span style="width:10px;height:10px;border-radius:50%;background:${col.color};display:inline-block;"></span>${col.label}</div>
        <span class="wip-indicator ${wipCls}">${wipText}</span>
      </div>
      <div class="col-body">${colT.map(t => ticketCard(t)).join('')}</div>
    </div>`;
  }).join('');

  // CFD — Répartition actuelle par statut (données réelles)
  setTimeout(() => {
    const ctx = document.getElementById('cfdChart');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();

    const statuses = ['backlog', 'todo', 'inprog', 'review', 'test', 'blocked', 'done'];
    const labels   = ['Backlog', 'À faire', 'En cours', 'En review', 'En test', 'Bloqué', 'Terminé'];
    const colors   = ['#94A3B8', '#64748B', '#3B82F6', '#06B6D4', '#F59E0B', '#EF4444', '#10B981'];
    const counts   = statuses.map(s => tickets.filter(t => t.status === s).length);
    const points   = statuses.map(s => tickets.filter(t => t.status === s).reduce((a, t) => a + t.points, 0));

    ctx._chart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Tickets',
            data: counts,
            backgroundColor: colors.map(c => c + 'BB'),
            borderColor: colors,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Story Points',
            data: points,
            type: 'line',
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,.1)',
            pointBackgroundColor: '#F59E0B',
            tension: .3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 } } } },
        scales: {
          y:  { beginAtZero: true, title: { display: true, text: 'Tickets' } },
          y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Points' }, grid: { drawOnChartArea: false } },
        },
      },
    });
  }, 100);

  // Répartition par type (données réelles)
  const typeGroups = {};
  tickets.forEach(t => {
    if (!typeGroups[t.type]) typeGroups[t.type] = { count: 0, points: 0, done: 0 };
    typeGroups[t.type].count++;
    typeGroups[t.type].points += t.points;
    if (t.status === 'done') typeGroups[t.type].done++;
  });

  // Cycle time / Lead time metrics
  const doneWithCT = tickets.filter(t => t.status === 'done' && t.cycleTimeDays != null);
  const doneWithLT = tickets.filter(t => t.status === 'done' && t.leadTimeDays != null);
  const avgCT = doneWithCT.length ? (doneWithCT.reduce((a, t) => a + t.cycleTimeDays, 0) / doneWithCT.length).toFixed(1) : null;
  const avgLT = doneWithLT.length ? (doneWithLT.reduce((a, t) => a + t.leadTimeDays, 0) / doneWithLT.length).toFixed(1) : null;

  let ctHtml = '';
  if (avgCT || avgLT) {
    ctHtml = `<div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid var(--border);margin-bottom:6px;">
      ${avgCT ? `<div style="flex:1;text-align:center;"><div style="font-size:22px;font-weight:800;color:#3B82F6;">${avgCT}<span style="font-size:11px;font-weight:400;">j</span></div><div style="font-size:10px;color:var(--text-muted);font-weight:600;">Cycle Time moy.</div><div style="font-size:9px;color:var(--text-muted);">In Progress → Done</div></div>` : ''}
      ${avgLT ? `<div style="flex:1;text-align:center;"><div style="font-size:22px;font-weight:800;color:#F59E0B;">${avgLT}<span style="font-size:11px;font-weight:400;">j</span></div><div style="font-size:10px;color:var(--text-muted);font-weight:600;">Lead Time moy.</div><div style="font-size:9px;color:var(--text-muted);">Création → Done</div></div>` : ''}
    </div>`;
  }

  document.getElementById('cycle-time-display').innerHTML = ctHtml + Object.entries(typeGroups)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, g]) => {
      const color  = CONFIG.typeColors[type] || '#94A3B8';
      const donePct = g.count ? Math.round(g.done / g.count * 100) : 0;
      // Per-type cycle time
      const typeDone = tickets.filter(t => t.type === type && t.status === 'done' && t.cycleTimeDays != null);
      const typeCT = typeDone.length ? (typeDone.reduce((a, t) => a + t.cycleTimeDays, 0) / typeDone.length).toFixed(1) : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
          ${typeName(type)}
        </span>
        <span style="display:flex;gap:12px;color:var(--text-muted)">
          <span title="Tickets">${g.count} tickets</span>
          <span title="Points">${g.points} pts</span>
          ${typeCT ? `<span title="Cycle Time moyen" style="color:#3B82F6;font-weight:700;">${typeCT}j</span>` : ''}
          <strong style="color:${color}">${donePct}% done</strong>
        </span>
      </div>`;
    }).join('') || '<div style="padding:8px;color:var(--text-muted)">Aucun ticket</div>';
}
