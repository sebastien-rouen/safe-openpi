// ============================================================
// CHARTS - Graphiques Chart.js (burndown, velocity, donut type)
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

// ---- Mode plein ecran pour un chart ----
let _fsChart = null;
window._chartFullscreen = function(canvasId, title) {
  const src = document.getElementById(canvasId);
  if (!src) return;
  // Recuperer l'instance Chart.js liee a ce canvas
  const srcChart = Chart.getChart(canvasId);
  if (!srcChart) return;

  // Construire l'overlay
  const overlay = document.createElement('div');
  overlay.className = 'chart-fs-overlay';
  overlay.innerHTML = `
    <div class="chart-fs-modal" onclick="event.stopPropagation()">
      <div class="chart-fs-header">
        <h2>${title || ''}</h2>
        <button class="chart-fs-close" onclick="_closeChartFullscreen()" title="Fermer (Esc)">✕</button>
      </div>
      <div class="chart-fs-body"><canvas id="_fsCanvas"></canvas></div>
    </div>`;
  overlay.addEventListener('click', _closeChartFullscreen);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Cloner la config en deep clone (sans les fonctions car JSON ne les serialise pas)
  const fsCanvas = document.getElementById('_fsCanvas');
  const cfg = {
    type: srcChart.config.type,
    data: srcChart.config.data,
    options: { ...srcChart.config.options, responsive: true, maintainAspectRatio: false },
    plugins: srcChart.config.plugins,
  };
  _fsChart = new Chart(fsCanvas.getContext('2d'), cfg);

  // Echap pour fermer
  document.addEventListener('keydown', _fsKeyHandler);
};

function _fsKeyHandler(e) {
  if (e.key === 'Escape') _closeChartFullscreen();
}

window._closeChartFullscreen = function() {
  if (_fsChart) { _fsChart.destroy(); _fsChart = null; }
  const ov = document.querySelector('.chart-fs-overlay');
  if (ov) ov.remove();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', _fsKeyHandler);
};

// ---- Jours ouvrables : labels "J1 (L)" + plugin fond grisé ----
const _DAY_SHORT_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Retourne un tableau de { label, date, isOff, holiday } pour chaque jour du sprint
function _sprintDayInfo(days, sprint) {
  const startStr = sprint?.startDateISO || sprint?.startDate;
  if (!startStr) {
    return Array.from({ length: days }, (_, i) => ({ label: `J${i + 1}`, date: null, isOff: false, holiday: null }));
  }
  const start = new Date(/^\d{4}-\d{2}-\d{2}$/.test(startStr) ? startStr + 'T00:00:00' : startStr);
  if (isNaN(start)) return Array.from({ length: days }, (_, i) => ({ label: `J${i + 1}`, date: null, isOff: false, holiday: null }));
  // Charger les fériés sur la plage
  const hols = [];
  if (typeof _frenchHolidays === 'function') {
    const endYear = new Date(start.getTime() + days * 86400000).getFullYear();
    hols.push(..._frenchHolidays(start.getFullYear()));
    if (endYear !== start.getFullYear()) hols.push(..._frenchHolidays(endYear));
  }
  const holByDate = new Map(hols.map(h => [h.d.toDateString(), h.name]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const wd = d.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const holiday = holByDate.get(d.toDateString()) || null;
    return {
      label: `J${i + 1} (${_DAY_SHORT_FR[wd]})`,
      date: d,
      isOff: isWeekend || !!holiday,
      holiday,
    };
  });
}

