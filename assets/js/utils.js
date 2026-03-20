// ============================================================
// UTILS - Fonctions utilitaires partagées
// ============================================================

// Ticket considéré "terminé" et comptabilisé dans la vélocité (basé sur CONFIG.statuses)
function isDone(status) {
  return CONFIG.statuses[status]?.countsInVelocity === true;
}

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

// Uniform story-points badge - always visible, consistent style
function ptsBadge(points, opts = {}) {
  const size = opts.size || 'normal'; // 'small' | 'normal'
  const val  = points ? points + ' pts' : '– pts';
  const fs   = size === 'small' ? '10px' : '11px';
  const pad  = size === 'small' ? '1px 6px' : '2px 7px';
  return `<span style="background:#1E293B;color:#F8FAFC;font-size:${fs};font-weight:700;padding:${pad};border-radius:99px;white-space:nowrap;flex-shrink:0">${val}</span>`;
}

// Epic tag - shows truncated title, hover reveals key + title with JIRA link
// opts.maxWidth: max width in px (default 120), set to 'none' for no truncation
function epicTag(epic, ticketEpicId, opts = {}) {
  if (!epic) return '';
  const id    = epic.id || ticketEpicId || '';
  const title = epic.title || id;
  const color = epic.color || CLR.dark;
  const base  = (CONFIG.jira.url || '').replace(/\/$/, '');
  const url   = base && !base.includes('votre-jira') ? `${base}/browse/${id}` : '';
  const tip   = `${id} - ${title}`;
  const mw    = opts.maxWidth === 'none' ? '' : `max-width:${opts.maxWidth || 120}px;overflow:hidden;text-overflow:ellipsis;`;
  const inner = `<span class="epic-tag" style="background:${color};${mw}white-space:nowrap;display:inline-block;vertical-align:middle;" title="${tip.replace(/"/g, '&quot;')}">${title}</span>`;
  if (url) {
    const extIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:3px;opacity:.6;flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="text-decoration:none;flex-shrink:0;display:inline-flex;align-items:center;">${inner}${extIcon}</a>`;
  }
  return inner;
}

// Lien cliquable vers un ticket JIRA - retourne juste l'id si URL non configurée
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

// Shared color constants - semantic fallback palette
// Used as fallback values when team/member/type color is undefined.
// These CANNOT be CSS variables because they're used in hex-opacity expressions (e.g., color + '18').
const CLR = {
  muted:   '#94A3B8', // light gray - todo, muted text, fallback badges
  slate:   '#64748B', // medium gray - default avatar, unset team color
  dark:    '#475569', // dark slate - default type color, filter buttons
  red:     '#DC2626', // blocked, critical, flagged
  orange:  '#D97706', // warning, presentiel
  amber:   '#F59E0B', // test, lead time, caution
  green:   '#22C55E', // buffer, success
  darkGrn: '#16A34A', // done, health good, IP sprint
  blue:    '#3B82F6', // in progress, cycle time
  purple:  '#7C3AED', // review, epic default
  teal:    '#06B6D4', // review column
};

// Status → hex color map (for JS contexts needing hex, e.g. opacity suffixes)
const STATUS_HEX = {
  blocked: CLR.red, inprog: CLR.blue, review: CLR.purple,
  todo: CLR.muted, done: CLR.darkGrn, test: CLR.amber, backlog: CLR.muted,
};

// Colored dot indicator (status, team, epic)
// size: 'sm' (6px), 'md' (8px), 'lg' (10px, default)
function statusDot(color, size) {
  const px = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  return `<span style="width:${px}px;height:${px}px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>`;
}

// Avatar badge with initials
// opts: { w (px, default 24), fs (font-size, default '10px') }
function avatarBadge(name, color, opts = {}) {
  const w  = opts.w || 24;
  const fs = opts.fs || '10px';
  return `<span class="avatar" style="background:${color};width:${w}px;height:${w}px;font-size:${fs};flex-shrink:0;" title="${(name || 'Non assigné').replace(/"/g, '&quot;')}">${initials(name)}</span>`;
}

// Internal status → CSS color variable
const _STATUS_COLORS = {
  backlog: '#94A3B8', todo: 'var(--todo)', inprog: 'var(--inprog)',
  review: 'var(--review)', test: '#0891B2', done: 'var(--done)', blocked: 'var(--blocked)',
};

// Internal status → board category (todo / wip / blocked / done)
function statusCat(key) {
  if (key === 'done') return 'done';
  if (key === 'blocked') return 'blocked';
  if (key === 'backlog' || key === 'todo') return 'todo';
  return 'wip'; // inprog, review, test
}

/**
 * Build board columns from BOARD_COLUMNS for the active team(s).
 * Returns array of { key (internal), label (JIRA name), color }.
 * - Single team selected → exact JIRA columns in order
 * - Multiple teams / all → merged unique columns, ordered by workflow
 * - Fallback (demo / no config) → default columns
 */
function getBoardColumns(tickets) {
  const teams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const _defaultCols = [
    { key: 'todo',   label: 'À faire',   color: _STATUS_COLORS.todo   },
    { key: 'inprog', label: 'En cours',   color: _STATUS_COLORS.inprog },
    { key: 'review', label: 'En review',  color: _STATUS_COLORS.review },
    { key: 'done',   label: 'Terminé',    color: _STATUS_COLORS.done   },
  ];

  if (!BOARD_COLUMNS || !Object.keys(BOARD_COLUMNS).length) return _defaultCols;

  // Collect relevant team configs
  const teamConfigs = teams.length === 1 && BOARD_COLUMNS[teams[0]]
    ? [BOARD_COLUMNS[teams[0]]]
    : Object.values(BOARD_COLUMNS);

  if (!teamConfigs.length) return _defaultCols;

  // Single team → use its exact columns (preserving JIRA order)
  if (teams.length === 1 && BOARD_COLUMNS[teams[0]]) {
    const cols = BOARD_COLUMNS[teams[0]]
      .filter(c => c.internal) // skip unmapped columns
      .map(c => ({ key: c.internal, label: c.name, color: _STATUS_COLORS[c.internal] || CLR.muted }));
    return cols.length ? cols : _defaultCols;
  }

  // Multiple teams → merge, deduplicate by internal key, keep canonical order
  const _ORDER = ['backlog','todo','inprog','review','test','done'];
  const seen = {};
  for (const tc of teamConfigs) {
    for (const c of tc) {
      if (!c.internal) continue;
      if (!seen[c.internal]) seen[c.internal] = c.name; // first name wins
    }
  }
  const cols = _ORDER
    .filter(k => seen[k])
    .map(k => ({ key: k, label: seen[k], color: _STATUS_COLORS[k] || CLR.muted }));

  // Add columns for statuses present in tickets but not in board config (e.g. blocked)
  if (tickets) {
    const statusSet = new Set(tickets.map(t => t.status));
    for (const s of statusSet) {
      if (!cols.find(c => c.key === s) && _STATUS_COLORS[s]) {
        // Find insertion point based on order
        const idx = _ORDER.indexOf(s);
        const insertAt = idx >= 0 ? cols.findIndex(c => _ORDER.indexOf(c.key) > idx) : cols.length;
        cols.splice(insertAt >= 0 ? insertAt : cols.length, 0, {
          key: s, label: s === 'blocked' ? 'Bloqué' : s, color: _STATUS_COLORS[s],
        });
      }
    }
  }

  return cols.length ? cols : _defaultCols;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
