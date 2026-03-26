// ============================================================
// ABSENCES / CONGES - Parsing, persistence, indicators
// Depends on globals from settings.js: _rotWeekInfos, _supFile, _supSave
// ============================================================

let _rotParsedAbsences = {};   // live-parsed from textarea (per current PI offset)
let _rotAbsencesRaw = '';      // raw textarea for current PI
let _rotAbsencesDate = '';     // last update timestamp for current PI
let _rotAbsMemberCount = 0;
let _rotAbsAllNames = new Set();
let _rotAbsDayCounts = {};
let _rotAbsDateData = {};      // memberName → [{ date: Date, value: number }, ...]  (raw per-date)
let _rotAbsTeams = {};        // memberName → teamKey (from absence data "Equipes" column)

// Get/set absences raw text for a given PI
function _supAbsRaw(piNum) {
  return _supFile.absences?.[piNum]?.raw || '';
}
function _supAbsDate(piNum) {
  return _supFile.absences?.[piNum]?.updatedAt || '';
}
function _supSetAbs(piNum, raw) {
  if (!_supFile.absences) _supFile.absences = {};
  _supFile.absences[piNum] = { raw, updatedAt: new Date().toISOString() };
  _supSave();
}

// Load absences for the current PI offset into working variables
function _rotLoadAbsForPI() {
  const piNum = _rotWeekInfos()._piNum || 'unknown';
  _rotAbsencesRaw = _supAbsRaw(piNum);
  _rotAbsencesDate = _supAbsDate(piNum);
  _rotAbsMemberCount = 0;
  _rotAbsAllNames = new Set();
  _rotAbsDayCounts = {};
  _rotAbsDateData = {};
  _rotAbsTeams = {};
  _rotParsedAbsences = {};
  if (_rotAbsencesRaw) {
    _rotParsedAbsences = _parseAbsences(_rotAbsencesRaw);
    const lines = _rotAbsencesRaw.trim().split('\n');
    _rotAbsMemberCount = lines.length > 1 ? lines.slice(1).filter(l => l.split('\t')[0]?.trim()).length : 0;
    if (lines.length > 1) {
      for (const l of lines.slice(1)) {
        const raw = l.split('\t')[0]?.trim();
        if (raw) _rotAbsAllNames.add(_normalizeExcelName(raw).toLowerCase());
      }
    }
  }
}

function _rotAbsIndicatorContent() {
  if (!_rotAbsencesDate) return '';
  const d = new Date(_rotAbsencesDate);
  const fmt = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const absentCount = Object.keys(_rotParsedAbsences).length;
  return `<span class="rot-abs-dot"></span> ${_rotAbsMemberCount} membre${_rotAbsMemberCount > 1 ? 's' : ''}${absentCount ? ` · ${absentCount} avec absences` : ''} · ${fmt}`;
}

function _parseAbsences(raw, piOffset) {
  // Excel format: header row with dates (DD/MM) starting at col 4+
  // Data rows: "Nom, Prenom \t Equipe \t Entite \t Role \t 1 \t \t 0,5 ..."
  // Returns { normalizedMemberName: Set([weekIndex, ...]) }
  const result = {};
  _rotAbsDayCounts = {};
  _rotAbsDateData = {};
  _rotAbsTeams = {};
  if (!raw.trim()) return result;
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return result;

  // Parse header row to find date columns
  const headerCells = lines[0].split('\t');
  const weekInfos = _rotWeekInfos(piOffset != null ? piOffset : undefined);
  const dateRe = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/;

  // PI date range for year inference (handles Dec->Jan crossover)
  const piStart = weekInfos[0]?._start;
  const piEnd   = weekInfos[weekInfos.length - 1]?._end;
  const piYear  = piStart ? piStart.getFullYear() : new Date().getFullYear();

  // Map each column index -> date object
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

  // Map each date -> week index (which rotation week does this date fall in?)
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

    // Extract team from column 1 ("Equipes") -> match to CONFIG.teams key
    const rawTeam = (cells[1] || '').trim();
    if (rawTeam) {
      const teamKey = _normalizeAbsTeam(rawTeam);
      if (teamKey) _rotAbsTeams[memberName] = teamKey;
    }

    // Store raw per-date absence data + sum per week
    const weekAbsence = {};
    const memberDates = [];
    for (const [ci, date] of Object.entries(colDates)) {
      const val = (cells[ci] || '').trim().replace(',', '.');
      const num = parseFloat(val);
      if (!num || isNaN(num)) continue;
      const absDate = new Date(date); absDate.setHours(0, 0, 0, 0);
      memberDates.push({ date: absDate, value: num });
      const wi = dateToWeekIdx(date);
      if (wi < 0) continue;
      weekAbsence[wi] = (weekAbsence[wi] || 0) + num;
    }
    if (memberDates.length) _rotAbsDateData[memberName] = memberDates;

    // Store day counts for display
    if (Object.keys(weekAbsence).length) {
      _rotAbsDayCounts[memberName] = {};
      for (const [wi, total] of Object.entries(weekAbsence)) {
        _rotAbsDayCounts[memberName][wi] = total;
      }
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
  // "Nom, Prenom" -> "Prenom Nom" to match MEMBERS format
  const commaMatch = raw.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) return `${commaMatch[2].trim()} ${commaMatch[1].trim()}`;
  return raw;
}

