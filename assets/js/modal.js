// ============================================================
// MODAL - Détail d'un ticket
// ============================================================

// Context list for prev/next navigation (improvement #8)
window._modalTicketList  = [];
window._modalCurrentIdx  = 0;

function openModal(id) {
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const t = TICKETS.find(x => x.id === id) || SUPPORT_TICKETS.find(x => x.id === id) || _bl.find(x => x.id === id);
  if (!t) return;

  // If no context was pre-set, build it from current visible tickets
  if (!window._modalTicketList || !window._modalTicketList.length) {
    window._modalTicketList = (typeof getTickets === 'function' ? getTickets() : TICKETS).map(x => x.id);
  }
  const idx = window._modalTicketList.indexOf(id);
  window._modalCurrentIdx = idx >= 0 ? idx : 0;
  if (idx < 0) {
    // ticket not in list (e.g. support ticket) - clear context
    window._modalTicketList = [];
  }

  _renderModalContent(t);
  _updateModalNavButtons();
  document.getElementById('modal-overlay').classList.add('open');
}

// Palette for feature project-code badges (cycles if more tokens than colors)
const _FEAT_PALETTE = [
  { bg:'#DBEAFE', color:'#1D4ED8' }, { bg:'#FCE7F3', color:'#9D174D' },
  { bg:'#D1FAE5', color:'#065F46' }, { bg:'#FEF3C7', color:'#92400E' },
  { bg:'#EDE9FE', color:'#5B21B6' }, { bg:'#FFEDD5', color:'#9A3412' },
  { bg:'#E0F2FE', color:'#0369A1' }, { bg:'#FEE2E2', color:'#991B1B' },
  { bg:'#F0FDF4', color:'#15803D' }, { bg:'#FDF4FF', color:'#86198F' },
];

function _featureBadges(featureId, title) {
  const tokens = title.split(/,\s*/).filter(Boolean);
  const _grps  = typeof GROUPS !== 'undefined' ? GROUPS : [];
  const badges = tokens.map((tok, i) => {
    // Group ID is built as "G-<projectKey>" in jira.js - direct lookup
    const grp = _grps.find(g => g.id === 'G-' + tok)
              || _grps.find(g => g.name && g.name.toUpperCase().includes(tok.toUpperCase()));
    let bg, color;
    if (grp && grp.color) {
      bg    = grp.color + '22';
      color = grp.color;
    } else {
      const p = _FEAT_PALETTE[i % _FEAT_PALETTE.length];
      bg    = p.bg;
      color = p.color;
    }
    return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${bg};color:${color};border:1px solid ${color}44;margin:2px 3px 2px 0;">${tok}</span>`;
  });
  return `<span style="font-size:11px;color:#94A3B8;margin-right:6px;">${featureId}</span>${badges.join('')}`;
}

