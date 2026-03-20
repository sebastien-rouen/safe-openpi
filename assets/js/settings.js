// ============================================================
// SETTINGS VIEW - Configuration équipes, JIRA, groupes, notifications
// ============================================================

// --- Dark mode ---
function _initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}
_initTheme();

function toggleDarkMode(checkbox) {
  const theme = checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (typeof refreshCharts === 'function' && typeof chartsInitialized !== 'undefined' && chartsInitialized) refreshCharts();
}

// Collapsible state for settings sections
const _settingsCollapsed = JSON.parse(localStorage.getItem('settings_collapsed') || '{}');

// Support rotation data (persisted in localStorage)
let _supportRotation = JSON.parse(localStorage.getItem('support_rotation') || '{}');
let _rotParsedAbsences = {}; // live-parsed from textarea
let _rotAbsencesRaw = '';    // raw textarea content, loaded from JSON
let _rotAbsencesDate = '';   // last update timestamp
let _rotAbsencesLoaded = false;

let _rotAbsMemberCount = 0; // total members parsed (not just absent ones)
let _rotAbsAllNames = new Set(); // all normalized names found in absences data

let _rotAbsSaveTimer = null;
function _rotAbsSave(raw) {
  clearTimeout(_rotAbsSaveTimer);
  _rotAbsSaveTimer = setTimeout(() => {
    _rotAbsencesDate = new Date().toISOString();
    const structured = _buildAbsencesJSON(raw);
    fetch('/data/absences.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structured, null, 2),
    }).catch(err => console.warn('[absences] Sauvegarde échouée :', err));
    const ind = document.getElementById('rot-abs-indicator');
    if (ind) ind.innerHTML = _rotAbsIndicatorContent();
  }, 500);
}

function _buildAbsencesJSON(raw) {
  const lines = (raw || '').trim().split('\n');
  if (lines.length < 2) return { updatedAt: _rotAbsencesDate, members: [], raw };

  const headerCells = lines[0].split('\t');
  const dateRe = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/;
  const weekInfos = _rotWeekInfos();
  const piStart = weekInfos[0]?._start;
  const piEnd   = weekInfos[weekInfos.length - 1]?._end;
  const piYear  = piStart ? piStart.getFullYear() : new Date().getFullYear();

  // Resolve each date column with correct year
  const dateCols = [];
  for (let ci = 0; ci < headerCells.length; ci++) {
    const m = headerCells[ci].trim().match(dateRe);
    if (!m) continue;
    const day = parseInt(m[1]), month = parseInt(m[2]) - 1;
    let year;
    if (m[3]) {
      year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    } else if (piStart && piEnd) {
      const c1 = new Date(piYear, month, day);
      const c2 = new Date(piYear + 1, month, day);
      year = (c2 >= piStart && c2 <= piEnd && !(c1 >= piStart && c1 <= piEnd)) ? piYear + 1 : piYear;
    } else {
      year = piYear;
    }
    const dd = String(day).padStart(2, '0');
    const mm = String(month + 1).padStart(2, '0');
    dateCols.push({ col: ci, date: `${dd}/${mm}/${year}` });
  }

  const members = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split('\t');
    if (!cells[0]?.trim()) continue;
    const rawName = cells[0].trim();
    const team = (cells[1] || '').trim();
    const absences = [];
    for (const dc of dateCols) {
      const val = (cells[dc.col] || '').trim().replace(',', '.');
      const num = parseFloat(val);
      if (num && !isNaN(num)) absences.push({ date: dc.date, value: num });
    }
    members.push({
      name: _normalizeExcelName(rawName),
      rawName,
      team,
      totalDays: absences.reduce((s, a) => s + a.value, 0),
      absences,
    });
  }

  return { updatedAt: _rotAbsencesDate, memberCount: members.length, members, raw };
}

async function _rotAbsLoad() {
  if (_rotAbsencesLoaded) return;
  try {
    const res = await fetch('/data/absences.json');
    if (res.ok) {
      const data = await res.json();
      _rotAbsencesRaw = data.raw || '';
      _rotAbsencesDate = data.updatedAt || '';
      _rotAbsMemberCount = data.memberCount || 0;
      if (_rotAbsencesRaw) {
        _rotParsedAbsences = _parseAbsences(_rotAbsencesRaw);
        // Populate all names set from raw data
        _rotAbsAllNames = new Set();
        const lines = _rotAbsencesRaw.trim().split('\n');
        if (lines.length > 1) {
          for (const l of lines.slice(1)) {
            const raw = l.split('\t')[0]?.trim();
            if (raw) _rotAbsAllNames.add(_normalizeExcelName(raw).toLowerCase());
          }
        }
      }
    }
  } catch { /* no file yet */ }
  _rotAbsencesLoaded = true;
}

