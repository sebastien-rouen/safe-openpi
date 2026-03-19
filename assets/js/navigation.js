// ============================================================
// NAVIGATION - Vues, raccourcis clavier, URL hash, initialisation
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
    scrum:    `📋 Vue Scrum - ${CONFIG.sprint.label || 'Sprint actif'}`,
    kanban:   '🗂️ Vue Kanban',
    pi:       '🗓️ PI Planning',
    reports:  '📊 Rapports de Fin de Sprint',
    support:  '🎫 Tickets de Support',
    settings: '⚙️ Paramètres',
    roadmap:  '🗺️ Roadmap & Planification',
  };
  // La vue Scrum met à jour son propre titre via renderScrum() - inutile de l'écraser ici
  if (view !== 'scrum') document.getElementById('topbar-title').textContent = titles[view] || '';

  _updateTopbarActions(view);

  if (view === 'scrum')    renderScrum();
  if (view === 'kanban')   renderKanban();
  if (view === 'pi')       renderPI();
  if (view === 'reports')  { if (currentTeam && currentTeam !== 'all') reportTeam = currentTeam; renderReportSections(); renderReport(); }
  if (view === 'support')  renderSupport();
  if (view === 'settings') renderSettings();
  if (view === 'roadmap')  renderRoadmap();

  // Sidebar progress is only built inside renderScrum - refresh it for other views too
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
  };
  // Mapping vue → section rapport
  const viewToSection = { scrum:'sprint', kanban:'kanban', pi:'pi', support:'support', roadmap:'roadmap' };
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
    roadmap:  `<button class="btn btn-secondary" onclick="_ppExportJSON()">💾 Exporter PI</button>${png}${rpt}`,
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
  banner.innerHTML = `⚠ Données potentiellement obsolètes -
    <button onclick="doSync()">Synchroniser</button>
    <button class="stale-close" onclick="this.parentElement.remove()">✕</button>`;
  content.insertBefore(banner, content.firstChild);
}

// ============================================================
// URL hash - sérialise / restaure l'état de navigation
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
  let view  = parts[0];
  // Backward compat: old views merged into roadmap
  if (view === 'piprep' || view === 'releases') view = 'roadmap';
  const views = ['scrum', 'kanban', 'pi', 'reports', 'support', 'settings', 'roadmap'];
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

// Raccourcis clavier : 1-6 pour naviguer, Échap pour fermer le modal, Ctrl+K search, Ctrl+F page search, ←/→ modal nav
document.addEventListener('keydown', e => {
  // Ctrl+K - open search overlay (global)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
    return;
  }
  // Ctrl+F - open search overlay scoped to current page
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    openSearch('page');
    return;
  }
  // Escape - close search or modal
  if (e.key === 'Escape') {
    const overlay = document.getElementById('search-overlay');
    if (overlay && overlay.style.display !== 'none') { closeSearch(); return; }
    closeModalDirect();
    return;
  }
  // Arrow/Enter navigation in search results
  const _srOverlay = document.getElementById('search-overlay');
  if (_srOverlay && _srOverlay.style.display !== 'none') {
    const items = _srOverlay.querySelectorAll('.search-result-item');
    if (items.length) {
      const active = _srOverlay.querySelector('.search-result-item.sr-active');
      let idx = active ? [...items].indexOf(active) : -1;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
      else if (e.key === 'Enter' && active) { e.preventDefault(); active.click(); return; }
      else return;
      items.forEach(i => i.classList.remove('sr-active'));
      if (items[idx]) { items[idx].classList.add('sr-active'); items[idx].scrollIntoView({ block: 'nearest' }); }
    }
    return;
  }
  // Arrow navigation inside open modal
  const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');
  if (modalOpen) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); modalNavigate(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); modalNavigate(1);  return; }
  }
  // Arrow navigation in daily mode
  if (typeof _dailyActive !== 'undefined' && _dailyActive) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); _dailyPrev(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); _dailyNext(); return; }
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const map = { '1': 'scrum', '2': 'kanban', '3': 'roadmap', '4': 'pi', '5': 'reports', '6': 'support', '7': 'settings' };
  if (map[e.key]) showView(map[e.key]);
});

// ============================================================
// Recherche globale (Ctrl+K) & page (Ctrl+F)
// ============================================================
let _searchMode = 'global'; // 'global' | 'page'

function openSearch(mode) {
  _searchMode = mode || 'global';
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.placeholder = _searchMode === 'page'
      ? 'Rechercher dans cette page… (Ctrl+F)'
      : 'Rechercher un ticket, epic, section… (Ctrl+K)';
    input.focus();
  }
  const el = document.getElementById('search-results');
  if (el) {
    if (_searchMode === 'page') {
      _renderSearchResults(_collectSections(true));
    } else {
      el.innerHTML = '';
    }
  }
}

