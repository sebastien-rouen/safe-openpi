// ============================================================
// SETTINGS VIEW - Configuration équipes, JIRA, groupes, notifications
// ============================================================

// --- Persistance des paramètres dans localStorage ---
function _stgSave(path, value) {
  // Appliquer en mémoire
  const parts = path.split('.');
  let obj = CONFIG;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  // Persister dans localStorage
  const overrides = JSON.parse(localStorage.getItem('config_overrides') || '{}');
  overrides[path] = value;
  localStorage.setItem('config_overrides', JSON.stringify(overrides));
  // Feedback visuel
  if (typeof showToast === 'function') showToast('Paramètre sauvegardé', 'success');
}

// Restaurer les overrides au chargement
(function _stgRestore() {
  try {
    const overrides = JSON.parse(localStorage.getItem('config_overrides') || '{}');
    Object.entries(overrides).forEach(([path, value]) => {
      const parts = path.split('.');
      let obj = CONFIG;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
    });
  } catch {}
})();

// --- Info tooltips (fixed position, escapes overflow) ---
(function() {
  let _tip = null;
  document.addEventListener('mouseenter', e => {
    const el = e.target.closest?.('.stg-info');
    if (!el || !el.dataset.tip) return;
    if (_tip) _tip.remove();
    _tip = document.createElement('div');
    _tip.className = 'stg-info-tip';
    _tip.textContent = el.dataset.tip;
    document.body.appendChild(_tip);
    const r = el.getBoundingClientRect();
    let left = r.left + r.width / 2 - _tip.offsetWidth / 2;
    let top = r.top - _tip.offsetHeight - 8;
    if (top < 4) top = r.bottom + 8;
    if (left < 4) left = 4;
    if (left + _tip.offsetWidth > window.innerWidth - 4) left = window.innerWidth - _tip.offsetWidth - 4;
    _tip.style.left = left + 'px';
    _tip.style.top = top + 'px';
  }, true);
  document.addEventListener('mouseleave', e => {
    if (e.target.closest?.('.stg-info') && _tip) { _tip.remove(); _tip = null; }
  }, true);
})();

// --- Dark mode ---
function _initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}
_initTheme();

// --- Restore persisted sync settings ---
(function _initSyncSettings() {
  const enrich = localStorage.getItem('enrichClosedSprints');
  if (enrich !== null) CONFIG.sync.enrichClosedSprints = enrich === '1';
})();

function toggleDarkMode(checkbox) {
  const theme = checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (typeof refreshCharts === 'function' && typeof chartsInitialized !== 'undefined' && chartsInitialized) refreshCharts();
}

// Collapsible state for settings sections
const _settingsCollapsed = JSON.parse(localStorage.getItem('settings_collapsed') || '{}');

// ============================================================
// Support rotation data — persisted in data/supports.json
// Structure: { rotation, extraMembers, hiddenMembers, absences: { piXX: { raw, updatedAt } } }
// ============================================================
let _supFile = {};             // full JSON file contents
let _supLoaded = false;

let _supportRotation = {};     // rotation assignments (ref into _supFile)
let _rotExtraMembers = {};     // manually added members
let _rotHiddenMembers = {};    // hidden members

// Absences variables & functions → absences.js
let _rotPIOffset = 0;
let _rotPINumOverride = null; // null = utiliser offset (comportement historique), sinon numero PI absolu force
let _rotTeamCollapsed = {};
let _rotGroupCollapsed = {};
let _rotAddingGroup = null; // group currently showing add input

// --- supports.json persistence ---
let _supSaveTimer = null;

// ============================================================
// Faits Marquants — evenements (incidents, gels, jalons, periodes)
// Stockes dans _supFile.events
// ============================================================
// Types : 'incident' 💥 | 'freeze' 🧊 | 'milestone' 🚩 | 'period' 📅 | 'other' ℹ️
const _EVENT_TYPES = {
  incident:  { icon: '💥', label: 'Incident',    color: '#DC2626' },
  freeze:    { icon: '🧊', label: 'Gel',          color: '#3B82F6' },
  milestone: { icon: '🚩', label: 'Jalon',        color: '#8B5CF6' },
  period:    { icon: '📅', label: 'Période',      color: '#F59E0B' },
  other:     { icon: 'ℹ️', label: 'Info',         color: '#64748B' },
};

function _eventsList() {
  return (_supFile?.events || []).slice().sort((a, b) => {
    const da = a.startDate || a.date || '';
    const db = b.startDate || b.date || '';
    return db.localeCompare(da); // plus recent en premier
  });
}

function _eventAdd(ev) {
  if (!_supFile.events) _supFile.events = [];
  ev.id = ev.id || ('evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
  _supFile.events.push(ev);
  _supSave();
}

function _eventUpdate(id, patch) {
  const list = _supFile.events || [];
  const idx = list.findIndex(e => e.id === id);
  if (idx >= 0) { Object.assign(list[idx], patch); _supSave(); }
}

function _eventDelete(id) {
  if (!confirm('Supprimer ce fait marquant ?')) return;
  _supFile.events = (_supFile.events || []).filter(e => e.id !== id);
  _supSave();
  renderSettings();
}

// Evenements actifs sur une date donnee (pour plugin chart)
function _eventsOnDate(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return [];
  return (_supFile?.events || []).filter(ev => {
    const start = ev.startDate || ev.date || '';
    const end = ev.endDate || ev.date || start;
    return start <= d && d <= end;
  });
}

// Evenements dans une plage [start, end]
function _eventsInRange(startDate, endDate) {
  const s = String(startDate || '').slice(0, 10);
  const e = String(endDate || '').slice(0, 10);
  if (!s || !e) return [];
  return (_supFile?.events || []).filter(ev => {
    const evStart = ev.startDate || ev.date || '';
    const evEnd = ev.endDate || ev.date || evStart;
    return evStart <= e && evEnd >= s;
  });
}


function _supSave() {
  // Sync in-memory refs back to file
  _supFile.rotation = _supportRotation;
  _supFile.extraMembers = _rotExtraMembers;
  _supFile.hiddenMembers = _rotHiddenMembers;
  // Backup local : conserver les 5 derniers etats dans localStorage (rotation backup ring)
  try {
    const backups = JSON.parse(localStorage.getItem('supports_backups') || '[]');
    backups.unshift({ ts: Date.now(), data: _supFile });
    localStorage.setItem('supports_backups', JSON.stringify(backups.slice(0, 5)));
  } catch (e) { /* localStorage plein, on ignore */ }
  clearTimeout(_supSaveTimer);
  _supSaveTimer = setTimeout(() => {
    fetch('/data/supports.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_supFile, null, 2),
    }).catch(err => {
      console.error('[supports] Sauvegarde échouée :', err);
      if (typeof showToast === 'function') showToast('Erreur sauvegarde supports.json : ' + err.message, 'error');
    });
  }, 300);
}

// Restaurer un backup localStorage (utilitaire console : _supRestoreBackup(0))
window._supRestoreBackup = function(idx = 0) {
  const backups = JSON.parse(localStorage.getItem('supports_backups') || '[]');
  if (!backups[idx]) { console.warn('Aucun backup a l\'index', idx, '— max:', backups.length - 1); return; }
  const b = backups[idx];
  console.log('Restauration backup du', new Date(b.ts).toLocaleString('fr-FR'));
  _supFile = b.data;
  _supportRotation = _supFile.rotation || {};
  _rotExtraMembers = _supFile.extraMembers || {};
  _rotHiddenMembers = _supFile.hiddenMembers || {};
  // Sauvegarder sur disque
  fetch('/data/supports.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_supFile, null, 2),
  }).then(() => {
    if (typeof showToast === 'function') showToast(`✅ Backup #${idx} restauré (${new Date(b.ts).toLocaleString('fr-FR')})`, 'success');
    if (typeof renderSettings === 'function') renderSettings();
  });
};
window._supListBackups = function() {
  const backups = JSON.parse(localStorage.getItem('supports_backups') || '[]');
  console.table(backups.map((b, i) => ({ idx: i, date: new Date(b.ts).toLocaleString('fr-FR'), teams: Object.keys(b.data?.rotation || {}).length })));
  return backups.length;
};

async function _supLoad() {
  if (_supLoaded) return;
  try {
    const res = await fetch('/data/supports.json');
    if (res.ok) {
      _supFile = await res.json() || {};
    } else if (res.status === 404) {
      // First run: migrate from localStorage if available
      _supFile = {};
      const lsRot = localStorage.getItem('support_rotation');
      if (lsRot) _supFile.rotation = JSON.parse(lsRot);
      const lsExtra = localStorage.getItem('rot_extra_members');
      if (lsExtra) _supFile.extraMembers = JSON.parse(lsExtra);
      const lsHidden = localStorage.getItem('rot_hidden_members');
      if (lsHidden) _supFile.hiddenMembers = JSON.parse(lsHidden);
      // Migrate old absences.json if present
      try {
        const absRes = await fetch('/data/absences.json');
        if (absRes.ok) {
          const absData = await absRes.json();
          if (absData.raw) {
            const piNum = _rotWeekInfos(0)._piNum || 'unknown';
            _supFile.absences = { [piNum]: { raw: absData.raw, updatedAt: absData.updatedAt || '' } };
          }
        }
      } catch {}
      _supSave(); // persist migrated data
    }
  } catch (err) {
    console.error('[supports] Chargement échoué :', err);
    if (typeof showToast === 'function') showToast('Erreur chargement supports.json : ' + err.message, 'error');
  }
  // Populate in-memory refs from file
  _supportRotation = _supFile.rotation || {};
  _rotExtraMembers = _supFile.extraMembers || {};
  _rotHiddenMembers = _supFile.hiddenMembers || {};
  _supLoaded = true;
}

// _supAbsRaw, _supAbsDate, _supSetAbs → absences.js

// _rotLoadAbsForPI → absences.js

// _rotAbsIndicatorContent → absences.js

function _saveRotation() {
  _supSave();
}

function _piWeeks() {
  const sPerPI = CONFIG.sprint.sprintsPerPI || 5;
  const dur    = CONFIG.sprint.durationDays || 14;
  return sPerPI * (dur / 7); // typically 10 weeks
}