// Normalize team name from absences: "Team Fuego" -> "Fuego", match to CONFIG.teams key
function _normalizeAbsTeam(rawTeam) {
  if (!rawTeam) return null;
  // Strip common prefixes
  const stripped = rawTeam.replace(/^(team|equipe|équipe)\s+/i, '').trim();
  const teamKeys = Object.keys(CONFIG.teams || {});
  // Exact match (case-insensitive)
  const exact = teamKeys.find(k => k.toLowerCase() === stripped.toLowerCase());
  if (exact) return exact;
  // Match against team display name
  const byName = teamKeys.find(k => (CONFIG.teams[k].name || '').toLowerCase() === stripped.toLowerCase());
  if (byName) return byName;
  // Partial match: stripped starts with or contains team key
  const partial = teamKeys.find(k => stripped.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(stripped.toLowerCase()));
  return partial || null;
}

// Fuzzy name matching: "Bob L" matches "Bob Lenon"
// Handles JIRA abbreviated names (last name truncated to initial)
function _fuzzyNameMatch(jiraName, absName) {
  const a = jiraName.toLowerCase().trim();
  const b = absName.toLowerCase().trim();
  if (a === b) return true;
  // Split into parts
  const pa = a.split(/\s+/);
  const pb = b.split(/\s+/);
  if (pa.length < 2 || pb.length < 2) return false;
  // "Prenom N" vs "Prenom Nom" -- first name matches, last is initial
  const firstA = pa[0], lastA = pa.slice(1).join(' ');
  const firstB = pb[0], lastB = pb.slice(1).join(' ');
  // Case 1: same first name, one last name is initial of the other
  if (firstA === firstB && (lastB.startsWith(lastA) || lastA.startsWith(lastB))) return true;
  // Case 2: reversed order -- "N Prenom" vs "Nom Prenom"
  if (lastA === lastB && (firstB.startsWith(firstA) || firstA.startsWith(firstB))) return true;
  // Case 3: "Prenom N" vs "Nom Prenom" (swapped order)
  if (firstA === lastB && (firstB.startsWith(lastA) || lastA.startsWith(firstB))) return true;
  if (lastA === firstB && (lastB.startsWith(firstA) || firstA.startsWith(lastB))) return true;
  return false;
}

function _findAbsKey(member, dataMap) {
  if (dataMap[member]) return member;
  const lower = member.toLowerCase();
  for (const name of Object.keys(dataMap)) {
    if (name.toLowerCase() === lower) return name;
  }
  for (const name of Object.keys(dataMap)) {
    if (_fuzzyNameMatch(member, name)) return name;
  }
  return null;
}

function _isAbsent(member, weekIdx, absences) {
  const key = _findAbsKey(member, absences);
  return key ? absences[key].has(weekIdx) : false;
}

function _getAbsDays(member, weekIdx) {
  const key = _findAbsKey(member, _rotAbsDayCounts);
  return key ? (_rotAbsDayCounts[key][weekIdx] || 0) : 0;
}

// Compute absence days for a specific week boundary (weekMode-aware)
function _getAbsDaysForRange(member, weekStart, weekEnd) {
  const key = _findAbsKey(member, _rotAbsDateData);
  if (!key) return 0;
  const entries = _rotAbsDateData[key];
  if (!entries) return 0;
  let total = 0;
  for (const e of entries) {
    if (e.date >= weekStart && e.date <= weekEnd) total += e.value;
  }
  return total;
}

function _isAbsentForRange(member, weekStart, weekEnd, workDays) {
  const days = _getAbsDaysForRange(member, weekStart, weekEnd);
  return days >= (workDays || 5) / 2;
}

// Check if a member name fuzzy-matches any name in the absences data
function _isMemberInAbsData(member) {
  if (_rotAbsAllNames.has(member.toLowerCase())) return true;
  for (const absName of _rotAbsAllNames) {
    if (_fuzzyNameMatch(member, absName)) return true;
  }
  return false;
}