function _rotAbsIndicatorContent() {
  if (!_rotAbsencesDate) return '';
  const d = new Date(_rotAbsencesDate);
  const fmt = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const absentCount = Object.keys(_rotParsedAbsences).length;
  return `<span class="rot-abs-dot"></span> ${_rotAbsMemberCount} membre${_rotAbsMemberCount > 1 ? 's' : ''}${absentCount ? ` · ${absentCount} avec absences` : ''} · ${fmt}`;
}

function _saveRotation() {
  localStorage.setItem('support_rotation', JSON.stringify(_supportRotation));
}

function _piWeeks() {
  const sPerPI = CONFIG.sprint.sprintsPerPI || 5;
  const dur    = CONFIG.sprint.durationDays || 14;
  return sPerPI * (dur / 7); // typically 10 weeks
}

function _rotWeekInfos() {
  const sprintsPerPI = CONFIG.sprint.sprintsPerPI || 5;
  const dur = CONFIG.sprint.durationDays || 14;
  const weeksPerSprint = dur / 7;
  const totalWeeks = sprintsPerPI * weeksPerSprint;

  // Detect PI number — same logic as _ppDetectPI(): team sprintNames first, then label
  const piRe = /(\d{2,3})\.(\d+)\s*$/;
  let piNum = null, currentSprintIdx = 0;
  for (const tc of Object.values(CONFIG.teams || {})) {
    const m = (tc.sprintName || '').match(piRe);
    if (m) { piNum = m[1]; currentSprintIdx = parseInt(m[2]) - 1; break; }
  }
  if (!piNum) {
    const m2 = (CONFIG.sprint.label || '').match(/(\d{2,3})\.(\d+)/);
    if (m2) { piNum = m2[1]; currentSprintIdx = parseInt(m2[2]) - 1; }
  }

  // Compute PI start date — derive from current sprint start + sprint position
  let piStartDate = null;
  const _tryDate = s => { if (!s) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s); return isNaN(d.getTime()) ? null : d; };

  // 1) rm_pi_start from localStorage — authoritative, set by roadmap/piprep
  const stored = localStorage.getItem('rm_pi_start') || '';
  if (stored) piStartDate = _tryDate(stored);

  // 2) Derive current PI start from team sprint ISO start date + sprint index
  //    sprintStart is formatted in French locale (unparseable), use sprintStartISO instead
  if (!piStartDate && currentSprintIdx >= 0) {
    let bestStart = null;
    for (const tc of Object.values(CONFIG.teams || {})) {
      const d = _tryDate(tc.sprintStartISO);
      if (d) { bestStart = d; break; }
    }
    if (!bestStart) bestStart = _tryDate(CONFIG.sprint.startDateISO);
    if (!bestStart) bestStart = _tryDate(CONFIG.sprint.startDate); // legacy fallback
    if (bestStart) {
      piStartDate = new Date(bestStart);
      piStartDate.setDate(piStartDate.getDate() - currentSprintIdx * dur);
    }
  }

  // 3) Fallback: next sprintStartDay from today
  if (!piStartDate) {
    const sd = CONFIG.sprint?.sprintStartDay ?? 5;
    piStartDate = new Date(); piStartDate.setHours(0, 0, 0, 0);
    piStartDate.setDate(piStartDate.getDate() + (sd - piStartDate.getDay() + 7) % 7);
  }

  // Collect French holidays covering the full PI date range
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const y1 = piStartDate.getFullYear();
  const piEndEst = new Date(piStartDate);
  piEndEst.setDate(piEndEst.getDate() + totalWeeks * 7);
  const y2 = piEndEst.getFullYear();
  const holidays = typeof _frenchHolidays === 'function'
    ? [..._frenchHolidays(y1), ...(y2 !== y1 ? _frenchHolidays(y2) : [])]
    : [];
  const holSet = new Set(holidays.map(h => h.d.toDateString()));

  const infos = [];
  for (let i = 0; i < totalWeeks; i++) {
    const sprintIdx = Math.floor(i / weeksPerSprint); // 0-based sprint
    const weekInSprint = (i % weeksPerSprint) + 1;    // 1-based week

    const label = piNum
      ? `${piNum}.${sprintIdx + 1}.${weekInSprint}`
      : `S${i + 1}`;

    const _start = new Date(piStartDate);
    _start.setDate(_start.getDate() + i * 7);
    const _end = new Date(_start);
    _end.setDate(_end.getDate() + 6);
    const dateRange = `${fmt(_start)} → ${fmt(_end)}`;

    // Count working days (exclude weekends + French holidays)
    let workDays = 0;
    const weekHolidays = [];
    const cursor = new Date(_start);
    while (cursor <= _end) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) { // weekday
        if (holSet.has(cursor.toDateString())) {
          const h = holidays.find(h => h.d.toDateString() === cursor.toDateString());
          weekHolidays.push(h ? h.name : 'Férié');
        } else {
          workDays++;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    infos.push({ label, dateRange, sprintIdx, weekInSprint, _start, _end, workDays, holidays: weekHolidays });
  }
  return infos;
}