function _rotWeekInfos(piOffset, weekMode) {
  const offset = piOffset != null ? piOffset : _rotPIOffset || 0;
  const sprintsPerPI = CONFIG.sprint.sprintsPerPI || 5;
  const dur = CONFIG.sprint.durationDays || 14;
  const weeksPerSprint = dur / 7;
  // Detect PI number — same logic as _ppDetectPI(): team sprintNames first, then label
  const piRe = /(\d{2,3})\.(\d+)\s*$/;
  let basePiNum = null, currentSprintIdx = 0;
  for (const tc of Object.values(CONFIG.teams || {})) {
    const m = (tc.sprintName || '').match(piRe);
    if (m) { basePiNum = parseInt(m[1]); currentSprintIdx = parseInt(m[2]) - 1; break; }
  }
  if (basePiNum == null) {
    const m2 = (CONFIG.sprint.label || '').match(/(\d{2,3})\.(\d+)/);
    if (m2) { basePiNum = parseInt(m2[1]); currentSprintIdx = parseInt(m2[2]) - 1; }
  }
  // _rotPINumOverride prend le dessus sur l'offset quand defini
  const piNum = _rotPINumOverride != null
    ? String(_rotPINumOverride)
    : (basePiNum != null ? String(basePiNum + offset) : null);

  // Collect actual sprint dates from velocity history for the target PI
  const _tryDate = s => { if (!s) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s); return isNaN(d.getTime()) ? null : d; };
  const _piSprintDates = {}; // sprintIdx (0-based) → { start, end }
  if (piNum) {
    for (const tc of Object.values(CONFIG.teams || {})) {
      for (const vh of (tc.velocityHistory || [])) {
        const m = (vh.name || '').match(piRe);
        if (m && m[1] === piNum) {
          const idx = parseInt(m[2]) - 1;
          if (!_piSprintDates[idx]) {
            const s = _tryDate(vh.startDate);
            const e = _tryDate(vh.endDate);
            if (s) _piSprintDates[idx] = { start: s, end: e };
          }
        }
      }
      // Also use current active sprint (only for current PI, offset=0)
      if (offset === 0) {
        const cm = (tc.sprintName || '').match(piRe);
        if (cm && cm[1] === piNum) {
          const idx = parseInt(cm[2]) - 1;
          if (!_piSprintDates[idx]) {
            const s = _tryDate(tc.sprintStartISO);
            if (s) _piSprintDates[idx] = { start: s, end: null };
          }
        }
      }
      // Also use future sprint dates (sprints not yet opened but with dates)
      (tc.futureSprintDates || []).forEach(fsd => {
        const fm = (fsd.name || '').match(piRe);
        if (fm && fm[1] === piNum) {
          const idx = parseInt(fm[2]) - 1;
          if (!_piSprintDates[idx]) {
            const s = _tryDate(fsd.startDate);
            const e = _tryDate(fsd.endDate);
            if (s) _piSprintDates[idx] = { start: s, end: e };
          }
        }
      });
    }
  }

  // Compute PI start date
  let piStartDate = null;

  // 1) Use actual date of sprint X.1 from velocity history
  if (_piSprintDates[0]?.start) {
    piStartDate = new Date(_piSprintDates[0].start);
  }

  if (offset === 0) {
    // 2) rm_pi_start from localStorage — authoritative, set by roadmap/piprep
    if (!piStartDate) {
      const stored = localStorage.getItem('rm_pi_start') || '';
      if (stored) piStartDate = _tryDate(stored);
    }

    // 3) Derive from current sprint ISO start date + sprint index
    if (!piStartDate && currentSprintIdx >= 0) {
      let bestStart = null;
      for (const tc of Object.values(CONFIG.teams || {})) {
        const d = _tryDate(tc.sprintStartISO);
        if (d) { bestStart = d; break; }
      }
      if (!bestStart) bestStart = _tryDate(CONFIG.sprint.startDateISO);
      if (!bestStart) bestStart = _tryDate(CONFIG.sprint.startDate);
      if (bestStart) {
        piStartDate = new Date(bestStart);
        piStartDate.setDate(piStartDate.getDate() - currentSprintIdx * dur);
      }
    }
  }

  // For next PI: extrapolate from current PI end
  if (!piStartDate && offset > 0) {
    const currentInfos = _rotWeekInfos(0);
    if (currentInfos.length) {
      piStartDate = new Date(currentInfos[currentInfos.length - 1]._end);
      piStartDate.setDate(piStartDate.getDate() + 1); // day after current PI ends
      // Advance by (offset - 1) full PIs
      if (offset > 1) piStartDate.setDate(piStartDate.getDate() + (offset - 1) * sprintsPerPI * dur);
    }
  }

  // 4) Fallback: next sprintStartDay from today
  if (!piStartDate) {
    const sd = CONFIG.sprint?.sprintStartDay ?? 5;
    piStartDate = new Date(); piStartDate.setHours(0, 0, 0, 0);
    piStartDate.setDate(piStartDate.getDate() + (sd - piStartDate.getDay() + 7) % 7);
  }

  // Build per-sprint start dates: use actual JIRA dates when available, else extrapolate
  const sprintStarts = [];
  for (let s = 0; s < sprintsPerPI; s++) {
    if (_piSprintDates[s]?.start) {
      sprintStarts[s] = new Date(_piSprintDates[s].start);
    } else if (s === 0) {
      sprintStarts[s] = new Date(piStartDate);
    } else {
      // Extrapolate from previous sprint start + duration
      sprintStarts[s] = new Date(sprintStarts[s - 1]);
      sprintStarts[s].setDate(sprintStarts[s].getDate() + dur);
    }
  }

  // Collect French holidays covering the full PI date range
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const y1 = piStartDate.getFullYear();
  const lastSprintStart = sprintStarts[sprintsPerPI - 1];
  const piEndEst = new Date(lastSprintStart);
  piEndEst.setDate(piEndEst.getDate() + dur);
  const y2 = piEndEst.getFullYear();
  const holidays = typeof _frenchHolidays === 'function'
    ? [..._frenchHolidays(y1), ...(y2 !== y1 ? _frenchHolidays(y2) : [])]
    : [];
  const holSet = new Set(holidays.map(h => h.d.toDateString()));

  const infos = [];
  infos._piNum = piNum; // expose PI number for display
  for (let s = 0; s < sprintsPerPI; s++) {
    for (let w = 0; w < weeksPerSprint; w++) {
      const label = piNum
        ? `${piNum}.${s + 1}.${w + 1}`
        : `S${s * weeksPerSprint + w + 1}`;

      let _start, _end;
      if (weekMode === 'monday') {
        // Monday→Friday: find the Monday on or after sprint week boundary
        const base = new Date(sprintStarts[s]);
        base.setDate(base.getDate() + w * 7);
        const dow = base.getDay(); // 0=Sun,1=Mon,...
        _start = new Date(base);
        if (dow !== 1) _start.setDate(_start.getDate() + ((8 - dow) % 7)); // advance to Monday
        _start.setHours(0, 0, 0, 0);
        _end = new Date(_start);
        _end.setDate(_end.getDate() + 4); // Friday
        _end.setHours(23, 59, 59, 999);
      } else if (weekMode === 'wednesday') {
        // Wednesday→Tuesday: find the Wednesday on or after sprint week boundary
        const base = new Date(sprintStarts[s]);
        base.setDate(base.getDate() + w * 7);
        const dow = base.getDay();
        _start = new Date(base);
        if (dow !== 3) _start.setDate(_start.getDate() + ((10 - dow) % 7)); // advance to Wednesday
        _start.setHours(0, 0, 0, 0);
        _end = new Date(_start);
        _end.setDate(_end.getDate() + 6); // Tuesday
        _end.setHours(23, 59, 59, 999);
      } else {
        // Default (friday / sprint-aligned): 7-day block from sprint start
        _start = new Date(sprintStarts[s]);
        _start.setDate(_start.getDate() + w * 7);
        _start.setHours(0, 0, 0, 0);
        _end = new Date(_start);
        _end.setDate(_end.getDate() + 6);
        _end.setHours(23, 59, 59, 999);
      }
      const dateRange = `${fmt(_start)} → ${fmt(_end)}`;

      // Count working days (exclude weekends + French holidays)
      let workDays = 0;
      const weekHolidays = [];
      const cursor = new Date(_start);
      while (cursor <= _end) {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) {
          if (holSet.has(cursor.toDateString())) {
            const h = holidays.find(h => h.d.toDateString() === cursor.toDateString());
            weekHolidays.push(h ? h.name : 'Férié');
          } else {
            workDays++;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      infos.push({ label, dateRange, sprintIdx: s, weekInSprint: w + 1, _start, _end, workDays, holidays: weekHolidays });
    }
  }
  return infos;
}

function _rotToggleTeam(team) {
  _rotTeamCollapsed[team] = !(_rotTeamCollapsed[team] ?? true);
  _rotRefreshTeam(team);
}

function _rotTogglePI(offset) {
  _rotPIOffset = offset;
  _rotPINumOverride = null;
  _rotLoadAbsForPI();
  renderSettings();
}

// Selectionner un PI par numero absolu (depuis le selecteur)
function _rotSelectPI(piNum) {
  const n = parseInt(piNum);
  if (isNaN(n)) return;
  _rotPINumOverride = n;
  _rotPIOffset = 0;
  if (typeof _rotLoadAbsForPI === 'function') _rotLoadAbsForPI();
  renderSettings();
}

// Rotation key: namespace by PI offset so each PI has its own rotation data
function _rotTeamKey(team) {
  const piNum = _rotWeekInfos()._piNum;
  return piNum ? `${team}__pi${piNum}` : team;
}

function _rotSetMembersPerWeek(team, n) {
  const k = _rotTeamKey(team);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 3, weeks: {} };
  _supportRotation[k].membersPerWeek = Math.max(1, Math.min(10, n));
  _saveRotation();
  renderSettings();
}