function closeSearch() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- Collect navigable sections from the DOM ---
function _collectSections(currentPageOnly) {
  const selectors = '.section-title, .section-header > .section-title, .rm-section-title, .chart-title, .pi-obj-header, .settings-section-header';
  const activeView = currentPageOnly ? document.querySelector('.view.active') : null;
  const root = activeView || document.getElementById('content') || document.body;
  const els = root.querySelectorAll(selectors);
  const seen = new Set();
  const results = [];

  // View labels for meta badge
  const viewLabels = { 'view-scrum': 'Scrum', 'view-kanban': 'Kanban', 'view-pi': 'PI Planning', 'view-reports': 'Rapports', 'view-support': 'Support', 'view-settings': 'Paramètres', 'view-roadmap': 'Roadmap' };

  els.forEach(el => {
    let text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length < 2 || text.length > 80) return;
    if (seen.has(text)) return;
    seen.add(text);

    // Find parent view for meta label
    const parentView = el.closest('.view');
    const viewId = parentView ? parentView.id : '';
    const viewLabel = viewLabels[viewId] || '';

    // Use the closest scrollable parent element for targeting
    const target = el.closest('.section-header, .rm-section-header, .chart-card, .pi-obj, .settings-section') || el;
    const uid = 'sr-' + results.length;
    target.dataset.searchTarget = uid;

    results.push({
      group: 'section',
      id: uid,
      title: text,
      meta: viewLabel,
      _viewId: viewId,
      _el: target,
    });
  });

  // Sections statiques : toujours disponibles même si la vue n'a pas encore été rendue
  // Chaque entrée pointe vers une vue + section Roadmap (rm-sec-*) ou un ID de section
  if (!currentPageOnly) {
    const statics = [
      { title: '📊 Vision & Avancement',    view: 'roadmap', rmSec: 'vision' },
      { title: '📅 Planification',           view: 'roadmap', rmSec: 'planification' },
      { title: '⚡ Capacité & Charge',        view: 'roadmap', rmSec: 'capacite' },
      { title: '⚠️ Risques & Qualité',       view: 'roadmap', rmSec: 'risques' },
      { title: '🤝 Rituels',                 view: 'roadmap', rmSec: 'rituels' },
      { title: '📋 Backlog',                 view: 'roadmap', rmSec: 'backlog' },
      { title: '🎯 Objectifs PI',            view: 'roadmap', rmSec: 'capacite', keywords: 'objectifs pi objectives' },
      { title: '⚡ ROAM Board - Risques',     view: 'roadmap', rmSec: 'risques', keywords: 'roam risques risks' },
      { title: '🔗 Dépendances inter-équipes', view: 'roadmap', rmSec: 'risques', keywords: 'dépendances dependencies' },
      { title: '🤜 Fist of Five',            view: 'roadmap', rmSec: 'rituels', keywords: 'fist vote confiance' },
    ];
    statics.forEach(s => {
      if (seen.has(s.title)) return;
      seen.add(s.title);
      const uid = 'sr-static-' + s.rmSec + '-' + results.length;
      results.push({
        group: 'section',
        id: uid,
        title: s.title,
        meta: 'Roadmap',
        _viewId: 'view-roadmap',
        _rmSec: s.rmSec,
        _keywords: s.keywords || '',
      });
    });
  }

  return results;
}

// --- Search tickets on current page (id, title, description) ---
function _searchPageTickets(lq) {
  const tickets = typeof getTickets === 'function' ? getTickets() : (typeof TICKETS !== 'undefined' ? TICKETS : []);
  const results = [];
  tickets.forEach(t => {
    if (results.length >= 15) return;
    if (
      (t.id || '').toLowerCase().includes(lq) ||
      (t.title || '').toLowerCase().includes(lq) ||
      (t.description || '').toLowerCase().includes(lq)
    ) {
      results.push({
        group: 'ticket',
        id: t.id,
        title: t.title || t.id,
        meta: t.assignee || '',
        _pageTicket: true,
      });
    }
  });
  return results;
}

