// ============================================================
// CHARTS — Graphiques Chart.js (burndown, velocity, donut type)
// Données réelles depuis TICKETS + CONFIG.sprint
// ============================================================

// Références aux instances Chart.js
let _burndownChart = null;
let _velocityChart = null;
let _typeChart     = null;
let _burnupChart   = null;
let _cmdChart      = null;

// Sprint sélectionné pour la comparaison : null = sprint actuel, entier = index dans velocityHistory
let _metricsSprintIdx = null;

// ---- Style partagé pour tous les tooltips ----------------
const _TOOLTIP = {
  backgroundColor: 'rgba(15,23,42,.94)',
  titleColor:      '#F8FAFC',
  bodyColor:       '#CBD5E1',
  borderColor:     'rgba(255,255,255,.10)',
  borderWidth:     1,
  padding:         12,
  cornerRadius:    10,
  titleFont:       { size: 12, weight: 'bold' },
  bodyFont:        { size: 11 },
  displayColors:   true,
  boxWidth:        10,
  boxHeight:       10,
  boxPadding:      4,
};

function _chartTextColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '#CBD5E1' : '#666';
}

function initCharts() {
  Chart.defaults.color = _chartTextColor();
  _renderSprintSelector();
  _buildBurndown();
  _buildVelocity();
  _buildTypeDonut();
  _buildBurnup();
  _buildCFDScrum();
}

function refreshCharts() {
  if (_burndownChart) { _burndownChart.destroy(); _burndownChart = null; }
  if (_velocityChart) { _velocityChart.destroy(); _velocityChart = null; }
  if (_typeChart)     { _typeChart.destroy();     _typeChart     = null; }
  if (_burnupChart)   { _burnupChart.destroy();   _burnupChart   = null; }
  if (_cmdChart)      { _cmdChart.destroy();      _cmdChart      = null; }
  chartsInitialized = false;
  initCharts();
  chartsInitialized = true;
}

// ---- Historique sprint normalisé --------------------------------
// Retourne [{name, vel}] pour le sélecteur et le velocity chart.
// - Équipe unique : noms réels depuis cette équipe
// - Multi-équipes / groupe : noms ordinaux S-N, vélocité agrégée

function _getSprintHistory() {
  // Équipe unique sélectionnée → historique direct avec vrais noms
  if (currentTeam && currentTeam !== 'all' && !currentGroup) {
    const tc = CONFIG.teams[currentTeam];
    if (!tc?.velocityHistory?.length) return [];
    return tc.velocityHistory.slice(0, CONFIG.sync.velocityHistoryCount).map(e => ({
      name: e.name || '',
      vel:  e.velocity || 0,
    }));
  }

  // Multi-équipes / groupe → agréger par index, labels ordinaux
  const activeTeams = getActiveTeams();
  const teamEntries = activeTeams
    .map(tid => CONFIG.teams[tid])
    .filter(tc => tc && Array.isArray(tc.velocityHistory) && tc.velocityHistory.length);

  if (!teamEntries.length) return [];

  const maxLen = Math.max(...teamEntries.map(tc => tc.velocityHistory.length));
  const count  = Math.min(maxLen, 6);

  return Array.from({ length: count }, (_, i) => {
    let vel = 0;
    teamEntries.forEach(tc => {
      const e = tc.velocityHistory[i];
      if (e) vel += e.velocity || 0;
    });
    return { name: `S-${count - i}`, vel };
  });
}

// ---- Sprint selector -------------------------------------------

function _renderSprintSelector() {
  const history = _getSprintHistory();

  // Injecter ou récupérer le conteneur
  let el = document.getElementById('sprint-selector');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sprint-selector';
    const chartsRow = document.getElementById('charts-row');
    if (chartsRow) chartsRow.parentNode.insertBefore(el, chartsRow);
  }

  if (!history.length) {
    el.style.display = 'none';
    _metricsSprintIdx = null;
    return;
  }

  // Valider la sélection courante
  if (_metricsSprintIdx !== null && _metricsSprintIdx >= history.length) _metricsSprintIdx = null;

  const s            = _activeSprintCtx();
  const currentLabel = s.label || 'Sprint actuel';

  let html = `<div class="sprint-selector-row">
    <span class="sprint-sel-label">Comparer :</span>
    <button class="sprint-sel-btn${_metricsSprintIdx === null ? ' active' : ''}" onclick="_selectMetricsSprint(null)">${currentLabel}</button>`;

  history.forEach((entry, i) => {
    const label = (entry.name || `S-${history.length - i}`).replace(/sprint\s*/i, 'S');
    html += `<button class="sprint-sel-btn${_metricsSprintIdx === i ? ' active' : ''}" onclick="_selectMetricsSprint(${i})">${label}</button>`;
  });
  html += '</div>';

  el.innerHTML     = html;
  el.style.display = '';
}