function _rotSetWeekMode(team, mode) {
  const k = _rotTeamKey(team);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 3, weeks: {} };
  const cur = _supportRotation[k];
  // Si meme mode, ne rien faire
  if ((cur.weekMode || 'friday') === mode) return;
  // Si des assignations existent, demander confirmation avant de les effacer
  const hasAssignments = cur.weeks && Object.values(cur.weeks).some(arr => Array.isArray(arr) && arr.length > 0);
  if (hasAssignments) {
    const teamName = CONFIG.teams[team]?.name || team;
    const confirmed = confirm(
      `⚠ Changer le mode de semaine pour "${teamName}" va EFFACER toutes les assignations actuelles ` +
      `(les bornes de semaine changent).\n\nContinuer ?`
    );
    if (!confirmed) {
      // Re-render pour remettre l'ancien bouton actif visuellement
      _rotRefreshTeam(team);
      return;
    }
  }
  cur.weekMode = mode; // 'monday' | 'friday' | 'wednesday'
  cur.weeks = {};      // reset assignments — week boundaries changed
  _saveRotation();
  _rotRefreshTeam(team);
}

function _rotGetWeekMode(team) {
  const k = _rotTeamKey(team);
  return (_supportRotation[k]?.weekMode) || 'friday';
}

function _rotToggleMember(team, weekIdx, member) {
  const k = _rotTeamKey(team);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 3, weeks: {} };
  const weeks = _supportRotation[k].weeks;
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

function _rotTeamMembers(team) {
  const base = MEMBERS[team] || [];
  const extra = _rotExtraMembers[team] || [];
  // Members auto-detected from absences "Équipes" column
  const fromAbs = Object.entries(_rotAbsTeams)
    .filter(([, t]) => t === team)
    .map(([m]) => m);
  const hk = _rotTeamKey(team);
  const hidden = new Set(_rotHiddenMembers[hk] || []);
  const all = [...new Set([...base, ...extra, ...fromAbs])].filter(m => !hidden.has(m));
  all.sort((a, b) => a.localeCompare(b, 'fr'));
  return all;
}

// --- Add member: inline input with autocomplete ---
let _rotAddingTeam = null; // team currently showing add input

function _rotAddMember(team) {
  // Toggle: close if already open for this team
  if (_rotAddingTeam === team) { _rotAddingTeam = null; _rotRefreshTeam(team); return; }
  _rotAddingTeam = team;
  _rotRefreshTeam(team);
  // Focus the input after DOM update
  setTimeout(() => {
    const inp = document.getElementById(`rot-add-input-${team}`);
    if (inp) inp.focus();
  }, 30);
}

function _rotConfirmAdd(team) {
  const inp = document.getElementById(`rot-add-input-${team}`);
  const name = inp?.value?.trim();
  if (!name) return;
  if (!_rotExtraMembers[team]) _rotExtraMembers[team] = [];
  if (!_rotExtraMembers[team].includes(name)) _rotExtraMembers[team].push(name);
  const hk = _rotTeamKey(team);
  if (_rotHiddenMembers[hk]) {
    _rotHiddenMembers[hk] = _rotHiddenMembers[hk].filter(m => m !== name);
  }
  _supSave();
  _rotAddingTeam = null;
  _rotRefreshTeam(team);
  if (typeof showToast === 'function') showToast(`✅ ${name} ajouté à ${CONFIG.teams[team]?.name || team}`, 'success');
}

function _rotAddInputKeydown(e, team) {
  if (e.key === 'Enter') { e.preventDefault(); _rotConfirmAdd(team); }
  if (e.key === 'Escape') { _rotAddingTeam = null; _rotRefreshTeam(team); }
}

// Build suggestions: all members from other teams not already in this team
function _rotSuggestions(team) {
  const current = new Set(_rotTeamMembers(team));
  const suggestions = [];
  // From all MEMBERS (other teams)
  Object.entries(MEMBERS).forEach(([t, ms]) => {
    if (t === team) return;
    ms.forEach(m => { if (!current.has(m) && !suggestions.includes(m)) suggestions.push(m); });
  });
  // From extra members of other teams
  Object.entries(_rotExtraMembers).forEach(([t, ms]) => {
    if (t === team) return;
    ms.forEach(m => { if (!current.has(m) && !suggestions.includes(m)) suggestions.push(m); });
  });
  // From hidden members of this team (re-add)
  (_rotHiddenMembers[_rotTeamKey(team)] || []).forEach(m => {
    if (!current.has(m) && !suggestions.includes(m)) suggestions.push(m);
  });
  // From absences data names
  _rotAbsAllNames.forEach(absName => {
    // Find the original-case name
    const origName = _normalizeExcelName(absName);
    if (!current.has(origName) && !suggestions.includes(origName)) suggestions.push(origName);
  });
  suggestions.sort((a, b) => a.localeCompare(b, 'fr'));
  return suggestions;
}

function _rotAddInputHtml(team) {
  const suggestions = _rotSuggestions(team);
  const listId = `rot-add-list-${team}`;
  return `<div class="rot-add-row">
    <input id="rot-add-input-${team}" type="text" class="rot-add-input" placeholder="Nom du membre…"
      list="${listId}" autocomplete="off"
      onkeydown="_rotAddInputKeydown(event,'${team}')">
    <datalist id="${listId}">
      ${suggestions.map(s => `<option value="${s}">`).join('')}
    </datalist>
    <button class="rot-add-confirm" onclick="_rotConfirmAdd('${team}')" title="Ajouter">✓</button>
    <button class="rot-add-cancel" onclick="_rotAddingTeam=null;_rotRefreshTeam('${team}')" title="Annuler">✕</button>
  </div>`;
}

// --- Remove member: with confirmation ---
function _rotRemoveMember(team, member) {
  if (!confirm(`Retirer « ${member} » de l'équipe ${CONFIG.teams[team]?.name || team} ?`)) return;
  // Remove from extra if manually added
  if (_rotExtraMembers[team]) {
    _rotExtraMembers[team] = _rotExtraMembers[team].filter(m => m !== member);
  }
  // Hide if from JIRA or from absences auto-detection
  const isFromJira = (MEMBERS[team] || []).includes(member);
  const isFromAbs = _rotAbsTeams[member] === team;
  const hk = _rotTeamKey(team);
  if (isFromJira || isFromAbs) {
    if (!_rotHiddenMembers[hk]) _rotHiddenMembers[hk] = [];
    if (!_rotHiddenMembers[hk].includes(member)) _rotHiddenMembers[hk].push(member);
  }
  // Remove from rotation weeks
  const k = _rotTeamKey(team);
  const rot = _supportRotation[k];
  if (rot?.weeks) {
    Object.values(rot.weeks).forEach(arr => {
      const idx = arr.indexOf(member);
      if (idx >= 0) arr.splice(idx, 1);
    });
  }
  _supSave();
  _rotRefreshTeam(team);
}

// ============================================================
// Rotation groupée — fonctions utilitaires
// ============================================================

// Clé de stockage pour un groupe rotation
function _rotGroupKey(groupId) {
  const piNum = _rotWeekInfos()?._piNum || 'unknown';
  return `GROUP_${groupId}__pi${piNum}`;
}

// Pool de membres fusionné (union dédupliquée de toutes les équipes du groupe)
function _rotGroupMembers(group) {
  const all = [];
  const seen = new Set();
  for (const t of group.teams) {
    for (const m of _rotTeamMembers(t)) {
      if (!seen.has(m)) { seen.add(m); all.push(m); }
    }
  }
  all.sort((a, b) => a.localeCompare(b, 'fr'));
  return all;
}

// ============================================================
// Rotation groupée — panel
// ============================================================