function _renderSearchResults(results) {
  const el = document.getElementById('search-results');
  if (!el) return;
  if (!results.length) {
    el.innerHTML = '<div class="search-empty">Aucune section trouvée</div>';
    return;
  }
  const groups = {};
  results.forEach(r => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });
  const groupLabels = { ticket: 'Tickets', epic: 'Epics', member: 'Membres', section: 'Sections' };
  el.innerHTML = Object.entries(groups).map(([gk, items]) =>
    `<div class="search-result-group">
      <div class="search-result-group-label">${groupLabels[gk] || gk}</div>
      ${items.map(item => {
        // Escape single quotes in id for onclick
        const safeId = (item.id || '').replace(/'/g, "\\'");
        return `<div class="search-result-item" onclick="_searchResultClick('${item.group}','${safeId}')">
          <span class="sri-key">${item.group === 'section' ? '§' : item.id}</span>
          <span class="sri-title">${item.title}</span>
          ${item.meta ? `<span class="sri-badge">${item.meta}</span>` : ''}
        </div>`;
      }).join('')}
    </div>`
  ).join('');
}

window._onSearchInput = function(q) {
  const el = document.getElementById('search-results');
  if (!el) return;

  if (_searchMode === 'page') {
    const sections = _collectSections(true);
    if (!q.trim()) { _renderSearchResults(sections); return; }
    const lq = q.toLowerCase();
    const filtered = sections.filter(s => s.title.toLowerCase().includes(lq));
    // Also search tickets visible on current page
    const pageTickets = _searchPageTickets(lq);
    const all = [...filtered, ...pageTickets];
    if (!all.length) { el.innerHTML = '<div class="search-empty">Aucun résultat pour "' + q + '"</div>'; return; }
    _renderSearchResults(all);
    return;
  }

  // Global mode
  const results = window._globalSearch(q);
  if (!q.trim()) { el.innerHTML = ''; return; }
  if (!results.length) {
    el.innerHTML = '<div class="search-empty">Aucun résultat pour "' + q + '"</div>';
    return;
  }
  _renderSearchResults(results);
};

window._globalSearch = function(q) {
  if (!q || !q.trim()) return [];
  const lq = q.toLowerCase();
  const results = [];

  // Search sections (across all views + static roadmap sections)
  const sections = _collectSections(false);
  sections.forEach(s => {
    if (results.length >= 20) return;
    if (s.title.toLowerCase().includes(lq) || (s._keywords && s._keywords.toLowerCase().includes(lq))) {
      results.push(s);
    }
  });

  // Search TICKETS
  (typeof TICKETS !== 'undefined' ? TICKETS : []).forEach(t => {
    if (results.length >= 20) return;
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
    if (results.length >= 20) return;
    if (
      (e.id    || '').toLowerCase().includes(lq) ||
      (e.title || '').toLowerCase().includes(lq)
    ) {
      results.push({ group: 'epic', id: e.id, title: e.title || e.id, meta: e.team || '' });
    }
  });

  // Search MEMBERS
  const _m = typeof MEMBERS !== 'undefined' ? MEMBERS : {};
  const memberList = Array.isArray(_m) ? _m : [...new Set(Object.values(_m).flat())];
  memberList.forEach(m => {
    if (results.length >= 20) return;
    const name = typeof m === 'string' ? m : (m.name || m.id || '');
    if (name.toLowerCase().includes(lq)) {
      results.push({ group: 'member', id: name, title: name, meta: '' });
    }
  });

  return results.slice(0, 20);
};

// --- Highlight a section element ---
function _highlightSection(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('search-highlight');
  setTimeout(() => el.classList.remove('search-highlight'), 2200);
}

window._searchResultClick = function(group, id) {
  closeSearch();
  if (group === 'section') {
    // Static roadmap section (sr-static-*) → navigate to roadmap + scroll to section
    if (id.startsWith('sr-static-')) {
      const rmSec = id.replace('sr-static-', '').replace(/-\d+$/, '');
      showView('roadmap');
      setTimeout(() => { if (typeof _rmScrollTo === 'function') _rmScrollTo(rmSec); }, 150);
      return;
    }
    // Find element by data-search-target
    const target = document.querySelector(`[data-search-target="${id}"]`);
    if (target) {
      // Switch to the right view if needed
      const parentView = target.closest('.view');
      if (parentView && !parentView.classList.contains('active')) {
        const viewId = parentView.id.replace('view-', '');
        showView(viewId);
        // Wait for view render then scroll
        setTimeout(() => _highlightSection(target), 120);
      } else {
        _highlightSection(target);
      }
    }
  } else if (group === 'ticket') {
    // Try to find and highlight the ticket card on the current page first
    const card = document.querySelector(`.view.active [data-ticket-id="${id}"]`);
    if (card && _searchMode === 'page') {
      _highlightSection(card);
    } else {
      const visibleTickets = (typeof getTickets === 'function' ? getTickets() : TICKETS);
      window._modalTicketList = visibleTickets.map(t => t.id);
      openModal(id);
    }
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
// Init - lecture du cache au démarrage (jamais d'appel JIRA)
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
      showToast('Pas de cache - cliquez sur Synchroniser pour charger depuis JIRA', 'info');
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
