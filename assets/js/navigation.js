// ============================================================
// NAVIGATION — Vues, raccourcis clavier, URL hash, initialisation
// ============================================================

function toggleGroupSelector() {
  const el = document.getElementById('group-selector');
  if (!el) return;
  el.classList.toggle('collapsed');
  localStorage.setItem('groups_collapsed', el.classList.contains('collapsed') ? '1' : '');
}
// Restore collapsed state on load
(function() {
  if (localStorage.getItem('groups_collapsed') === '1') {
    const el = document.getElementById('group-selector');
    if (el) el.classList.add('collapsed');
  }
})();

function showView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  const titles = {
    scrum:    `📋 Vue Scrum — ${CONFIG.sprint.label || 'Sprint actif'}`,
    kanban:   '🗂️ Vue Kanban',
    pi:       '🗓️ PI Planning',
    reports:  '📊 Rapports de Fin de Sprint',
    support:  '🎫 Tickets de Support',
    settings: '⚙️ Paramètres',
    roadmap:  '🗺️ Roadmap & Planification',
    piprep:   '📋 Préparation PI Planning',
  };
  // La vue Scrum met à jour son propre titre via renderScrum() — inutile de l'écraser ici
  if (view !== 'scrum') document.getElementById('topbar-title').textContent = titles[view] || '';

  _updateTopbarActions(view);

  if (view === 'scrum')    renderScrum();
  if (view === 'kanban')   renderKanban();
  if (view === 'pi')       renderPI();
  if (view === 'reports')  { if (currentTeam && currentTeam !== 'all') reportTeam = currentTeam; renderReportSections(); renderReport(); }
  if (view === 'support')  renderSupport();
  if (view === 'settings') renderSettings();
  if (view === 'roadmap')  renderRoadmap();
  if (view === 'piprep')   renderPIPrep();

  // Sidebar progress is only built inside renderScrum — refresh it for other views too
  if (view !== 'scrum') { _renderSidebarProgress(); _updateSidebarStats(); }
  _updateBlockedBadge();
  _checkStaleBanner();
  _pushHash();
}