function _rotGroupPanel(group) {
  const members = _rotGroupMembers(group);
  if (!members.length) return '';
  const color = group.color;
  const name  = group.name;
  const gid   = group.id;
  const rot   = _supportRotation[_rotGroupKey(gid)] || { membersPerWeek: 2, weeks: {} };
  const mpw   = rot.membersPerWeek || 2;
  const wMode = rot.weekMode || 'friday';
  const weekInfos = _rotWeekInfos(null, wMode);
  const totalWeeks = weekInfos.length;

  const weekHeaders = weekInfos.map(w => {
    const holTip = w.holidays.length ? ` title="${w.holidays.join(', ')}"` : '';
    const holBadge = w.holidays.length ? `<span class="rot-wk-hol"${holTip}>${w.holidays.length}j férié${w.holidays.length > 1 ? 's' : ''}</span>` : '';
    return `<th class="rot-wk-th"><span class="rot-wk-label">${w.label}</span>${w.dateRange ? `<span class="rot-wk-dates">${w.dateRange}</span>` : ''}${holBadge}</th>`;
  }).join('');

  const memberRows = members.map(m => {
    const cells = Array.from({ length: totalWeeks }, (_, wi) => {
      const selected = (rot.weeks[wi] || []).includes(m);
      const w = weekInfos[wi];
      const absDays = _getAbsDaysForRange(m, w._start, w._end);
      const absent = absDays >= (w.workDays || 5) / 2;
      const absentCls = absent ? ' rot-cell-absent' : absDays > 0 ? ' rot-cell-partial' : '';
      const absBadge = absDays > 0 ? `<span class="rot-abs-badge${absent ? ' rot-abs-full' : ''}" title="${absDays}j congé">${absDays % 1 ? absDays.toFixed(1).replace('.', ',') : absDays}j</span>` : '';
      return `<td class="rot-cell${absentCls}">
        ${absBadge}
        <button class="rot-chip${selected ? ' rot-chip-on' : ''}" style="${selected ? `background:${color}22;color:${color};border-color:${color}` : ''}"
          onclick="_rotToggleGroupMember('${gid}',${wi},'${m.replace(/'/g, "\\'")}')">${selected ? '✓' : ''}</button>
      </td>`;
    }).join('');
    const hasAbsData = _rotAbsAllNames.size > 0;
    let matchDot = '';
    if (hasAbsData) {
      const matched = _isMemberInAbsData(m);
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

  // Capacity row: total available person-days per week
  const capaCells = Array.from({ length: totalWeeks }, (_, wi) => {
    const w = weekInfos[wi];
    const wd = w?.workDays ?? 5;
    let totalAbs = 0;
    members.forEach(m => { totalAbs += _getAbsDaysForRange(m, w._start, w._end); });
    const totalCap = members.length * wd;
    const availCap = Math.max(0, totalCap - totalAbs);
    const pct = totalCap > 0 ? Math.round(availCap / totalCap * 100) : 100;
    const warn = pct < 60 ? ' rot-capa-warn' : pct < 80 ? ' rot-capa-mid' : '';
    return `<td class="rot-cell rot-capa${warn}" title="${availCap}/${totalCap} jours dispo (${pct}%)">${availCap}j <span class="rot-capa-pct">${pct}%</span></td>`;
  }).join('');

  const collapsed = _rotGroupCollapsed[gid] ?? false;
  const filledWeeks = Object.keys(rot.weeks).filter(wi => (rot.weeks[wi] || []).length > 0).length;
  const correctWeeks = Object.keys(rot.weeks).filter(wi => (rot.weeks[wi] || []).length === mpw).length;
  const weeksPct = totalWeeks > 0 ? Math.round(filledWeeks / totalWeeks * 100) : 0;
  const weeksOk = filledWeeks === totalWeeks;
  const correctOk = correctWeeks === totalWeeks;
  const summaryWeeksCls = weeksOk && correctOk ? 'rot-sum-ok' : filledWeeks > 0 ? 'rot-sum-partial' : 'rot-sum-empty';
  const summary = collapsed ? `<span class="rot-team-summary">
    <span class="rot-sum-pill rot-sum-members">${members.length} membre${members.length > 1 ? 's' : ''}</span>
    <span class="rot-sum-pill ${summaryWeeksCls}">${filledWeeks}/${totalWeeks} sem.</span>
    ${!correctOk && filledWeeks > 0 ? `<span class="rot-sum-pill rot-sum-partial">${correctWeeks}/${totalWeeks} complet${correctWeeks > 1 ? 's' : ''}</span>` : ''}
    <span class="rot-sum-bar"><span class="rot-sum-fill ${summaryWeeksCls}" style="width:${weeksPct}%"></span></span>
  </span>` : '';

  return `<div class="rot-team-panel rot-group-panel" id="rot-group-${gid}" style="border-left:4px solid ${color}">
    <div class="rot-team-hdr" onclick="_rotToggleGroupPanel('${gid}')" style="cursor:pointer;">
      <span class="rot-team-chevron">${collapsed ? '▶' : '▼'}</span>
      <span class="rot-team-dot" style="background:${color}"></span>
      <span class="rot-team-name">${name}</span>
      <span class="rot-group-badge">Groupe · ${group.teams.length} équipes</span>
      ${summary}
      ${!collapsed ? `<label class="rot-mpw-label" onclick="event.stopPropagation()">Effectif / sem. :
        <input type="number" min="1" max="10" value="${mpw}" class="rot-mpw-input"
          onchange="_rotSetGroupMPW('${gid}',+this.value)">
      </label>
      <span class="rot-wmode" onclick="event.stopPropagation()" title="Mode semaine support">
        <button class="rot-wmode-btn${wMode === 'friday' ? ' rot-wmode-on' : ''}" onclick="_rotSetGroupWeekMode('${gid}','friday')">Ven→Jeu</button>
        <button class="rot-wmode-btn${wMode === 'monday' ? ' rot-wmode-on' : ''}" onclick="_rotSetGroupWeekMode('${gid}','monday')">Lun→Ven</button>
        <button class="rot-wmode-btn${wMode === 'wednesday' ? ' rot-wmode-on' : ''}" onclick="_rotSetGroupWeekMode('${gid}','wednesday')">Mer→Mar</button>
      </span>
      <button class="rot-lock-btn${rot.locked ? ' rot-locked' : ''}" onclick="event.stopPropagation();_rotToggleGroupLock('${gid}')" title="${rot.locked ? 'Déverrouiller' : 'Verrouiller'} la rotation">${rot.locked ? '🔒' : '🔓'}</button>
      <button class="rot-copy-btn" onclick="event.stopPropagation();_rotCopyGroup('${gid}')" title="Copier la rotation">📋</button>
      <button class="rot-gen-btn" onclick="event.stopPropagation();_rotShuffleGroup('${gid}')" title="Générer une nouvelle rotation pour ce groupe">🎲</button>
      <button class="rot-add-btn" onclick="event.stopPropagation();_rotAddGroupMember('${gid}')" title="Ajouter un membre">+ Membre</button>` : ''}
    </div>
    ${!collapsed ? `<div class="rot-table-wrap">
      <table class="rot-table">
        <thead><tr><th class="rot-member-th">Membre</th>${weekHeaders}</tr></thead>
        <tbody>${memberRows}
          <tr class="rot-count-row"><td class="rot-member rot-count-label">Total</td>${countCells}</tr>
          <tr class="rot-capa-row"><td class="rot-member rot-count-label">Capacité</td>${capaCells}</tr>
        </tbody>
      </table>
      <div class="rot-capa-legend">
        <span class="legend-ok">&ge;80%</span>
        <span class="legend-mid">60-80%</span>
        <span class="legend-warn">&lt;60%</span>
      </div>
      ${_rotAddingGroup === gid ? _rotAddGroupInputHtml(gid) : ''}
    </div>` : ''}
  </div>`;
}

// ============================================================
// Rotation groupée — fonctions de contrôle
// ============================================================

function _rotToggleGroupPanel(gid) {
  _rotGroupCollapsed[gid] = !(_rotGroupCollapsed[gid] ?? false);
  _rotRefreshGroup(gid);
}

function _rotRefreshGroup(gid) {
  const el = document.getElementById(`rot-group-${gid}`);
  if (!el) return;
  const group = GROUPS.find(g => g.id === gid);
  if (!group) return;
  el.outerHTML = _rotGroupPanel(group);
}

function _rotShuffleGroup(gid) {
  const group = GROUPS.find(g => g.id === gid);
  if (!group) return;
  const k = _rotGroupKey(gid);
  if (_supportRotation[k]?.locked) {
    const panel = document.getElementById('rot-group-' + gid);
    if (panel) { panel.classList.add('rot-locked-flash'); setTimeout(() => panel.classList.remove('rot-locked-flash'), 5000); }
    if (typeof showToast === 'function') showToast(`🔒 ${group.name} est verrouillé`, 'warning');
    return;
  }
  _rotParseAbsencesLive();
  const totalWeeks = _piWeeks();
  const members = _rotGroupMembers(group);
  if (!members.length) return;
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 2, weeks: {} };
  const mpw = _supportRotation[k].membersPerWeek || 2;
  const weeks = {};
  const counts = {};
  members.forEach(m => counts[m] = 0);

  const weekInfos = _rotWeekInfos(null, _supportRotation[k].weekMode || 'friday');
  for (let wi = 0; wi < totalWeeks; wi++) {
    const w = weekInfos[wi];
    const wd = w?.workDays ?? 5;
    const available = members.filter(m => {
      const abs = _getAbsDaysForRange(m, w._start, w._end);
      if (abs >= wd / 2) return false;
      return (wd - abs) >= 1;
    });
    available.sort((a, b) => {
      const aAbs = _getAbsDaysForRange(a, w._start, w._end);
      const bAbs = _getAbsDaysForRange(b, w._start, w._end);
      const aPresent = wd - aAbs;
      const bPresent = wd - bAbs;
      const aFull = aAbs === 0 ? 0 : 1;
      const bFull = bAbs === 0 ? 0 : 1;
      if (aFull !== bFull) return aFull - bFull;
      if (counts[a] !== counts[b]) return counts[a] - counts[b];
      if (aPresent !== bPresent) return bPresent - aPresent;
      return Math.random() - 0.5;
    });
    const picked = available.slice(0, Math.min(mpw, available.length));
    weeks[wi] = picked;
    picked.forEach(m => counts[m]++);
  }

  _supportRotation[k].weeks = weeks;
  _saveRotation();
  _rotRefreshGroup(gid);
  if (typeof showToast === 'function') showToast(`🔄 Rotation générée pour ${group.name}`, 'success');
}

function _rotSetGroupMPW(gid, n) {
  const k = _rotGroupKey(gid);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 2, weeks: {} };
  _supportRotation[k].membersPerWeek = Math.max(1, Math.min(10, n));
  _saveRotation();
  renderSettings();
}

function _rotSetGroupWeekMode(gid, mode) {
  const k = _rotGroupKey(gid);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 2, weeks: {} };
  _supportRotation[k].weekMode = mode;
  _supportRotation[k].weeks = {};
  _saveRotation();
  _rotRefreshGroup(gid);
}

function _rotToggleGroupMember(gid, wi, member) {
  const k = _rotGroupKey(gid);
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 2, weeks: {} };
  const weeks = _supportRotation[k].weeks;
  if (!weeks[wi]) weeks[wi] = [];
  const arr = weeks[wi];
  const idx = arr.indexOf(member);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(member);
  _saveRotation();
  _rotRefreshGroup(gid);
}

function _rotToggleGroupLock(gid) {
  const k = _rotGroupKey(gid);
  if (!_supportRotation[k]) _supportRotation[k] = { weeks: {} };
  _supportRotation[k].locked = !_supportRotation[k].locked;
  _saveRotation();
  _rotRefreshGroup(gid);
}

