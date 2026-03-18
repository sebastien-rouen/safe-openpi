// ============================================================
// STANDUP VIEW — Vue condensée pour le daily standup
// Ce qui a bougé hier, ce qui est bloqué, risques
// ============================================================

function renderStandup() {
  const el = document.getElementById('standup-content');
  if (!el) return;

  const tickets = getTickets();
  if (!tickets.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Synchronisez les données JIRA pour afficher le standup.</div>';
    return;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Yesterday (skip weekends)
  const yesterday = new Date(now);
  do { yesterday.setDate(yesterday.getDate() - 1); } while (yesterday.getDay() === 0 || yesterday.getDay() === 6);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // ---- Section 1: What changed (today + yesterday) ----
  const changedTickets = tickets.filter(t => Array.isArray(t.todayChanges) && t.todayChanges.length > 0);

  // Also include tickets resolved/updated yesterday (via updatedAt)
  const updatedYesterday = tickets.filter(t => {
    if (!t.updatedAt) return false;
    const d = t.updatedAt.slice(0, 10);
    return d === yesterdayStr || d === today;
  });

  const allChanged = new Map();
  [...changedTickets, ...updatedYesterday].forEach(t => allChanged.set(t.id, t));
  const changes = [...allChanged.values()].sort((a, b) => {
    const aTime = a.todayChanges?.[0]?.time || a.updatedAt || '';
    const bTime = b.todayChanges?.[0]?.time || b.updatedAt || '';
    return bTime.localeCompare(aTime);
  });

  // Group changes by type of movement
  const completed = changes.filter(t => t.status === 'done');
  const inProgress = changes.filter(t => t.status === 'inprog' || t.status === 'review');
  const moved = changes.filter(t => t.status !== 'done' && t.status !== 'inprog' && t.status !== 'review' && t.status !== 'blocked');

  // ---- Section 2: Blocked ----
  const blocked = tickets.filter(t => t.status === 'blocked');

  // ---- Section 3: Risks ----
  const risks = [];

  // Critical/high tickets not done
  const criticalNotDone = tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'done');
  if (criticalNotDone.length) {
    risks.push({ icon: '🔴', label: `${criticalNotDone.length} ticket${criticalNotDone.length > 1 ? 's' : ''} critique${criticalNotDone.length > 1 ? 's' : ''}/haute priorité non terminé${criticalNotDone.length > 1 ? 's' : ''}`, tickets: criticalNotDone });
  }

  // Tickets with no assignee
  const unassigned = tickets.filter(t => !t.assignee && t.status !== 'done' && t.status !== 'backlog');
  if (unassigned.length) {
    risks.push({ icon: '👤', label: `${unassigned.length} ticket${unassigned.length > 1 ? 's' : ''} non assigné${unassigned.length > 1 ? 's' : ''}`, tickets: unassigned });
  }

  // Sprint end approaching
  const s = (typeof _activeSprintCtx === 'function') ? _activeSprintCtx() : CONFIG.sprint;
  if (s.endDate) {
    const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end - now) / 86400000);
    const notDone = tickets.filter(t => t.status !== 'done').length;
    const total = tickets.length;
    const pctDone = total ? Math.round((total - notDone) / total * 100) : 0;
    if (daysLeft <= 3 && pctDone < 70) {
      risks.push({ icon: '⏰', label: `Fin de sprint dans ${daysLeft}j — ${pctDone}% terminé (${notDone} restant${notDone > 1 ? 's' : ''})` });
    }
  }

  // Flagged tickets
  const flagged = tickets.filter(t => t.flagged && t.status !== 'done');
  if (flagged.length) {
    risks.push({ icon: '🚩', label: `${flagged.length} ticket${flagged.length > 1 ? 's' : ''} flaggé${flagged.length > 1 ? 's' : ''} (impediment)`, tickets: flagged });
  }

  // ---- Render ----
  const ticketLine = (t, showStatus) => {
    const tc = CONFIG.typeColors[t.type] || '#475569';
    const statusColors = { done: '#16A34A', inprog: '#2563EB', review: '#7C3AED', blocked: '#DC2626', todo: '#94A3B8' };
    const sc = statusColors[t.status] || '#94A3B8';
    const url = typeof _jiraBrowseUrl === 'function' ? _jiraBrowseUrl(t.id) : null;
    const link = url ? `<a href="${url}" target="_blank" style="font-weight:700;color:${tc};text-decoration:none;font-size:12px;" onclick="event.stopPropagation()">${t.id}</a>` : `<strong style="color:${tc};font-size:12px;">${t.id}</strong>`;
    const statusBadge = showStatus ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${sc}18;color:${sc};font-weight:600;border:1px solid ${sc}33;">${statusLabel(t.status)}</span>` : '';
    return `<div class="su-ticket" onclick="openModal('${t.id}')" style="cursor:pointer;">
      ${link}
      <span style="font-size:12px;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title || '—'}</span>
      ${statusBadge}
      ${t.assignee ? `<span style="font-size:10px;color:var(--text-muted);">${t.assignee.split(' ')[0]}</span>` : ''}
      ${t.points ? `<span style="font-size:10px;font-weight:700;color:var(--text-muted);">${t.points}pts</span>` : ''}
    </div>`;
  };

  const section = (icon, title, count, color, content) => `
    <div class="su-section">
      <div class="su-section-header" style="border-left:3px solid ${color};">
        <span style="font-size:16px;">${icon}</span>
        <span style="font-size:14px;font-weight:700;color:var(--text);">${title}</span>
        <span style="font-size:12px;font-weight:700;color:${color};background:${color}15;padding:2px 8px;border-radius:6px;">${count}</span>
      </div>
      <div class="su-section-body">${content}</div>
    </div>`;

  // Sprint context
  const sprintLabel = s.label || 'Sprint actif';
  const sprintInfo = s.endDate ? (() => {
    const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end - now) / 86400000);
    const totalDone = tickets.filter(t => t.status === 'done').length;
    const pct = tickets.length ? Math.round(totalDone / tickets.length * 100) : 0;
    return `J${daysLeft >= 0 ? '+' : ''}${Math.abs(Math.round((now - new Date(s.startDate)) / 86400000))} · ${daysLeft}j restants · ${pct}% terminé`;
  })() : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 16px;background:var(--surface);border-radius:10px;border:1px solid var(--border);">
      <span style="font-size:20px;">☀️</span>
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--text);">Daily Standup</div>
        <div style="font-size:12px;color:var(--text-muted);">${sprintLabel} · ${sprintInfo}</div>
      </div>
      <div style="margin-left:auto;font-size:11px;color:var(--text-muted);">${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>

    <div class="su-grid">
      ${section('✅', 'Terminé hier/aujourd\'hui', completed.length, '#16A34A',
        completed.length ? completed.slice(0, 15).map(t => ticketLine(t, false)).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Aucun ticket terminé</div>'
      )}

      ${section('🔄', 'En cours / En revue', inProgress.length, '#2563EB',
        inProgress.length ? inProgress.slice(0, 15).map(t => ticketLine(t, true)).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Aucun ticket en cours</div>'
      )}

      ${section('🚧', 'Bloqué', blocked.length, '#DC2626',
        blocked.length ? blocked.map(t => ticketLine(t, false)).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Aucun blocage</div>'
      )}

      ${section('⚠️', 'Risques', risks.length, '#F59E0B',
        risks.length ? risks.map(r => `<div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:14px;flex-shrink:0;">${r.icon}</span>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);">${r.label}</div>
            ${r.tickets ? r.tickets.slice(0, 5).map(t => `<div style="font-size:11px;color:var(--text-muted);padding:1px 0;cursor:pointer;" onclick="openModal('${t.id}')">${t.id} — ${(t.title || '').slice(0, 50)}</div>`).join('') : ''}
          </div>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Aucun risque détecté</div>'
      )}
    </div>
  `;
}