// Slack/JIRA emoji shortcodes → Unicode
const _EMOJI_MAP = {
  'slight_smile':'🙂','smile':'😄','grinning':'😀','laughing':'😆','sweat_smile':'😅','rofl':'🤣',
  'joy':'😂','wink':'😉','blush':'😊','innocent':'😇','heart_eyes':'😍','star_struck':'🤩',
  'kissing_heart':'😘','yum':'😋','stuck_out_tongue':'😛','stuck_out_tongue_winking_eye':'😜',
  'thinking':'🤔','thinking_face':'🤔','zipper_mouth':'🤐','raised_eyebrow':'🤨','neutral_face':'😐',
  'expressionless':'😑','no_mouth':'😶','smirk':'😏','unamused':'😒','roll_eyes':'🙄','grimacing':'😬',
  'lying_face':'🤥','relieved':'😌','pensive':'😔','sleepy':'😪','sleeping':'😴','mask':'😷',
  'nauseated_face':'🤢','sneezing_face':'🤧','hot_face':'🥵','cold_face':'🥶','dizzy_face':'😵',
  'exploding_head':'🤯','cowboy':'🤠','partying_face':'🥳','sunglasses':'😎','nerd':'🤓',
  'confused':'😕','worried':'😟','slightly_frowning_face':'🙁','frowning':'☹️','open_mouth':'😮',
  'hushed':'😯','astonished':'😲','flushed':'😳','pleading_face':'🥺','cry':'😢','sob':'😭',
  'scream':'😱','angry':'😠','rage':'😡','skull':'💀','clown':'🤡','poop':'💩','ghost':'👻',
  'alien':'👽','robot':'🤖','wave':'👋','raised_hands':'🙌','clap':'👏','handshake':'🤝',
  'thumbsup':'\uD83D\uDC4D','+1':'\uD83D\uDC4D','thumbsdown':'\uD83D\uDC4E','-1':'\uD83D\uDC4E',
  'muscle':'💪','pray':'🙏','point_up':'☝️','point_down':'👇','point_left':'👈','point_right':'👉',
  'ok_hand':'👌','v':'✌️','crossed_fingers':'🤞','metal':'🤘','call_me':'🤙',
  'heart':'❤️','orange_heart':'🧡','yellow_heart':'💛','green_heart':'💚','blue_heart':'💙',
  'purple_heart':'💜','black_heart':'🖤','white_heart':'🤍','broken_heart':'💔','fire':'🔥',
  'star':'⭐','sparkles':'✨','zap':'⚡','boom':'💥','tada':'🎉','trophy':'🏆','medal':'🏅',
  'check':'✅','white_check_mark':'✅','heavy_check_mark':'✔️','x':'❌','warning':'⚠️',
  'no_entry':'⛔','question':'❓','exclamation':'❗','bulb':'💡','mag':'🔍','lock':'🔒',
  'unlock':'🔓','bell':'🔔','bookmark':'🔖','link':'🔗','gear':'⚙️','wrench':'🔧','hammer':'🔨',
  'rocket':'🚀','hourglass':'⏳','alarm_clock':'⏰','calendar':'📅','chart_with_upwards_trend':'📈',
  'chart_with_downwards_trend':'📉','clipboard':'📋','pushpin':'📌','paperclip':'📎',
  'memo':'📝','pencil':'✏️','file_folder':'📁','wastebasket':'🗑️','package':'📦',
  'email':'📧','inbox_tray':'📥','outbox_tray':'📤','mailbox':'📬','speech_balloon':'💬',
  'thought_balloon':'💭','eyes':'👀','brain':'🧠','dart':'🎯','jigsaw':'🧩',
  'art':'🎨','hammer_and_wrench':'🛠️','shield':'🛡️','flag':'🏁','triangular_flag':'🚩',
  'checkered_flag':'🏁','rainbow':'🌈','sun':'☀️','cloud':'☁️','umbrella':'☂️',
  'snowflake':'❄️','coffee':'☕','pizza':'🍕','beer':'🍺','wine_glass':'🍷',
  'dog':'🐶','cat':'🐱','bug':'🐛','bee':'🐝','turtle':'🐢','snake':'🐍',
  'crab':'🦀','octopus':'🐙','butterfly':'🦋','deciduous_tree':'🌳','seedling':'🌱',
  'cherry_blossom':'🌸','rose':'🌹','sunflower':'🌻','four_leaf_clover':'🍀',
};