function _rotCopyGroup(gid) {
  const group = GROUPS.find(g => g.id === gid);
  if (!group) return;
  const rot = _supportRotation[_rotGroupKey(gid)] || { weeks: {} };
  const weekInfos = _rotWeekInfos(null, rot.weekMode || 'friday');
  const lines = [];
  lines.push(`**${group.name}** (${group.teams.length} équipes)`);
  lines.push('');
  for (let wi = 0; wi < weekInfos.length; wi++) {
    const w = weekInfos[wi];
    const members = rot.weeks[wi] || [];
    const datePart = w.dateRange ? ` (${w.dateRange.replace(' → ', '– ')})` : '';
    lines.push(`* 🟦 Itération ${w.label}${datePart}`);
    if (members.length) {
      lines.push(`    * ${members.map(m => '@' + m).join(', ')}`);
    } else {
      lines.push(`    * (aucun)`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') showToast('📋 Rotation groupe copiée !', 'success');
  });
}

function _rotAddGroupMember(gid) {
  if (_rotAddingGroup === gid) { _rotAddingGroup = null; _rotRefreshGroup(gid); return; }
  _rotAddingGroup = gid;
  _rotRefreshGroup(gid);
  setTimeout(() => {
    const inp = document.getElementById(`rot-add-input-group-${gid}`);
    if (inp) inp.focus();
  }, 30);
}

function _rotConfirmAddGroup(gid) {
  const inp = document.getElementById(`rot-add-input-group-${gid}`);
  const name = inp?.value?.trim();
  if (!name) return;
  // Add member to the first team in the group that exists
  const group = GROUPS.find(g => g.id === gid);
  if (!group || !group.teams.length) return;
  const targetTeam = group.teams[0];
  if (!_rotExtraMembers[targetTeam]) _rotExtraMembers[targetTeam] = [];
  if (!_rotExtraMembers[targetTeam].includes(name)) _rotExtraMembers[targetTeam].push(name);
  const hk = _rotTeamKey(targetTeam);
  if (_rotHiddenMembers[hk]) {
    _rotHiddenMembers[hk] = _rotHiddenMembers[hk].filter(m => m !== name);
  }
  _supSave();
  _rotAddingGroup = null;
  _rotRefreshGroup(gid);
  if (typeof showToast === 'function') showToast(`✅ ${name} ajouté via ${CONFIG.teams[targetTeam]?.name || targetTeam}`, 'success');
}

function _rotAddGroupInputKeydown(e, gid) {
  if (e.key === 'Enter') { e.preventDefault(); _rotConfirmAddGroup(gid); }
  if (e.key === 'Escape') { _rotAddingGroup = null; _rotRefreshGroup(gid); }
}

function _rotGroupSuggestions(gid) {
  const group = GROUPS.find(g => g.id === gid);
  if (!group) return [];
  const current = new Set(_rotGroupMembers(group));
  const suggestions = [];
  // From all MEMBERS (all teams)
  Object.entries(MEMBERS).forEach(([t, ms]) => {
    ms.forEach(m => { if (!current.has(m) && !suggestions.includes(m)) suggestions.push(m); });
  });
  // From extra members
  Object.entries(_rotExtraMembers).forEach(([t, ms]) => {
    ms.forEach(m => { if (!current.has(m) && !suggestions.includes(m)) suggestions.push(m); });
  });
  // From absences data names
  _rotAbsAllNames.forEach(absName => {
    const origName = _normalizeExcelName(absName);
    if (!current.has(origName) && !suggestions.includes(origName)) suggestions.push(origName);
  });
  suggestions.sort((a, b) => a.localeCompare(b, 'fr'));
  return suggestions;
}

function _rotAddGroupInputHtml(gid) {
  const suggestions = _rotGroupSuggestions(gid);
  const listId = `rot-add-list-group-${gid}`;
  return `<div class="rot-add-row">
    <input id="rot-add-input-group-${gid}" type="text" class="rot-add-input" placeholder="Nom du membre…"
      list="${listId}" autocomplete="off"
      onkeydown="_rotAddGroupInputKeydown(event,'${gid}')">
    <datalist id="${listId}">
      ${suggestions.map(s => `<option value="${s}">`).join('')}
    </datalist>
    <button class="rot-add-confirm" onclick="_rotConfirmAddGroup('${gid}')" title="Ajouter">✓</button>
    <button class="rot-add-cancel" onclick="_rotAddingGroup=null;_rotRefreshGroup('${gid}')" title="Annuler">✕</button>
  </div>`;
}

// Toggle activation/désactivation d'un groupe de rotation
function _rotToggleGroupRotation(gid) {
  const k = _rotGroupKey(gid);
  if (_supportRotation[k]) {
    delete _supportRotation[k];
  } else {
    _supportRotation[k] = { membersPerWeek: 2, weeks: {} };
  }
  _saveRotation();
  renderSettings();
}

function _rotTeamPanel(team) {
  const members = _rotTeamMembers(team);
  if (!members.length) return '';
  const color = _teamColor(team);
  const name  = CONFIG.teams[team]?.name || team;
  const rot   = _supportRotation[_rotTeamKey(team)] || { membersPerWeek: 3, weeks: {} };
  const mpw   = rot.membersPerWeek || 3;
  const wMode = rot.weekMode || 'friday';
  const weekInfos = _rotWeekInfos(null, wMode);
  const totalWeeks = weekInfos.length;

  const weekHeaders = weekInfos.map(w => {
    const holTip = w.holidays.length ? ` title="${w.holidays.join(', ')}"` : '';
    const holBadge = w.holidays.length ? `<span class="rot-wk-hol"${holTip}>${w.holidays.length}j férié${w.holidays.length > 1 ? 's' : ''}</span>` : '';
    return `<th class="rot-wk-th"><span class="rot-wk-label">${w.label}</span>${w.dateRange ? `<span class="rot-wk-dates">${w.dateRange}</span>` : ''}${holBadge}</th>`;
  }).join('');

  const memberRows = members.map(m => {
    const cells = Array.from({ length: totalWeeks }, (_, wi) => {
      const selected = (rot.weeks[wi] || []).includes(m);
      const w = weekInfos[wi];
      const absDays = _getAbsDaysForRange(m, w._start, w._end);
      const absent = absDays >= (w.workDays || 5) / 2;
      const absentCls = absent ? ' rot-cell-absent' : absDays > 0 ? ' rot-cell-partial' : '';
      const absBadge = absDays > 0 ? `<span class="rot-abs-badge${absent ? ' rot-abs-full' : ''}" title="${absDays}j congé">${absDays % 1 ? absDays.toFixed(1).replace('.', ',') : absDays}j</span>` : '';
      return `<td class="rot-cell${absentCls}">
        ${absBadge}
        <button class="rot-chip${selected ? ' rot-chip-on' : ''}" style="${selected ? `background:${color}22;color:${color};border-color:${color}` : ''}"
          onclick="_rotToggleMember('${team}',${wi},'${m.replace(/'/g, "\\'")}')">${selected ? '✓' : ''}</button>
      </td>`;
    }).join('');
    const hasAbsData = _rotAbsAllNames.size > 0;
    let matchDot = '';
    if (hasAbsData) {
      const matched = _isMemberInAbsData(m);
      matchDot = `<span class="rot-member-match ${matched ? 'matched' : 'unmatched'}" title="${matched ? 'Congés référencés' : 'Non trouvé dans les congés'}"></span>`;
    }
    const isExtra = (_rotExtraMembers[team] || []).includes(m);
    const removeTip = isExtra ? 'Retirer ce membre ajouté manuellement' : 'Masquer ce membre';
    const removeBtn = `<button class="rot-member-rm" onclick="event.stopPropagation();_rotRemoveMember('${team}','${m.replace(/'/g, "\\'")}')" title="${removeTip}">×</button>`;
    return `<tr><td class="rot-member">${matchDot}${m}${removeBtn}</td>${cells}</tr>`;
  }).join('');

  // Week counts
  const countCells = Array.from({ length: totalWeeks }, (_, wi) => {
    const cnt = (rot.weeks[wi] || []).length;
    const ok  = cnt === mpw;
    return `<td class="rot-cell rot-count${ok ? '' : ' rot-count-warn'}">${cnt}/${mpw}</td>`;
  }).join('');

  // Capacity row: total available person-days per week
  const capaCells = Array.from({ length: totalWeeks }, (_, wi) => {
    const w = weekInfos[wi];
    const wd = w?.workDays ?? 5;
    let totalAbs = 0;
    members.forEach(m => { totalAbs += _getAbsDaysForRange(m, w._start, w._end); });
    const totalCap = members.length * wd;
    const availCap = Math.max(0, totalCap - totalAbs);
    const pct = totalCap > 0 ? Math.round(availCap / totalCap * 100) : 100;
    const warn = pct < 60 ? ' rot-capa-warn' : pct < 80 ? ' rot-capa-mid' : '';
    return `<td class="rot-cell rot-capa${warn}" title="${availCap}/${totalCap} jours dispo (${pct}%)">${availCap}j <span class="rot-capa-pct">${pct}%</span></td>`;
  }).join('');

  const activeTeams = typeof getActiveTeams === 'function' ? getActiveTeams() : [];
  const isActive = activeTeams.length === 0 || activeTeams.includes(team);
  const collapsed = _rotTeamCollapsed[team] ?? !isActive;
  const filledWeeks = Object.keys(rot.weeks).filter(wi => (rot.weeks[wi] || []).length > 0).length;
  const correctWeeks = Object.keys(rot.weeks).filter(wi => (rot.weeks[wi] || []).length === mpw).length;
  const weeksPct = totalWeeks > 0 ? Math.round(filledWeeks / totalWeeks * 100) : 0;
  const weeksOk = filledWeeks === totalWeeks;
  const correctOk = correctWeeks === totalWeeks;
  const summaryWeeksCls = weeksOk && correctOk ? 'rot-sum-ok' : filledWeeks > 0 ? 'rot-sum-partial' : 'rot-sum-empty';
  const summary = collapsed ? `<span class="rot-team-summary">
    <span class="rot-sum-pill rot-sum-members">${members.length} membre${members.length > 1 ? 's' : ''}</span>
    <span class="rot-sum-pill ${summaryWeeksCls}">${filledWeeks}/${totalWeeks} sem.</span>
    ${!correctOk && filledWeeks > 0 ? `<span class="rot-sum-pill rot-sum-partial">${correctWeeks}/${totalWeeks} complet${correctWeeks > 1 ? 's' : ''}</span>` : ''}
    <span class="rot-sum-bar"><span class="rot-sum-fill ${summaryWeeksCls}" style="width:${weeksPct}%"></span></span>
  </span>` : '';

  return `<div class="rot-team-panel" id="rot-team-${team}" style="border-left:3px solid ${color}">
    <div class="rot-team-hdr" onclick="_rotToggleTeam('${team}')" style="cursor:pointer;">
      <span class="rot-team-chevron">${collapsed ? '▶' : '▼'}</span>
      <span class="rot-team-dot" style="background:${color}"></span>
      <span class="rot-team-name">${name}</span>
      ${summary}
      ${!collapsed ? `<label class="rot-mpw-label" onclick="event.stopPropagation()">Effectif / sem. :
        <input type="number" min="1" max="10" value="${mpw}" class="rot-mpw-input"
          onchange="_rotSetMembersPerWeek('${team}',+this.value)">
      </label>
      <span class="rot-wmode" onclick="event.stopPropagation()" title="Mode semaine support">
        <button class="rot-wmode-btn${wMode === 'friday' ? ' rot-wmode-on' : ''}" onclick="_rotSetWeekMode('${team}','friday')">Ven→Jeu</button>
        <button class="rot-wmode-btn${wMode === 'monday' ? ' rot-wmode-on' : ''}" onclick="_rotSetWeekMode('${team}','monday')">Lun→Ven</button>
        <button class="rot-wmode-btn${wMode === 'wednesday' ? ' rot-wmode-on' : ''}" onclick="_rotSetWeekMode('${team}','wednesday')">Mer→Mar</button>
      </span>
      <button class="rot-lock-btn${rot.locked ? ' rot-locked' : ''}" onclick="event.stopPropagation();_rotToggleLock('${team}')" title="${rot.locked ? 'Déverrouiller' : 'Verrouiller'} la rotation">${rot.locked ? '🔒' : '🔓'}</button>
      <button class="rot-copy-btn" onclick="event.stopPropagation();_rotCopyTeam('${team}')" title="Copier la rotation">📋</button>
      <button class="rot-gen-btn" onclick="event.stopPropagation();_rotShuffleTeam('${team}')" title="Générer une nouvelle rotation pour cette équipe">🎲</button>
      <button class="rot-add-btn" onclick="event.stopPropagation();_rotAddMember('${team}')" title="Ajouter un membre">+ Membre</button>` : ''}
    </div>
    ${!collapsed ? `<div class="rot-table-wrap">
      <table class="rot-table">
        <thead><tr><th class="rot-member-th">Membre</th>${weekHeaders}</tr></thead>
        <tbody>${memberRows}
          <tr class="rot-count-row"><td class="rot-member rot-count-label">Total</td>${countCells}</tr>
          <tr class="rot-capa-row"><td class="rot-member rot-count-label">Capacité</td>${capaCells}</tr>
        </tbody>
      </table>
      <div class="rot-capa-legend">
        <span class="legend-ok">&ge;80%</span>
        <span class="legend-mid">60-80%</span>
        <span class="legend-warn">&lt;60%</span>
      </div>
      ${_rotAddingTeam === team ? _rotAddInputHtml(team) : ''}
    </div>` : ''}
  </div>`;
}

function _rotToggleLock(team) {
  const k = _rotTeamKey(team);
  if (!_supportRotation[k]) _supportRotation[k] = { weeks: {} };
  _supportRotation[k].locked = !_supportRotation[k].locked;
  _saveRotation();
  _rotRefreshTeam(team);
}

function _rotShuffleTeam(team) {
  const k = _rotTeamKey(team);
  if (_supportRotation[k]?.locked) {
    // Highlight orange vif pendant 5s
    const panel = document.getElementById('rot-team-' + team);
    if (panel) { panel.classList.add('rot-locked-flash'); setTimeout(() => panel.classList.remove('rot-locked-flash'), 5000); }
    if (typeof showToast === 'function') showToast(`🔒 ${CONFIG.teams[team]?.name || team} est verrouillée`, 'warning');
    return;
  }
  _rotParseAbsencesLive();
  const totalWeeks = _piWeeks();
  const members = _rotTeamMembers(team);
  if (!members.length) return;
  if (!_supportRotation[k]) _supportRotation[k] = { membersPerWeek: 3, weeks: {} };
  const mpw = _supportRotation[k].membersPerWeek || 3;
  const weeks = {};
  const counts = {};
  members.forEach(m => counts[m] = 0);

  const weekInfos = _rotWeekInfos(null, _supportRotation[k].weekMode || 'friday');
  for (let wi = 0; wi < totalWeeks; wi++) {
    const w = weekInfos[wi];
    const wd = w?.workDays ?? 5;
    // Filter: exclude fully absent AND members with < 1 day present
    const available = members.filter(m => {
      const abs = _getAbsDaysForRange(m, w._start, w._end);
      if (abs >= wd / 2) return false; // majority absent
      return (wd - abs) >= 1; // at least 1 working day present
    });
    // Sort by effective availability, then by assignment balance
    available.sort((a, b) => {
      const aAbs = _getAbsDaysForRange(a, w._start, w._end);
      const bAbs = _getAbsDaysForRange(b, w._start, w._end);
      const aPresent = wd - aAbs;
      const bPresent = wd - bAbs;
      // Primary: prefer members who are fully present (0 abs) over partial
      const aFull = aAbs === 0 ? 0 : 1;
      const bFull = bAbs === 0 ? 0 : 1;
      if (aFull !== bFull) return aFull - bFull;
      // Secondary: fewest assignments so far (balance workload)
      if (counts[a] !== counts[b]) return counts[a] - counts[b];
      // Tertiary: more present days preferred
      if (aPresent !== bPresent) return bPresent - aPresent;
      // Quaternary: random
      return Math.random() - 0.5;
    });
    const picked = available.slice(0, Math.min(mpw, available.length));
    weeks[wi] = picked;
    picked.forEach(m => counts[m]++);
  }

  _supportRotation[k].weeks = weeks;
  _saveRotation();
  _rotRefreshTeam(team);
  if (typeof showToast === 'function') showToast(`🔄 Rotation générée pour ${CONFIG.teams[team]?.name || team}`, 'success');
}

function _rotShuffle() {
  const btn = document.querySelector('[onclick="_rotShuffle()"]');
  const origHtml = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="rot-spinner"></span> Génération…'; }
  setTimeout(() => {
    _rotParseAbsencesLive();
    const realTeams = _stgLiveTeams([...new Set([
      ...Object.keys(CONFIG.teams),
      ...GROUPS.flatMap(g => g.teams),
    ])].sort());
    for (const team of realTeams) _rotShuffleTeam(team);
    GROUPS.filter(g => _supportRotation[_rotGroupKey(g.id)]).forEach(g => _rotShuffleGroup(g.id));
    const piLabel = _rotWeekInfos()._piNum || '?';
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    if (typeof showToast === 'function') showToast(`🔄 Rotation PI ${piLabel} générée pour toutes les équipes !`, 'success');
  }, 50);
}

// _parseAbsences, _normalizeExcelName, _normalizeAbsTeam, _fuzzyNameMatch,
// _findAbsKey, _isAbsent, _getAbsDays, _isMemberInAbsData → absences.js

// _rotParseAbsencesLive → absences.js

function _rotCopyTeam(team) {
  const rot = _supportRotation[_rotTeamKey(team)] || { weeks: {} };
  const weekInfos = _rotWeekInfos(null, rot.weekMode || 'friday');
  const lines = [];
  for (let wi = 0; wi < weekInfos.length; wi++) {
    const w = weekInfos[wi];
    const members = rot.weeks[wi] || [];
    const datePart = w.dateRange ? ` (${w.dateRange.replace(' → ', '– ')})` : '';
    lines.push(`* 🟦 Itération ${w.label}${datePart}`);
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
  const realTeams = _stgLiveTeams([...new Set([
    ...Object.keys(CONFIG.teams),
    ...GROUPS.flatMap(g => g.teams),
  ])].sort());
  for (const team of realTeams) {
    const k = _rotTeamKey(team);
    if (_supportRotation[k]) _supportRotation[k].weeks = {};
  }
  // Clear group rotation keys
  Object.keys(_supportRotation).forEach(k => {
    if (k.startsWith('GROUP_')) {
      _supportRotation[k].weeks = {};
    }
  });
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
  { id: 'rotation',  icon: '🔄', label: 'Support' },
  { id: 'events',    icon: '💥', label: 'Faits marquants' },
  { id: 'absences', icon: '📋', label: 'Absences' },
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
  setTimeout(() => {
    const container = document.getElementById('content') || document.documentElement;
    const rect = sec.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const offset = (document.getElementById('stg-tabs')?.offsetHeight || 0) + (document.getElementById('topbar')?.offsetHeight || 0) + 16;
    container.scrollBy({ top: rect.top - contRect.top - offset, behavior: 'smooth' });
    sec.classList.add('pi-highlight');
    setTimeout(() => sec.classList.remove('pi-highlight'), 3000);
  }, 50);
  document.querySelectorAll('.stg-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === id));
  if (typeof _pushHash === 'function') _pushHash();
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
      const prev = tabs.querySelector('.stg-tab.active')?.dataset.sec;
      tabs.querySelectorAll('.stg-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === activeId));
      if (activeId !== prev && typeof _pushHash === 'function') _pushHash();
    }
  };
  content.addEventListener('scroll', handler, { passive: true });
  _stgSpyCleanup = () => content.removeEventListener('scroll', handler);
  handler();
}

// ============================================================
// Section 'Faits marquants' dans les parametres
// ============================================================
function _eventsSectionHtml() {
  const events = _eventsList();
  const fmt = d => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); };
  const rows = events.map(ev => {
    const t = _EVENT_TYPES[ev.type] || _EVENT_TYPES.other;
    const isPeriod = ev.startDate && ev.endDate && ev.startDate !== ev.endDate;
    const dateHtml = isPeriod
      ? `${fmt(ev.startDate)} → ${fmt(ev.endDate)}`
      : fmt(ev.startDate || ev.date);
    const teamsLabel = ev.teams && ev.teams.length ? ev.teams.join(', ') : 'Toutes les équipes';
    return `<div class="stg-event-row" style="border-left:3px solid ${t.color}">
      <div class="stg-event-main">
        <div class="stg-event-hdr">
          <span class="stg-event-icon">${t.icon}</span>
          <span class="stg-event-type" style="color:${t.color}">${t.label}</span>
          <span class="stg-event-date">${dateHtml}</span>
          <span class="stg-event-teams">${escapeHtml(teamsLabel)}</span>
        </div>
        <div class="stg-event-title">${escapeHtml(ev.title || '(sans titre)')}</div>
        ${ev.description ? `<div class="stg-event-desc">${escapeHtml(ev.description)}</div>` : ''}
      </div>
      <button class="stg-event-del" onclick="_eventDelete('${ev.id}')" title="Supprimer">🗑️</button>
    </div>`;
  }).join('');

  return `
  <div class="settings-section stg-full-width" id="stg-sec-events">
    ${_sectionHeader('events', '💥', 'Faits marquants', `${events.length} événement${events.length > 1 ? 's' : ''}`)}
    ${!_settingsCollapsed['events'] ? `<div class="stg-body">
      <div class="stg-event-form">
        <div class="stg-event-form-title">➕ Ajouter un fait marquant</div>
        <div class="stg-grid-4">
          <div class="form-group">
            <label>Type</label>
            <select id="stg-event-type">
              ${Object.entries(_EVENT_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Date début</label>
            <input type="date" id="stg-event-start" required>
          </div>
          <div class="form-group">
            <label>Date fin (optionnelle)</label>
            <input type="date" id="stg-event-end" placeholder="Laisser vide si 1 jour">
          </div>
          <div class="form-group">
            <label>Équipes (vide = toutes)</label>
            <input type="text" id="stg-event-teams" placeholder="ex: Fuego, Gabbiano">
          </div>
        </div>
        <div class="stg-grid-2" style="margin-top:6px;">
          <div class="form-group">
            <label>Titre</label>
            <input type="text" id="stg-event-title" placeholder="Incident prod, Gel de code, etc." required>
          </div>
          <div class="form-group">
            <label>Description (optionnelle)</label>
            <input type="text" id="stg-event-desc" placeholder="Contexte, impact...">
          </div>
        </div>
        <button class="btn btn-primary stg-btn-sm" style="margin-top:8px;" onclick="_eventAddFromForm()">💾 Ajouter</button>
      </div>
      <div class="stg-event-list">
        ${events.length ? rows : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">Aucun fait marquant — ajoutez-en pour les visualiser dans les charts Scrum.</div>'}
      </div>
    </div>` : ''}
  </div>`;
}

function _eventAddFromForm() {
  const type = document.getElementById('stg-event-type').value;
  const startDate = document.getElementById('stg-event-start').value;
  const endDate = document.getElementById('stg-event-end').value || '';
  const title = document.getElementById('stg-event-title').value.trim();
  const description = document.getElementById('stg-event-desc').value.trim();
  const teamsRaw = document.getElementById('stg-event-teams').value.trim();
  if (!startDate || !title) {
    if (typeof showToast === 'function') showToast('Date de début et titre requis', 'error');
    return;
  }
  const teams = teamsRaw ? teamsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  _eventAdd({ type, startDate, endDate: endDate || startDate, title, description, teams });
  if (typeof showToast === 'function') showToast(`✅ Fait marquant ajouté : ${title}`, 'success');
  renderSettings();
}

function renderSettings() {
  // Load supports.json on first render
  if (!_supLoaded) {
    _supLoad().then(() => {
      _rotLoadAbsForPI();
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
  <div class="settings-section stg-compact stg-full-width" id="stg-sec-apparence">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:700;">🎨 Apparence</span>
      <label class="theme-toggle" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;">
        <span>${isDark ? '🌙 Sombre' : '☀️ Clair'}</span>
        <div class="stg-toggle-track" style="background:${isDark ? 'var(--primary)' : '#CBD5E1'}">
          <div class="stg-toggle-thumb" style="${isDark ? 'left:20px' : 'left:2px'}"></div>
          <input type="checkbox" ${isDark ? 'checked' : ''} onchange="toggleDarkMode(this);renderSettings();">
        </div>
      </label>
    </div>
  </div>

  <!-- Connexion JIRA -->
  <div class="settings-section stg-full-width" id="stg-sec-jira">
    ${_sectionHeader('jira', '🔗', 'Connexion JIRA', CONFIG.jira.url !== 'https://votre-jira.atlassian.net' ? '✅ Configuré' : '⚠️ Non configuré')}
    ${!_settingsCollapsed['jira'] ? `<div class="stg-body">
      <div class="stg-grid-3">
        <div class="form-group"><label>URL JIRA</label><input type="text" value="${CONFIG.jira.url}"/></div>
        <div class="form-group"><label>Projets (virgule)</label><input type="text" value="${(CONFIG.jira.projects || []).join(', ')}"/></div>
        <div class="form-group"><label>API Token</label><input type="password" value="${CONFIG.jira.hasToken ? '••••••••' : ''}" placeholder="Configuré dans .env" disabled title="Le token est géré côté serveur (fichier .env)"/></div>
      </div>
      <div class="stg-grid-2" style="margin-top:6px;">
        <div class="form-group"><label>Durée Sprint (jours)</label><input type="number" value="${CONFIG.sprint.durationDays}"/></div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-primary stg-btn-sm" id="stg-jira-test-btn" onclick="_stgTestJira()">🔌 Tester</button>
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Paramètres de synchronisation -->
  <div class="settings-section stg-full-width" id="stg-sec-sync">
    ${_sectionHeader('sync', '⚙️', 'Synchronisation', '')}
    ${!_settingsCollapsed['sync'] ? `<div class="stg-body">
      <div class="stg-kv-grid">
        <div class="stg-kv">
          <label>Boards par page <span class="stg-info" data-tip="Nombre max de boards JIRA récupérés par requête. Augmentez si certaines équipes ne sont pas détectées.">i</span></label>
          <input type="number" value="${sc.maxBoardsPerPage}" onchange="_stgSave('sync.maxBoardsPerPage',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Issues max / sprint <span class="stg-info" data-tip="Nombre max de tickets récupérés par sprint. Augmentez si des tickets manquent dans le board.">i</span></label>
          <input type="number" value="${sc.maxIssuesPerSprint}" onchange="_stgSave('sync.maxIssuesPerSprint',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Sprints historiques <span class="stg-info" data-tip="Nombre de sprints fermés analysés par équipe pour calculer la vélocité et l'historique. Ex : 5 → les 5 derniers sprints terminés seront récupérés pour chaque board.">i</span></label>
          <input type="number" value="${sc.velocityHistoryCount}" onchange="_stgSave('sync.velocityHistoryCount',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>PIs historiques <span class="stg-info" data-tip="Nombre de PIs futurs à scanner en plus du PI courant (ex: 3 → PI actuel + PI+1 + PI+2 + PI+3).">i</span></label>
          <input type="number" value="${sc.piHistoryCount}" onchange="_stgSave('sync.piHistoryCount',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Issues max vélocité <span class="stg-info" data-tip="Limite de tickets dans la requête JQL pour le calcul de vélocité. Augmentez pour les gros projets.">i</span></label>
          <input type="number" value="${sc.velocityMaxIssues}" onchange="_stgSave('sync.velocityMaxIssues',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Issues max PI (JQL) <span class="stg-info" data-tip="Nombre max de tickets récupérés par la requête JQL PI (sprint IN 'PI#XX'). Paginé par pages de 100. Augmentez si des features PI manquent.">i</span></label>
          <input type="number" value="${sc.maxPIIssues}" onchange="_stgSave('sync.maxPIIssues',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>PIs futurs <span class="stg-info" data-tip="Nombre de PIs futurs à synchroniser. Ex: 2 → PI courant + PI+1 + PI+2. Utile pour la préparation PI Planning.">i</span></label>
          <input type="number" value="${sc.piFutureCount}" onchange="_stgSave('sync.piFutureCount',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Epics orphelines max <span class="stg-info" data-tip="Nombre max d'epics sans tickets à résoudre. Utilisé pour compléter les epics référencées mais absentes du sprint.">i</span></label>
          <input type="number" value="${sc.maxEpicsResolve}" onchange="_stgSave('sync.maxEpicsResolve',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Sprints fermés <span class="stg-info" data-tip="Nombre max de sprints fermés récupérés par board (fallback). Couvre le cas où l'API retourne plus de sprints que nécessaire.">i</span></label>
          <input type="number" value="${sc.closedSprintsFetch}" onchange="_stgSave('sync.closedSprintsFetch',+this.value)" class="stg-kv-num">
        </div>
        <div class="stg-kv">
          <label>Champ Sprint <span class="stg-info" data-tip="ID du custom field JIRA contenant les sprints (ex: customfield_10020). Détecté automatiquement à la première sync.">i</span></label>
          <input type="text" value="${sc.sprintField}" onchange="_stgSave('sync.sprintField',this.value)" class="stg-kv-text">
        </div>
      </div>
      <div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:12px;font-weight:600;">
          <div class="stg-toggle-track" style="background:${sc.enrichClosedSprints ? 'var(--primary)' : '#CBD5E1'}">
            <div class="stg-toggle-thumb" style="${sc.enrichClosedSprints ? 'left:20px' : 'left:2px'}"></div>
            <input type="checkbox" ${sc.enrichClosedSprints ? 'checked' : ''} onchange="_stgSave('sync.enrichClosedSprints',this.checked);renderSettings();">
          </div>
          <span>Enrichir les tickets des sprints fermés</span>
        </label>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;margin-left:50px;">Stocke la description, priorité, labels et commentaires des tickets d'itérations passées. Augmente la taille du cache d'environ 30%. Nécessite une re-synchronisation.</div>
      </div>
    </div>` : ''}
  </div>

  <!-- Alertes sprint -->
  <div class="settings-section" id="stg-sec-alerts" class="stg-full-width">
    ${_sectionHeader('alerts', '🔔', 'Alertes Sprint', '')}
    ${!_settingsCollapsed['alerts'] ? `<div class="stg-body">
      <div class="stg-alert-group">
        <div class="stg-alert-header">⏳ Avant fin de sprint</div>
        <div class="stg-alert-row">
          <span class="stg-alert-icon">🎬</span>
          <span class="stg-alert-label">Préparation démo <span class="stg-info" data-tip="Affiche un rappel dans la sprint-bar de la vue Scrum pour préparer la démo de fin de sprint. Ex : J-1 → le rappel apparaît la veille de la fin du sprint. Cochez le rituel pour le masquer.">i</span></span>
          <span class="stg-alert-jx">J-</span>
          <input type="number" class="stg-alert-num" min="0" max="7" value="${CONFIG.alerts?.demoDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.demoDays=+this.value;">
        </div>
        <div class="stg-alert-row">
          <span class="stg-alert-icon">😊</span>
          <span class="stg-alert-label">Mood meter <span class="stg-info" data-tip="Affiche un rappel dans la sprint-bar (vue Scrum) pour lancer le sondage de satisfaction d'équipe (ROTI). Le panel Mood se trouve dans la barre du sprint en haut de la vue Scrum.">i</span></span>
          <span class="stg-alert-jx">J-</span>
          <input type="number" class="stg-alert-num" min="0" max="7" value="${CONFIG.alerts?.moodDays ?? 2}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.moodDays=+this.value;">
        </div>
      </div>
      <div class="stg-alert-group">
        <div class="stg-alert-header">🚀 Après début de sprint</div>
        <div class="stg-alert-row">
          <span class="stg-alert-icon">🗳️</span>
          <span class="stg-alert-label">Vote de confiance <span class="stg-info" data-tip="Affiche un rappel dans la sprint-bar (vue Scrum) pour réaliser le Fist of Five en début de sprint. Les votes se gèrent dans PI Planning > ✋ Fist of Five et sont aussi visibles dans Roadmap.">i</span></span>
          <span class="stg-alert-jx">J+</span>
          <input type="number" class="stg-alert-num" min="0" max="7" value="${CONFIG.alerts?.voteDays ?? 1}" onchange="if(!CONFIG.alerts)CONFIG.alerts={};CONFIG.alerts.voteDays=+this.value;">
        </div>
      </div>
    </div>` : ''}
  </div>

  <!-- Équipes -->
  <div class="settings-section" id="stg-sec-teams" class="stg-full-width">
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
        // Reasons for being inactive
        const _inactiveReasons = [];
        if (inactive) {
          if (cfg.inactive) _inactiveReasons.push('Marquée inactive dans la config');
          if (!cfg.sprintName) _inactiveReasons.push('Pas de sprint configuré (sprintName)');
          const hasTickets = TICKETS.some(t => t.team === team);
          if (!hasTickets) _inactiveReasons.push('Aucun ticket trouvé dans le sprint actif');
          if (!cfg.boardId) _inactiveReasons.push('Pas de board JIRA associé (boardId)');
          if (!_inactiveReasons.length) _inactiveReasons.push('Non détectée par la synchronisation');
        }
        const _inactiveTip = _inactiveReasons.join(' · ');
        return `<div class="stg-team-card${inactive ? ' stg-inactive' : ''}" style="border-left:3px solid ${color}">
          <div class="stg-team-header">
            <span class="stg-team-name" style="color:${color}">${team}</span>
            ${inactive ? `<span class="stg-badge-inactive stg-info" data-tip="${_inactiveTip}">inactif</span>` : ''}
            <span class="stg-team-meta">${members.length} membres · ${velocity} pts</span>
          </div>
          <div class="stg-team-details">
            <span class="stg-chip" title="Sprint">${sprintN || '-'}</span>
            <span class="stg-chip" title="Board ID">Board ${boardId || '-'}</span>
            <span class="stg-chip" title="Projet">${projKey || '-'}</span>
            <input type="color" value="${color}" class="stg-color-input"
              onchange="if(CONFIG.teams['${team}'])CONFIG.teams['${team}'].color=this.value;" title="Couleur">
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}
  </div>

  <!-- Groupes -->
  <div class="settings-section" id="stg-sec-groups" class="stg-full-width">
    ${_sectionHeader('groups', '🗂️', 'Groupes', `${GROUPS.length} groupes`)}
    ${!_settingsCollapsed['groups'] ? `<div class="stg-body">
      <div id="groups-config-list">${GROUPS.map((g, gi) => {
        const isEmpty = !g.teams.length;
        const dupes = GROUPS.filter((o, oi) => oi !== gi && o.name.trim().toLowerCase() === g.name.trim().toLowerCase());
        return `
      <div class="stg-group-card" id="group-cfg-${g.id}" style="border-left:3px solid ${g.color}">
        <div class="stg-group-header">
          <span class="group-dot" style="background:${g.color};width:10px;height:10px;border-radius:3px;"></span>
          <input type="text" class="stg-group-name-input" value="${g.name}" onchange="GROUPS[${gi}].name=this.value;renderGroupBtns();">
          <input type="color" value="${g.color}" class="stg-color-input"
            onchange="GROUPS[${gi}].color=this.value;renderGroupBtns();document.getElementById('group-cfg-${g.id}').style.borderLeftColor=this.value;">
          <button class="stg-group-delete" onclick="_stgDeleteGroup(${gi})" title="Supprimer ce groupe">×</button>
        </div>
        <div class="stg-group-teams">
          ${_stgLiveTeams(realTeams).map(t =>
            `<label class="stg-team-check"><input type="checkbox" ${g.teams.includes(t) ? 'checked' : ''} onchange="toggleGroupTeam('${g.id}','${t}',this.checked)"><span>${t}</span></label>`
          ).join('')}
        </div>
        ${isEmpty ? '<div class="stg-group-empty">Aucune équipe sélectionnée</div>' : ''}
        ${dupes.length ? '<div class="stg-group-empty">Nom en doublon</div>' : ''}
      </div>`;
      }).join('')}
      </div>
      <button class="btn btn-secondary stg-btn-sm" style="margin-top:8px;" onclick="addGroup()">➕ Ajouter un groupe</button>
    </div>` : ''}
  </div>

  <!-- Notifications -->
  <div class="settings-section" id="stg-sec-notif" class="stg-full-width">
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
      <button class="btn btn-primary stg-btn-sm" onclick="showToast('✅ Paramètres sauvegardés !','success')" style="margin-top:6px;">💾 Sauvegarder</button>
    </div>` : ''}
  </div>

  <!-- Rotation Support -->
  <div class="settings-section rot-section" id="stg-sec-rotation" class="stg-full-width">
    <div class="rot-sticky-bar">
      ${_sectionHeader('rotation', '🔄', 'Rotation Support', '')}
      ${!_settingsCollapsed['rotation'] ? (() => {
        const wi0 = _rotWeekInfos();
        const currentPiNum = String(wi0._piNum || '');
        // Selecteur PI : meme source unique que piprep/roadmap (utils.js)
        const piOptions = typeof _piSelectOptions === 'function'
          ? _piSelectOptions(currentPiNum)
          : `<option>PI${currentPiNum}</option>`;
        return `<div class="rot-toolbar">
        <div class="rot-pi-selector">
          <label class="rot-pi-label">PI :</label>
          <select class="rm-pi-select" onchange="_rotSelectPI(this.value)">${piOptions}</select>
        </div>
        <div class="rot-group-selector">
          ${GROUPS.filter(g => g.teams.length > 1).map(g => {
            const gk = _rotGroupKey(g.id);
            const active = !!_supportRotation[gk];
            return `<button class="btn ${active ? 'btn-primary' : 'btn-secondary'} stg-btn-sm rot-group-toggle"
              onclick="_rotToggleGroupRotation('${g.id}')"
              style="border-left:3px solid ${g.color}">
              ${active ? '✓' : '+'} ${g.name}
            </button>`;
          }).join('')}
        </div>
        <button class="btn btn-primary stg-btn-sm" onclick="_rotShuffle()">🎲 Générer la rotation pour toutes les équipes</button>
        <button class="btn btn-secondary stg-btn-sm" onclick="_rotClearAll()">🗑️ Réinitialiser</button>
        <button class="stg-btn-info rot-algo-toggle" onclick="_rotToggleAlgoLegend()" title="Algorithme de génération">ℹ️ Algorithme</button>
      </div>
      <div class="rot-algo-legend" id="rot-algo-legend" style="display:none">
        <div class="rot-algo-title">Algorithme de génération 🎲</div>
        <ol class="rot-algo-steps">
          <li><strong>Exclusion</strong> — un membre est retiré de la semaine si :
            <ul>
              <li>ses jours de congé &ge; 50% des jours ouvrés de la semaine</li>
              <li><em>ou</em> il lui reste &lt; 1 jour ouvré présent (congés + fériés)</li>
            </ul>
          </li>
          <li><strong>Priorité 1 — Présence complète</strong> — les membres sans aucun congé dans la semaine sont choisis en premier</li>
          <li><strong>Priorité 2 — Équilibrage</strong> — parmi les candidats de même disponibilité, celui avec le moins d'assignations cumulées est choisi</li>
          <li><strong>Priorité 3 — Jours présents</strong> — à assignations égales, le membre avec le plus de jours ouvrés présents est préféré</li>
          <li><strong>Aléatoire</strong> — en dernier recours, tirage au sort</li>
        </ol>
      </div>`;
      })() : ''}
    </div>
    ${!_settingsCollapsed['rotation'] ? `<div class="stg-body">
      ${GROUPS.filter(g => _supportRotation[_rotGroupKey(g.id)]).map(g => _rotGroupPanel(g)).join('')}
      ${_stgLiveTeams(realTeams).map(t => _rotTeamPanel(t)).join('')}
    </div>` : ''}
  </div>

  <!-- Faits marquants (incidents, gels, jalons, périodes) -->
  ${_eventsSectionHtml()}

  <!-- Absences / Congés (rendered by absences.js) -->
  ${_absencesSectionHtml()}`;

  // Init scroll spy for tabs
  setTimeout(_stgInitScrollSpy, 100);
}

// --- Filter out demo-only teams (A, B, C, D) when real JIRA teams exist ---
function _stgLiveTeams(allTeams) {
  const live = allTeams.filter(t => {
    const cfg = CONFIG.teams[t] || {};
    return cfg.boardId || cfg.sprintName || (typeof MEMBERS !== 'undefined' && (MEMBERS[t] || []).length > 0);
  });
  return live.length > 0 ? live : allTeams;
}

// --- Toggle algo legend ---
function _rotToggleAlgoLegend() {
  const el = document.getElementById('rot-algo-legend');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// --- Real JIRA connectivity test ---
async function _stgTestJira() {
  const btn = document.getElementById('stg-jira-test-btn');
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="rot-spinner"></span> Test…';
  try {
    const url = CONFIG.jira.url;
    if (!url || url === 'https://votre-jira.atlassian.net') {
      showToast('URL JIRA non configurée', 'error');
      return;
    }
    const res = await fetch(`/jira/rest/api/3/myself`, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      showToast(`Connexion OK : ${data.displayName || data.emailAddress || 'Authentifié'}`, 'success');
    } else if (res.status === 401 || res.status === 403) {
      showToast(`Échec authentification (${res.status}) — vérifiez le token`, 'error');
    } else {
      showToast(`Erreur JIRA (${res.status})`, 'error');
    }
  } catch (err) {
    showToast('Proxy inaccessible — lancez python scripts/proxy.py', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// --- Delete group ---
function _stgDeleteGroup(idx) {
  const g = GROUPS[idx];
  if (!g) return;
  if (!confirm(`Supprimer le groupe « ${g.name} » ?`)) return;
  GROUPS.splice(idx, 1);
  renderGroupBtns();
  renderSettings();
  showToast(`Groupe « ${g.name} » supprimé`, 'success');
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
