// ============================================================
// JIRA.JS - Chargement et transformation des données JIRA
//
// Deux fonctions publiques :
//   loadJiraCache() → charge data/jira-data.json (sans appel API)
//                     retourne la date ISO du cache si trouvé, null sinon
//   loadJiraData()  → fetch tous les boards JIRA, récupère les sprints actifs,
//                     transforme, sauvegarde en cache
//                     appelé uniquement sur clic "Synchroniser"
//
// Équipe   = nom du board, préfixe "Sprint " / "Équipe " / "Team " supprimé
//            ex: "Sprint Fuego" → "Fuego"
// Groupes  = boards partageant le même Espace (location.projectKey)
//            ex: Espaces > Gestion des Communs > Sprint Fuego → groupe "Gestion des Communs"
//
// Cache (data/) : tout serveur HTTP statique suffit (node server.js, Live Server...).
// ============================================================

const JIRA_PROXY = 'http://localhost:3001/jira';
const DATA_PROXY = '/data';

// API call counter (reset at each sync, read by sync.js for toast/meta)
let _jiraApiCalls = 0;
function _jiraFetch(url, opts) {
  _jiraApiCalls++;
  return fetch(url, opts);
}

// Nom de fichier cache fixe (multi-board)
function _cacheFile() { return 'jira-data.json'; }

// --- Palette de couleurs auto ---
const _COLOR_PALETTE = [
  '#2563EB','#EC4899','#14B8A6','#F59E0B','#06B6D4','#10B981',
  '#0891B2','#F43F5E','#F97316','#84CC16','#EF4444','#8B5CF6',
  '#3B82F6','#22C55E','#EAB308','#0EA5E9','#E11D48','#0284C7',
];
let _colorCursor = 0;
function _pickColor() { return _COLOR_PALETTE[_colorCursor++ % _COLOR_PALETTE.length]; }

const _GROUP_COLORS = [
  '#0284C7','#059669','#EA580C','#8B5CF6','#EC4899','#14B8A6','#F59E0B','#EF4444',
];

// --- Board column config (dynamic status mapping from JIRA board configuration) ---
// Structure : { statusName(lowercase) → internalStatus }
// Built from /agile/1.0/board/{id}/configuration during sync
let _boardColumnMap = {};

// Map JIRA board column name → internal status
function _mapColumnToInternal(colName) {
  const c = (colName || '').toLowerCase().trim();
  // 1. Composite / specific patterns first (order matters)
  if (/pas pr[eêè]t|pour plus tard/i.test(c))                            return 'backlog';
  if (/pr[eêè]t/i.test(c))                                               return 'todo';
  // 2. Test / QA — before done, because "A livrer en Qualif" contains "livr" but is a test/QA step
  if (/test|recette|qualif|preprod|préprod|uat|valid/i.test(c))           return 'test';
  // 3. Done
  if (/termin|done\b|clos|livr|deploy|d[eéè]ploy|prod|résolu|resolv/i.test(c)) return 'done';
  // 4. Review
  if (/review|revue|relecture|code review/i.test(c))                     return 'review';
  // 5. Blocked
  if (/bloqu|bloc|imped|attente|hold|wait/i.test(c))                     return 'blocked';
  // 6. In progress
  if (/cours|progress|dev|wip|sp[eéè]c|analys|cadrage|développ/i.test(c)) return 'inprog';
  // 7. Backlog / Todo
  if (/backlog/i.test(c))                                                return 'backlog';
  if (/todo|[àa] faire|open|ready|estimer|affinage/i.test(c))           return 'todo';
  return null;
}

// --- Mappings JIRA → interne ---

const _STATUS_MAP = {
  // --- Todo / Backlog ---
  'to do':                      'todo',
  'à faire':                    'todo',
  'open':                       'todo',
  'backlog':                    'backlog',
  'sprint backlog':             'todo',
  'selected for development':   'todo',
  'a estimer':                  'todo',
  'à estimer':                  'todo',
  'en attente':                 'todo',
  'prêt':                       'todo',
  'pret':                       'todo',
  'ready':                      'todo',
  'ready for development':      'todo',
  'en cours de spécification tech': 'todo',
  'en cours de specification tech': 'todo',
  'en cours d\'analyse':        'todo',
  'en cours d\'analyse ':       'todo',
  'en cours de spécification':  'todo',
  'en cours de specification':  'todo',

  // --- In Progress ---
  'in progress':                'inprog',
  'en cours':                   'inprog',
  'en cours de développement':  'inprog',
  'en cours de developpement':  'inprog',
  'in development':             'inprog',
  'development':                'inprog',

  // --- Review ---
  'in review':                  'review',
  'code review':                'review',
  'en revue':                   'review',
  'en cours de revue':          'review',
  'review':                     'review',
  'peer review':                'review',

  // --- Test / Recette / QA ---
  'testing':                    'test',
  'qa':                         'test',
  'en test':                    'test',
  'en cours de recette':        'test',
  'a livrer en recette':        'test',
  'à livrer en recette':        'test',
  'en cours de qualif (mi)':    'done',
  'en cours de qualif':         'done',
  'a livrer en qualif (mi)':    'done',
  'à livrer en qualif (mi)':    'done',
  'a livrer en qualif':         'done',
  'à livrer en qualif':         'done',
  'en cours de test préprod':   'done',
  'en cours de test preprod':   'done',
  'a livrer en préprod':        'done',
  'a livrer en preprod':        'done',
  'à livrer en préprod':        'done',
  'uat':                        'test',
  'recette':                    'test',

  // --- Blocked / Waiting / Pending ---
  'blocked':                        'blocked',
  'bloqué':                         'blocked',
  'bloque':                         'blocked',
  'impediment':                     'blocked',
  'on hold':                        'blocked',
  'retour au demandeur':            'blocked',
  'en attente de retour':           'blocked',

  // --- Support / Service Desk ---
  'requête/demande envoyée':        'todo',
  'demande envoyée':                'todo',
  'en attente de support':          'todo',
  'en cours de traitement':         'inprog',
  'résolution en cours':            'inprog',
  'résolu':                         'done',
  'fermé':                          'done',

  // --- Done ---
  'done':                       'done',
  'closed':                     'done',
  'resolved':                   'done',
  'terminé':                    'done',
  'termine':                    'done',
  'a livrer en prod':           'done',
  'à livrer en prod':           'done',
  'en prod':                    'done',
  'in production':              'done',
  'deployed':                   'done',
  'livré':                      'done',
  'livre':                      'done',
  'déployé':                    'done',
  'deploye':                    'done',
  'clos sans suite':            'done',
  'won\'t fix':                 'done',
  'wont fix':                   'done',
  'duplicate':                  'done',
};

function _mapStatus(s) {
  const key = (s || '').toLowerCase().trim();
  // 1. Board column mapping (from JIRA board configuration - highest priority)
  if (_boardColumnMap[key]) return _boardColumnMap[key];
  // 2. Static mapping
  if (_STATUS_MAP[key]) return _STATUS_MAP[key];
  // 3. Pattern detection pour les statuts personnalisés non listés
  if (/termin|done|clos|resolv|livr|deploy|prod\b|complet/i.test(s)) return 'done';
  if (/test|recette|qualif|preprod|préprod|uat/i.test(s))             return 'test';
  if (/revue|review/i.test(s))                                        return 'review';
  if (/bloc|imped|attente|hold/i.test(s))                             return 'blocked';
  if (/cours|progress|dev|wip|spec|analys/i.test(s))                  return 'inprog';
  if (/backlog/i.test(s))                                             return 'backlog';
  console.warn(`[JIRA] Statut non mappé : "${s}" → todo`);
  return 'todo';
}

function _mapType(t) {
  const s = (t || '').toLowerCase();
  if (s === 'bug')                                    return 'bug';
  if (s === 'incident')                               return 'incident';
  if (s === 'support request' || s === 'support')     return 'support';
  if (s.includes('tech') || s === 'technical story')  return 'storytech';
  if (s === 'task' || s === 'tâche' || s === 'sous-tâche' || s === 'sub-task') return 'tache';
  if (s === 'ops' || s === 'operation')               return 'ops';
  if (s === 'dette' || s === 'tech debt')             return 'dette';
  if (s === 'feature' || s === 'fonctionnalité')      return 'feature';
  if (s === 'epic')                                   return 'epic';
  return 'story';
}

function _mapPriority(p) {
  const s = (p || '').toLowerCase();
  if (s === 'highest' || s === 'critical' || s === 'bloquant') return 'critical';
  if (s === 'high'    || s === 'haute')    return 'high';
  if (s === 'low'     || s === 'lowest'  || s === 'basse') return 'low';
  return 'medium';
}

// --- Flagged / Impediment indicator ---
// JIRA : Flagged = "Impediment" (accessible via fields.flagged)
function _isFlagged(fields) {
  const v = fields.flagged;
  if (!v) return false;
  // String directe : "Impediment"
  if (typeof v === 'string') return /impediment/i.test(v);
  // Array d'objets : [{value:"Impediment"}]
  if (Array.isArray(v)) return v.some(e => /impediment/i.test(typeof e === 'object' ? e.value || '' : e));
  // Objet : {value:"Impediment"}
  if (typeof v === 'object' && v.value) return /impediment/i.test(v.value);
  return false;
}

// --- Buffer ticket detection ---
// Buffer = label "Buffer" (case-insensitive) OR parent epic/feature title contains "Buffer"
function _isBuffer(labels, epicKey, epicMap) {
  if (labels.some(l => l.includes('buffer'))) return true;
  if (epicKey && epicMap[epicKey]) {
    const epicTitle = (epicMap[epicKey].title || '').toLowerCase();
    if (epicTitle.includes('buffer')) return true;
  }
  return false;
}

// --- Story points (custom fields variables selon les instances JIRA) ---
let _pointsFieldKey = null; // mémorisé après détection automatique

function _getPoints(fields) {
  const _num = v => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  };

  // Champ déjà identifié lors d'une sync précédente
  if (_pointsFieldKey) {
    const v = _num(fields[_pointsFieldKey]);
    if (v > 0) return v;
  }

  // Champs connus (ordre de priorité), accepte number ET string parseable
  const knownKeys = [
    'story_points',
    'customfield_10016', 'customfield_10028', 'customfield_10005',
    'customfield_10004', 'customfield_10115', 'customfield_10106',
    'customfield_10034', 'customfield_10193',
  ];
  for (const k of knownKeys) {
    const v = _num(fields[k]);
    if (v > 0) { _pointsFieldKey = k; return v; }
  }

  // Fallback dynamique : scan tous les customfield_* avec valeur numérique 1–100
  const _sprintFieldId = CONFIG.sync.sprintField || 'customfield_10020';
  for (const [k, raw] of Object.entries(fields)) {
    if (!/^customfield_\d+$/.test(k)) continue;
    if (k === _sprintFieldId) continue;  // Exclure le champ sprint
    const v = _num(raw);
    if (v > 0 && v <= 100) {
      console.info(`[JIRA] Story points auto-détectés → ${k} (ex: ${v})`);
      _pointsFieldKey = k;
      return v;
    }
  }
  return 0;
}

// --- Parser le champ sprint (customfield_10020) ---
// JIRA peut retourner ce champ sous deux formats :
//   - Objet  : { id: 123, state: 'closed', name: 'Sprint X' }
//   - String : "Sprint@xxx[id=123,state=CLOSED,name=Sprint X,startDate=...,...]"
function _parseSprintField(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map(item => {
    if (!item) return null;
    if (typeof item === 'object') {
      return {
        id:        item.id,
        name:      item.name,
        state:     (item.state || '').toLowerCase(),
        startDate: item.startDate ? String(item.startDate).slice(0, 10) : undefined,
        endDate:   item.endDate   ? String(item.endDate).slice(0, 10)   : undefined,
      };
    }
    if (typeof item === 'string') {
      const id        = item.match(/\bid=(\d+)/)?.[1];
      const state     = item.match(/\bstate=([A-Za-z]+)/)?.[1];
      const name      = item.match(/\bname=([^,\]]+)/)?.[1];
      const startDate = item.match(/\bstartDate=([^,\]]+)/)?.[1];
      const endDate   = item.match(/\bendDate=([^,\]]+)/)?.[1];
      if (name) return {
        id:        id ? parseInt(id) : 0,
        state:     (state || '').toLowerCase(),
        name:      name.trim(),
        startDate: startDate ? startDate.slice(0, 10) : undefined,
        endDate:   endDate   ? endDate.slice(0, 10)   : undefined,
      };
    }
    return null;
  }).filter(Boolean);
}