// Tooltip HTML partage pour les events de tous les charts
function _getEventsTooltipEl() {
  let el = document.getElementById('chart-events-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chart-events-tooltip';
    el.className = 'chart-events-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

// Plugin Chart.js : dessine les faits marquants (events) comme markers verticaux
// + gere tooltips HTML au survol via hitboxes
// opts.info = [{ label, date, isOff, holiday }] pour chaque jour du chart
// opts.events = array de { type, startDate, endDate, title, description, ... }
const _eventsPlugin = {
  id: 'sprintEvents',
  afterDatasetsDraw(chart, args, opts) {
    const info = opts?.info;
    const events = opts?.events;
    // Reset hitboxes a chaque render
    chart.$eventHitboxes = [];
    if (!info || !info.length || !events || !events.length) return;
    const { ctx, chartArea, scales: { x } } = chart;
    if (!chartArea || !x) return;

    // Map des couleurs par type
    const typeColors = {
      incident:  '#DC2626',
      freeze:    '#3B82F6',
      milestone: '#8B5CF6',
      period:    '#F59E0B',
      other:     '#64748B',
    };
    const typeIcons = {
      incident: '💥', freeze: '🧊', milestone: '🚩', period: '📅', other: 'ℹ️',
    };
    const typeLabels = {
      incident: 'Incident', freeze: 'Gel', milestone: 'Jalon', period: 'Période', other: 'Info',
    };

    // Bornes du sprint (iso dates)
    const sprintFirstDay = info[0]?.date ? info[0].date.toISOString().slice(0, 10) : null;
    const sprintLastDay  = info[info.length - 1]?.date ? info[info.length - 1].date.toISOString().slice(0, 10) : null;

    events.forEach(ev => {
      const evStart = String(ev.startDate || ev.date || '').slice(0, 10);
      const evEnd   = String(ev.endDate   || ev.date || evStart).slice(0, 10);
      if (!evStart || !sprintFirstDay || !sprintLastDay) return;
      if (evStart > sprintLastDay || evEnd < sprintFirstDay) return;

      let firstIdx = info.findIndex(d => d.date && d.date.toISOString().slice(0, 10) >= evStart);
      if (firstIdx === -1) firstIdx = 0;
      let lastIdx = firstIdx;
      for (let i = firstIdx; i < info.length; i++) {
        const iso = info[i].date ? info[i].date.toISOString().slice(0, 10) : '';
        if (iso && iso <= evEnd) lastIdx = i;
        else break;
      }

      const color = typeColors[ev.type] || typeColors.other;
      const icon = typeIcons[ev.type] || 'ℹ️';
      const xStart = x.getPixelForValue(firstIdx);
      const xEnd   = x.getPixelForValue(lastIdx);

      ctx.save();
      // Zone periodique
      if (firstIdx !== lastIdx) {
        const step = info.length > 1 ? (x.getPixelForValue(1) - x.getPixelForValue(0)) : 0;
        const left = xStart - step / 2;
        const right = xEnd + step / 2;
        ctx.fillStyle = color + '18';
        ctx.fillRect(
          Math.max(chartArea.left, left),
          chartArea.top,
          Math.min(chartArea.right, right) - Math.max(chartArea.left, left),
          chartArea.bottom - chartArea.top
        );
      }

      // Ligne verticale
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xStart, chartArea.top);
      ctx.lineTo(xStart, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge emoji
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const bgW = 22;
      const bgH = 20;
      const bgX = xStart - bgW / 2;
      const bgY = chartArea.top + 2;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.fillText(icon, xStart, bgY + 2);
      ctx.restore();

      // Enregistrer la hitbox (badge + ligne verticale sur toute la hauteur)
      chart.$eventHitboxes.push({
        x: bgX, y: bgY, w: bgW, h: bgH,
        lineX: xStart, lineYTop: chartArea.top, lineYBottom: chartArea.bottom,
        event: ev, color, icon, typeLabel: typeLabels[ev.type] || 'Event',
      });
    });
  },
};

// Installer le handler mousemove sur le canvas pour detecter le survol des hitboxes
function _installEventsTooltipHandler(chart) {
  if (chart._eventsTooltipInstalled) return;
  chart._eventsTooltipInstalled = true;
  const canvas = chart.canvas;
  const tip = _getEventsTooltipEl();

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hitboxes = chart.$eventHitboxes || [];
    // 1. Check badge hover (prioritaire)
    let found = hitboxes.find(h => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h);
    // 2. Check ligne verticale (tolerance 4px)
    if (!found) {
      found = hitboxes.find(h => Math.abs(mx - h.lineX) <= 4 && my >= h.lineYTop && my <= h.lineYBottom);
    }
    if (!found) {
      tip.style.display = 'none';
      canvas.style.cursor = '';
      return;
    }
    const ev = found.event;
    const fmt = d => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); };
    const dateHtml = ev.startDate && ev.endDate && ev.startDate !== ev.endDate
      ? `${fmt(ev.startDate)} → ${fmt(ev.endDate)}`
      : fmt(ev.startDate || ev.date);
    const teamsLabel = ev.teams && ev.teams.length ? ev.teams.join(', ') : 'Toutes les équipes';
    const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    tip.innerHTML = `
      <div class="cet-hdr" style="border-left:3px solid ${found.color}">
        <span class="cet-icon">${found.icon}</span>
        <span class="cet-type" style="color:${found.color}">${found.typeLabel}</span>
        <span class="cet-date">${_esc(dateHtml)}</span>
      </div>
      <div class="cet-title">${_esc(ev.title || '(sans titre)')}</div>
      ${ev.description ? `<div class="cet-desc">${_esc(ev.description)}</div>` : ''}
      <div class="cet-teams">🏷️ ${_esc(teamsLabel)}</div>
    `;
    tip.style.display = 'block';
    // Position a droite du curseur, retombe a gauche si deborde
    const tipRect = tip.getBoundingClientRect();
    let left = e.clientX + 14;
    let top  = e.clientY + 14;
    if (left + tipRect.width + 8 > window.innerWidth) left = e.clientX - tipRect.width - 14;
    if (top + tipRect.height + 8 > window.innerHeight) top = e.clientY - tipRect.height - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = Math.max(8, top) + 'px';
    canvas.style.cursor = 'help';
  };
  const onLeave = () => { tip.style.display = 'none'; canvas.style.cursor = ''; };
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
}