// ============================================================
// Badge "tickets bloqués" dans la sidebar (improvement #2)
// ============================================================
function _updateBlockedBadge() {
  const badge = document.getElementById('sb-blocked-badge');
  if (!badge) return;
  const allTickets = (typeof getTickets === 'function') ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const count = allTickets.filter(t => t.status === 'blocked').length;
  if (count > 0) {
    badge.textContent = count;
    badge.title = `${count} ticket${count > 1 ? 's' : ''} bloqué${count > 1 ? 's' : ''}`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================================
// Boutons d'action contextuels dans la topbar
// ============================================================
function _updateTopbarActions(view) {
  const el = document.getElementById('topbar-actions');
  if (!el) return;

  const labels = {
    scrum:   'Scrum',
    kanban:  'Kanban',
    pi:      'PI Planning',
    reports: 'Rapports',
    support: 'Support',
    roadmap: 'Roadmap',
    piprep:  'Prépa PI',
  };
  // Mapping vue → section rapport
  const viewToSection = { scrum:'sprint', kanban:'kanban', pi:'pi', support:'support', roadmap:'roadmap', piprep:'piprep' };
  const label = labels[view] || '';
  const png = label ? `<button class="btn btn-secondary" onclick="exportPNG()">📸 Export ${label}</button>` : '';
  const rptSection = viewToSection[view];
  const rpt = rptSection
    ? `<button class="btn btn-primary" onclick="reportSection='${rptSection}';showView('reports')">📊 Rapport ${label}</button>`
    : '';

  const actions = {
    scrum:    `${png}${rpt}`,
    kanban:   `${png}${rpt}`,
    pi:       `${png}${rpt}`,
    reports:  `<button class="btn btn-secondary" onclick="copyReport()">📋 Copier</button>${png}`,
    support:  `${png}${rpt}`,
    roadmap:  `${png}${rpt}`,
    piprep:   `<button class="btn btn-secondary" onclick="_ppExportJSON()">💾 Exporter JSON</button>${png}${rpt}`,
    settings: '',
  };

  el.innerHTML = actions[view] ?? png;
}

// ============================================================
// Indicateur de fraîcheur des données (improvement #3)
// ============================================================
function _checkStaleBanner() {
  const content = document.getElementById('content');
  if (!content) return;
  // Remove existing banner first
  const existing = document.getElementById('stale-banner');
  if (existing) existing.remove();

  const raw = localStorage.getItem('lastSync');
  if (!raw) {
    _showStaleBanner(content);
    return;
  }
  const ageMs = Date.now() - parseInt(raw, 10);
  const twoHours = 2 * 60 * 60 * 1000;
  if (ageMs > twoHours) {
    _showStaleBanner(content);
  }
  // Between 30min and 2h: no banner. Under 30min: no banner.
}

function _showStaleBanner(content) {
  const banner = document.createElement('div');
  banner.id = 'stale-banner';
  banner.innerHTML = `⚠ Données potentiellement obsolètes —
    <button onclick="doSync()">Synchroniser</button>
    <button class="stale-close" onclick="this.parentElement.remove()">✕</button>`;
  content.insertBefore(banner, content.firstChild);
}

// ============================================================
// URL hash — sérialise / restaure l'état de navigation
// Format : #vue[/group:GID | équipe][/extra…]
// ============================================================

function _pushHash() {
  const parts = [currentView];

  if (currentGroup) {
    parts.push('group:' + currentGroup);
  } else if (currentTeam && currentTeam !== 'all') {
    parts.push(encodeURIComponent(currentTeam));
  }

  if (currentView === 'reports') {
    parts.push(reportFormat);
    const impliedTeam = currentGroup ? 'group' : currentTeam;
    if (reportTeam && reportTeam !== impliedTeam) {
      parts.push('rt:' + encodeURIComponent(reportTeam));
    }
    if (reportSection && reportSection !== 'sprint') {
      parts.push('rs:' + reportSection);
    }
  }

  if (currentView === 'support' && supportFilter !== 'all') {
    parts.push(supportFilter);
  }

  history.replaceState(null, '', '#' + parts.join('/'));
}

function _applyHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return false;

  const parts = hash.split('/');
  const view  = parts[0];
  const views = ['scrum', 'kanban', 'pi', 'reports', 'support', 'settings', 'roadmap', 'piprep'];
  if (!views.includes(view)) return false;

  // Contexte équipe / groupe
  const ctx = parts[1];
  if (ctx) {
    if (ctx.startsWith('group:')) {
      currentGroup = ctx.slice(6);
      currentTeam  = 'all';
    } else {
      currentTeam  = decodeURIComponent(ctx);
      currentGroup = null;
    }
  }

  // Extras selon la vue
  if (view === 'reports') {
    const fmt = parts[2];
    if (fmt === 'slack' || fmt === 'confluence') reportFormat = fmt;
    const rtPart = parts.find(p => p.startsWith('rt:'));
    if (rtPart) reportTeam = decodeURIComponent(rtPart.slice(3));
    else if (currentGroup) reportTeam = 'group';
    const rsPart = parts.find(p => p.startsWith('rs:'));
    if (rsPart) reportSection = rsPart.slice(3);
  }

  if (view === 'support' && parts[2]) {
    supportFilter = parts[2];
  }

  renderGroupBtns();
  renderTeamBtns();
  showView(view);
  return true;
}

// Raccourcis clavier : 1-6 pour naviguer, Échap pour fermer le modal, Ctrl+K search, ←/→ modal nav
document.addEventListener('keydown', e => {
  // Ctrl+K — open search overlay
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
    return;
  }
  // Escape — close search or modal
  if (e.key === 'Escape') {
    const overlay = document.getElementById('search-overlay');
    if (overlay && overlay.style.display !== 'none') { closeSearch(); return; }
    closeModalDirect();
    return;
  }
  // Arrow navigation inside open modal
  const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');
  if (modalOpen) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); modalNavigate(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); modalNavigate(1);  return; }
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const map = { '1': 'scrum', '2': 'kanban', '3': 'pi', '4': 'reports', '5': 'support', '6': 'settings', '7': 'roadmap', '8': 'piprep' };
  if (map[e.key]) showView(map[e.key]);
});

// ============================================================
// Recherche globale (Ctrl+K) — improvement #1
// ============================================================
function openSearch() {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; input.focus(); }
  document.getElementById('search-results').innerHTML = '';
}

function closeSearch() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.style.display = 'none';
}

window._onSearchInput = function(q) {
  const results = window._globalSearch(q);
  const el = document.getElementById('search-results');
  if (!el) return;
  if (!q.trim()) { el.innerHTML = ''; return; }
  if (!results.length) {
    el.innerHTML = '<div class="search-empty">Aucun résultat pour "' + q + '"</div>';
    return;
  }
  // Group by type
  const groups = {};
  results.forEach(r => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });
  const groupLabels = { ticket: 'Tickets', epic: 'Epics', member: 'Membres' };
  el.innerHTML = Object.entries(groups).map(([gk, items]) =>
    `<div class="search-result-group">
      <div class="search-result-group-label">${groupLabels[gk] || gk}</div>
      ${items.map(item =>
        `<div class="search-result-item" onclick="_searchResultClick('${item.group}','${item.id}')">
          <span class="sri-key">${item.id}</span>
          <span class="sri-title">${item.title}</span>
          ${item.meta ? `<span class="sri-badge">${item.meta}</span>` : ''}
        </div>`
      ).join('')}
    </div>`
  ).join('');
};

