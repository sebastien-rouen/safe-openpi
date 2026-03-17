// ============================================================
// SYNC — Bouton "Synchroniser" → chargement des données JIRA
//        Sync diff — changelog visuel après synchronisation
//        Incremental sync — seuil 6h, checkbox full/partial
// ============================================================

// --- Snapshot before sync for diff computation ---
let _syncSnapshot = null;

function _takeSnapshot() {
  return {
    ids:     new Set(TICKETS.map(t => t.id)),
    status:  Object.fromEntries(TICKETS.map(t => [t.id, t.status])),
    points:  Object.fromEntries(TICKETS.map(t => [t.id, t.points])),
    flagged: new Set(TICKETS.filter(t => t.flagged).map(t => t.id)),
    titles:  Object.fromEntries(TICKETS.map(t => [t.id, t.title])),
  };
}

function _computeDiff(before, after) {
  const changes = [];
  const afterIds = new Set(TICKETS.map(t => t.id));

  const _link = (id) => _jiraBrowse(id, { style: 'font-weight:700;font-size:11px;' });

  // New tickets
  TICKETS.forEach(t => {
    if (!before.ids.has(t.id)) {
      changes.push({ type: 'new', icon: '🆕', label: `${_link(t.id)} — ${t.title}`, color: '#16A34A' });
    }
  });

  // Status changes
  TICKETS.forEach(t => {
    if (before.ids.has(t.id) && before.status[t.id] !== t.status) {
      const from = statusLabel(before.status[t.id]);
      const to   = statusLabel(t.status);
      changes.push({ type: 'status', icon: '🔄', label: `${_link(t.id)} : ${from} → ${to}`, color: '#3B82F6' });
    }
  });

  // Points changes
  TICKETS.forEach(t => {
    if (before.ids.has(t.id) && before.points[t.id] !== t.points) {
      const from = before.points[t.id] || 0;
      const to   = t.points || 0;
      changes.push({ type: 'points', icon: '🎯', label: `${_link(t.id)} : ${from} → ${to} pts`, color: '#F59E0B' });
    }
  });

  // Newly flagged
  TICKETS.forEach(t => {
    if (t.flagged && !before.flagged.has(t.id)) {
      changes.push({ type: 'flag', icon: '🚩', label: `${_link(t.id)} flaggé`, color: '#DC2626' });
    }
  });

  // Removed tickets
  before.ids.forEach(id => {
    if (!afterIds.has(id)) {
      changes.push({ type: 'removed', icon: '🗑', label: `${_link(id)} — ${before.titles[id] || '?'} retiré`, color: '#94A3B8' });
    }
  });

  return changes;
}