// Plugin Chart.js : colore le fond des jours non ouvrables
const _offDaysPlugin = {
  id: 'offDays',
  beforeDraw(chart, args, opts) {
    const info = opts?.info;
    if (!info || !info.length) return;
    const { ctx, chartArea, scales: { x } } = chart;
    if (!chartArea || !x) return;
    ctx.save();
    info.forEach((d, i) => {
      if (!d.isOff) return;
      const xCenter = x.getPixelForValue(i);
      const step = info.length > 1 ? (x.getPixelForValue(1) - x.getPixelForValue(0)) : (chartArea.right - chartArea.left);
      const half = step / 2;
      const xLeft = xCenter - half;
      const xRight = xCenter + half;
      ctx.fillStyle = d.holiday ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.15)';
      ctx.fillRect(
        Math.max(chartArea.left, xLeft),
        chartArea.top,
        Math.min(chartArea.right, xRight) - Math.max(chartArea.left, xLeft),
        chartArea.bottom - chartArea.top
      );
    });
    ctx.restore();
  },
};

function initCharts() {
  Chart.defaults.color = _chartTextColor();
  if (typeof Chart !== 'undefined' && !Chart.registry.plugins.get('offDays')) {
    Chart.register(_offDaysPlugin);
  }
  if (typeof Chart !== 'undefined' && !Chart.registry.plugins.get('sprintEvents')) {
    Chart.register(_eventsPlugin);
  }
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

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    const label = (entry.name || `S-${history.length - i}`).replace(/sprint\s*/i, 'S');
    html += `<button class="sprint-sel-btn${_metricsSprintIdx === i ? ' active' : ''}" onclick="_selectMetricsSprint(${i})">${label}</button>`;
  }
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
  let sprintCtxForDates = _activeSprintCtx();

  let ptsTotal, ptsDone, ticketsTotal, ticketsDone, chartTitle, isHistorical = false;

  if (_metricsSprintIdx !== null) {
    // Sprint historique : seule la vélocité réalisée est disponible
    isHistorical = true;
    const activeTeams = getActiveTeams();
    const teamEntries = activeTeams.map(tid => CONFIG.teams[tid]).filter(tc => tc && Array.isArray(tc.velocityHistory));
    ptsDone = 0;
    let sprintName = null;
    let histStartDate = null;
    let histEndDate = null;
    teamEntries.forEach(tc => {
      const e = tc.velocityHistory[_metricsSprintIdx];
      if (e) {
        ptsDone += e.velocity || 0;
        if (!sprintName) sprintName = e.name;
        if (!histStartDate && e.startDate) histStartDate = e.startDate;
        if (!histEndDate && e.endDate) histEndDate = e.endDate;
      }
    });
    // Utiliser les dates reelles du sprint historique (pour le plugin events)
    if (histStartDate) {
      sprintCtxForDates = { startDateISO: histStartDate, startDate: histStartDate, endDate: histEndDate };
    }
    ptsTotal     = ptsDone;
    ticketsTotal = 0;
    ticketsDone  = 0;
    chartTitle   = `📉 Burndown Chart · ${ptsDone} pts réalisés`;
  } else {
    const s       = _activeSprintCtx();
    const tickets = getTickets();
    ptsTotal     = tickets.reduce((a, t) => a + t.points, 0) || s.velocityTarget || 80;
    ptsDone      = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + t.points, 0);
    ticketsTotal = tickets.length;
    ticketsDone  = tickets.filter(t => isDone(t.status)).length;
    chartTitle   = '📉 Burndown Chart';
  }

  // dayInfo calcule apres le bloc historique pour utiliser les bonnes dates
  const dayInfo = _sprintDayInfo(days, sprintCtxForDates);
  const labels = dayInfo.map(d => d.label);

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
        offDays: { info: dayInfo },
        sprintEvents: { info: dayInfo, events: typeof _eventsList === 'function' ? _eventsList() : [] },
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            title: items => {
              const idx = items?.[0]?.dataIndex;
              const d = idx != null ? dayInfo[idx] : null;
              if (!d) return items?.[0]?.label || '';
              const datePart = d.date ? ` · ${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}` : '';
              const offLabel = d.holiday ? ` · 🎉 ${d.holiday}` : (d.isOff ? ' · weekend' : '');
              return `${d.label}${datePart}${offLabel}`;
            },
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
  _installEventsTooltipHandler(_burndownChart);
}

