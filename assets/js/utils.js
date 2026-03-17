// ============================================================
// UTILS — Fonctions utilitaires partagées
// ============================================================

// Initiales d'un nom complet (ex: "Martin Leclerc" → "ML", "Alice" → "AL")
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function typeName(t) {
  const map = {
    story: 'Story', storytech: 'Story Tech', bug: 'Bug', incident: 'Incident',
    support: 'Support', ops: 'OPS', tache: 'Tâche', dette: 'Dette',
    epic: 'Epic', feature: 'Feature',
  };
  return map[t] || t;
}

function priorityIcon(p) {
  const m = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  return `<span title="${p}">${m[p] || ''}</span>`;
}

function statusLabel(s) {
  return {
    todo: 'À faire', inprog: 'En cours', review: 'En review',
    done: 'Terminé', blocked: 'Bloqué', test: 'En test', backlog: 'Backlog',
  }[s] || s;
}

function blocked_count(tickets) {
  return tickets.filter(x => x.status === 'blocked').length;
}

// Uniform story-points badge — always visible, consistent style
function ptsBadge(points, opts = {}) {
  const size = opts.size || 'normal'; // 'small' | 'normal'
  const val  = points ? points + ' pts' : '– pts';
  const fs   = size === 'small' ? '10px' : '11px';
  const pad  = size === 'small' ? '1px 6px' : '2px 7px';
  return `<span style="background:#F1F5F9;color:#475569;font-size:${fs};font-weight:700;padding:${pad};border-radius:99px;white-space:nowrap;flex-shrink:0">${val}</span>`;
}

// Epic tag — shows truncated title, hover reveals key + title with JIRA link
// opts.maxWidth: max width in px (default 120), set to 'none' for no truncation
function epicTag(epic, ticketEpicId, opts = {}) {
  if (!epic) return '';
  const id    = epic.id || ticketEpicId || '';
  const title = epic.title || id;
  const color = epic.color || '#475569';
  const base  = (CONFIG.jira.url || '').replace(/\/$/, '');
  const url   = base && !base.includes('votre-jira') ? `${base}/browse/${id}` : '';
  const tip   = `${id} — ${title}`;
  const mw    = opts.maxWidth === 'none' ? '' : `max-width:${opts.maxWidth || 120}px;overflow:hidden;text-overflow:ellipsis;`;
  const inner = `<span class="epic-tag" style="background:${color};${mw}white-space:nowrap;display:inline-block;vertical-align:middle;" title="${tip.replace(/"/g, '&quot;')}">${title}</span>`;
  if (url) {
    const extIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:3px;opacity:.6;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="text-decoration:none;flex-shrink:0;display:inline-flex;align-items:center;">${inner}${extIcon}</a>`;
  }
  return inner;
}

// Lien cliquable vers un ticket JIRA — retourne juste l'id si URL non configurée
function _jiraBrowse(id, opts = {}) {
  const base = (CONFIG.jira.url || '').replace(/\/$/, '');
  if (!base || base.includes('votre-jira')) return opts.text || id;
  const url   = `${base}/browse/${id}`;
  const label = opts.text || id;
  const style = opts.style || 'color:inherit;text-decoration:none;font-weight:inherit;';
  const icon  = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:3px;opacity:.6;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="${style}" title="Ouvrir dans JIRA">${label}${icon}</a>`;
}

// URL brute vers un ticket JIRA (pour les rapports texte/Slack)
function _jiraBrowseUrl(id) {
  const base = (CONFIG.jira.url || '').replace(/\/$/, '');
  if (!base || base.includes('votre-jira')) return '';
  return `${base}/browse/${id}`;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