window._selectMetricsSprint = function(idx) {
  _metricsSprintIdx = idx;
  refreshCharts();
};

// ---- Burndown (sprint actuel ou historique) --------------------

function _buildBurndown() {
  const days   = CONFIG.sprint.durationDays || 14;
  const labels = Array.from({ length: days }, (_, i) => `J${i + 1}`);

  let ptsTotal, ptsDone, ticketsTotal, ticketsDone, chartTitle, isHistorical = false;

  if (_metricsSprintIdx !== null) {
    // Sprint historique : seule la vélocité réalisée est disponible
    isHistorical = true;
    const activeTeams = getActiveTeams();
    const teamEntries = activeTeams.map(tid => CONFIG.teams[tid]).filter(tc => tc && Array.isArray(tc.velocityHistory));
    ptsDone = 0;
    let sprintName = null;
    teamEntries.forEach(tc => {
      const e = tc.velocityHistory[_metricsSprintIdx];
      if (e) { ptsDone += e.velocity || 0; if (!sprintName) sprintName = e.name; }
    });
    ptsTotal     = ptsDone;
    ticketsTotal = 0;
    ticketsDone  = 0;
    chartTitle   = `📉 Sprint terminé · ${ptsDone} pts réalisés`;
  } else {
    const s       = _activeSprintCtx();
    const tickets = getTickets();
    ptsTotal     = tickets.reduce((a, t) => a + t.points, 0) || s.velocityTarget || 80;
    ptsDone      = tickets.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
    ticketsTotal = tickets.length;
    ticketsDone  = tickets.filter(t => t.status === 'done').length;
    chartTitle   = '📉 Burndown Chart';
  }

  const titleEl = document.querySelector('#burndownChart')?.closest('.chart-card')?.querySelector('.chart-title');
  if (titleEl) titleEl.textContent = chartTitle;

  const idealData = Array.from({ length: days }, (_, i) =>
    Math.round(ptsTotal * (1 - i / (days - 1)))
  );

  let realData, ticketData;
  if (isHistorical) {
    realData = Array.from({ length: days }, (_, i) =>
      Math.round(ptsTotal * (1 - i / (days - 1)))
    );
    ticketData = null;
  } else {
    const s          = _activeSprintCtx();
    const currentDay = _sprintCurrentDay(days, s);
    realData = Array.from({ length: days }, (_, i) => {
      if (i > currentDay) return null;
      if (currentDay === 0) return ptsTotal;
      return Math.round(ptsTotal - (ptsDone * i / currentDay));
    });
    // Ticket count burndown (on secondary Y axis)
    ticketData = Array.from({ length: days }, (_, i) => {
      if (i > currentDay) return null;
      if (currentDay === 0) return ticketsTotal;
      return Math.round(ticketsTotal - (ticketsDone * i / currentDay));
    });
  }

  const datasets = [
    {
      label: 'Idéal',
      data: idealData,
      borderColor: '#94A3B8', borderDash: [5, 5], pointRadius: 0, tension: .3,
      yAxisID: 'y',
    },
    {
      label: isHistorical ? 'Réalisé (approx.)' : 'Réel (pts)',
      data: realData,
      borderColor: isHistorical ? '#10B981' : '#0284C7',
      backgroundColor: isHistorical ? 'rgba(16,185,129,.12)' : 'rgba(2,132,199,.1)',
      fill: true, tension: .3,
      pointBackgroundColor: isHistorical ? '#10B981' : '#0284C7',
      pointRadius: 3, pointHoverRadius: 5,
      spanGaps: false,
      yAxisID: 'y',
    },
  ];

  if (ticketData && ticketsTotal > 0) {
    datasets.push({
      label: 'Tickets restants',
      data: ticketData,
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,.08)',
      borderWidth: 2, borderDash: [3, 3],
      fill: false, tension: .3,
      pointBackgroundColor: '#F59E0B',
      pointRadius: 2, pointHoverRadius: 4,
      spanGaps: false,
      yAxisID: 'y1',
    });
  }

  _burndownChart = new Chart(document.getElementById('burndownChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            label: item => {
              if (item.raw == null) return null;
              if (item.dataset.yAxisID === 'y1') return ` ${item.dataset.label}: ${item.raw} tickets`;
              return ` ${item.dataset.label}: ${item.raw} pts restants`;
            },
            footer: items => {
              const real  = items.find(i => i.dataset.yAxisID === 'y' && i.dataset.label !== 'Idéal' && i.raw != null);
              const ideal = items.find(i => i.dataset.label === 'Idéal' && i.raw != null);
              if (!real || !ideal) return [];
              const d = real.raw - ideal.raw;
              if (d > 0)  return [`⚠️  Retard : +${d} pts par rapport à l'idéal`];
              if (d < 0)  return [`✅  Avance : ${Math.abs(d)} pts sur l'idéal`];
              return [`=  Dans les clous`];
            },
          },
          footerColor:  '#F59E0B',
          footerFont:   { size: 11, weight: '600' },
        },
        ...(isHistorical ? {
          subtitle: {
            display: true,
            text: 'Courbe approximative · données journalières non disponibles',
            color: '#94A3B8',
            font: { size: 10, style: 'italic' },
            padding: { bottom: 8 },
          },
        } : {}),
      },
      scales: {
        y:  { beginAtZero: true, title: { display: true, text: 'Points restants' }, position: 'left' },
        y1: {
          beginAtZero: true, position: 'right', display: ticketData && ticketsTotal > 0,
          title: { display: true, text: 'Tickets', color: '#F59E0B' },
          ticks: { color: '#F59E0B', stepSize: 1 },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

// ---- Velocity (toujours 6 colonnes : 5 historiques + sprint actuel) ----

function _buildVelocity() {
  const history   = _getSprintHistory();
  const tickets   = getTickets();
  const ptsTotal  = tickets.reduce((a, t) => a + t.points, 0) || CONFIG.sprint.velocityTarget || 80;
  const ptsDone   = tickets.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
  const s         = _activeSprintCtx();
  const sprintLbl = (s.label || `S${CONFIG.sprint.current}`).replace(/sprint\s*/i, 'S');

  // Toujours 5 slots historiques + 1 actuel = 6 colonnes
  const HIST_SLOTS = 5;
  const slots    = history.slice(0, HIST_SLOTS);
  const padCount = HIST_SLOTS - slots.length;

  const labels   = [...Array(padCount).fill(''), ...slots.map(h => (h.name || '').replace(/sprint\s*/i, 'S')), sprintLbl];
  const engaged  = [...Array(padCount).fill(null), ...slots.map(h => h.vel), ptsTotal];
  const realized = [...Array(padCount).fill(null), ...slots.map(h => h.vel), ptsDone];

  // Mise en évidence du sprint sélectionné
  const hiIdx      = _metricsSprintIdx !== null ? padCount + _metricsSprintIdx : labels.length - 1;
  const engagedBg  = labels.map((_, i) => i === hiIdx ? 'rgba(2,132,199,.75)'   : 'rgba(2,132,199,.22)');
  const realizedBg = labels.map((_, i) => i === hiIdx ? 'rgba(16,185,129,.9)'   : 'rgba(16,185,129,.35)');
  const engagedBdr = labels.map((_, i) => i === hiIdx ? '#0284C7'               : 'rgba(2,132,199,.4)');
  const realizedBdr= labels.map((_, i) => i === hiIdx ? '#10B981'               : 'rgba(16,185,129,.5)');

  _velocityChart = new Chart(document.getElementById('velocityChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Engagés',  data: engaged,  backgroundColor: engagedBg,  borderColor: engagedBdr,  borderWidth: 2 },
        { label: 'Réalisés', data: realized, backgroundColor: realizedBg, borderColor: realizedBdr, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw} pts`,
            footer: items => {
              const eng = items.find(i => i.dataset.label === 'Engagés'  && i.raw != null);
              const rea = items.find(i => i.dataset.label === 'Réalisés' && i.raw != null);
              if (!eng || !rea || !eng.raw) return [];
              const rate = Math.round(rea.raw / eng.raw * 100);
              const icon = rate >= 90 ? '✅' : rate >= 70 ? '🟡' : '⚠️';
              return [`${icon}  Taux de réalisation : ${rate}%`];
            },
          },
          footerColor: '#10B981',
          footerFont:  { size: 11, weight: '600' },
        },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// ---- Type distribution (filtré sur les équipes actives) --------

function _buildTypeDonut() {
  const typeCounts = {};
  getTickets().forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1; });

  _typeChart = new Chart(document.getElementById('typeChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(typeCounts).map(typeName),
      datasets: [{
        data:            Object.values(typeCounts),
        backgroundColor: Object.keys(typeCounts).map(k => CONFIG.typeColors[k] || '#94A3B8'),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            label: item => {
              const total = item.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total ? Math.round(item.raw / total * 100) : 0;
              return ` ${item.label}: ${item.raw} ticket${item.raw !== 1 ? 's' : ''} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ---- Burnup Chart ---------------------------------------------

function _buildBurnup() {
  const canvas = document.getElementById('burnupChart');
  if (!canvas) return;

  const days   = CONFIG.sprint.durationDays || 14;
  const labels = Array.from({ length: days }, (_, i) => `J${i + 1}`);

  let ptsScope, ptsDone, isHistorical = false, chartTitle;

  if (_metricsSprintIdx !== null) {
    isHistorical = true;
    const activeTeams = getActiveTeams();
    const teamEntries = activeTeams.map(tid => CONFIG.teams[tid]).filter(tc => tc && Array.isArray(tc.velocityHistory));
    ptsDone = 0;
    let sprintName = null;
    teamEntries.forEach(tc => {
      const e = tc.velocityHistory[_metricsSprintIdx];
      if (e) { ptsDone += e.velocity || 0; if (!sprintName) sprintName = e.name; }
    });
    ptsScope   = ptsDone;
    chartTitle = `📈 Sprint terminé · ${ptsDone} pts réalisés`;
  } else {
    const s      = _activeSprintCtx();
    const tickets = getTickets();
    ptsScope   = tickets.reduce((a, t) => a + t.points, 0) || s.velocityTarget || 80;
    ptsDone    = tickets.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
    chartTitle = '📈 Burnup Chart';
  }

  const titleEl = canvas.closest('.chart-card')?.querySelector('.chart-title');
  if (titleEl) titleEl.textContent = chartTitle;

  const scopeData  = Array.from({ length: days }, () => ptsScope);
  const currentDay = isHistorical ? days - 1 : _sprintCurrentDay(days, _activeSprintCtx());
  const doneData   = Array.from({ length: days }, (_, i) => {
    if (i > currentDay) return null;
    if (currentDay === 0) return ptsDone;
    return Math.round(ptsDone * i / currentDay);
  });

  _burnupChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Scope',
          data: scopeData,
          borderColor: '#94A3B8', borderDash: [5, 5], pointRadius: 0, tension: 0, fill: false,
        },
        {
          label: isHistorical ? 'Réalisé' : 'Terminé',
          data: doneData,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,.15)',
          fill: true, tension: .3,
          pointBackgroundColor: '#10B981',
          pointRadius: 3, pointHoverRadius: 5,
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            label: item => {
              if (item.raw == null) return null;
              if (item.dataset.label === 'Scope') return ` Scope: ${item.raw} pts`;
              return ` Terminé: ${item.raw} pts`;
            },
            footer: items => {
              const done  = items.find(i => i.dataset.label !== 'Scope' && i.raw != null);
              const scope = items.find(i => i.dataset.label === 'Scope'  && i.raw != null);
              if (!done || !scope || !scope.raw) return [];
              const pct  = Math.round(done.raw / scope.raw * 100);
              const icon = pct >= 80 ? '✅' : pct >= 50 ? '🟡' : '📍';
              return [`${icon}  Avancement : ${pct}%`];
            },
          },
          footerColor: '#10B981',
          footerFont:  { size: 11, weight: '600' },
        },
      },
      scales: {
        y: { beginAtZero: true, max: Math.ceil(ptsScope * 1.1) || undefined, title: { display: true, text: 'Points' } },
      },
    },
  });
}