// ---- Velocity (toujours 6 colonnes : 5 historiques + sprint actuel) ----

function _buildVelocity() {
  const history   = _getSprintHistory();
  const tickets   = getTickets();
  const ptsTotal  = tickets.reduce((a, t) => a + t.points, 0) || CONFIG.sprint.velocityTarget || 80;
  const ptsDone   = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + t.points, 0);
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
  let sprintCtxForDates = _activeSprintCtx();

  let ptsScope, ptsDone, isHistorical = false, chartTitle;

  if (_metricsSprintIdx !== null) {
    isHistorical = true;
    const activeTeams = getActiveTeams();
    const teamEntries = activeTeams.map(tid => CONFIG.teams[tid]).filter(tc => tc && Array.isArray(tc.velocityHistory));
    ptsDone = 0;
    let sprintName = null;
    let histStartDate = null;
    let histEndDate = null;
    teamEntries.forEach(tc => {
      const e = tc.velocityHistory[_metricsSprintIdx];
      if (e) {
        ptsDone += e.velocity || 0;
        if (!sprintName) sprintName = e.name;
        if (!histStartDate && e.startDate) histStartDate = e.startDate;
        if (!histEndDate && e.endDate) histEndDate = e.endDate;
      }
    });
    if (histStartDate) {
      sprintCtxForDates = { startDateISO: histStartDate, startDate: histStartDate, endDate: histEndDate };
    }
    ptsScope   = ptsDone;
    chartTitle = `📈 Burnup Chart · ${ptsDone} pts réalisés`;
  } else {
    const s      = _activeSprintCtx();
    const tickets = getTickets();
    ptsScope   = tickets.reduce((a, t) => a + t.points, 0) || s.velocityTarget || 80;
    ptsDone    = tickets.filter(t => isDone(t.status)).reduce((a, t) => a + t.points, 0);
    chartTitle = '📈 Burnup Chart';
  }

  // dayInfo calcule apres le bloc historique pour utiliser les bonnes dates
  const dayInfo = _sprintDayInfo(days, sprintCtxForDates);
  const labels = dayInfo.map(d => d.label);

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
        offDays: { info: dayInfo },
        sprintEvents: { info: dayInfo, events: typeof _eventsList === 'function' ? _eventsList() : [] },
        legend: { labels: { font: { size: 11 } } },
        tooltip: {
          ..._TOOLTIP,
          callbacks: {
            title: items => {
              const idx = items?.[0]?.dataIndex;
              const d = idx != null ? dayInfo[idx] : null;
              if (!d) return items?.[0]?.label || '';
              const datePart = d.date ? ` · ${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}` : '';
              const offLabel = d.holiday ? ` · 🎉 ${d.holiday}` : (d.isOff ? ' · weekend' : '');
              return `${d.label}${datePart}${offLabel}`;
            },
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
  _installEventsTooltipHandler(_burnupChart);
}

// ---- CFD Scrum - Flux Cumulatif Sprint (simulation) -----------

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

  // Layers de bas en haut (stacked area) — use JIRA column names
  const _bc = typeof getBoardColumns === 'function' ? getBoardColumns() : [];
  const _cl = (k, fb) => { const c = _bc.find(x => x.key === k); return c ? c.label : fb; };
  const layers = [
    { key: 'done',    label: _cl('done','Terminé'),     color: '#10B981' },
    { key: 'test',    label: _cl('test','En test'),     color: '#06B6D4' },
    { key: 'review',  label: _cl('review','Review'),    color: '#3B82F6' },
    { key: 'inprog',  label: _cl('inprog','En cours'),  color: '#F59E0B' },
    { key: 'blocked', label: 'Bloqué',                  color: '#EF4444' },
    { key: 'todo',    label: _cl('todo','À faire'),     color: '#94A3B8' },
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