function _rotParseAbsencesLive() {
  const raw = document.getElementById('rot-absences-input')?.value || '';
  _rotAbsencesRaw = raw;
  _rotParsedAbsences = _parseAbsences(raw);
  const lines = raw.trim().split('\n');
  _rotAbsMemberCount = lines.length > 1 ? lines.slice(1).filter(l => l.split('\t')[0]?.trim()).length : 0;
  _rotAbsAllNames = new Set();
  if (lines.length > 1) {
    for (const l of lines.slice(1)) {
      const rn = l.split('\t')[0]?.trim();
      if (rn) _rotAbsAllNames.add(_normalizeExcelName(rn).toLowerCase());
    }
  }
  // Persist to supports.json for current PI
  const piNum = _rotWeekInfos()._piNum || 'unknown';
  _supSetAbs(piNum, raw);
  _rotAbsencesDate = _supAbsDate(piNum);
  // Update indicator
  const ind = document.getElementById('rot-abs-indicator');
  if (ind) ind.innerHTML = _rotAbsIndicatorContent();
  // Update absences match feedback
  const fb = document.getElementById('rot-abs-feedback');
  if (fb) fb.innerHTML = _rotAbsFeedbackContent();
  // Refresh all team panels
  const realTeams = [...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort();
  for (const team of realTeams) _rotRefreshTeam(team);
}

// Absences match feedback: how many JIRA members matched vs unmatched
function _rotAbsFeedbackContent() {
  if (!_rotAbsAllNames.size) return '';
  // Collect all known JIRA members across teams
  const allMembers = new Set();
  Object.values(typeof MEMBERS !== 'undefined' ? MEMBERS : {}).forEach(ms => ms.forEach(m => allMembers.add(m)));
  Object.values(typeof _rotExtraMembers !== 'undefined' ? _rotExtraMembers : {}).forEach(ms => ms.forEach(m => allMembers.add(m)));
  let matched = 0, unmatched = 0;
  const unmatchedNames = [];
  for (const absName of _rotAbsAllNames) {
    let found = false;
    for (const m of allMembers) {
      if (m.toLowerCase() === absName || _fuzzyNameMatch(m, absName)) { found = true; break; }
    }
    if (found) matched++;
    else { unmatched++; unmatchedNames.push(absName); }
  }
  let html = `<span class="rot-abs-fb-ok">${matched} reconnu${matched > 1 ? 's' : ''}</span>`;
  if (unmatched) html += `<span class="rot-abs-fb-warn">${unmatched} non reconnu${unmatched > 1 ? 's' : ''} : ${unmatchedNames.slice(0, 5).join(', ')}${unmatchedNames.length > 5 ? '…' : ''}</span>`;
  return html;
}

// Render the absences/conges HTML section for settings
function _absencesSectionHtml() {
  const _absPI = _rotWeekInfos()._piNum || '?';
  return `<div class="settings-section rot-section stg-full-width" id="stg-sec-absences">
    <details class="rot-absences-details"${_rotAbsencesRaw ? ' open' : ''}>
      <summary class="rot-absences-summary">📋 Congés / Absences PI ${_absPI} (coller depuis Excel)
        <span class="rot-abs-indicator" id="rot-abs-indicator">${_rotAbsIndicatorContent()}</span>
      </summary>
      <div class="rot-absences-body">
        <div class="rot-abs-intro">
          <div class="rot-abs-intro-icon">📎</div>
          <div class="rot-abs-intro-text">
            <strong>Collez le tableau Excel</strong> des congés pour le PI ${_absPI}.<br>
            <span class="rot-abs-intro-sub">Format : 1ère ligne = en-têtes avec dates (JJ/MM), colonnes = <code>1</code> (absent) ou <code>0,5</code> (demi-journée).<br>Si ≥ 2,5 jours dans une semaine → membre exclu de la rotation.</span>
          </div>
        </div>
        <details class="rot-abs-example-details">
          <summary class="rot-abs-example-toggle">📄 Voir un exemple de format</summary>
          <div class="rot-abs-example-table">
            <table>
              <thead><tr><th>NOMS, Prénom</th><th>Équipes</th><th>Entité</th><th>Rôles</th><th>03/04</th><th>06/04</th><th>07/04</th></tr></thead>
              <tbody>
                <tr><td>Leclerc, Martin</td><td>Fuego</td><td>XYZ</td><td>Ops</td><td></td><td class="rot-abs-cell-full">1</td><td></td></tr>
                <tr><td>Renaud, Sophie</td><td>Fuego</td><td>XYZ</td><td>Dev</td><td class="rot-abs-cell-full">1</td><td class="rot-abs-cell-full">1</td><td class="rot-abs-cell-full">1</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        <div class="rot-abs-textarea-wrap">
          <textarea id="rot-absences-input" class="rot-absences-textarea" rows="6" placeholder="Collez ici le tableau Excel des congés pour PI ${_absPI}…" oninput="_rotParseAbsencesLive()">${_rotAbsencesRaw.replace(/</g,'&lt;')}</textarea>
          <div class="rot-abs-textarea-hint">💡 Ctrl+V depuis Excel ou Google Sheets</div>
        </div>
        <div class="rot-abs-feedback" id="rot-abs-feedback">${_rotAbsFeedbackContent()}</div>
      </div>
    </details>
  </div>`;
}