function _showSyncDiff(changes) {
  if (!changes.length) return;

  // Remove existing diff panel
  const existing = document.getElementById('sync-diff-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'sync-diff-panel';

  // Group by type
  const groups = {};
  changes.forEach(c => { (groups[c.type] = groups[c.type] || []).push(c); });

  const summary = [];
  if (groups.new)     summary.push(`${groups.new.length} nouveau${groups.new.length > 1 ? 'x' : ''}`);
  if (groups.status)  summary.push(`${groups.status.length} changement${groups.status.length > 1 ? 's' : ''} de statut`);
  if (groups.points)  summary.push(`${groups.points.length} mise${groups.points.length > 1 ? 's' : ''} à jour de points`);
  if (groups.flag)    summary.push(`${groups.flag.length} flaggé${groups.flag.length > 1 ? 's' : ''}`);
  if (groups.removed) summary.push(`${groups.removed.length} retiré${groups.removed.length > 1 ? 's' : ''}`);

  const rows = changes.slice(0, 20).map(c =>
    `<div class="sync-diff-row">
      <span class="sync-diff-icon">${c.icon}</span>
      <span class="sync-diff-label">${c.label}</span>
      <span class="sync-diff-dot" style="background:${c.color}"></span>
    </div>`
  ).join('');
  const moreText = changes.length > 20 ? `<div style="padding:4px 12px;font-size:11px;color:var(--text-muted);text-align:center;">+${changes.length - 20} autres changements</div>` : '';

  panel.innerHTML = `
    <div class="sync-diff-header">
      <div class="sync-diff-title">📋 Changements détectés</div>
      <button class="sync-diff-close" onclick="this.closest('#sync-diff-panel').remove()">✕</button>
    </div>
    <div class="sync-diff-summary">${summary.join(' · ')}</div>
    <div class="sync-diff-body">${rows}${moreText}</div>
  `;

  document.body.appendChild(panel);

  // Auto-dismiss after 15s
  setTimeout(() => { if (panel.parentNode) panel.classList.add('sync-diff-fade'); }, 12000);
  setTimeout(() => { if (panel.parentNode) panel.remove(); }, 15000);
}

// --- Incremental sync ---
function _isIncrementalSync() {
  const cb = document.getElementById('sync-incremental');
  return cb && cb.checked;
}

function _lastSyncAge() {
  const ts = parseInt(localStorage.getItem('lastSync'), 10);
  if (!ts || isNaN(ts)) return Infinity;
  return Date.now() - ts;
}

function doSync() {
  const btn = document.getElementById('syncBtn');
  _setBtnLoading(btn);

  // Snapshot before sync
  _syncSnapshot = _takeSnapshot();

  // Determine if incremental (only if data < 6h old)
  const incremental = _isIncrementalSync() && _lastSyncAge() < 6 * 3600 * 1000;

  const syncPromise = incremental
    ? loadJiraData({ incremental: true })
    : loadJiraData();

  syncPromise
    .then(() => {
      _setBtnReady(btn);
      _updateLastSync();
      localStorage.setItem('lastSync', Date.now());
      renderTeamBtns();
      renderGroupBtns();
      _updateSidebarStats();
      if (typeof _updateBlockedBadge === 'function') _updateBlockedBadge();
      const banner = document.getElementById('stale-banner');
      if (banner) banner.remove();
      if (currentView === 'scrum')  renderScrum();
      if (currentView === 'kanban') renderKanban();

      // Compute and show diff
      if (_syncSnapshot) {
        const changes = _computeDiff(_syncSnapshot);
        if (changes.length) {
          _showSyncDiff(changes);
        } else {
          showToast('✅ Aucun changement détecté', 'success');
        }
        _syncSnapshot = null;
      } else {
        const n = TICKETS.length;
        showToast(`✅ ${n} ticket${n !== 1 ? 's' : ''} chargé${n !== 1 ? 's' : ''} depuis JIRA`, 'success');
      }
    })
    .catch(err => {
      _setBtnReady(btn);
      _syncSnapshot = null;
      const hint = err.message.includes('fetch') || err.message.includes('network')
        ? ' — proxy démarré ? (python scripts/proxy.py)'
        : '';
      showToast(`❌ JIRA : ${err.message}${hint}`, 'error');
    });
}

function _setBtnLoading(btn) {
  btn.classList.add('syncing');
  btn.innerHTML = '<span class="sync-icon">🔄</span> Synchronisation...';
  btn.disabled  = true;
  _syncProgress(0, 1, '');
  const el = document.getElementById('syncProgress');
  if (el) el.style.display = '';
}

function _setBtnReady(btn) {
  btn.classList.remove('syncing');
  btn.innerHTML = '<span class="sync-icon">🔄</span> Synchroniser';
  btn.disabled  = false;
  const el = document.getElementById('syncProgress');
  if (el) el.style.display = 'none';
}

function _syncProgress(step, total, label) {
  const fill  = document.getElementById('syncProgressFill');
  const lbl   = document.getElementById('syncProgressLabel');
  const pct   = total > 0 ? Math.round((step / total) * 100) : 0;
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = label || '';
}

function _updateLastSync(isoDate) {
  const d  = isoDate ? new Date(isoDate) : new Date();
  const el = document.getElementById('lastSync');
  if (!el) return;
  el.textContent = `Dernière sync: ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const stale = (Date.now() - d.getTime()) > 24 * 60 * 60 * 1000;
  el.classList.toggle('stale', stale);
}
