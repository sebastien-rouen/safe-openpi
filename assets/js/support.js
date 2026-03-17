// ============================================================
// SUPPORT VIEW — Tickets support avec description complète
// ============================================================

function renderSupport() {
  const critCount = SUPPORT_TICKETS.filter(t => t.priority === 'critical').length;
  const highCount = SUPPORT_TICKETS.filter(t => t.priority === 'high').length;
  const openCount = SUPPORT_TICKETS.filter(t => t.status !== 'done').length;
  const doneCount = SUPPORT_TICKETS.filter(t => t.status === 'done').length;

  document.getElementById('support-stats').innerHTML = [
    { num: openCount,  lbl: 'Tickets Ouverts', color: '#3B82F6' },
    { num: critCount,  lbl: 'Critiques',        color: '#DC2626' },
    { num: highCount,  lbl: 'Haute Priorité',   color: '#EA580C' },
    { num: doneCount,  lbl: 'Résolus',           color: '#10B981' },
  ].map(s => `<div class="stat-card"><div class="num" style="color:${s.color}">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join('');

  renderSupportList();
}

function filterSupport(f) {
  supportFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === f)
  );
  renderSupportList();
  _pushHash();
}

function renderSupportList() {
  let tickets = [...SUPPORT_TICKETS];
  const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tickets.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);

  if      (supportFilter === 'open') tickets = tickets.filter(t => t.status !== 'done');
  else if (supportFilter === 'done') tickets = tickets.filter(t => t.status === 'done');
  else if (supportFilter !== 'all')  tickets = tickets.filter(t => t.priority === supportFilter);

  const pColors = { critical: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#059669' };
  const pLabels = { critical: '🔴 Critique', high: '🟠 Haute', medium: '🟡 Moyenne', low: '🟢 Basse' };
  const sColors = { open: '#3B82F6', inprog: '#06B6D4', done: '#10B981' };
  const sLabels = { open: 'Ouvert', inprog: 'En cours', done: 'Résolu' };

  if (!tickets.length) {
    document.getElementById('support-list').innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Aucun ticket de support.</div>';
    return;
  }

  document.getElementById('support-list').innerHTML = tickets.map(t => {
    const assignee    = t.assignee || '?';
    const avatarColor = MEMBER_COLORS[t.assignee] || '#64748B';
    // Tickets critiques et hauts ouverts par défaut
    const startOpen   = t.priority === 'critical' || t.priority === 'high';
    return `
    <div class="support-card ${t.priority}" id="sc-${t.id}">
      <div class="support-header" onclick="toggleSupport('${t.id}')">
        <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:13px;color:var(--text-muted)">${_jiraBrowse(t.id, { style: 'color:inherit;text-decoration:none;font-weight:700;' })}</span>
          <span style="font-weight:600;font-size:14px">${t.title}</span>
          <span class="badge" style="background:${pColors[t.priority]}22;color:${pColors[t.priority]}">${pLabels[t.priority]}</span>
          <span class="badge" style="background:${(sColors[t.status] || '#94A3B8')}22;color:${sColors[t.status] || '#94A3B8'}">${sLabels[t.status] || t.status}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
          <span class="avatar" style="background:${avatarColor}" title="${t.assignee || 'Non assigné'}">${initials(t.assignee)}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.date || ''}</span>
          <span style="font-size:18px;color:var(--text-muted)" id="sc-icon-${t.id}">${startOpen ? '▲' : '▼'}</span>
        </div>
      </div>
      <div class="support-body${startOpen ? ' open' : ''}" id="sb-${t.id}">
        <div class="support-desc">${t.description || '<em style="color:var(--text-muted)">Aucune description.</em>'}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleSupport(id) {
  const body = document.getElementById('sb-' + id);
  const icon = document.getElementById('sc-icon-' + id);
  body.classList.toggle('open');
  icon.textContent = body.classList.contains('open') ? '▲' : '▼';
}