window._globalSearch = function(q) {
  if (!q || !q.trim()) return [];
  const lq = q.toLowerCase();
  const results = [];

  // Search TICKETS
  (typeof TICKETS !== 'undefined' ? TICKETS : []).forEach(t => {
    if (results.length >= 12) return;
    if (
      (t.id    || '').toLowerCase().includes(lq) ||
      (t.title || '').toLowerCase().includes(lq) ||
      (t.assignee || '').toLowerCase().includes(lq)
    ) {
      results.push({ group: 'ticket', id: t.id, title: t.title || t.id, meta: t.assignee || '' });
    }
  });

  // Search EPICS
  (typeof EPICS !== 'undefined' ? EPICS : []).forEach(e => {
    if (results.length >= 12) return;
    if (
      (e.id    || '').toLowerCase().includes(lq) ||
      (e.title || '').toLowerCase().includes(lq)
    ) {
      results.push({ group: 'epic', id: e.id, title: e.title || e.id, meta: e.team || '' });
    }
  });

  // Search MEMBERS (object { team: [names] } or array)
  const _m = typeof MEMBERS !== 'undefined' ? MEMBERS : {};
  const memberList = Array.isArray(_m) ? _m : [...new Set(Object.values(_m).flat())];
  memberList.forEach(m => {
    if (results.length >= 12) return;
    const name = typeof m === 'string' ? m : (m.name || m.id || '');
    if (name.toLowerCase().includes(lq)) {
      results.push({ group: 'member', id: name, title: name, meta: '' });
    }
  });

  return results.slice(0, 12);
};

window._searchResultClick = function(group, id) {
  closeSearch();
  if (group === 'ticket') {
    // Build context list from current visible tickets
    const visibleTickets = (typeof getTickets === 'function' ? getTickets() : TICKETS);
    window._modalTicketList = visibleTickets.map(t => t.id);
    openModal(id);
  } else if (group === 'epic') {
    showView('pi');
  }
};

// Navigation arrière / avant du navigateur
window.addEventListener('hashchange', () => { if (!_applyHash()) showView('scrum'); });

// ============================================================
// Sidebar redimensionnable
// ============================================================
(function() {
  const handle  = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('sidebar');
  if (!handle || !sidebar) return;

  // Restaurer la largeur sauvegardée
  const saved = parseInt(localStorage.getItem('sidebarW') || '', 10);
  if (saved >= 160 && saved <= 420) {
    sidebar.style.width    = saved + 'px';
    sidebar.style.minWidth = saved + 'px';
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const w = Math.min(420, Math.max(160, startW + e.clientX - startX));
      sidebar.style.width    = w + 'px';
      sidebar.style.minWidth = w + 'px';
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebarW', sidebar.offsetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
})();

// ============================================================
// Init — lecture du cache au démarrage (jamais d'appel JIRA)
// ============================================================

renderGroupBtns();
renderTeamBtns();

(async function init() {
  const jiraUrl   = CONFIG.jira.url   || '';
  const jiraToken = CONFIG.jira.token || '';
  const isLive    = jiraUrl && jiraToken && !jiraUrl.includes('votre-jira');

  // Load team mood / rituals data
  if (typeof _moodLoad === 'function') await _moodLoad();

  if (isLive) {
    const cachedAt = await loadJiraCache();
    renderGroupBtns(); // re-rendre avec les groupes réels du cache
    renderTeamBtns();  // re-rendre avec les équipes réelles du cache
    _updateSidebarStats();
    _renderSidebarProgress();
    _updateBlockedBadge();
    if (cachedAt) {
      _updateLastSync(cachedAt);
      const age = _formatCacheAge(cachedAt);
      showToast(`Données chargées depuis le cache (${age})`, 'success');
    } else {
      showToast('Pas de cache — cliquez sur Synchroniser pour charger depuis JIRA', 'info');
    }
  }

  // Restaurer depuis le hash ou afficher la vue par défaut
  if (!_applyHash()) showView('scrum');
})();

// Formate l'âge d'un timestamp ISO en texte lisible ("il y a 2h", "12/03 à 14h30"…)
function _formatCacheAge(isoDate) {
  try {
    const d      = new Date(isoDate);
    const now    = new Date();
    const diffMs = now - d;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1)   return 'à l\'instant';
    if (diffMin < 60)  return `il y a ${diffMin} min`;
    if (diffMin < 1440) {
      const h = Math.round(diffMin / 60);
      return `il y a ${h}h`;
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'cache local';
  }
}