function _formatDescription(text) {
  if (!text) return '';
  // Escape HTML entities first
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Emoji shortcodes (:name:) → Unicode
  s = s.replace(/:([a-z0-9_+-]+):/gi, (m, code) => _EMOJI_MAP[code] || m);
  // Code blocks (``` ... ```)
  s = s.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headings (## or #)
  s = s.replace(/^#{2,}\s+(.+)$/gm, '<div style="font-weight:700;font-size:12px;color:var(--text);margin:8px 0 3px;">$1</div>');
  s = s.replace(/^#\s+(.+)$/gm,     '<div style="font-weight:700;font-size:13px;color:var(--text);margin:10px 0 3px;border-bottom:1px solid var(--border);padding-bottom:3px;">$1</div>');
  // Bullet lists (- or *)
  s = s.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // Numbered lists
  s = s.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Links: [text](url) - markdown style
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Auto-link bare URLs (not already inside href)
  s = s.replace(/(?<!="|'>)(https?:\/\/[^\s<"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // JIRA ticket references (e.g. PROJ-123) - skip matches inside existing <a> tags
  s = s.replace(/(<a[^>]*>[\s\S]*?<\/a>)|\b([A-Z][A-Z0-9]+-\d+)\b/g, (match, link, key) => {
    if (link) return link; // already inside an anchor tag, keep as-is
    const url = CONFIG.jira?.url && !CONFIG.jira.url.includes('votre-jira') ? CONFIG.jira.url : null;
    return url ? `<a href="${url}/browse/${key}" target="_blank" rel="noopener" style="font-weight:600;">${key}</a>` : `<strong>${key}</strong>`;
  });
  // @mentions - styled as inline badge
  s = s.replace(/@([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]*)/g,
    '<span class="mdl-mention">@$1</span>');
  // Status-like keywords
  s = s.replace(/\b(TODO|FIXME|NOTE|WARN|WARNING|IMPORTANT)\b/g,
    '<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;background:#FEF3C7;color:#92400E;">$1</span>');
  s = s.replace(/\b(DONE|OK|FIXED)\b/g,
    '<span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;background:#D1FAE5;color:#065F46;">$1</span>');
  // Horizontal rule
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">');
  // Line breaks
  s = s.replace(/\n/g, '<br>');
  return s;
}

function _renderModalContent(t) {
  const epic    = EPICS.find(e => e.id === t.epic);
  const feature = epic ? FEATURES.find(f => f.id === epic.feature) : null;

  const _chipClr = (CONFIG.typeColors && CONFIG.typeColors[t.type]) || '#2563EB';
  const _chipBg  = _chipClr + '18';
  const _chipHtml = _jiraBrowse(t.id, {
    style: `color:${_chipClr};text-decoration:none;font-weight:700;font-size:12px;`,
    text:  t.id
  });
  const avatarColor = MEMBER_COLORS[t.assignee] || CLR.slate;
  const teamColor   = CONFIG.teams[t.team]?.color || CLR.slate;

  document.getElementById('modal-title').innerHTML =
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:${_chipBg};border:1.5px solid ${_chipClr}33;font-size:12px;font-weight:700;vertical-align:middle;margin-right:8px;white-space:nowrap;">${_chipHtml}</span>${t.title}`;

  // Flags row
  const flags = [];
  if (t.flagged) flags.push('<span style="color:#DC2626;font-size:11px;font-weight:700;">🚩 Flaggé</span>');
  if (t.buffer)  flags.push('<span style="color:#22C55E;font-size:11px;font-weight:700;">🛡️ Buffer</span>');
  const flagsHtml = flags.length ? `<span style="display:flex;gap:8px;margin-left:auto;">${flags.join('')}</span>` : '';

  // Cycle/lead time + sprint progress row
  let timeRowHtml = '';
  {
    const chips = [];
    if (t.cycleTimeDays != null) chips.push(`<span class="mdl-time-chip mdl-time-cycle">${t.cycleTimeDays}j cycle</span>`);
    if (t.leadTimeDays != null)  chips.push(`<span class="mdl-time-chip mdl-time-lead">${t.leadTimeDays}j lead</span>`);

    // Sprint progress mini-bar - use team-specific sprint context
    let sprintBarHtml = '';
    const tc = t.team ? CONFIG.teams[t.team] : null;
    const sStart = tc?.sprintStart || CONFIG.sprint?.startDate;
    const sEnd   = tc?.sprintEnd   || CONFIG.sprint?.endDate;
    const sLabel = tc?.sprintName  || CONFIG.sprint?.label || 'Sprint';
    if (sStart && sEnd) {
      const s = new Date(sStart.length === 10 ? sStart + 'T00:00:00' : sStart);
      const e = new Date(sEnd.length === 10   ? sEnd   + 'T00:00:00' : sEnd);
      const now = new Date();
      const total   = e - s;
      const elapsed = now - s;
      const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : 0;
      const remaining = Math.max(0, Math.ceil((e - now) / 86400000));

      // Resolve start/end dates - use stored dates or estimate from cycle/lead time
      let _started  = t.startedDate;
      let _resolved = t.resolvedDate;
      if (!_started && !_resolved && isDone(t.status) && (t.cycleTimeDays != null || t.leadTimeDays != null)) {
        // Estimate: resolvedDate ≈ now (already done), startedDate = resolved - cycleTime
        const resolvedMs = now.getTime();
        _resolved = new Date(resolvedMs).toISOString().slice(0, 10);
        if (t.cycleTimeDays != null) {
          _started = new Date(resolvedMs - t.cycleTimeDays * 86400000).toISOString().slice(0, 10);
        }
      }

      // Ticket start/end markers on the sprint bar
      let markersHtml = '';
      if (_started) {
        const ts = new Date(_started + 'T00:00:00');
        const mPct = total > 0 ? Math.max(0, Math.min(100, Math.round(((ts - s) / total) * 100))) : 0;
        markersHtml += `<div class="mdl-sprint-marker mdl-sprint-marker-start" style="left:${mPct}%" title="Début : ${ts.toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}"></div>`;
      }
      if (_resolved) {
        const ts = new Date(_resolved + 'T00:00:00');
        const mPct = total > 0 ? Math.max(0, Math.min(100, Math.round(((ts - s) / total) * 100))) : 0;
        markersHtml += `<div class="mdl-sprint-marker mdl-sprint-marker-end" style="left:${mPct}%" title="Fin : ${ts.toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}"></div>`;
      }
      // Filled range between start and end (or start and now)
      let rangeHtml = '';
      if (_started) {
        const rsDate = new Date(_started + 'T00:00:00');
        const reDate = _resolved ? new Date(_resolved + 'T00:00:00') : now;
        const rLeft  = total > 0 ? Math.max(0, Math.min(100, ((rsDate - s) / total) * 100)) : 0;
        const rRight = total > 0 ? Math.max(0, Math.min(100, ((reDate - s) / total) * 100)) : 0;
        const rColor = _resolved ? '#10B981' : '#3B82F6';
        rangeHtml = `<div class="mdl-sprint-range" style="left:${rLeft}%;width:${Math.max(0, rRight - rLeft)}%;background:${rColor}55;"></div>`;
      }

      const _df = { day: 'numeric', month: 'short' };
      const sStartLabel = s.toLocaleDateString('fr-FR', _df);
      const sEndLabel   = e.toLocaleDateString('fr-FR', _df);

      // Determine fill colors based on available time data
      // cycle → blue (#DBEAFE / #3B82F6), lead → amber (#FEF3C7 / #F59E0B)
      const hasCycle = t.cycleTimeDays != null;
      const hasLead  = t.leadTimeDays != null;
      const fillGrad = hasLead && !hasCycle
        ? 'linear-gradient(90deg, #F59E0B, #FB923C)'   // lead-only: amber
        : hasCycle && hasLead
          ? 'linear-gradient(90deg, #3B82F6, #F59E0B)' // both: blue → amber
          : 'linear-gradient(90deg, #3B82F6, #06B6D4)';// cycle-only or default: blue
      const trackBg = hasLead && !hasCycle ? '#FEF3C7' : '#DBEAFE';

      sprintBarHtml = `<div class="mdl-sprint-bar">
        <span class="mdl-sprint-label">${sLabel}</span>
        <div class="mdl-sprint-track-wrap">
          <div class="mdl-sprint-dates"><span>${sStartLabel}</span><span>${sEndLabel}</span></div>
          <div class="mdl-sprint-track" style="background:${trackBg}">
            <div class="mdl-sprint-fill" style="width:${pct}%;background:${fillGrad}"></div>
            ${rangeHtml}${markersHtml}
          </div>
        </div>
        <span class="mdl-sprint-pct">${remaining > 0 ? 'J-' + remaining : 'Terminé'}</span>
      </div>`;
    }

    if (chips.length || sprintBarHtml) {
      timeRowHtml = `<div class="mdl-time-row">${chips.join('')}${sprintBarHtml}</div>`;
    }
  }

  // Due date
  let dueDateHtml = '';
  if (t.dueDate) {
    const dd = new Date(t.dueDate.length === 10 ? t.dueDate + 'T00:00:00' : t.dueDate);
    if (!isNaN(dd)) {
      const now  = new Date(); now.setHours(0,0,0,0);
      const diff = Math.ceil((dd - now) / 86400000);
      const dateStr = dd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const overdue = diff < 0 && !isDone(t.status);
      const soon    = diff >= 0 && diff <= 3 && !isDone(t.status);
      const color   = overdue ? '#DC2626' : soon ? '#F59E0B' : '#64748B';
      const bg      = overdue ? '#FEE2E2' : soon ? '#FEF3C7' : 'var(--bg, #F8FAFC)';
      const suffix  = overdue ? ` (${Math.abs(diff)}j en retard)` : diff === 0 ? ' (aujourd\'hui)' : diff <= 7 && !isDone(t.status) ? ` (J-${diff})` : '';
      dueDateHtml = `<span class="mdl-pill" style="border-color:${color}44;background:${bg};color:${color};font-size:11px;font-weight:600;">📅 ${dateStr}${suffix}</span>`;
    }
  }

  // Last comment
  let commentHtml = '';
  if (t.lastComment && t.lastComment.body) {
    const c = t.lastComment;
    const commentDate = c.date ? new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
    commentHtml = `<div class="mdl-comment">
      <div class="mdl-comment-header">
        ${avatarBadge(c.author, MEMBER_COLORS[c.author] || CLR.slate, {w:18, fs:'8px'})}
        <span class="mdl-comment-author">${c.author}</span>
        <span class="mdl-comment-date">${commentDate}</span>
      </div>
      <div class="mdl-comment-body">${_formatDescription(c.body)}</div>
    </div>`;
  }

  // --- Right-side extras for line 1
  const rightL1 = [dueDateHtml, flagsHtml].filter(Boolean).join(' ');

  // --- Team chip
  const teamChip = t.team
    ? `<span class="mdl-sep">·</span><span style="display:inline-flex;align-items:center;gap:4px;">${statusDot(teamColor, 'sm')}<span style="font-size:11px;font-weight:600;color:${teamColor};">${t.team}</span></span>`
    : '';

  // --- Sprint chips
  const sprints = t.allSprints || (t.sprintName ? [t.sprintName] : []);
  let sprintChipsHtml = '';
  if (sprints.length) {
    const last = sprints[sprints.length - 1];
    const rest = sprints.slice(0, -1);
    const uid  = 'mdl-sp-' + Date.now();
    sprintChipsHtml = `<span class="mdl-sep">·</span><span class="mdl-sprint-chips"><span class="mdl-sprint-chip-main">🏃 ${last}</span>${rest.length ? `<button class="mdl-sprint-chip-toggle" onclick="document.getElementById('${uid}').classList.toggle('mdl-sprint-chips-open');this.textContent=this.textContent.trim()==='+${rest.length}'?'−':'+${rest.length}'" title="${rest.join(', ')}">+${rest.length}</button><span class="mdl-sprint-chips-rest" id="${uid}">${rest.map(s => `<span class="mdl-sprint-chip-item">${s}</span>`).join('')}</span>` : ''}</span>`;
  }

  // --- Epic chip (line 2 right)
  const epicChip = epic ? epicTag(epic, epic.id, {maxWidth: 260}) : '';

  document.getElementById('modal-body').innerHTML = `
    <div class="mdl-meta">
      <div class="mdl-meta-row">
        <div class="mdl-meta-left">
          <span class="mdl-pill mdl-pill-sm">${priorityIcon(t.priority || 'medium')}<span style="font-size:11px;font-weight:600;text-transform:capitalize;">${t.priority || '-'}</span></span>
          <span class="badge badge-${t.type}">${typeName(t.type || 'support')}</span>
          <span class="badge badge-${t.status || 'open'}">${statusLabel(t.status || 'open')}</span>
          ${ptsBadge(t.points)}
        </div>
        <div class="mdl-meta-right">${rightL1}</div>
      </div>
      <div class="mdl-meta-row">
        <div class="mdl-meta-left">
          ${avatarBadge(t.assignee, avatarColor, {w:20, fs:'9px'})}
          <span style="font-size:12px;font-weight:600;">${t.assignee || 'Non assigné'}</span>
          ${teamChip}
          ${sprintChipsHtml}
        </div>
        <div class="mdl-meta-right">${epicChip}</div>
      </div>
      ${timeRowHtml}
    </div>
    ${t.description
      ? `<div class="mdl-desc">${_formatDescription(t.description)}</div>`
      : `<div class="mdl-desc mdl-desc-empty"><span style="display:flex;align-items:center;gap:8px;justify-content:center;padding:20px 0;color:var(--text-muted);font-size:13px;font-style:italic;opacity:.7;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Pas de description pour le moment</span></div>`}
    ${commentHtml}
  `;
}

function _updateModalNavButtons() {
  const list    = window._modalTicketList || [];
  const idx     = window._modalCurrentIdx;
  const prevBtn = document.getElementById('modal-prev-btn');
  const nextBtn = document.getElementById('modal-next-btn');
  const counter = document.getElementById('modal-nav-counter');

  if (!list.length) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (counter) counter.style.display = 'none';
    return;
  }
  if (prevBtn) { prevBtn.style.display = ''; prevBtn.disabled = idx <= 0; }
  if (nextBtn) { nextBtn.style.display = ''; nextBtn.disabled = idx >= list.length - 1; }
  if (counter) { counter.style.display = ''; counter.textContent = `${idx + 1}/${list.length}`; }
}

function modalNavigate(dir) {
  const list = window._modalTicketList || [];
  if (!list.length) return;
  const newIdx = window._modalCurrentIdx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  window._modalCurrentIdx = newIdx;
  const id  = list[newIdx];
  const _bl = typeof BACKLOG_TICKETS !== 'undefined' ? BACKLOG_TICKETS : [];
  const t   = TICKETS.find(x => x.id === id) || SUPPORT_TICKETS.find(x => x.id === id) || _bl.find(x => x.id === id);
  if (!t) return;
  _renderModalContent(t);
  _updateModalNavButtons();
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}

function closeModalDirect() {
  document.getElementById('modal-overlay').classList.remove('open');
  // Reset context so next open rebuilds it
  window._modalTicketList = [];
  window._modalCurrentIdx = 0;
}