// ---- CFD Scrum — Flux Cumulatif Sprint (simulation) -----------

function _buildCFDScrum() {
  const canvas = document.getElementById('cmdChart');
  if (!canvas) return;

  const days    = CONFIG.sprint.durationDays || 14;
  const labels  = Array.from({ length: days }, (_, i) => `J${i + 1}`);
  const tickets = getTickets();
  const total   = tickets.length;

  if (!total) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94A3B8'; ctx.font = '12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Aucune donnée', canvas.width / 2, canvas.height / 2);
    return;
  }

  const s          = _activeSprintCtx();
  const currentDay = _sprintCurrentDay(days, s);

  // Distribution actuelle
  const now = { todo: 0, inprog: 0, review: 0, test: 0, done: 0, blocked: 0 };
  tickets.forEach(t => {
    if (Object.prototype.hasOwnProperty.call(now, t.status)) now[t.status]++;
    else now.todo++;
  });

  // Simulation linéaire : J0 → tous en todo, J_current → distribution réelle
  const sim = (status, day) => {
    if (day > currentDay) return null;
    const t = currentDay > 0 ? day / currentDay : 1;
    const startVal = status === 'todo' ? total : 0;
    return Math.round(startVal + (now[status] - startVal) * t);
  };

  // Layers de bas en haut (stacked area)
  const layers = [
    { key: 'done',    label: 'Terminé',   color: '#10B981' },
    { key: 'test',    label: 'En test',   color: '#06B6D4' },
    { key: 'review',  label: 'Review',    color: '#3B82F6' },
    { key: 'inprog',  label: 'En cours',  color: '#F59E0B' },
    { key: 'blocked', label: 'Bloqué',    color: '#EF4444' },
    { key: 'todo',    label: 'À faire',   color: '#94A3B8' },
  ];

  const datasets = layers.map(l => ({
    label:           l.label,
    data:            Array.from({ length: days }, (_, i) => sim(l.key, i)),
    backgroundColor: l.color + 'CC',
    borderColor:     l.color,
    borderWidth:     1,
    fill:            true,
    tension:         0.35,
    pointRadius:     0,
    pointHoverRadius: 4,
    spanGaps:        false,
  }));

  _cmdChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 10, padding: 6 } },
        tooltip: {
          ..._TOOLTIP,
          mode: 'index', intersect: false,
          callbacks: {
            label: item => item.raw == null ? null : ` ${item.dataset.label}: ${item.raw}`,
            footer: items => {
              const sum = items.filter(i => i.raw != null).reduce((s, i) => s + i.raw, 0);
              return sum ? [`Total : ${sum} tickets`] : [];
            },
          },
          footerColor: '#94A3B8',
          footerFont:  { size: 11 },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max: total,
          ticks: { stepSize: Math.max(1, Math.ceil(total / 5)), font: { size: 10 } },
          title: { display: true, text: 'Tickets', font: { size: 10 } },
        },
      },
    },
  });
}

// ---- Helpers ---------------------------------------------------

// Jour courant dans le sprint (0 = premier jour, days-1 = dernier)
function _sprintCurrentDay(days, sprintCtx) {
  const rawDate = (sprintCtx || CONFIG.sprint).startDate || '';
  const parsed  = _parseDate(rawDate);
  if (!parsed) return Math.floor(days / 2); // fallback : milieu du sprint
  const diffDays = Math.floor((new Date() - parsed) / 86400000);
  return Math.min(Math.max(0, diffDays), days - 1);
}

// Parse "06 Mar 2026", "06 mars 2026", "2026-03-06"
function _parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d)) return d;
  const months = {
    jan:0, fév:1, fev:1, mar:2, avr:3, apr:3, mai:4, may:4,
    juin:5, jun:5, juil:6, jul:6, août:7, aug:7,
    sep:8, oct:9, nov:10, déc:11, dec:11,
  };
  const m = str.match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i);
  if (m) {
    const month = months[(m[2] || '').toLowerCase().slice(0, 3)];
    if (month !== undefined) return new Date(parseInt(m[3]), month, parseInt(m[1]));
  }
  return null;
}