// --- Nom d'équipe depuis le nom du board (supprime les préfixes courants) ---
// "Sprint Fuego" → "Fuego" | "Équipe Alpha" → "Alpha" | "Fuego" → "Fuego"
function _boardTeamName(boardName) {
  return (boardName || '')
    .replace(/^(?:Sprint|Équipe|Equipe|Team|Board)\s+/i, '')
    .trim() || (boardName || 'A');
}

// --- Initiales depuis un displayName JIRA ---
function _initials(displayName) {
  if (!displayName) return null;
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

// --- Formater une date ISO → "DD Mon YYYY" ---
function _fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

// --- Clé epic d'une issue ---
function _getEpicKey(fields) {
  const parentType = (fields.parent?.fields?.issuetype?.name || '').toLowerCase();
  if (parentType === 'epic' || parentType === 'feature' || parentType === 'fonctionnalité') return fields.parent.key;
  // Fallback: any parent with a hierarchyLevel >= 1 (epic-level or above)
  if (fields.parent?.key && fields.parent?.fields?.issuetype?.hierarchyLevel >= 1) return fields.parent.key;
  if (fields.customfield_10014) return fields.customfield_10014;
  return null;
}

// --- Extraire le texte d'une description ADF (Atlassian Document Format) ---
function _extractDescription(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  try {
    const lines = [];
    function walk(node) {
      if (!node) return;

      // --- Leaf nodes (no content) ---

      if (node.type === 'text') {
        const linkMark = (node.marks || []).find(m => m.type === 'link' && m.attrs?.href);
        if (linkMark) {
          const href = linkMark.attrs.href;
          const text = node.text || href;
          lines.push(text === href ? href : `[${text}](${href})`);
        } else {
          lines.push(node.text || '');
        }
        return;
      }
      if (node.type === 'hardBreak') { lines.push('\n'); return; }

      // Mention - @User : {type:"mention", attrs:{text:"@Sebastien", id:"..."}}
      if (node.type === 'mention') {
        const name = node.attrs?.text || '@inconnu';
        lines.push(name.startsWith('@') ? name : '@' + name);
        return;
      }

      // Emoji : {type:"emoji", attrs:{shortName:":smile:", text:"😄"}}
      if (node.type === 'emoji') {
        lines.push(node.attrs?.text || node.attrs?.shortName || '');
        return;
      }

      // inlineCard / blockCard - JIRA smart links (tickets, Confluence, GitLab…)
      if ((node.type === 'inlineCard' || node.type === 'blockCard') && node.attrs?.url) {
        lines.push(node.attrs.url);
        return;
      }

      // Status lozenge : {type:"status", attrs:{text:"IN PROGRESS", color:"blue"}}
      if (node.type === 'status') {
        lines.push(`[${node.attrs?.text || ''}]`);
        return;
      }

      // Date node : {type:"date", attrs:{timestamp:"1679961600000"}}
      if (node.type === 'date' && node.attrs?.timestamp) {
        const d = new Date(Number(node.attrs.timestamp));
        lines.push(isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }));
        return;
      }

      // Media (images, attachments) - placeholder only
      if (node.type === 'media' || node.type === 'mediaInline') {
        lines.push('[pièce jointe]');
        return;
      }

      // Rule / horizontal line
      if (node.type === 'rule') { lines.push('\n---\n'); return; }

      // --- List items : add prefix before content ---
      if (node.type === 'listItem') {
        const prefix = node._listPrefix || '- ';
        lines.push(prefix);
        if (node.content) {
          // Walk children but suppress trailing \n from inner paragraph
          // (the list item itself controls line breaks)
          node.content.forEach((child, ci) => {
            if (child.type === 'paragraph') {
              if (child.content) child.content.forEach(walk);
            } else {
              walk(child);
            }
          });
        }
        lines.push('\n');
        return;
      }

      // Ordered / bullet lists : tag children with prefix
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        const items = node.content || [];
        items.forEach((child, idx) => {
          if (child.type === 'listItem') {
            child._listPrefix = node.type === 'orderedList' ? `${idx + 1}. ` : '- ';
          }
        });
        items.forEach(walk);
        return;
      }

      // Task list / decision list items
      if (node.type === 'taskItem' || node.type === 'decisionItem') {
        const checked = node.attrs?.state === 'DONE';
        lines.push(checked ? '- [x] ' : '- [ ] ');
        if (node.content) node.content.forEach(walk);
        lines.push('\n');
        return;
      }
      if (node.type === 'taskList' || node.type === 'decisionList') {
        if (node.content) node.content.forEach(walk);
        return;
      }

      // --- Container nodes (have content) ---
      if (node.content) node.content.forEach(walk);

      // Block-level nodes → trailing newline
      if (['paragraph','heading',
           'blockquote','codeBlock',
           'table','tableRow','tableCell','tableHeader',
           'mediaSingle','mediaGroup','panel','expand','layoutSection','layoutColumn'
          ].includes(node.type)) {
        lines.push('\n');
      }
    }
    walk(doc);
    return lines.join('').trim();
  } catch { return ''; }
}

// --- Extraire le dernier commentaire JIRA ---
function _extractLastComment(commentField) {
  if (!commentField) return null;
  const comments = commentField.comments || commentField;
  if (!Array.isArray(comments) || !comments.length) return null;
  const last = comments[comments.length - 1];
  if (!last) return null;
  return {
    author: last.author?.displayName || last.updateAuthor?.displayName || '?',
    date:   (last.updated || last.created || '').slice(0, 10),
    body:   _extractDescription(last.body) || (typeof last.body === 'string' ? last.body : ''),
  };
}

function _extractComments(commentField) {
  if (!commentField) return [];
  const comments = commentField.comments || commentField;
  if (!Array.isArray(comments)) return [];
  return comments.map(c => ({
    author: c.author?.displayName || c.updateAuthor?.displayName || '?',
    date:   c.updated || c.created || '',
    body:   _extractDescription(c.body) || (typeof c.body === 'string' ? c.body : ''),
  })).filter(c => c.body);
}

function _extractLinks(issuelinks) {
  if (!Array.isArray(issuelinks)) return [];
  return issuelinks.map(l => {
    const outward = l.outwardIssue;
    const inward  = l.inwardIssue;
    const linked  = outward || inward;
    if (!linked) return null;
    return {
      type:    outward ? (l.type?.outward || 'relates to') : (l.type?.inward || 'relates to'),
      id:      linked.key,
      title:   linked.fields?.summary || '',
      status:  linked.fields?.status?.name || '',
    };
  }).filter(Boolean);
}

function _extractComponents(fields) {
  if (!Array.isArray(fields.components)) return [];
  return fields.components.map(c => c.name).filter(Boolean);
}

// Fetch remote (web) links for a single issue — called on demand from modal
window._fetchRemoteLinks = async function(issueKey) {
  if (!CONFIG.jira?.url) return [];
  try {
    const r = await _jiraFetch(`${JIRA_PROXY}/api/3/issue/${encodeURIComponent(issueKey)}/remotelink`);
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map(rl => ({
      id:    rl.id,
      title: rl.object?.title || rl.object?.url || '',
      url:   rl.object?.url || '',
      icon:  rl.object?.icon?.url16x16 || '',
      status: rl.object?.status?.description || rl.object?.status?.resolved ? 'Résolu' : '',
    })).filter(l => l.url);
  } catch (e) {
    console.warn('[JIRA] Remote links fetch failed for', issueKey, e.message);
    return [];
  }
};

// ============================================================
// Transformation issues JIRA → objet cache (sans side-effects)
// Chaque issue peut porter ._boardTeam (nom d'équipe issu du board)
// ============================================================

// Extract recent changelog entries (last 48h) from a JIRA issue
// Stores date + time so the rendering layer can filter by day
function _extractRecentChanges(issue) {
  const histories = issue.changelog?.histories || [];
  if (!histories.length) return [];
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const changes = [];
  histories.forEach(h => {
    if (!h.created) return;
    const d = new Date(h.created);
    if (d.getTime() < cutoff) return;
    const author = h.author?.displayName || '';
    const date   = h.created.slice(0, 10);
    const time   = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    (h.items || []).forEach(item => {
      changes.push({
        date,
        time,
        author,
        field:    item.field,
        fieldId:  item.fieldId || item.field,
        from:     item.fromString || item.from || '',
        to:       item.toString  || item.to   || '',
      });
    });
  });
  return changes;
}