function _rotSetMembersPerWeek(team, n) {
  if (!_supportRotation[team]) _supportRotation[team] = { membersPerWeek: 3, weeks: {} };
  _supportRotation[team].membersPerWeek = Math.max(1, Math.min(10, n));
  _saveRotation();
  renderSettings();
}

function _rotToggleMember(team, weekIdx, member) {
  if (!_supportRotation[team]) _supportRotation[team] = { membersPerWeek: 3, weeks: {} };
  const weeks = _supportRotation[team].weeks;
  if (!weeks[weekIdx]) weeks[weekIdx] = [];
  const arr = weeks[weekIdx];
  const idx = arr.indexOf(member);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(member);
  _saveRotation();
  _rotRefreshTeam(team);
}

function _rotRefreshTeam(team) {
  const el = document.getElementById(`rot-team-${team}`);
  if (!el) return;
  el.outerHTML = _rotTeamPanel(team);
}

function _rotTeamPanel(team) {
  const members = MEMBERS[team] || [];
  if (!members.length) return '';
  const color = _teamColor(team);
  const name  = CONFIG.teams[team]?.name || team;
  const rot   = _supportRotation[team] || { membersPerWeek: 3, weeks: {} };
  const mpw   = rot.membersPerWeek || 3;
  const weekInfos = _rotWeekInfos();
  const totalWeeks = weekInfos.length;

  const weekHeaders = weekInfos.map(w => {
    const holTip = w.holidays.length ? ` title="${w.holidays.join(', ')}"` : '';
    const holBadge = w.holidays.length ? `<span class="rot-wk-hol"${holTip}>${w.holidays.length}j férié${w.holidays.length > 1 ? 's' : ''}</span>` : '';
    return `<th class="rot-wk-th"><span class="rot-wk-label">${w.label}</span>${w.dateRange ? `<span class="rot-wk-dates">${w.dateRange}</span>` : ''}${holBadge}</th>`;
  }).join('');

  const memberRows = members.map(m => {
    const cells = Array.from({ length: totalWeeks }, (_, wi) => {
      const selected = (rot.weeks[wi] || []).includes(m);
      const absent = _isAbsent(m, wi, _rotParsedAbsences);
      const absentCls = absent ? ' rot-cell-absent' : '';
      return `<td class="rot-cell${absentCls}">
        <button class="rot-chip${selected ? ' rot-chip-on' : ''}" style="${selected ? `background:${color}22;color:${color};border-color:${color}` : ''}"
          onclick="_rotToggleMember('${team}',${wi},'${m.replace(/'/g, "\\'")}')">${selected ? '✓' : ''}</button>
      </td>`;
    }).join('');
    const hasAbsData = _rotAbsAllNames.size > 0;
    let matchDot = '';
    if (hasAbsData) {
      const matched = _rotAbsAllNames.has(m.toLowerCase());
      matchDot = `<span class="rot-member-match ${matched ? 'matched' : 'unmatched'}" title="${matched ? 'Congés référencés' : 'Non trouvé dans les congés'}"></span>`;
    }
    return `<tr><td class="rot-member">${matchDot}${m}</td>${cells}</tr>`;
  }).join('');

  // Week counts
  const countCells = Array.from({ length: totalWeeks }, (_, wi) => {
    const cnt = (rot.weeks[wi] || []).length;
    const ok  = cnt === mpw;
    return `<td class="rot-cell rot-count${ok ? '' : ' rot-count-warn'}">${cnt}/${mpw}</td>`;
  }).join('');

  return `<div class="rot-team-panel" id="rot-team-${team}" style="border-left:3px solid ${color}">
    <div class="rot-team-hdr">
      <span class="rot-team-dot" style="background:${color}"></span>
      <span class="rot-team-name">${name}</span>
      <label class="rot-mpw-label">Effectif support / semaine :
        <input type="number" min="1" max="10" value="${mpw}" class="rot-mpw-input"
          onchange="_rotSetMembersPerWeek('${team}',+this.value)">
      </label>
      <button class="rot-copy-btn" onclick="_rotCopyTeam('${team}')" title="Copier la rotation">📋</button>
      <button class="rot-gen-btn" onclick="_rotShuffleTeam('${team}')" title="Générer une nouvelle rotation pour cette équipe">🎲</button>
    </div>
    <div class="rot-table-wrap">
      <table class="rot-table">
        <thead><tr><th class="rot-member-th">Membre</th>${weekHeaders}</tr></thead>
        <tbody>${memberRows}
          <tr class="rot-count-row"><td class="rot-member rot-count-label">Total</td>${countCells}</tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

function _rotShuffleTeam(team) {
  _rotParseAbsencesLive();
  const absences = _rotParsedAbsences;
  const totalWeeks = _piWeeks();
  const members = MEMBERS[team] || [];
  if (!members.length) return;
  if (!_supportRotation[team]) _supportRotation[team] = { membersPerWeek: 3, weeks: {} };
  const mpw = _supportRotation[team].membersPerWeek || 3;
  const weeks = {};
  const counts = {};
  members.forEach(m => counts[m] = 0);

  for (let wi = 0; wi < totalWeeks; wi++) {
    const available = members.filter(m => !_isAbsent(m, wi, absences));
    available.sort((a, b) => counts[a] - counts[b] || (Math.random() - 0.5));
    const picked = available.slice(0, Math.min(mpw, available.length));
    weeks[wi] = picked;
    picked.forEach(m => counts[m]++);
  }

  _supportRotation[team].weeks = weeks;
  _saveRotation();
  _rotRefreshTeam(team);
  if (typeof showToast === 'function') showToast(`🔄 Rotation générée pour ${CONFIG.teams[team]?.name || team}`, 'success');
}

function _rotShuffle() {
  _rotParseAbsencesLive();
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();
  for (const team of realTeams) _rotShuffleTeam(team);
  if (typeof showToast === 'function') showToast('🔄 Rotation générée pour toutes les équipes !', 'success');
}

function _parseAbsences(raw) {
  // Excel format: header row with dates (DD/MM) starting at col 4+
  // Data rows: "Nom, Prénom \t Équipe \t Entité \t Rôle \t 1 \t \t 0,5 …"
  // Returns { normalizedMemberName: Set([weekIndex, ...]) }
  const result = {};
  if (!raw.trim()) return result;
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return result;

  // Parse header row to find date columns
  const headerCells = lines[0].split('\t');
  const weekInfos = _rotWeekInfos();
  const dateRe = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/;

  // PI date range for year inference (handles Dec→Jan crossover)
  const piStart = weekInfos[0]?._start;
  const piEnd   = weekInfos[weekInfos.length - 1]?._end;
  const piYear  = piStart ? piStart.getFullYear() : new Date().getFullYear();

  // Map each column index → date object
  const colDates = {};
  for (let ci = 0; ci < headerCells.length; ci++) {
    const m = headerCells[ci].trim().match(dateRe);
    if (m) {
      const day = parseInt(m[1]), month = parseInt(m[2]) - 1;
      if (m[3]) {
        // Explicit year provided
        const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
        colDates[ci] = new Date(year, month, day);
      } else {
        // No year: pick the one that falls within PI range
        // Try piYear and piYear+1, keep the one closest to PI window
        const candidate1 = new Date(piYear, month, day);
        const candidate2 = new Date(piYear + 1, month, day);
        if (piStart && piEnd) {
          const inRange1 = candidate1 >= piStart && candidate1 <= piEnd;
          const inRange2 = candidate2 >= piStart && candidate2 <= piEnd;
          colDates[ci] = inRange2 && !inRange1 ? candidate2 : candidate1;
        } else {
          colDates[ci] = candidate1;
        }
      }
    }
  }

  // Map each date → week index (which rotation week does this date fall in?)
  function dateToWeekIdx(date) {
    for (let wi = 0; wi < weekInfos.length; wi++) {
      const w = weekInfos[wi];
      if (!w._start) continue;
      const wEnd = new Date(w._start);
      wEnd.setDate(wEnd.getDate() + 6);
      if (date >= w._start && date <= wEnd) return wi;
    }
    return -1;
  }

  // Parse data rows
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split('\t');
    if (!cells[0]?.trim()) continue;
    const rawName = cells[0].trim();
    const memberName = _normalizeExcelName(rawName);

    // Sum absence values per week
    const weekAbsence = {};
    for (const [ci, date] of Object.entries(colDates)) {
      const val = (cells[ci] || '').trim().replace(',', '.');
      const num = parseFloat(val);
      if (!num || isNaN(num)) continue;
      const wi = dateToWeekIdx(date);
      if (wi < 0) continue;
      weekAbsence[wi] = (weekAbsence[wi] || 0) + num;
    }

    // Mark absent if absent for majority of working days (>= half of workDays)
    const absentWeeks = new Set();
    for (const [wi, total] of Object.entries(weekAbsence)) {
      const wd = weekInfos[wi]?.workDays ?? 5;
      if (total >= wd / 2) absentWeeks.add(parseInt(wi));
    }
    if (absentWeeks.size) result[memberName] = absentWeeks;
  }
  return result;
}

function _normalizeExcelName(raw) {
  // "Nom, Prénom" → "Prénom Nom" to match MEMBERS format
  const commaMatch = raw.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) return `${commaMatch[2].trim()} ${commaMatch[1].trim()}`;
  return raw;
}

function _isAbsent(member, weekIdx, absences) {
  // Try exact match first, then case-insensitive
  if (absences[member]?.has(weekIdx)) return true;
  const lower = member.toLowerCase();
  for (const [name, weeks] of Object.entries(absences)) {
    if (name.toLowerCase() === lower && weeks.has(weekIdx)) return true;
  }
  return false;
}

function _rotParseAbsencesLive() {
  const raw = document.getElementById('rot-absences-input')?.value || '';
  _rotAbsencesRaw = raw;
  _rotParsedAbsences = _parseAbsences(raw);
  // Count total members in pasted data (lines with a name, excluding header)
  const lines = raw.trim().split('\n');
  _rotAbsMemberCount = lines.length > 1 ? lines.slice(1).filter(l => l.split('\t')[0]?.trim()).length : 0;
  // Collect all normalized names from absences data
  _rotAbsAllNames = new Set();
  if (lines.length > 1) {
    for (const l of lines.slice(1)) {
      const raw = l.split('\t')[0]?.trim();
      if (raw) _rotAbsAllNames.add(_normalizeExcelName(raw).toLowerCase());
    }
  }
  // Persist to JSON
  if (raw.trim()) _rotAbsSave(raw);
  // Refresh all team panels to show/hide orange cells
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();
  for (const team of realTeams) _rotRefreshTeam(team);
}

function _rotCopyTeam(team) {
  const rot = _supportRotation[team] || { weeks: {} };
  const weekInfos = _rotWeekInfos();
  const lines = [];
  for (let wi = 0; wi < weekInfos.length; wi++) {
    const w = weekInfos[wi];
    const members = rot.weeks[wi] || [];
    const datePart = w.dateRange ? ` (${w.dateRange.replace(' → ', '– ')})` : '';
    lines.push(`* ✅ Itération ${w.label}${datePart}`);
    if (members.length) {
      lines.push(`    * ${members.map(m => '@' + m).join(', ')}`);
    } else {
      lines.push(`    * (aucun)`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') showToast('📋 Rotation copiée !', 'success');
  });
}

function _rotClearAll() {
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();
  for (const team of realTeams) {
    if (_supportRotation[team]) _supportRotation[team].weeks = {};
  }
  _saveRotation();
  renderSettings();
}

function _toggleSettingsSection(key) {
  _settingsCollapsed[key] = !_settingsCollapsed[key];
  localStorage.setItem('settings_collapsed', JSON.stringify(_settingsCollapsed));
  renderSettings();
}

function _sectionHeader(key, icon, title, subtitle) {
  const open = !_settingsCollapsed[key];
  return `<div class="stg-section-header" onclick="_toggleSettingsSection('${key}')">
    <span class="stg-section-left"><span class="stg-section-arrow">${open ? '▼' : '▶'}</span>${icon} ${title}</span>
    ${subtitle ? `<span class="stg-section-sub">${subtitle}</span>` : ''}
  </div>`;
}

// Settings tabs definition
const _stgTabs = [
  { id: 'apparence', icon: '🎨', label: 'Apparence' },
  { id: 'jira',      icon: '🔗', label: 'JIRA' },
  { id: 'sync',      icon: '⚙️', label: 'Synchronisation' },
  { id: 'alerts',    icon: '🔔', label: 'Alertes' },
  { id: 'teams',     icon: '👥', label: 'Équipes' },
  { id: 'groups',    icon: '🗂️', label: 'Groupes' },
  { id: 'notif',     icon: '🔔', label: 'Notifications' },
  { id: 'rotation',  icon: '🔄', label: 'Rotation' },
];

function _stgScrollTo(id) {
  const sec = document.getElementById('stg-sec-' + id);
  if (!sec) return;
  // Open section if collapsed
  if (_settingsCollapsed[id]) {
    _settingsCollapsed[id] = false;
    localStorage.setItem('settings_collapsed', JSON.stringify(_settingsCollapsed));
    renderSettings();
    setTimeout(() => _stgScrollTo(id), 50);
    return;
  }
  setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  document.querySelectorAll('.stg-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === id));
}

let _stgSpyCleanup = null;
function _stgInitScrollSpy() {
  if (_stgSpyCleanup) _stgSpyCleanup();
  const content = document.getElementById('content') || document.getElementById('main') || window;
  const handler = () => {
    const tabs = document.getElementById('stg-tabs');
    if (!tabs) return;
    const sections = document.querySelectorAll('[id^="stg-sec-"]');
    let activeId = null;
    const offset = 120;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= offset && rect.bottom > offset) activeId = sec.id.replace('stg-sec-', '');
    });
    if (activeId) {
      tabs.querySelectorAll('.stg-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === activeId));
    }
  };
  content.addEventListener('scroll', handler, { passive: true });
  _stgSpyCleanup = () => content.removeEventListener('scroll', handler);
  handler();
}

function renderSettings() {
  // Load absences from JSON on first render
  if (!_rotAbsencesLoaded) {
    _rotAbsLoad().then(() => {
      // Re-render to inject loaded textarea content + indicator
      const el = document.getElementById('settings-content');
      if (el) renderSettings();
    });
  }
  const activeTeams = new Set(_allTeams());
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const activeCount = realTeams.filter(t => activeTeams.has(t)).length;
  const inactiveCount = realTeams.length - activeCount;

  // Sync config values
  const sc = CONFIG.sync;

  const tabsHtml = `<div class="rm-tabs" id="stg-tabs">
    ${_stgTabs.map(t => `<button class="rm-tab stg-tab" data-sec="${t.id}" onclick="_stgScrollTo('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
  </div>`;

  document.getElementById('settings-content').innerHTML = tabsHtml + `
  <!-- Apparence -->
  <div class="settings-section stg-compact" id="stg-sec-apparence" style="grid-column:1/-1">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:700;">🎨 Apparence</span>
      <label class="theme-toggle" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;">
        <span>${isDark ? '🌙 Sombre' : '☀️ Clair'}</span>
        <div class="toggle-track" style="position:relative;width:40px;height:22px;border-radius:99px;background:${isDark ? 'var(--primary)' : '#CBD5E1'};transition:background .3s;flex-shrink:0;">
          <div style="position:absolute;top:2px;${isDark ? 'left:20px' : 'left:2px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .3s;"></div>
          <input type="checkbox" ${isDark ? 'checked' : ''} onchange="toggleDarkMode(this);renderSettings();"
            style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;margin:0;">
        </div>
      </label>
    </div>
  </div>

  <!-- Connexion JIRA -->
  <div class="settings-section" id="stg-sec-jira" style="grid-column:1/-1">
    ${_sectionHeader('jira', '🔗', 'Connexion JIRA', CONFIG.jira.url !== 'https://votre-jira.atlassian.net' ? '✅ Configuré' : '⚠️ Non configuré')}
    ${!_settingsCollapsed['jira'] ? `<div class="stg-body">
      <div class="stg-grid-3">
        <div class="form-group"><label>URL JIRA</label><input type="text" value="${CONFIG.jira.url}"/></div>
        <div class="form-group"><label>Projets (virgule)</label><input type="text" value="${(CONFIG.jira.projects || []).join(', ')}"/></div>
        <div class="form-group"><label>API Token</label><input type="password" value="${CONFIG.jira.token}" placeholder="••••••"/></div>
      </div>
      <div class="stg-grid-2" style="margin-top:6px;">
        <div class="form-group"><label>Durée Sprint (jours)</label><input type="number" value="${CONFIG.sprint.durationDays}"/></div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-primary" onclick="showToast('✅ Connexion testée avec succès !','success')" style="font-size:12px;padding:7px 14px;">🔌 Tester</button>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Paramètres de synchronisation -->
  <div class="settings-section" id="stg-sec-sync" style="grid-column:1/-1">
    ${_sectionHeader('sync', '⚙️', 'Synchronisation', '')}
    ${!_settingsCollapsed['sync'] ? `<div class="stg-body">
      <div class="stg-kv-grid">
        <div class="stg-kv">
          <label>Boards par page</label>
          <input type="number" value="${sc.maxBoardsPerPage}" onchange="CONFIG.sync.maxBoardsPerPage=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Issues max / sprint</label>
          <input type="number" value="${sc.maxIssuesPerSprint}" onchange="CONFIG.sync.maxIssuesPerSprint=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Sprints historiques (vélocité)</label>
          <input type="number" value="${sc.velocityHistoryCount}" onchange="CONFIG.sync.velocityHistoryCount=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>PIs historiques</label>
          <input type="number" value="${sc.piHistoryCount}" onchange="CONFIG.sync.piHistoryCount=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Issues max vélocité (JQL)</label>
          <input type="number" value="${sc.velocityMaxIssues}" onchange="CONFIG.sync.velocityMaxIssues=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Epics orphelines max</label>
          <input type="number" value="${sc.maxEpicsResolve}" onchange="CONFIG.sync.maxEpicsResolve=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Sprints fermés (fallback)</label>
          <input type="number" value="${sc.closedSprintsFetch}" onchange="CONFIG.sync.closedSprintsFetch=+this.value" style="width:80px;">
        </div>
        <div class="stg-kv">
          <label>Champ Sprint</label>
          <input type="text" value="${sc.sprintField}" onchange="CONFIG.sync.sprintField=this.value" style="width:160px;">
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Alertes sprint -->
  <div class="settings-section" id="stg-sec-alerts" style="grid-column:1/-1">
    ${_sectionHeader('alerts', '🔔', 'Alertes Sprint', '')}
    ${!_settingsCollapsed['alerts'] ? `<div class="stg-body">
      <div class="stg-kv-grid">
        <div class="stg-kv">
          <label>🎬 Préparation démo</label>
          <div class="stg-alert-input">
            <span>J-</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.demoDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.demoDays=+this.value;" style="width:50px;">
            <span>avant fin de sprint</span>
          </div>
        </div>
        <div class="stg-kv">
          <label>😊 Mood meter (ROTI)</label>
          <div class="stg-alert-input">
            <span>J-</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.moodDays ?? 2}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.moodDays=+this.value;" style="width:50px;">
            <span>avant fin de sprint</span>
          </div>
        </div>
        <div class="stg-kv">
          <label>🗳️ Vote de confiance</label>
          <div class="stg-alert-input">
            <span>J+</span>
            <input type="number" min="0" max="7" value="${CONFIG.alerts?.voteDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.voteDays=+this.value;" style="width:50px;">
            <span>après début de sprint</span>
          </div>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Équipes -->
  <div class="settings-section" id="stg-sec-teams" style="grid-column:1/-1">
    ${_sectionHeader('teams', '👥', 'Équipes', `${activeCount} actives · ${inactiveCount} inactives`)}
    ${!_settingsCollapsed['teams'] ? `<div class="stg-body">
      <div class="stg-teams-grid">${realTeams.map(team => {
        const cfg      = CONFIG.teams[team] || {};
        const color    = cfg.color || _teamColor(team);
        const members  = MEMBERS[team] || [];
        const velocity = cfg.velocity || CONFIG.sprint.velocityTarget || 80;
        const inactive = !activeTeams.has(team);
        const boardId  = cfg.boardId || '';
        const projKey  = cfg.projectKey || '';
        const sprintN  = cfg.sprintName || '';
        return `<div class="stg-team-card${inactive ? ' stg-inactive' : ''}" style="border-left:3px solid ${color}">
          <div class="stg-team-header">
            <span class="stg-team-name" style="color:${color}">${team}</span>
            ${inactive ? '<span class="stg-badge-inactive">inactif</span>' : ''}
            <span class="stg-team-meta">${members.length} membres · ${velocity} pts</span>
          </div>
          <div class="stg-team-details">
            <span class="stg-chip" title="Sprint">${sprintN || '-'}</span>
            <span class="stg-chip" title="Board ID">Board ${boardId || '-'}</span>
            <span class="stg-chip" title="Projet">${projKey || '-'}</span>
            <input type="color" value="${color}" style="width:24px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;vertical-align:middle;"
              onchange="if(CONFIG.teams['${team}'])CONFIG.teams['${team}'].color=this.value;" title="Couleur">
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}
  </div>

  <!-- Groupes -->
  <div class="settings-section" id="stg-sec-groups" style="grid-column:1/-1">
    ${_sectionHeader('groups', '🗂️', 'Groupes', `${GROUPS.length} groupes`)}
    ${!_settingsCollapsed['groups'] ? `<div class="stg-body">
      <div id="groups-config-list">${GROUPS.map((g, gi) => `
      <div class="stg-group-card" id="group-cfg-${g.id}" style="border-left:3px solid ${g.color}">
        <div class="stg-group-header">
          <span class="group-dot" style="background:${g.color};width:10px;height:10px;border-radius:3px;"></span>
          <input type="text" class="stg-group-name-input" value="${g.name}" onchange="GROUPS[${gi}].name=this.value;renderGroupBtns();">
          <input type="color" value="${g.color}" style="width:24px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;"
            onchange="GROUPS[${gi}].color=this.value;renderGroupBtns();document.getElementById('group-cfg-${g.id}').style.borderLeftColor=this.value;">
        </div>
        <div class="stg-group-teams">
          ${realTeams.map(t =>
            `<label class="stg-team-check"><input type="checkbox" ${g.teams.includes(t) ? 'checked' : ''} onchange="toggleGroupTeam('${g.id}','${t}',this.checked)"><span>${t}</span></label>`
          ).join('')}
        </div>
      </div>`).join('')}
      </div>
      <button class="btn btn-secondary" style="margin-top:8px;font-size:12px;" onclick="addGroup()">➕ Ajouter un groupe</button>
    </div>` : ''}
  </div>

  <!-- Notifications -->
  <div class="settings-section" id="stg-sec-notif" style="grid-column:1/-1">
    ${_sectionHeader('notif', '🔔', 'Notifications', '')}
    ${!_settingsCollapsed['notif'] ? `<div class="stg-body">
      <div class="stg-grid-2">
        <div class="form-group"><label>Canal Slack Sprint Reports</label><input type="text" value="${CONFIG.notifications.slackReports}"/></div>
        <div class="form-group"><label>Canal Slack Alertes</label><input type="text" value="${CONFIG.notifications.slackAlerts}"/></div>
        <div class="form-group"><label>Email rapports</label><input type="email" value="${CONFIG.notifications.email}"/></div>
        <div class="form-group"><label>Fréquence auto-rapport</label>
          <select><option>Fin de sprint</option><option>Hebdomadaire</option><option>Quotidien</option></select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="showToast('✅ Paramètres sauvegardés !','success')" style="margin-top:6px;font-size:12px;padding:7px 14px;">💾 Sauvegarder</button>
    </div>` : ''}
  </div>

  <!-- Rotation Support -->
  <div class="settings-section rot-section" id="stg-sec-rotation" style="grid-column:1/-1">
    <div class="rot-sticky-bar">
      ${_sectionHeader('rotation', '🔄', 'Rotation Support', '')}
      ${!_settingsCollapsed['rotation'] ? `<div class="rot-toolbar">
        <button class="btn btn-primary" onclick="_rotShuffle()" style="font-size:12px;padding:6px 14px;">🎲 Générer la rotation pour toutes les équipes</button>
        <button class="btn btn-secondary" onclick="_rotClearAll()" style="font-size:12px;padding:6px 14px;">🗑️ Réinitialiser</button>
      </div>` : ''}
    </div>
    ${!_settingsCollapsed['rotation'] ? `<div class="stg-body">
      <details class="rot-absences-details"${_rotAbsencesRaw ? ' open' : ''}>
        <summary class="rot-absences-summary">📋 Congés / Absences (coller depuis Excel)
          <span class="rot-abs-indicator" id="rot-abs-indicator">${_rotAbsIndicatorContent()}</span>
        </summary>
        <div class="rot-absences-body">
          <p class="rot-absences-help">Collez le tableau Excel des congés (Ctrl+C depuis Excel, Ctrl+V ici). Format attendu : 1ère ligne = en-têtes avec dates (JJ/MM), colonnes suivantes = 1 (absent) ou 0,5 (demi-journée). Si >= 2,5 jours d'absence dans une semaine, le membre est exclu de cette semaine.</p>
          <pre class="rot-absences-example">NOMS, Prénom\tÉquipes\tEntité\tRôles\t03/04\t06/04\t07/04\nLeclerc, Martin\tFuego\tXYZ\tOps\t\t1\t\nRenaud, Sophie\tFuego\tXYZ\tDev\t1\t1\t1</pre>
          <textarea id="rot-absences-input" class="rot-absences-textarea" rows="6" placeholder="Collez ici le tableau Excel des congés…" oninput="_rotParseAbsencesLive()">${_rotAbsencesRaw.replace(/</g,'&lt;')}</textarea>
        </div>
      </details>
      ${realTeams.map(t => _rotTeamPanel(t)).join('')}
    </div>` : ''}
  </div>`;

  // Init scroll spy for tabs
  setTimeout(_stgInitScrollSpy, 100);
}

function toggleGroupTeam(gid, team, checked) {
  const g = GROUPS.find(x => x.id === gid);
  if (!g) return;
  if (checked && !g.teams.includes(team)) g.teams.push(team);
  if (!checked) g.teams = g.teams.filter(t => t !== team);
  renderGroupBtns();
}

function addGroup() {
  const colors = ['#0E7490','#B45309','#BE185D','#065F46'];
  const idx    = GROUPS.length;
  GROUPS.push({ id: 'G-' + (idx + 1), name: 'Nouveau groupe', color: colors[idx % colors.length], teams: [] });
  renderGroupBtns();
  renderSettings();
  showToast('✅ Groupe ajouté - configurez-le ci-dessous', 'success');
}