function _transform(issues, project, sprintId, teamConfigs) {
  _colorCursor = 0;

  const epicTypes    = ['epic'];
  const featureTypes = ['feature', 'fonctionnalité'];
  const supportTypes = ['support request', 'support', 'incident'];
  const hierarchyTypes = [...epicTypes, ...featureTypes];

  const epicIssues    = issues.filter(i => epicTypes.includes((i.fields.issuetype?.name || '').toLowerCase()));
  const featureIssues = issues.filter(i => featureTypes.includes((i.fields.issuetype?.name || '').toLowerCase()));
  const supportIssues = issues.filter(i => supportTypes.includes((i.fields.issuetype?.name || '').toLowerCase()));
  const otherIssues   = issues.filter(i => {
    const t = (i.fields.issuetype?.name || '').toLowerCase();
    return !hierarchyTypes.includes(t) && !supportTypes.includes(t);
  });

  // Extraire les Features et les Epics
  // Hiérarchie JIRA : Epic > Feature > Ticket
  // Modèle code     : FEATURES (top) > EPICS (mid) > TICKETS
  const _featureMap = {};
  const epicMap = {};

  // Features issues directes (type Feature/Fonctionnalité dans le sprint)
  featureIssues.forEach(i => {
    const team = i._boardTeam || '';
    const sprintRaw = i.fields[CONFIG.sync?.sprintField || 'sprint'];
    const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
    const piSprint = _extractPISprint(sprintList);
    let piSprintName = piSprint?.name || i._piSprintName || '';
    if (!piSprintName && sprintRaw) {
      const rawStr = typeof sprintRaw === 'string' ? sprintRaw : JSON.stringify(sprintRaw);
      const piMatch = rawStr.match(/PI\s*#?\s*(\d+)/i);
      if (piMatch) piSprintName = `PI#${piMatch[1]}`;
    }
    // Chercher le parent Epic (top level)
    const parentKey = i.fields.parent?.key || null;
    const parentType = (i.fields.parent?.fields?.issuetype?.name || '').toLowerCase();
    const isParentEpic = parentType === 'epic' || (i.fields.parent?.fields?.issuetype?.hierarchyLevel != null && i.fields.parent?.fields?.issuetype?.hierarchyLevel >= 1 && !featureTypes.includes(parentType));
    if (!epicMap[i.key]) {
      epicMap[i.key] = { id: i.key, title: i.fields.summary || i.key, feature: isParentEpic ? parentKey : null, team, color: _pickColor(), status: _mapStatus(i.fields.status?.name), _jiraStatus: i.fields.status?.name || '', piSprint: piSprintName, _isFeature: true };
    }
    // Register parent Epic as a Feature in code model
    if (isParentEpic && parentKey) {
      if (!_featureMap[parentKey]) {
        _featureMap[parentKey] = { id: parentKey, title: i.fields.parent?.fields?.summary || parentKey, color: _pickColor(), status: _mapStatus(i.fields.parent?.fields?.status?.name), _jiraStatus: i.fields.parent?.fields?.status?.name || '' };
      }
    }
  });

  function _extractFeature(epicIssue) {
    const p = epicIssue.fields?.parent;
    if (!p) return null;
    const pType = (p.fields?.issuetype?.name || '').toLowerCase();
    const pLevel = p.fields?.issuetype?.hierarchyLevel;
    // Parent de type Feature/Fonctionnalité → c'est un sibling dans EPICS, son parent est un "Feature" code
    if (featureTypes.includes(pType)) {
      // La Feature JIRA est un EPIC dans le modèle code — s'assurer qu'elle est enregistrée
      if (!epicMap[p.key]) {
        epicMap[p.key] = { id: p.key, title: p.fields?.summary || p.key, feature: null, team: epicIssue._boardTeam || '', color: _pickColor(), status: _mapStatus(p.fields?.status?.name), _jiraStatus: p.fields?.status?.name || '', _isFeature: true };
      }
      return epicMap[p.key].feature || null; // return the grandparent (Epic JIRA = Feature code)
    }
    // Parent de type Epic ou hierarchyLevel >= 2 → Feature dans le modèle code
    if (pType === 'epic' || pLevel >= 2) {
      if (!_featureMap[p.key]) {
        _featureMap[p.key] = { id: p.key, title: p.fields?.summary || p.key, color: _pickColor(), status: _mapStatus(p.fields?.status?.name), _jiraStatus: p.fields?.status?.name || '' };
      }
      return p.key;
    }
    return null;
  }

  epicIssues.forEach(i => {
    const team = i._boardTeam || '';
    const featureKey = _extractFeature(i) || null;
    epicMap[i.key] = { id: i.key, title: i.fields.summary, feature: featureKey, team, color: _pickColor(), status: _mapStatus(i.fields.status?.name), _jiraStatus: i.fields.status?.name || '' };
  });

  // Epics/Features référencées mais absentes du sprint → stub
  otherIssues.forEach(i => {
    const key = _getEpicKey(i.fields);
    const team = i._boardTeam || '';
    if (key && !epicMap[key]) {
      const parentTitle = (i.fields.parent?.key === key) ? i.fields.parent?.fields?.summary : null;
      const parentStatus = (i.fields.parent?.key === key) ? i.fields.parent?.fields?.status?.name : null;
      const parentType = (i.fields.parent?.key === key) ? (i.fields.parent?.fields?.issuetype?.name || '').toLowerCase() : '';
      const isFeature = featureTypes.includes(parentType);
      epicMap[key] = { id: key, title: parentTitle || key, feature: null, team, color: _pickColor(), status: _mapStatus(parentStatus), _jiraStatus: parentStatus || '', _isFeature: isFeature || false };
    }
  });

  // Enrichir les epics sans feature : chercher le parent dans les données
  Object.values(epicMap).forEach(e => {
    if (e.feature) return;
    // 1. Chercher dans les Epic JIRA (epicIssues)
    const epicIssue = epicIssues.find(i => i.key === e.id);
    if (epicIssue) {
      const fk = _extractFeature(epicIssue);
      if (fk) { e.feature = fk; return; }
    }
    // 2. Chercher dans les Feature JIRA (featureIssues) — leur parent est un Epic JIRA = Feature code
    const featIssue = featureIssues.find(i => i.key === e.id);
    if (featIssue && featIssue.fields?.parent?.key) {
      const parentKey = featIssue.fields.parent.key;
      const parentType = (featIssue.fields.parent?.fields?.issuetype?.name || '').toLowerCase();
      if (parentType === 'epic' || (featIssue.fields.parent?.fields?.issuetype?.hierarchyLevel >= 1 && !featureTypes.includes(parentType))) {
        if (!_featureMap[parentKey]) {
          _featureMap[parentKey] = { id: parentKey, title: featIssue.fields.parent?.fields?.summary || parentKey, color: _pickColor(), status: _mapStatus(featIssue.fields.parent?.fields?.status?.name), _jiraStatus: featIssue.fields.parent?.fields?.status?.name || '' };
        }
        e.feature = parentKey;
      }
    }
  });

  if (Object.keys(epicMap).length === 0) {
    epicMap['E-0'] = { id: 'E-0', title: project, feature: null, team: '', color: _pickColor() };
  }
  const fallbackEpic = Object.keys(epicMap)[0];

  const tickets = otherIssues.map(i => {
    const f       = i.fields;
    const epicKey = _getEpicKey(f) || fallbackEpic;
    const team    = i._boardTeam || epicMap[epicKey]?.team || '';
    // Detect JIRA flagged field (impediment indicator)
    const flagged = _isFlagged(f);
    let   status  = _mapStatus(f.status?.name);
    if (flagged && !isDone(status)) status = 'blocked';
    const labels  = (f.labels || []).map(l => l.toLowerCase());
    const buffer  = _isBuffer(labels, epicKey, epicMap);
    if (buffer) console.log(`[JIRA] Buffer détecté (sprint actif): ${i.key} (epic=${epicKey}, epicTitle=${epicMap[epicKey]?.title || '?'}, labels=[${labels.join(',')}])`);
    // Due date: duedate or Target end (customfield_10015)
    const dueDate = f.duedate || f.customfield_10015 || null;
    // Last comment
    const lastComment = _extractLastComment(f.comment);
    // Sprint name from sprint field
    const sprintRaw  = f[CONFIG.sync.sprintField];
    const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
    const piSprint   = _extractPISprint(sprintList);
    const teamSprint = _extractTeamSprint(sprintList);
    const sprintObj  = teamSprint || sprintList[sprintList.length - 1] || {};
    return {
      id:       i.key,
      title:    f.summary,
      type:     _mapType(f.issuetype?.name),
      epic:     epicKey,
      team,
      assignee: (f.assignee?.displayName || '').trim() || null,
      points:   _getPoints(f),
      status,
      flagged,
      buffer,
      _jiraStatus: f.status?.name || '',
      priority:    _mapPriority(f.priority?.name),
      sprint:      sprintId,
      sprintName:  sprintObj.name || '',
      allSprints:  sprintList.map(s => s.name).filter(Boolean),
      piSprint:    (() => {
        let pn = piSprint?.name || i._piSprintName || '';
        if (!pn && sprintRaw) {
          const rs = typeof sprintRaw === 'string' ? sprintRaw : JSON.stringify(sprintRaw);
          const pm = rs.match(/PI\s*#?\s*(\d+)/i);
          if (pm) pn = `PI#${pm[1]}`;
        }
        return pn;
      })(),
      labels,
      dueDate,
      lastComment,
      comments:    _extractComments(f.comment),
      components:  _extractComponents(f),
      environment: _extractDescription(f.environment) || (typeof f.environment === 'string' ? f.environment : '') || '',
      links:       _extractLinks(f.issuelinks),
      description: _extractDescription(f.description),
      updatedAt:   f.updated || null,
      recentChanges: _extractRecentChanges(i),
    };
  });

  const support = supportIssues.map(i => {
    const f = i.fields;
    const labels = (f.labels || []).map(l => l.toLowerCase());
    return {
      id:          i.key,
      title:       f.summary,
      type:        _mapType(f.issuetype?.name) || 'support',
      priority:    _mapPriority(f.priority?.name),
      status:      isDone(_mapStatus(f.status?.name)) ? 'done' : 'open',
      _jiraStatus: f.status?.name || '',
      _boardStatus: _mapStatus(f.status?.name) || 'todo',
      assignee:    (f.assignee?.displayName || '').trim() || null,
      team:        i._boardTeam || '',
      date:        (f.created || '').slice(0, 10),
      dueDate:     f.duedate || null,
      labels,
      components:  _extractComponents(f),
      environment: _extractDescription(f.environment) || (typeof f.environment === 'string' ? f.environment : '') || '',
      links:       _extractLinks(f.issuelinks),
      lastComment: _extractLastComment(f.comment),
      comments:    _extractComments(f.comment),
      description: _extractDescription(f.description),
    };
  });

  const members      = {};
  const memberColors = {};
  tickets.concat(support).forEach(t => {
    if (!t.assignee) return;
    if (!members[t.team]) members[t.team] = [];
    if (!members[t.team].includes(t.assignee)) members[t.team].push(t.assignee);
    if (!memberColors[t.assignee]) memberColors[t.assignee] = _pickColor();
  });
  // Enrich members from velocity history (covers all PI sprints, not just active)
  Object.entries(teamConfigs).forEach(([team, tc]) => {
    (tc.velocityHistory || []).forEach(vh => {
      (vh.members || []).forEach(m => {
        if (!members[team]) members[team] = [];
        if (!members[team].includes(m)) members[team].push(m);
        if (!memberColors[m]) memberColors[m] = _pickColor();
      });
    });
  });

  return {
    cached_at:       new Date().toISOString(),
    sprint_id:       sprintId,
    sprint_label:    CONFIG.sprint.label,
    sprint_start:    CONFIG.sprint.startDate,
    sprint_start_iso: CONFIG.sprint.startDateISO || '',
    sprint_end:      CONFIG.sprint.endDate,
    sprint_goal:     CONFIG.sprint.goal || '',
    features:        Object.keys(_featureMap).length ? Object.values(_featureMap) : [{ id: 'F-1', title: project, color: '#2563EB' }],
    epics:           Object.values(epicMap),
    tickets,
    support_tickets: support,
    members,
    member_colors:   memberColors,
  };
}

// ============================================================
// Transformation des issues de sprints futurs → format backlog
// ============================================================

// Extrait le sprint PI (ex: "PI#29", "PI #30") depuis la liste des sprints du ticket
function _extractPISprint(sprintList) {
  const piRe = /^PI\s*#?\s*(\d+)/i;
  for (const s of sprintList) {
    if (s && s.name && piRe.test(s.name)) return s;
  }
  return null;
}

// Extrait le sprint d'équipe (non-PI) depuis la liste des sprints du ticket
function _extractTeamSprint(sprintList) {
  const piRe = /^PI\s*#?\s*(\d+)/i;
  for (let i = sprintList.length - 1; i >= 0; i--) {
    if (sprintList[i] && sprintList[i].name && !piRe.test(sprintList[i].name)) return sprintList[i];
  }
  return null;
}

function _transformBacklog(issues, epicMapOverride) {
  // Build epic map for buffer detection (from override or empty)
  const _blEpicMap = epicMapOverride || {};
  // Enrichir avec les parents des issues elles-mêmes (Feature, Epic, Fonctionnalité)
  // → même logique que le transform principal (lignes 530-536)
  issues.forEach(i => {
    const key = _getEpicKey(i.fields);
    if (key && !_blEpicMap[key]) {
      const parentTitle = (i.fields.parent?.key === key) ? (i.fields.parent?.fields?.summary || '') : '';
      _blEpicMap[key] = { title: parentTitle || key };
    }
  });
  return issues.map(i => {
    const f          = i.fields;
    const sprintRaw  = f[CONFIG.sync.sprintField];
    const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
    const piSprint   = _extractPISprint(sprintList);
    const teamSprint = _extractTeamSprint(sprintList);
    // Prefer team sprint name for positioning, but keep PI sprint info
    const sprintObj  = teamSprint || piSprint || sprintList[sprintList.length - 1] || {};
    const labels = (f.labels || []).map(l => l.toLowerCase());
    const epicKey = _getEpicKey(f) || null;
    // PI sprint: from parsed sprint field or from _piSprintName (set by PI board fetch)
    let piSprintName = piSprint?.name || i._piSprintName || '';
    if (!piSprintName && sprintRaw) {
      const rawStr = typeof sprintRaw === 'string' ? sprintRaw : JSON.stringify(sprintRaw);
      const piMatch = rawStr.match(/PI\s*#?\s*(\d+)/i);
      if (piMatch) piSprintName = `PI#${piMatch[1]}`;
    }
    return {
      id:          i.key,
      title:       f.summary,
      type:        _mapType(f.issuetype?.name),
      epic:        epicKey,
      team:        i._boardTeam || '',
      assignee:    (f.assignee?.displayName || '').trim() || null,
      points:      _getPoints(f),
      status:      _mapStatus(f.status?.name) || 'backlog',
      _jiraStatus: f.status?.name || '',
      buffer:      (() => { const b = _isBuffer(labels, epicKey, _blEpicMap); if (b) console.log(`[JIRA] Buffer détecté (backlog): ${i.key} (epic=${epicKey}, epicTitle=${_blEpicMap[epicKey]?.title || '?'}, labels=[${labels.join(',')}])`); return b; })(),
      priority:    _mapPriority(f.priority?.name),
      sprint:      0,
      sprintName:  sprintObj.name      || '',
      sprintStart: sprintObj.startDate || '',
      piSprint:    piSprintName,
    };
  });
}

// ============================================================
// Application d'un objet cache dans les variables globales
// ============================================================

async function _applyCache(cache) {
  // Board column mapping - MUST be restored before tickets (used by _mapStatus)
  if (cache.board_status_map) {
    _boardColumnMap = cache.board_status_map;
    console.log(`[JIRA] Board status map restauré (${Object.keys(_boardColumnMap).length} statuts)`);
  }
  // Board columns: load from dedicated file, fallback to cache embed
  try {
    const bcRes = await fetch(`${DATA_PROXY}/board-columns.json`);
    if (bcRes.ok) {
      BOARD_COLUMNS = await bcRes.json();
      console.log(`[JIRA] Board columns chargé depuis board-columns.json (${Object.keys(BOARD_COLUMNS).length} équipes)`);
    } else if (cache.board_columns) {
      BOARD_COLUMNS = cache.board_columns;
    }
  } catch {
    if (cache.board_columns) BOARD_COLUMNS = cache.board_columns;
  }

  FEATURES.length = 0;        (cache.features        || []).forEach(f => FEATURES.push(f));
  EPICS.length    = 0;        (cache.epics            || []).forEach(e => EPICS.push(e));
  TICKETS.length  = 0;        (cache.tickets || []).forEach(t => {
    // Re-mapper le statut depuis le brut JIRA à chaque chargement du cache
    // → insensible aux évolutions de _STATUS_MAP sans re-sync
    if (t._jiraStatus) t.status = _mapStatus(t._jiraStatus);
    TICKETS.push(t);
  });
  SUPPORT_TICKETS.length  = 0; (cache.support_tickets   || []).forEach(t => SUPPORT_TICKETS.push(t));
  BACKLOG_TICKETS.length  = 0; (cache.backlog_tickets   || []).forEach(t => {
    if (t._jiraStatus) t.status = _mapStatus(t._jiraStatus);
    BACKLOG_TICKETS.push(t);
  });
  INNO_FEATURES.length    = 0; (cache.inno_features     || []).forEach(f => {
    if (f._jiraStatus) f.status = _mapStatus(f._jiraStatus);
    INNO_FEATURES.push(f);
  });
  AMELIORATION_TICKETS.length = 0; (cache.amelioration_tickets || []).forEach(t => {
    if (t._jiraStatus) t.status = _mapStatus(t._jiraStatus);
    AMELIORATION_TICKETS.push(t);
  });

  Object.keys(MEMBERS).forEach(k => delete MEMBERS[k]);
  Object.assign(MEMBERS, cache.members || {});

  Object.keys(MEMBER_COLORS).forEach(k => delete MEMBER_COLORS[k]);
  Object.assign(MEMBER_COLORS, cache.member_colors || {});

  if (cache.sprint_label)     CONFIG.sprint.label        = cache.sprint_label;
  if (cache.sprint_start)     CONFIG.sprint.startDate    = cache.sprint_start;
  if (cache.sprint_start_iso) CONFIG.sprint.startDateISO = cache.sprint_start_iso;
  if (cache.sprint_end)       CONFIG.sprint.endDate      = cache.sprint_end;
  if (cache.sprint_id)    CONFIG.sprint.current   = cache.sprint_id;
  if (cache.sprint_goal)  CONFIG.sprint.goal      = cache.sprint_goal;

  // Groupes dynamiques (depuis JIRA boards)
  if (cache.groups && cache.groups.length) {
    GROUPS.length = 0;
    cache.groups.forEach(g => GROUPS.push(g));
  }

  // CONFIG.teams : mise à jour ou création depuis les équipes réelles
  if (cache.team_configs) {
    Object.entries(cache.team_configs).forEach(([id, cfg]) => {
      if (!CONFIG.teams[id]) CONFIG.teams[id] = {};
      Object.assign(CONFIG.teams[id], cfg);
    });
  }

  console.log(`[JIRA] ${TICKETS.length} tickets · ${EPICS.length} epics · ${SUPPORT_TICKETS.length} support · ${BACKLOG_TICKETS.length} backlog · ${INNO_FEATURES.length} inno · ${AMELIORATION_TICKETS.length} amélio · ${GROUPS.length} groupes`);
}

// ============================================================
// API publique
// ============================================================

/**
 * Charge les données depuis le cache local (data/jira-data.json).
 * Retourne la date ISO du cache si trouvé, null sinon.
 * N'appelle pas JIRA.
 */
async function loadJiraCache() {
  try {
    const res = await fetch(`${DATA_PROXY}/${_cacheFile()}`);
    if (!res.ok) return null;
    const cache = await res.json();
    await _applyCache(cache);
    return cache.cached_at || null;
  } catch {
    return null;
  }
}

/**
 * Fetch tous les boards JIRA, récupère les sprints actifs de chaque board,
 * transforme les issues en taguant l'équipe depuis le nom du board,
 * construit les groupes depuis location.projectKey,
 * sauvegarde en cache et applique.
 * Appelé sur clic "Synchroniser".
 */
async function loadJiraData(opts = {}) {
  _jiraApiCalls = 0; // Reset API call counter
  // Découverte automatique du champ Story Points via l'API /field
  // (son customfield_XXXXX varie selon les instances JIRA)
  let _spFieldId = null;
  try {
    const fr = await _jiraFetch(`${JIRA_PROXY}/api/3/field`, { headers: { Accept: 'application/json' } });
    if (fr.ok) {
      const allFields = await fr.json();
      const spField = allFields.find(f =>
        /^story.?points?$/i.test(f.name) || /^story.?points?$/i.test(f.untranslatedName || '')
      );
      if (spField) {
        _spFieldId = spField.id;
        _pointsFieldKey = spField.id; // pré-cache pour _getPoints
        console.log(`[JIRA] Story Points field détecté : ${spField.name} → ${spField.id}`);
      } else {
        console.warn('[JIRA] Champ Story Points non trouvé via /api/3/field - fallback sur IDs connus');
      }
    }
  } catch (e) {
    console.warn('[JIRA] Découverte champ Story Points échouée :', e.message);
  }

  const fields = [
    'summary', 'status', 'issuetype', 'priority', 'assignee',
    'labels', 'components', 'parent', 'description', 'created', 'updated',
    'flagged', 'duedate', 'comment', 'environment', 'issuelinks',
    CONFIG.sync.sprintField,
    'customfield_10001',
    'customfield_10014', 'customfield_10015',
    'customfield_10016', 'customfield_10028', 'customfield_10005',
    'customfield_10004', 'customfield_10115', 'customfield_10106',
    'customfield_10034', 'customfield_10193',
    ...(_spFieldId && !['customfield_10016','customfield_10028','customfield_10005','customfield_10004','customfield_10115','customfield_10106','customfield_10034','customfield_10193'].includes(_spFieldId) ? [_spFieldId] : []),
  ].join(',');

  // 1. Récupérer tous les boards accessibles en un seul appel
  //    (projectKeyOrId filtre sur le projet propriétaire du board, pas sur les issues -
  //     on filtre donc côté client par location.projectKey pour couvrir tous les setups JIRA)
  const projects = CONFIG.jira.projects || [];
  _syncProgress(0, 1, 'Récupération des boards...');

  // Récupérer tous les boards avec pagination (JIRA limite à 50 par page par défaut)
  const allBoards = [];
  let startAt = 0;
  while (true) {
    const boardsRes = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board?maxResults=${CONFIG.sync.maxBoardsPerPage}&startAt=${startAt}`);
    if (!boardsRes.ok) {
      const err = await boardsRes.json().catch(() => ({}));
      throw new Error(err.message || `Boards HTTP ${boardsRes.status}`);
    }
    const body   = await boardsRes.json();
    const values = body.values || [];
    allBoards.push(...values);
    if (body.isLast || allBoards.length >= (body.total || 0) || !values.length) break;
    startAt += values.length;
  }
  if (!allBoards.length) throw new Error('Aucun board JIRA trouvé');

  // Filtrer par projet (location.projectKey) si JIRA_PROJECT est défini
  const boards = projects.length
    ? allBoards.filter(b => projects.includes(b.location?.projectKey))
    : allBoards;
  if (projects.length) {
    const excluded = allBoards.filter(b => !projects.includes(b.location?.projectKey));
    if (excluded.length) console.log(`[JIRA] Boards exclus (hors projet) : ${excluded.map(b => `"${b.name}" [${b.location?.projectKey || '?'}]`).join(', ')}`);
  }

  // Ne garder que les boards de type scrum - les boards kanban ne supportent pas l'API sprint
  const excludeTeams = (CONFIG.jira.excludeTeams || []).map(t => t.toLowerCase());
  const scrumBoardsRaw = boards.filter(b => b.type === 'scrum');
  const scrumBoards = excludeTeams.length
    ? scrumBoardsRaw.filter(b => !excludeTeams.includes(_boardTeamName(b.name).toLowerCase()))
    : scrumBoardsRaw;
  const skippedBoards = boards.filter(b => b.type !== 'scrum');
  if (excludeTeams.length && scrumBoardsRaw.length !== scrumBoards.length) {
    const excluded = scrumBoardsRaw.filter(b => excludeTeams.includes(_boardTeamName(b.name).toLowerCase()));
    console.log(`[JIRA] Équipes exclues (excludeTeams) : ${excluded.map(b => `"${_boardTeamName(b.name)}"`).join(', ')}`);
  }
  console.log(`[JIRA] ${allBoards.length} boards total → ${boards.length} après filtre projet${projects.length ? ` (${projects.join(', ')})` : ''} → ${scrumBoards.length} scrum (${skippedBoards.length} kanban ignorés)`);
  if (skippedBoards.length) console.log(`[JIRA] Boards non-scrum ignorés : ${skippedBoards.map(b => `"${b.name}" [${b.location?.projectKey}]`).join(', ')}`);

  // 2. Grouper les boards par Espace (location.projectKey)
  //    ex: Espaces > Gestion des Communs > Sprint Fuego → groupe "Gestion des Communs"
  const projectGroups = {}; // projectKey → { name, boards[] }
  scrumBoards.forEach(board => {
    const pk = board.location?.projectKey || board.location?.key || '_DEFAULT';
    const pn = board.location?.projectName || board.location?.name || pk;
    if (!projectGroups[pk]) projectGroups[pk] = { name: pn, boards: [] };
    projectGroups[pk].boards.push(board);
  });

  // 3. Pour chaque board, récupérer le sprint actif et ses issues
  const allIssues   = [];
  const teamConfigs = {}; // teamName → { name, color, boardId }
  let   firstSprint = null;
  let   gColorIdx   = 0;

  // Total des étapes : 1 (boards) + N scrumBoards × 2 (sprint + issues) + 1 (transform/save)
  const _totalSteps = 1 + scrumBoards.length * 2 + 1;
  let   _curStep    = 1;

  // Patterns de boards à ignorer (PI planning, boards agrégateurs, etc.)
  const _SKIP_BOARD_RE = /\b(PI\s*Board|Board\s*Features?|Cadrage|Post[- ]Mortem|Rétrospective|Retrospective|Program\s*Board)\b/i;
  // Boards PI détectés (sprint actif = "PI#XX") - leurs sprints futurs seront fetchés après
  const _piBoardIds = [];
  // Board column configs accumulator - { boardName: { columns: [ { name, statuses: [{id, name}] } ] } }
  const _allBoardColumns = {};

  for (const board of scrumBoards) {
    // Ignorer les boards PI/agrégateurs - pas des boards d'équipe sprint
    if (_SKIP_BOARD_RE.test(board.name)) {
      console.log(`[JIRA] Board ignoré (PI/agrégateur) : "${board.name}"`);
      _curStep += 2; // sauter les 2 étapes sprint + issues
      continue;
    }

    const teamName = _boardTeamName(board.name);

    // Couleur cohérente par équipe
    if (!teamConfigs[teamName]) {
      teamConfigs[teamName] = {
        name:       teamName,
        color:      _COLOR_PALETTE[Object.keys(teamConfigs).length % _COLOR_PALETTE.length],
        boardId:    board.id,
        projectKey: board.location?.projectKey || '',
      };
    }

    // Sprint actif + configuration colonnes de ce board (en parallèle)
    _syncProgress(++_curStep, _totalSteps, `Sprint : ${teamName}…`);
    let sprintId = null;

    // Fetch board column configuration (non-blocking)
    const _boardConfigPromise = _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${board.id}/configuration`, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    try {
      const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${board.id}/sprint?state=active&maxResults=1`);
      if (sr.ok) {
        const sb     = await sr.json();
        const sprint = (sb.values || [])[0];
        if (sprint) {
          // Ignorer les boards dont le sprint actif est un PI (ex: "PI#28") - pas des sprints d'équipe
          // Mais garder l'ID pour fetcher les sprints PI futurs (PI#29, PI#30…)
          if (/^PI\s*#?\d+/i.test(sprint.name)) {
            console.log(`[JIRA] Board "${board.name}" ignoré - sprint PI : "${sprint.name}" (sprints futurs seront fetchés)`);
            _piBoardIds.push(board.id);
            _curStep++; // sauter l'étape issues
            continue;
          }
          sprintId = sprint.id;
          // Stocker le sprint de chaque équipe (pour la sidebar par équipe)
          teamConfigs[teamName].sprintName    = sprint.name;
          teamConfigs[teamName].sprintStart   = _fmtDate(sprint.startDate);
          teamConfigs[teamName].sprintEnd     = _fmtDate(sprint.endDate);
          teamConfigs[teamName].sprintStartISO = sprint.startDate || '';
          teamConfigs[teamName].sprintGoal    = sprint.goal || '';
          if (!firstSprint) {
            firstSprint = sprint;
            CONFIG.sprint.current      = sprint.id;
            CONFIG.sprint.label        = sprint.name;
            CONFIG.sprint.startDate    = _fmtDate(sprint.startDate);
            CONFIG.sprint.endDate      = _fmtDate(sprint.endDate);
            CONFIG.sprint.startDateISO = sprint.startDate || '';
            CONFIG.sprint.goal      = sprint.goal || '';
            console.log(`[JIRA] Sprint référence : ${sprint.name} (id=${sprint.id})`);
          }
        }
      }
    } catch (e) {
      console.warn(`[JIRA] Sprint board ${board.id} (${board.name}) : ${e.message}`);
    }

    // Process board column configuration (await the parallel fetch)
    const _boardConfig = await _boardConfigPromise;
    if (_boardConfig?.columnConfig?.columns) {
      const cols = _boardConfig.columnConfig.columns;
      const boardCols = [];
      cols.forEach(col => {
        const internal = _mapColumnToInternal(col.name);
        const statuses = (col.statuses || []).map(st => ({
          id:   st.id,
          name: st.name || '',
        }));
        boardCols.push({ name: col.name, internal, statuses });
        // Build dynamic status mapping
        if (internal) {
          statuses.forEach(st => {
            const stName = (st.name || '').toLowerCase().trim();
            if (stName && !_boardColumnMap[stName]) {
              _boardColumnMap[stName] = internal;
            }
          });
        }
      });
      _allBoardColumns[teamName] = boardCols;
      const summary = boardCols.map(c => `${c.name}→${c.internal || '?'}(${c.statuses.length})`).join(', ');
      console.log(`[JIRA] Board "${board.name}" colonnes : ${summary}`);
    }

    if (!sprintId) {
      _curStep++; // sauter l'étape issues
      console.log(`[JIRA] Board "${board.name}" : pas de sprint actif`);
      continue;
    }

    // Issues du sprint actif
    _syncProgress(++_curStep, _totalSteps, `Issues : ${teamName}…`);
    try {
      const jql = `sprint=${sprintId} ORDER BY issuetype ASC, updated DESC`;
      const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${fields}&expand=changelog`;
      const ir  = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
      if (ir.ok) {
        const ib = await ir.json();
        const issues = ib.issues || [];
        issues.forEach(issue => { issue._boardTeam = teamName; });
        allIssues.push(...issues);
        if (issues.length) teamConfigs[teamName].hasIssues = true;
        console.log(`[JIRA] Board "${board.name}" → équipe "${teamName}" : ${issues.length} issues`);
      } else {
        console.warn(`[JIRA] Issues board ${board.id} : HTTP ${ir.status}`);
      }
    } catch (e) {
      console.warn(`[JIRA] Issues board ${board.id} (${board.name}) : ${e.message}`);
    }
  }

  if (!allIssues.length) throw new Error('Aucun ticket trouvé dans les sprints actifs');

  // 3.5b Détection des équipes inactives (dissoutes)
  // Une équipe est inactive si son sprint actif est terminé depuis trop longtemps
  // par rapport au sprint de référence (seuil : 60 jours ≈ 2 PI)
  {
    const refStart = CONFIG.sprint.startDate ? new Date(CONFIG.sprint.startDate) : null;
    if (refStart) {
      const INACTIVE_THRESHOLD_DAYS = 60;
      Object.entries(teamConfigs).forEach(([name, tc]) => {
        if (!tc.sprintEnd) return;
        const teamEnd = new Date(tc.sprintEnd);
        const diffDays = Math.round((refStart - teamEnd) / (1000 * 60 * 60 * 24));
        if (diffDays > INACTIVE_THRESHOLD_DAYS) {
          tc.inactive = true;
          tc.hasIssues = false; // exclure du cache et des vues
          console.log(`[JIRA] Équipe "${name}" marquée inactive (sprint "${tc.sprintName}" terminé il y a ${diffDays}j, seuil ${INACTIVE_THRESHOLD_DAYS}j)`);
        }
      });
    }
  }

  // Retirer les tickets des équipes inactives
  const _inactiveTeams = new Set(Object.entries(teamConfigs).filter(([, tc]) => tc.inactive).map(([n]) => n));
  if (_inactiveTeams.size) {
    const before = allIssues.length;
    for (let i = allIssues.length - 1; i >= 0; i--) {
      if (_inactiveTeams.has(allIssues[i]._boardTeam)) allIssues.splice(i, 1);
    }
    if (before !== allIssues.length) console.log(`[JIRA] ${before - allIssues.length} tickets d'équipes inactives retirés`);
  }

  // allFutureIssues declared here so it's accessible after the if/else block
  const allFutureIssues = [];
  const _futureSeenKeys = new Set();
  // Shared epicMap for buffer detection across closed sprints + backlog
  const _sharedEpicMap = {};

  // 3.6 Historique de vélocité - via board API (sprints fermés par board)
  // (Skipped in incremental mode - velocity doesn't change during sprint)
  if (opts.incremental) {
    console.log('[JIRA] Sync incrémentale - vélocité et backlog ignorés');
  } else {
  // Fetch tous les tickets de chaque sprint fermé, filtre les "Done" en JS
  // (pas de JQL status=Done car les statuts varient selon les instances JIRA)
  {
    const _ptFields = fields;

    // Champs pour le calcul de vélocité + détail tickets par sprint (popin)
    const _velFieldsArr = [
      'status', 'summary', 'issuetype', 'assignee', 'parent', 'labels',
      'customfield_10016', 'customfield_10028', 'customfield_10005',
      'customfield_10004', 'customfield_10115', 'customfield_10106',
      'customfield_10034', 'customfield_10193',
      ...(_spFieldId && !['customfield_10016','customfield_10028','customfield_10005','customfield_10004','customfield_10115','customfield_10106','customfield_10034','customfield_10193'].includes(_spFieldId) ? [_spFieldId] : []),
    ];
    if (CONFIG.sync.enrichClosedSprints) _velFieldsArr.push('description', 'priority', 'components');
    const _velFields = _velFieldsArr.join(',');

    await Promise.all(Object.entries(teamConfigs).map(async ([teamName, tc]) => {
      if (!tc.boardId || !tc.hasIssues) return;
      try {
        const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${tc.boardId}/sprint?state=closed&maxResults=${CONFIG.sync.closedSprintsFetch}`);
        if (!sr.ok) return;
        const allClosed = (await sr.json()).values || [];
        // Filtrer les sprints PI (ex: "PI#28", "PI 29") - ce ne sont pas des sprints d'équipe
        const teamSprints = allClosed.filter(s => !/^PI\s*#?\d+/i.test(s.name));
        // Trier par date de fin (ou début) décroissante - l'API retourne par ID, pas par date
        teamSprints.sort((a, b) => {
          const da = new Date(a.endDate || a.startDate || 0);
          const db = new Date(b.endDate || b.startDate || 0);
          return da - db;
        });
        const closed = teamSprints.slice(-CONFIG.sync.velocityHistoryCount);
        const projKey = tc.projectKey || '';

        // Phase 1 : fetcher les issues de chaque sprint fermé (en parallèle)
        const sprintData = await Promise.all(closed.map(async sprint => {
          try {
            const jql = projKey
              ? `sprint=${sprint.id} AND project="${projKey}"`
              : `sprint=${sprint.id}`;
            const ir  = await _jiraFetch(`${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${_velFields}`, { headers: { Accept: 'application/json' } });
            if (!ir.ok) {
              console.warn(`[JIRA] Vélocité ${teamName} sprint ${sprint.name} : HTTP ${ir.status}`);
              return { sprint, issues: [] };
            }
            const issues = (await ir.json()).issues || [];
            return { sprint, issues };
          } catch (e) {
            console.warn(`[JIRA] Vélocité ${teamName} sprint ${sprint.name} : ${e.message}`);
            return { sprint, issues: [] };
          }
        }));

        // Phase 2 : pour chaque ticket done, retenir uniquement le sprint le plus récent
        // (les sprints sont triés chronologiquement → le dernier gagne)
        const issueLastSprint = new Map(); // issueKey → index du sprint le plus récent
        sprintData.forEach((sd, idx) => {
          sd.issues.filter(i => isDone(_mapStatus(i.fields.status?.name))).forEach(i => issueLastSprint.set(i.key, idx));
        });
        // Aussi vérifier les tickets du sprint actif : si un ticket done d'un sprint
        // fermé est aussi dans le sprint actif, il a glissé → l'exclure du fermé
        const activeKeys = new Set(allIssues.filter(i => i._boardTeam === teamName).map(i => i.key));

        // Phase 3 : construire velocityHistory en excluant les tickets qui ont glissé
        // Construire un epicMap local pour la détection buffer
        const _closedEpicMap = {};
        const _epicLikeTypes = new Set(['epic', 'feature', 'fonctionnalité']);
        sprintData.forEach(sd => sd.issues.forEach(i => {
          const t = (i.fields.issuetype?.name || '').toLowerCase();
          if (_epicLikeTypes.has(t)) _closedEpicMap[i.key] = { title: i.fields.summary || '' };
          // Aussi ajouter le parent référencé (même logique que transform principal)
          const pk = _getEpicKey(i.fields);
          if (pk && !_closedEpicMap[pk] && i.fields.parent?.key === pk) {
            _closedEpicMap[pk] = { title: i.fields.parent?.fields?.summary || '' };
          }
        }));
        // Compléter avec les epics/features du sprint actif
        allIssues.forEach(i => {
          const t = (i.fields.issuetype?.name || '').toLowerCase();
          if (_epicLikeTypes.has(t)) _closedEpicMap[i.key] = { title: i.fields.summary || '' };
          const pk = _getEpicKey(i.fields);
          if (pk && !_closedEpicMap[pk] && i.fields.parent?.key === pk) {
            _closedEpicMap[pk] = { title: i.fields.parent?.fields?.summary || '' };
          }
        });
        // Propager vers le epicMap partagé (accessible par _blEpicMap pour le backlog)
        Object.assign(_sharedEpicMap, _closedEpicMap);

        tc.velocityHistory = sprintData.map((sd, idx) => {
          const doneIssues = sd.issues.filter(i => isDone(_mapStatus(i.fields.status?.name))).filter(i => {
            // Ticket présent dans le sprint actif → il a glissé vers le sprint courant
            if (activeKeys.has(i.key)) {
              console.log(`[JIRA] Vélocité ${teamName} ${sd.sprint.name} : ${i.key} exclu (glissé → sprint actif)`);
              return false;
            }
            if (issueLastSprint.get(i.key) !== idx) {
              console.log(`[JIRA] Vélocité ${teamName} ${sd.sprint.name} : ${i.key} exclu (glissé → ${sprintData[issueLastSprint.get(i.key)]?.sprint.name})`);
              return false;
            }
            return true;
          });
          const velocity = doneIssues.reduce((a, i) => a + _getPoints(i.fields), 0);
          const _enrich = CONFIG.sync.enrichClosedSprints;
          const _enrichFields = (i) => _enrich ? {
            description: _extractDescription(i.fields.description),
            priority:    (i.fields.priority?.name || '').toLowerCase(),
            labels:      (i.fields.labels || []).map(l => l.toLowerCase()),
            components:  (i.fields.components || []).map(c => c.name || c),
          } : {};
          const tickets = doneIssues.map(i => ({
            id:       i.key,
            title:    i.fields.summary || '',
            type:     _mapType(i.fields.issuetype?.name),
            status:   _mapStatus(i.fields.status?.name),
            points:   _getPoints(i.fields),
            assignee: i.fields.assignee?.displayName || '',
            epic:     i.fields.parent?.key || '',
            ..._enrichFields(i),
          }));
          // Buffer tickets : tous les tickets buffer de ce sprint (done ou non), hors glissés
          const bufferTickets = sd.issues
            .filter(i => !activeKeys.has(i.key))
            .filter(i => {
              const labels = (i.fields.labels || []).map(l => l.toLowerCase());
              const epicKey = _getEpicKey(i.fields);
              return _isBuffer(labels, epicKey, _closedEpicMap);
            })
            .map(i => ({
              id:       i.key,
              title:    i.fields.summary || '',
              type:     _mapType(i.fields.issuetype?.name),
              status:   _mapStatus(i.fields.status?.name),
              points:   _getPoints(i.fields),
              assignee: i.fields.assignee?.displayName || '',
              epic:     _getEpicKey(i.fields) || '',
              team:     teamName,
              buffer:   true,
              sprintName: sd.sprint.name,
              ..._enrichFields(i),
            }));
          // Collect all unique assignees from all sprint issues (not just done)
          const sprintMembers = [...new Set(sd.issues.map(i => (i.fields.assignee?.displayName || '').trim()).filter(Boolean))];
          return { name: sd.sprint.name, velocity, tickets, bufferTickets, members: sprintMembers, startDate: sd.sprint.startDate || '', endDate: sd.sprint.endDate || '' };
        });
        console.log(`[JIRA] Vélocité ${teamName} : ${tc.velocityHistory.map(s => `${s.name}=${s.velocity}`).join(', ')}`);
      } catch (e) {
        console.warn(`[JIRA] Vélocité ${teamName} : ${e.message}`);
      }
    }));
  }

  // 3.7 Tickets en sprints futurs → backlog planifié (vue Roadmap)
  //     On utilise l'API board-specific pour récupérer les sprints futurs de chaque board,
  //     puis les issues de chaque sprint, afin d'assigner le bon _boardTeam.
  {
    await Promise.all(Object.entries(teamConfigs).map(async ([teamName, tc]) => {
      if (!tc.boardId || !tc.hasIssues) return;
      try {
        // Récupérer les sprints futurs du board
        const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${tc.boardId}/sprint?state=future&maxResults=${CONFIG.sync.maxFutureSprints}`);
        if (!sr.ok) return;
        const sb = await sr.json();
        const futureSprints = sb.values || [];
        if (!futureSprints.length) return;

        // Récupérer les issues de chaque sprint futur
        for (const fs of futureSprints) {
          const jql = `sprint=${fs.id} ORDER BY priority ASC`;
          const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${fields}`;
          const ir  = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
          if (!ir.ok) continue;
          const issues = (await ir.json()).issues || [];
          issues.forEach(issue => {
            if (_futureSeenKeys.has(issue.key)) return; // de-dup cross-board
            _futureSeenKeys.add(issue.key);
            issue._boardTeam = teamName;
            issue._isFuture  = true;
            allFutureIssues.push(issue);
          });
        }
        const count = allFutureIssues.filter(i => i._boardTeam === teamName).length;
        if (count) console.log(`[JIRA] Sprints futurs "${teamName}" : ${count} tickets (${futureSprints.length} sprints)`);
      } catch (e) {
        console.warn(`[JIRA] Sprints futurs ${teamName} : ${e.message}`);
      }
    }));
  }

  // 3.8 Sprints PI futurs - récupérer les tickets planifiés dans les sprints PI (PI#28, PI#29, PI#30…)
  //     Stratégie : requête JQL directe par nom de sprint "PI#XX" - indépendant des boards.
  //     Les sprints PI peuvent être sur n'importe quel board (y compris hors-projet ou kanban).
  {
    const _currentPIMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
    const _currentPINum = _currentPIMatch ? parseInt(_currentPIMatch[1]) : null;

    if (_currentPINum) {
      // Chercher les PI courant et futurs (ex: PI#28, PI#29, PI#30)
      const piNames = [];
      const _piFuture = CONFIG.sync.piFutureCount || 2;
      for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI#${_currentPINum + i}"`);
      // Aussi chercher avec espace : "PI #29"
      for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI #${_currentPINum + i}"`);
      // Aussi chercher sans # : "PI29" (tickets en prévision, hors hiérarchie)
      for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI${_currentPINum + i}"`);

      const projFilter = (CONFIG.jira.projects || []).length
        ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
        : '';
      const piJql = `sprint IN (${piNames.join(',')})${projFilter} ORDER BY priority ASC`;
      console.log(`[JIRA] Recherche tickets PI : ${piJql}`);
      const _piActiveKeys = new Set(allIssues.map(i => i.key));

      try {
        // Paginer les résultats (JIRA Cloud limite à 100 par page)
        const maxPi = CONFIG.sync.maxPIIssues || 500;
        const pageSize = 100;
        let allPiIssues = [];
        let piTotal = Infinity;
        for (let startAt = 0; startAt < maxPi; startAt += pageSize) {
          const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(piJql)}&maxResults=${pageSize}&startAt=${startAt}&fields=${fields}`;
          const ir = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
          if (!ir.ok) break;
          const body = await ir.json();
          const page = body.issues || [];
          if (body.total != null) piTotal = body.total;
          allPiIssues = allPiIssues.concat(page);
          console.log(`[JIRA] PI page ${Math.floor(startAt/pageSize)+1}: ${page.length} issues (total: ${piTotal}, fetched: ${allPiIssues.length})`);
          if (page.length < pageSize || allPiIssues.length >= piTotal) break;
        }
        if (allPiIssues.length) {
          const issues = allPiIssues;
          const _activeKeys = new Set(allIssues.map(i => i.key));
          let added = 0, enriched = 0;
          issues.forEach(issue => {
            // Extraire le sprint PI depuis le champ sprint du ticket
            const sprintRaw  = issue.fields[CONFIG.sync.sprintField];
            const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
            const piSprint   = _extractPISprint(sprintList);
            let   piName     = piSprint?.name || '';
            // Fallback : regex sur la donnée brute
            if (!piName && sprintRaw) {
              const rawStr = typeof sprintRaw === 'string' ? sprintRaw : JSON.stringify(sprintRaw);
              const piMatch = rawStr.match(/PI\s*#?\s*(\d+)/i);
              if (piMatch) piName = `PI#${piMatch[1]}`;
            }
            // Fallback ultime : si sprintField est null (Features JIRA ne retournent pas le sprint),
            // scanner TOUS les champs de l'issue pour trouver un sprint PI
            if (!piName) {
              const allFieldsStr = JSON.stringify(issue.fields || {});
              const piScan = allFieldsStr.match(/PI\s*#?\s*(\d+)/i);
              if (piScan) piName = `PI#${piScan[1]}`;
              // Dernier recours : le JQL a trouvé cette issue, assigner le PI courant+futur
              if (!piName && _currentPINum) {
                // Chercher dans tous les champs sprint alternatifs connus
                const _sprintFields = ['customfield_10016','customfield_10028','customfield_10005','customfield_10004','customfield_10020','sprint'];
                for (const sf of _sprintFields) {
                  const val = issue.fields[sf];
                  if (!val) continue;
                  const str = typeof val === 'string' ? val : JSON.stringify(val);
                  const m = str.match(/PI\s*#?\s*(\d+)/i);
                  if (m) { piName = `PI#${m[1]}`; break; }
                }
              }
            }

            if (_futureSeenKeys.has(issue.key)) {
              // Ticket déjà vu depuis un board d'équipe - enrichir avec le sprint PI
              const existing = allFutureIssues.find(i => i.key === issue.key);
              if (existing && !existing._piSprintName) {
                existing._piSprintName = piName;
                enriched++;
              }
              return;
            }
            if (_activeKeys.has(issue.key)) {
              // Ticket dans le sprint actif - enrichir
              const existing = allIssues.find(ai => ai.key === issue.key);
              if (existing) { existing._piSprintName = piName; enriched++; }
              // Features/Epics : s'assurer qu'elles sont dans allFutureIssues avec piSprintName
              const iType = (issue.fields?.issuetype?.name || '').toLowerCase();
              if (iType === 'feature' || iType === 'fonctionnalité') console.log(`[JIRA] PI Feature in activeKeys: ${issue.key} type=${iType} piName=${piName} boardTeam=${existing?._boardTeam}`);
              if (iType === 'feature' || iType === 'fonctionnalité' || iType === 'epic') {
                // Si déjà dans allFutureIssues, enrichir piSprintName
                const existingFuture = allFutureIssues.find(fi => fi.key === issue.key);
                if (existingFuture) {
                  if (piName && !existingFuture._piSprintName) existingFuture._piSprintName = piName;
                } else {
                  // Ajouter au pool futur
                  _futureSeenKeys.add(issue.key);
                  issue._boardTeam = existing?._boardTeam || '_PI';
                  issue._piSprintName = piName;
                  allFutureIssues.push(issue);
                }
              }
              return;
            }
            // Nouveau ticket - déterminer l'équipe depuis les issues connues (même epic)
            const epicKey = _getEpicKey(issue.fields);
            let epicTeam = null;
            if (epicKey) {
              const sameEpic = allIssues.find(ai => _getEpicKey(ai.fields) === epicKey && ai._boardTeam);
              if (sameEpic) {
                epicTeam = sameEpic._boardTeam;
              } else {
                const sameEpicFuture = allFutureIssues.find(fi => _getEpicKey(fi.fields) === epicKey && fi._boardTeam && fi._boardTeam !== '_PI');
                if (sameEpicFuture) epicTeam = sameEpicFuture._boardTeam;
              }
            }
            _futureSeenKeys.add(issue.key);
            issue._boardTeam     = epicTeam || '_PI';
            issue._isFuture      = true;
            // Si piName est vide mais l'issue a été trouvée par le JQL PI, marquer comme PI issue
            issue._piSprintName  = piName || `PI#${_currentPINum}`;
            issue._fromPiJql     = true;
            allFutureIssues.push(issue);
            added++;
          });
          // Distribution des PI trouvés
          const piDist = {};
          allFutureIssues.forEach(fi => { if (fi._piSprintName) piDist[fi._piSprintName] = (piDist[fi._piSprintName] || 0) + 1; });
          console.log(`[JIRA] Tickets PI : ${issues.length} trouvés, ${added} nouveaux, ${enriched} enrichis - distribution:`, piDist);
        }
      } catch (e) {
        console.warn(`[JIRA] Recherche tickets PI : ${e.message}`);
      }

      // Fetch dédié des Features par PI (le sprint field est null pour les Features JIRA)
      // Requête par PI individuel pour assigner le bon piSprint
      for (let pi = 0; pi <= _piFuture; pi++) {
        const piN = _currentPINum + pi;
        const piSprintName = `PI#${piN}`;
        try {
          const featJql = `sprint IN ("PI#${piN}","PI #${piN}","PI${piN}")${projFilter} AND issuetype IN (Feature, Fonctionnalité) ORDER BY key ASC`;
          const featUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(featJql)}&maxResults=200&fields=${fields}`;
          const featRes = await _jiraFetch(featUrl, { headers: { Accept: 'application/json' } });
          if (!featRes.ok) continue;
          const featIssues = (await featRes.json()).issues || [];
          let featAdded = 0;
          featIssues.forEach(issue => {
            // Déterminer l'équipe depuis le champ Team JIRA
            // Chercher dans plusieurs custom fields connus pour le champ "Team"
            let teamField = null;
            for (const cf of ['customfield_10001','customfield_10193','customfield_10028','customfield_10004']) {
              const v = issue.fields?.[cf];
              if (v && typeof v === 'object' && (v.name || v.value)) { teamField = v; break; }
              if (v && typeof v === 'string' && v.length > 1) { teamField = v; break; }
            }
            let team = '_PI';
            if (teamField) {
              const teamStr = typeof teamField === 'string' ? teamField : (teamField.name || teamField.value || JSON.stringify(teamField));
              const tMatch = teamStr.match(/[-–]\s*(.+)/);
              team = tMatch ? tMatch[1].trim() : teamStr.trim();
            }
            if (!_futureSeenKeys.has(issue.key) && !_piActiveKeys.has(issue.key)) {
              _futureSeenKeys.add(issue.key);
              issue._boardTeam = team;
              issue._isFuture = true;
              issue._piSprintName = piSprintName;
              issue._fromPiJql = true;
              allFutureIssues.push(issue);
              featAdded++;
            } else {
              const existing = allFutureIssues.find(fi => fi.key === issue.key);
              if (existing) {
                if (!existing._piSprintName) existing._piSprintName = piSprintName;
                if ((!existing._boardTeam || existing._boardTeam === '_PI') && team !== '_PI') existing._boardTeam = team;
              }
            }
          });
          if (featIssues.length) console.log(`[JIRA] Features ${piSprintName} : ${featIssues.length} trouvées, ${featAdded} ajoutées`);

          // Fetch enfants de TOUTES les features PI (stories/tasks sans sprint)
          const allFeatKeys = featIssues.map(i => i.key);
          if (allFeatKeys.length) {
            let totalChildAdded = 0;
            // Batch par 50 clés pour ne pas dépasser la limite JQL
            for (let b = 0; b < allFeatKeys.length; b += 50) {
              const batch = allFeatKeys.slice(b, b + 50);
              try {
                const childJql = `parent IN (${batch.join(',')})${projFilter} ORDER BY key ASC`;
                const childUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(childJql)}&maxResults=200&fields=${fields}`;
                const childRes = await _jiraFetch(childUrl, { headers: { Accept: 'application/json' } });
                if (!childRes.ok) continue;
                const childIssues = (await childRes.json()).issues || [];
                childIssues.forEach(ci => {
                  if (_futureSeenKeys.has(ci.key) || _piActiveKeys.has(ci.key)) return;
                  _futureSeenKeys.add(ci.key);
                  const parentKey = ci.fields?.parent?.key;
                  const parentInFuture = parentKey ? allFutureIssues.find(fi => fi.key === parentKey) : null;
                  ci._boardTeam = parentInFuture?._boardTeam || '_PI';
                  ci._isFuture = true;
                  ci._piSprintName = piSprintName;
                  ci._fromPiJql = true;
                  allFutureIssues.push(ci);
                  totalChildAdded++;
                });
              } catch (e2) {
                console.warn(`[JIRA] Enfants Features PI#${piN} batch : ${e2.message}`);
              }
            }
            if (totalChildAdded) console.log(`[JIRA] Enfants Features ${piSprintName} : ${totalChildAdded} ajoutés (${allFeatKeys.length} features)`);
          }
        } catch (e) {
          console.warn(`[JIRA] Features PI#${piN} : ${e.message}`);
        }
      }
    }
  }

  } // end else (non-incremental)

  // 3.5 Résoudre les titres des epics/features référencées mais absentes du sprint
  {
    const hierarchyTypes = ['epic', 'feature', 'fonctionnalité'];
    const allPool = [].concat(allIssues, allFutureIssues);
    const fetchedKeys = new Set(
      allPool.filter(i => hierarchyTypes.includes((i.fields.issuetype?.name || '').toLowerCase()))
             .map(i => i.key)
    );
    const stubKeys = [...new Set(
      allPool
        .map(i => _getEpicKey(i.fields))
        .filter(k => k && !fetchedKeys.has(k))
    )];
    if (stubKeys.length) {
      _syncProgress(_totalSteps, _totalSteps, `Titres epics (${stubKeys.length})…`);
      try {
        const jql = `issuekey in (${stubKeys.join(',')})`;
        const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxEpicsResolve}&fields=summary,status,issuetype,assignee`;
        const res = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const body = await res.json();
          (body.issues || []).forEach(i => { allIssues.push(i); allFutureIssues.push(i); });
          console.log(`[JIRA] ${body.issues?.length || 0} epic(s)/feature(s) résolue(s)`);
        }
      } catch (e) {
        console.warn('[JIRA] Résolution epics :', e.message);
      }
    }
  }

  // 3.6 Innovation : Features avec label "inno" + leurs tickets enfants
  //     Les Features JIRA (issuetype Feature/Fonctionnalité) avec l'étiquette "Inno"
  //     sont des initiatives d'innovation. On récupère aussi leurs enfants (stories, bugs, etc.)
  const _innoFeatureList = [];
  if (!opts.incremental) {
    const _innoProjFilter = (CONFIG.jira.projects || []).length
      ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
      : '';
    const _innoJql = `issuetype in (Feature, Fonctionnalité) AND labels in (Inno, inno, innovation, Innovation)${_innoProjFilter} ORDER BY priority ASC`;
    console.log(`[JIRA] Innovation Features : ${_innoJql}`);
    try {
      const _innoUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_innoJql)}&maxResults=200&fields=${fields}`;
      const _innoRes = await _jiraFetch(_innoUrl, { headers: { Accept: 'application/json' } });
      if (_innoRes.ok) {
        const _innoIssues = (await _innoRes.json()).issues || [];
        const _innoKeys = _innoIssues.map(i => i.key);
        console.log(`[JIRA] Innovation : ${_innoIssues.length} features trouvées (${_innoKeys.join(', ')})`);

        // Stocker les Features en tant qu'INNO_FEATURES
        _innoIssues.forEach(i => {
          const f = i.fields;
          const sprintRaw  = f[CONFIG.sync.sprintField];
          const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
          const piSprint   = _extractPISprint(sprintList);
          _innoFeatureList.push({
            id:          i.key,
            title:       f.summary || '',
            status:      _mapStatus(f.status?.name),
            _jiraStatus: f.status?.name || '',
            labels:      (f.labels || []).map(l => l.toLowerCase()),
            assignee:    f.assignee?.displayName || '',
            points:      _getPoints(f),
            piSprint:    piSprint?.name || '',
            dueDate:     f.duedate || f.customfield_10015 || null,
          });
        });

        // Récupérer les tickets enfants des Features d'innovation
        if (_innoKeys.length) {
          const _childJql = `parent in (${_innoKeys.join(',')})${_innoProjFilter} ORDER BY priority ASC`;
          console.log(`[JIRA] Innovation enfants : ${_childJql}`);
          try {
            const _childUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_childJql)}&maxResults=500&fields=${fields}`;
            const _childRes = await _jiraFetch(_childUrl, { headers: { Accept: 'application/json' } });
            if (_childRes.ok) {
              const _childIssues = (await _childRes.json()).issues || [];
              const _activeKeys = new Set(allIssues.map(i => i.key));
              const _futureKeys = new Set(allFutureIssues.map(i => i.key));

              // Construire un mapping assignee → team depuis les issues connues
              const _memberTeamMap = {};
              allIssues.forEach(i => {
                if (i._boardTeam && i.fields?.assignee?.displayName) {
                  _memberTeamMap[i.fields.assignee.displayName] = i._boardTeam;
                }
              });

              let _childAdded = 0, _childEnriched = 0;
              _childIssues.forEach(i => {
                if (_activeKeys.has(i.key) || _futureKeys.has(i.key)) {
                  _childEnriched++;
                  return; // déjà connu
                }
                // Détecter l'équipe via assignee ou epic commun
                const assignee = i.fields?.assignee?.displayName;
                let team = (assignee && _memberTeamMap[assignee]) || null;
                if (!team) {
                  const epicKey = _getEpicKey(i.fields);
                  if (epicKey) {
                    const sameEpic = allIssues.find(ai => _getEpicKey(ai.fields) === epicKey && ai._boardTeam);
                    if (sameEpic) team = sameEpic._boardTeam;
                  }
                }
                i._boardTeam = team || '';
                allIssues.push(i);
                _childAdded++;
              });
              console.log(`[JIRA] Innovation enfants : ${_childIssues.length} trouvés, ${_childAdded} ajoutés, ${_childEnriched} déjà connus`);
            }
          } catch (e) {
            console.warn('[JIRA] Innovation enfants :', e.message);
          }
        }
      } else {
        console.warn(`[JIRA] Innovation Features : HTTP ${_innoRes.status}`);
      }
    } catch (e) {
      console.warn('[JIRA] Innovation Features :', e.message);
    }
  }

  // 3.7 Amélioration continue : tickets rétro, post-mortem, CoP
  const _ameliorationList = [];
  if (!opts.incremental) {
    const _amelProjFilter = (CONFIG.jira.projects || []).length
      ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
      : '';
    const _amelJql = `(labels in (Rétro, ActionRetro, Amélioration, postmortem, retro, retro-tech, RetroFonc, Adapt, CoP-méthodo, cop-dev, Methodo) OR summary ~ Rétro OR summary ~ Retro OR summary ~ postmortem OR summary ~ "post-mortem" OR summary ~ CoP) AND (statusCategory != Done OR resolved >= -15d)${_amelProjFilter} ORDER BY labels DESC, status DESC, Rank ASC`;
    console.log(`[JIRA] Amélioration continue : ${_amelJql}`);
    try {
      const _amelUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_amelJql)}&maxResults=500&fields=${fields}`;
      const _amelRes = await _jiraFetch(_amelUrl, { headers: { Accept: 'application/json' } });
      if (_amelRes.ok) {
        const _amelIssues = (await _amelRes.json()).issues || [];
        console.log(`[JIRA] Amélioration continue : ${_amelIssues.length} tickets trouvés`);
        _amelIssues.forEach(i => {
          const f = i.fields;
          const sprintRaw  = f[CONFIG.sync.sprintField];
          const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
          const piSprint   = _extractPISprint(sprintList);
          // Detect team via assignee or board membership
          const assignee = f.assignee?.displayName || '';
          let team = '';
          if (assignee) {
            for (const ai of allIssues) {
              if (ai.fields?.assignee?.displayName === assignee && ai._boardTeam) {
                team = ai._boardTeam;
                break;
              }
            }
          }
          _ameliorationList.push({
            id:          i.key,
            title:       f.summary || '',
            status:      _mapStatus(f.status?.name),
            _jiraStatus: f.status?.name || '',
            labels:      (f.labels || []).map(l => l.toLowerCase()),
            assignee:    assignee,
            points:      _getPoints(f),
            team:        team,
            type:        _mapType(f.issuetype?.name),
            priority:    _mapPriority(f.priority?.name),
            piSprint:    piSprint?.name || '',
            dueDate:     f.duedate || f.customfield_10015 || null,
            epic:        _getEpicKey(f) || '',
            description: _extractDescription(f.description),
          });
        });
      } else {
        console.warn(`[JIRA] Amélioration continue : HTTP ${_amelRes.status}`);
      }
    } catch (e) {
      console.warn('[JIRA] Amélioration continue :', e.message);
    }
  }

  // 4. Construire les groupes depuis les Espaces JIRA
  const groups = Object.entries(projectGroups)
    .filter(([, pg]) => pg.boards.some(b => {
      // garder uniquement les espaces ayant au moins un board avec sprint actif
      const teamName = _boardTeamName(b.name);
      return allIssues.some(i => i._boardTeam === teamName);
    }))
    .map(([pk, pg]) => ({
      id:    `G-${pk}`,
      name:  pg.name,
      color: _GROUP_COLORS[gColorIdx++ % _GROUP_COLORS.length],
      teams: pg.boards.map(b => _boardTeamName(b.name)),
    }));

  _syncProgress(_totalSteps, _totalSteps, 'Transformation & sauvegarde…');

  // 5. Transformer
  const project = (CONFIG.jira.projects || []).join(', ') || 'JIRA';
  const cache   = _transform(allIssues, project, CONFIG.sprint.current, teamConfigs);
  cache.groups       = groups;
  // N'exporter que les équipes ayant effectivement chargé des issues
  cache.team_configs = Object.fromEntries(
    Object.entries(teamConfigs).filter(([, tc]) => tc.hasIssues)
  );
  // Board column configuration & dynamic status mapping
  cache.inno_features        = _innoFeatureList;
  cache.amelioration_tickets = _ameliorationList;
  cache.board_status_map     = { ..._boardColumnMap };
  BOARD_COLUMNS = _allBoardColumns;

  // Save board columns to dedicated file for visibility
  try {
    await fetch(`${DATA_PROXY}/board-columns.json`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(_allBoardColumns, null, 2),
    });
    console.log('[JIRA] Board columns sauvegardé → board-columns.json');
  } catch (e) {
    console.warn('[JIRA] Sauvegarde board-columns.json échouée :', e.message);
  }

  // 5.3 Enrichir les features depuis toutes les issues (sprint actif + fermés + backlog)
  // Remonter la hiérarchie : issue → epic → feature
  {
    const _allFeatures = {};
    const _epicFeatureMap = {};
    // Features déjà extraites depuis le sprint actif
    (cache.features || []).forEach(f => { _allFeatures[f.id] = f; });
    (cache.epics || []).forEach(e => { if (e.feature) _epicFeatureMap[e.id] = e.feature; });

    // Scanner toutes les issues brutes pour trouver des features via parent chain
    const _scanIssue = (i) => {
      if (!i?.fields?.parent) return;
      const p = i.fields.parent;
      const pType = (p.fields?.issuetype?.name || '').toLowerCase();
      const pLevel = p.fields?.issuetype?.hierarchyLevel;
      const isEpic = pType === 'epic';
      const isFeature = pType === 'feature' || pType === 'fonctionnalité' || pLevel >= 2;

      if (isFeature && !_allFeatures[p.key]) {
        _allFeatures[p.key] = { id: p.key, title: p.fields?.summary || p.key, color: '#2563EB', status: _mapStatus(p.fields?.status?.name), _jiraStatus: p.fields?.status?.name || '' };
      }
      if (isEpic && p.fields?.parent) {
        const gp = p.fields.parent;
        const gpType = (gp.fields?.issuetype?.name || '').toLowerCase();
        const gpLevel = gp.fields?.issuetype?.hierarchyLevel;
        if ((gpType === 'feature' || gpType === 'fonctionnalité' || gpLevel >= 2) && !_allFeatures[gp.key]) {
          _allFeatures[gp.key] = { id: gp.key, title: gp.fields?.summary || gp.key, color: '#2563EB', status: _mapStatus(gp.fields?.status?.name), _jiraStatus: gp.fields?.status?.name || '' };
        }
        if (!_epicFeatureMap[p.key] && _allFeatures[gp.key]) _epicFeatureMap[p.key] = gp.key;
      }
    };
    allIssues.forEach(_scanIssue);
    allFutureIssues.forEach(_scanIssue);

    // Enrichir ou ajouter les features depuis les issues de type Feature/Fonctionnalité
    [].concat(allIssues, allFutureIssues).forEach(i => {
      const iType = (i.fields?.issuetype?.name || '').toLowerCase();
      const iLevel = i.fields?.issuetype?.hierarchyLevel;
      if (iType === 'feature' || iType === 'fonctionnalité' || (iLevel != null && iLevel >= 2)) {
        if (!_allFeatures[i.key]) {
          _allFeatures[i.key] = { id: i.key, title: i.fields?.summary || i.key, color: '#2563EB', status: _mapStatus(i.fields?.status?.name), _jiraStatus: i.fields?.status?.name || '' };
        }
        const piName = i._piSprintName || '';
        if (piName && !_allFeatures[i.key].piSprint) _allFeatures[i.key].piSprint = piName;
        // Stocker l'équipe du board si disponible
        if (i._boardTeam && i._boardTeam !== '_PI' && !_allFeatures[i.key].team) _allFeatures[i.key].team = i._boardTeam;
      }
    });

    // Mettre à jour cache.features et cache.epics
    cache.features = Object.values(_allFeatures);
    (cache.epics || []).forEach(e => {
      if (!e.feature && _epicFeatureMap[e.id]) e.feature = _epicFeatureMap[e.id];
    });

    // NOTE: la déduction de team des epics/features est faite APRÈS la construction du backlog (plus bas)
    if (cache.features.length > 1 || (cache.features.length === 1 && cache.features[0].id !== 'F-1')) {
      console.log(`[JIRA] Features extraites : ${cache.features.map(f => `${f.id}="${f.title}"`).join(', ')}`);
    }
  }

  // Tickets futurs / backlog planifié (de-dup avec sprint actif)
  if (opts.incremental) {
    // Preserve existing backlog from memory
    cache.backlog_tickets = (typeof BACKLOG_TICKETS !== 'undefined' ? [...BACKLOG_TICKETS] : []);
    console.log(`[JIRA] Sync incrémentale - backlog conservé (${cache.backlog_tickets.length})`);
  } else {
    const _seenActive = new Set(allIssues.map(i => i.key));
    // Issues trouvées par le JQL PI ou features/epics doivent passer dans le backlog
    // même si elles sont aussi dans allIssues (sprint actif / résolution epics)
    const _uniqueFuture = allFutureIssues.filter(i => {
      if (!_seenActive.has(i.key)) return true;
      // Laisser passer les issues trouvées par le JQL PI
      return !!i._fromPiJql;
    });
    // Build epicMap for buffer detection in backlog (active epics + closed sprints + PI epics)
    const _blEpicMap = { ..._sharedEpicMap };
    (cache.epics || []).forEach(e => { _blEpicMap[e.id] = { title: e.title || '' }; });
    const bufferEpics = Object.entries(_blEpicMap).filter(([, v]) => (v.title || '').toLowerCase().includes('buffer'));
    console.log(`[JIRA] EpicMap backlog: ${Object.keys(_blEpicMap).length} entrées (${bufferEpics.length} buffer: ${bufferEpics.map(([k, v]) => `${k}="${v.title}"`).join(', ')})`);
    cache.backlog_tickets = _transformBacklog(_uniqueFuture, _blEpicMap);
    if (cache.backlog_tickets.length) console.log(`[JIRA] ${cache.backlog_tickets.length} tickets backlog/futurs`);
  }

  // 5.45 Déduire la team et piSprint des epics/features depuis les tickets enfants
  // DOIT être après cache.backlog_tickets pour avoir accès à tous les tickets
  {
    const _allTicketPool = [].concat(cache.tickets || [], cache.backlog_tickets || []);

    // Déduire la team des epics sans team
    (cache.epics || []).forEach(e => {
      if (e.team && e.team !== '_PI' && e.team !== '') return;
      const child = _allTicketPool.find(t => t.epic === e.id && t.team && t.team !== '_PI' && t.team !== '');
      if (child) e.team = child.team;
    });

    // Déduire la team et piSprint des features
    (cache.features || []).forEach(f => {
      // Team
      if (!f.team || f.team === '_PI' || f.team === '') {
        const childEpic = (cache.epics || []).find(e => e.feature === f.id && e.team && e.team !== '_PI' && e.team !== '');
        if (childEpic) { f.team = childEpic.team; }
        else {
          const childTicket = _allTicketPool.find(t => t.epic === f.id && t.team && t.team !== '_PI' && t.team !== '');
          if (childTicket) f.team = childTicket.team;
        }
      }
      // piSprint — déduire depuis les backlog tickets qui SONT cette feature (type feature avec cet id)
      if (!f.piSprint) {
        const asBl = (cache.backlog_tickets || []).find(t => t.id === f.id && t.piSprint);
        if (asBl) f.piSprint = asBl.piSprint;
      }
    });

    // Aussi propager piSprint et team sur les epics _isFeature
    (cache.epics || []).forEach(e => {
      if (!e._isFeature) return;
      if (!e.piSprint) {
        const asBl = (cache.backlog_tickets || []).find(t => t.id === e.id && t.piSprint);
        if (asBl) e.piSprint = asBl.piSprint;
      }
      if (!e.team || e.team === '_PI' || e.team === '') {
        const matchFeat = (cache.features || []).find(f => f.id === e.id && f.team && f.team !== '_PI' && f.team !== '');
        if (matchFeat) e.team = matchFeat.team;
      }
    });

    const enrichedTeams = (cache.epics || []).filter(e => e._isFeature && e.team && e.team !== '_PI' && e.team !== '').length;
    const enrichedPi = (cache.features || []).filter(f => f.piSprint).length;
    console.log(`[JIRA] Enrichissement features : ${enrichedTeams} avec team, ${enrichedPi} avec piSprint`);
  }

  // 5.5 Lead time / Cycle time - fetch changelog des tickets Done
  {
    const doneTickets = cache.tickets.filter(t => isDone(t.status));
    if (doneTickets.length) {
      console.log(`[JIRA] Calcul lead/cycle time pour ${doneTickets.length} tickets terminés…`);
      const _batchSize = CONFIG.sync.cycleTimeBatchSize || 10;
      const batches = [];
      for (let i = 0; i < doneTickets.length; i += _batchSize) batches.push(doneTickets.slice(i, i + _batchSize));
      for (const batch of batches) {
        await Promise.all(batch.map(async t => {
          try {
            const r = await _jiraFetch(`${JIRA_PROXY}/api/3/issue/${t.id}?expand=changelog&fields=created`, { headers: { Accept: 'application/json' } });
            if (!r.ok) return;
            const data = await r.json();
            const created = data.fields?.created ? new Date(data.fields.created) : null;
            const histories = data.changelog?.histories || [];
            let firstInProg = null;
            let doneDate    = null;
            histories.forEach(h => {
              const ts = new Date(h.created);
              (h.items || []).forEach(item => {
                if (item.field !== 'status') return;
                const to = _mapStatus(item.toString || '');
                if (to === 'inprog' && (!firstInProg || ts < firstInProg)) firstInProg = ts;
                if (isDone(to)) doneDate = ts;
              });
            });
            if (created && doneDate) {
              t.leadTimeDays = Math.round((doneDate - created) / (1000 * 60 * 60 * 24) * 10) / 10;
            }
            if (firstInProg && doneDate) {
              t.cycleTimeDays = Math.round((doneDate - firstInProg) / (1000 * 60 * 60 * 24) * 10) / 10;
            }
            // Store ISO dates for modal sprint-bar visualization
            if (firstInProg) t.startedDate  = firstInProg.toISOString().slice(0, 10);
            if (doneDate)    t.resolvedDate = doneDate.toISOString().slice(0, 10);
          } catch { /* skip */ }
        }));
      }
      const withCT = cache.tickets.filter(t => t.cycleTimeDays != null).length;
      console.log(`[JIRA] Cycle time calculé pour ${withCT}/${doneTickets.length} tickets`);
    }
  }

  // 6. Sauvegarder en cache
  try {
    await fetch(`${DATA_PROXY}/${_cacheFile()}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cache),
    });
    console.log(`[JIRA] Cache sauvegardé → ${_cacheFile()}`);
  } catch (e) {
    console.warn('[JIRA] Sauvegarde cache échouée :', e.message);
  }

  // 7. Appliquer
  _applyCache(cache);
}
