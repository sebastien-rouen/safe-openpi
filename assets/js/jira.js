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

// Log conditionnel — désactivé en production (console.log trop verbeux)
const _JIRA_LOG = (localStorage.getItem('jiraDebug') === '1');
const _log = _JIRA_LOG ? console.log.bind(console, '[JIRA]') : () => {};
const _warn = console.warn.bind(console, '[JIRA]');

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
  _warn(`Statut non mappé : "${s}" → todo`);
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
    _warn('Remote links fetch failed for', issueKey, e.message);
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
    const epicKey = _getEpicKey(f) || null;
    const team    = i._boardTeam || epicMap[epicKey]?.team || '';
    // Detect JIRA flagged field (impediment indicator)
    const flagged = _isFlagged(f);
    let   status  = _mapStatus(f.status?.name);
    if (flagged && !isDone(status)) status = 'blocked';
    const labels  = (f.labels || []).map(l => l.toLowerCase());
    const buffer  = _isBuffer(labels, epicKey, epicMap);
    if (buffer) _log(`Buffer détecté (sprint actif): ${i.key} (epic=${epicKey}, epicTitle=${epicMap[epicKey]?.title || '?'}, labels=[${labels.join(',')}])`);
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
      buffer:      (() => { const b = _isBuffer(labels, epicKey, _blEpicMap); if (b) _log(`Buffer détecté (backlog): ${i.key} (epic=${epicKey}, epicTitle=${_blEpicMap[epicKey]?.title || '?'}, labels=[${labels.join(',')}])`); return b; })(),
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
    _log(`Board status map restauré (${Object.keys(_boardColumnMap).length} statuts)`);
  }
  // Board columns: load from dedicated file, fallback to cache embed
  try {
    const bcRes = await fetch(`${DATA_PROXY}/board-columns.json`);
    if (bcRes.ok) {
      BOARD_COLUMNS = await bcRes.json();
      _log(`Board columns chargé depuis board-columns.json (${Object.keys(BOARD_COLUMNS).length} équipes)`);
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

  _log(`${TICKETS.length} tickets · ${EPICS.length} epics · ${SUPPORT_TICKETS.length} support · ${BACKLOG_TICKETS.length} backlog · ${INNO_FEATURES.length} inno · ${AMELIORATION_TICKETS.length} amélio · ${GROUPS.length} groupes`);
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


// ============================================================
// Sous-fonctions de loadJiraData (extraction pour lisibilité)
// Chaque sous-fonction reçoit ses dépendances en paramètre et
// retourne ses résultats. L'état mutable est regroupé dans ctx.
// ============================================================

/**
 * A. Découverte automatique du champ Story Points via l'API /field
 * @returns {string|null} L'ID du customfield Story Points, ou null
 */
async function _jiraDiscoverSPField() {
  try {
    const fr = await _jiraFetch(`${JIRA_PROXY}/api/3/field`, { headers: { Accept: 'application/json' } });
    if (fr.ok) {
      const allFields = await fr.json();
      const spField = allFields.find(f =>
        /^story.?points?$/i.test(f.name) || /^story.?points?$/i.test(f.untranslatedName || '')
      );
      if (spField) {
        _pointsFieldKey = spField.id; // pré-cache pour _getPoints
        _log(`Story Points field détecté : ${spField.name} → ${spField.id}`);
        return spField.id;
      } else {
        _warn('Champ Story Points non trouvé via /api/3/field - fallback sur IDs connus');
      }
    }
  } catch (e) {
    _warn('Découverte champ Story Points échouée :', e.message);
  }
  return null;
}

/**
 * B. Construit la string de champs API à demander à JIRA
 * @param {string|null} spFieldId - L'ID du champ Story Points découvert
 * @returns {string} La liste des champs séparés par des virgules
 */
function _jiraBuildFields(spFieldId) {
  return [
    'summary', 'status', 'issuetype', 'priority', 'assignee',
    'labels', 'components', 'parent', 'description', 'created', 'updated',
    'flagged', 'duedate', 'comment', 'environment', 'issuelinks',
    CONFIG.sync.sprintField,
    'customfield_10001',
    'customfield_10014', 'customfield_10015',
    'customfield_10016', 'customfield_10028', 'customfield_10005',
    'customfield_10004', 'customfield_10115', 'customfield_10106',
    'customfield_10034', 'customfield_10193',
    ...(spFieldId && !['customfield_10016','customfield_10028','customfield_10005','customfield_10004','customfield_10115','customfield_10106','customfield_10034','customfield_10193'].includes(spFieldId) ? [spFieldId] : []),
  ].join(',');
}

/**
 * C. Pagine GET /agile/1.0/board, filtre par projet/scrum/teams
 * @returns {{ scrumBoards: Array, projectGroups: Object }}
 */
async function _jiraFetchBoards() {
  const projects = CONFIG.jira.projects || [];
  _syncProgress(0, 1, 'Récupération des boards...');

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

  const boards = projects.length
    ? allBoards.filter(b => projects.includes(b.location?.projectKey))
    : allBoards;
  if (projects.length) {
    const excluded = allBoards.filter(b => !projects.includes(b.location?.projectKey));
    if (excluded.length) _log(`Boards exclus (hors projet) : ${excluded.map(b => `"${b.name}" [${b.location?.projectKey || '?'}]`).join(', ')}`);
  }

  const excludeTeams = (CONFIG.jira.excludeTeams || []).map(t => t.toLowerCase());
  const scrumBoardsRaw = boards.filter(b => b.type === 'scrum');
  const scrumBoards = excludeTeams.length
    ? scrumBoardsRaw.filter(b => !excludeTeams.includes(_boardTeamName(b.name).toLowerCase()))
    : scrumBoardsRaw;
  const skippedBoards = boards.filter(b => b.type !== 'scrum');
  if (excludeTeams.length && scrumBoardsRaw.length !== scrumBoards.length) {
    const excluded = scrumBoardsRaw.filter(b => excludeTeams.includes(_boardTeamName(b.name).toLowerCase()));
    _log(`Équipes exclues (excludeTeams) : ${excluded.map(b => `"${_boardTeamName(b.name)}"`).join(', ')}`);
  }
  _log(`${allBoards.length} boards total → ${boards.length} après filtre projet${projects.length ? ` (${projects.join(', ')})` : ''} → ${scrumBoards.length} scrum (${skippedBoards.length} kanban ignorés)`);
  if (skippedBoards.length) _log(`Boards non-scrum ignorés : ${skippedBoards.map(b => `"${b.name}" [${b.location?.projectKey}]`).join(', ')}`);

  const projectGroups = {};
  scrumBoards.forEach(board => {
    const pk = board.location?.projectKey || board.location?.key || '_DEFAULT';
    const pn = board.location?.projectName || board.location?.name || pk;
    if (!projectGroups[pk]) projectGroups[pk] = { name: pn, boards: [] };
    projectGroups[pk].boards.push(board);
  });

  return { scrumBoards, projectGroups };
}

/**
 * D. Pour chaque board : sprint actif + issues + colonnes + détection inactive
 * Mute ctx.allIssues, ctx.teamConfigs, ctx.allBoardColumns, ctx.piBoardIds, ctx.step
 * @param {Array} scrumBoards
 * @param {Object} ctx - contexte partagé
 */
async function _jiraFetchSprintsAndIssues(scrumBoards, ctx) {
  const _SKIP_BOARD_RE = /\b(PI\s*Board|Board\s*Features?|Cadrage|Post[- ]Mortem|Rétrospective|Retrospective|Program\s*Board)\b/i;

  for (const board of scrumBoards) {
    if (_SKIP_BOARD_RE.test(board.name)) {
      _log(`Board ignoré (PI/agrégateur) : "${board.name}"`);
      ctx.step += 2;
      continue;
    }

    const teamName = _boardTeamName(board.name);

    if (!ctx.teamConfigs[teamName]) {
      ctx.teamConfigs[teamName] = {
        name:       teamName,
        color:      _COLOR_PALETTE[Object.keys(ctx.teamConfigs).length % _COLOR_PALETTE.length],
        boardId:    board.id,
        projectKey: board.location?.projectKey || '',
      };
    }

    _syncProgress(++ctx.step, ctx.totalSteps, `Sprint : ${teamName}…`);
    let sprintId = null;

    const _boardConfigPromise = _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${board.id}/configuration`, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    try {
      const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${board.id}/sprint?state=active&maxResults=1`);
      if (sr.ok) {
        const sb     = await sr.json();
        const sprint = (sb.values || [])[0];
        if (sprint) {
          if (/^PI\s*#?\d+/i.test(sprint.name)) {
            _log(`Board "${board.name}" ignoré - sprint PI : "${sprint.name}" (sprints futurs seront fetchés)`);
            ctx.piBoardIds.push(board.id);
            ctx.step++;
            continue;
          }
          sprintId = sprint.id;
          ctx.teamConfigs[teamName].sprintName    = sprint.name;
          ctx.teamConfigs[teamName].sprintStart   = _fmtDate(sprint.startDate);
          ctx.teamConfigs[teamName].sprintEnd     = _fmtDate(sprint.endDate);
          ctx.teamConfigs[teamName].sprintStartISO = sprint.startDate || '';
          ctx.teamConfigs[teamName].sprintGoal    = sprint.goal || '';
          if (!ctx.firstSprint) {
            ctx.firstSprint = sprint;
            CONFIG.sprint.current      = sprint.id;
            CONFIG.sprint.label        = sprint.name;
            CONFIG.sprint.startDate    = _fmtDate(sprint.startDate);
            CONFIG.sprint.endDate      = _fmtDate(sprint.endDate);
            CONFIG.sprint.startDateISO = sprint.startDate || '';
            CONFIG.sprint.goal      = sprint.goal || '';
            _log(`Sprint référence : ${sprint.name} (id=${sprint.id})`);
          }
        }
      }
    } catch (e) {
      _warn(`Sprint board ${board.id} (${board.name}) : ${e.message}`);
    }

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
        if (internal) {
          statuses.forEach(st => {
            const stName = (st.name || '').toLowerCase().trim();
            if (stName && !_boardColumnMap[stName]) {
              _boardColumnMap[stName] = internal;
            }
          });
        }
      });
      ctx.allBoardColumns[teamName] = boardCols;
      const summary = boardCols.map(c => `${c.name}→${c.internal || '?'}(${c.statuses.length})`).join(', ');
      _log(`Board "${board.name}" colonnes : ${summary}`);
    }

    if (!sprintId) {
      ctx.step++;
      _log(`Board "${board.name}" : pas de sprint actif`);
      continue;
    }

    _syncProgress(++ctx.step, ctx.totalSteps, `Issues : ${teamName}…`);
    try {
      const jql = `sprint=${sprintId} ORDER BY issuetype ASC, updated DESC`;
      const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${ctx.fields}&expand=changelog`;
      const ir  = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
      if (ir.ok) {
        const ib = await ir.json();
        const issues = ib.issues || [];
        issues.forEach(issue => { issue._boardTeam = teamName; });
        ctx.allIssues.push(...issues);
        if (issues.length) ctx.teamConfigs[teamName].hasIssues = true;
        _log(`Board "${board.name}" → équipe "${teamName}" : ${issues.length} issues`);
      } else {
        _warn(`Issues board ${board.id} : HTTP ${ir.status}`);
      }
    } catch (e) {
      _warn(`Issues board ${board.id} (${board.name}) : ${e.message}`);
    }
  }

  if (!ctx.allIssues.length) throw new Error('Aucun ticket trouvé dans les sprints actifs');

  // Détection des équipes inactives (dissoutes)
  {
    const refStart = CONFIG.sprint.startDate ? new Date(CONFIG.sprint.startDate) : null;
    if (refStart) {
      const INACTIVE_THRESHOLD_DAYS = 60;
      Object.entries(ctx.teamConfigs).forEach(([name, tc]) => {
        if (!tc.sprintEnd) return;
        const teamEnd = new Date(tc.sprintEnd);
        const diffDays = Math.round((refStart - teamEnd) / (1000 * 60 * 60 * 24));
        if (diffDays > INACTIVE_THRESHOLD_DAYS) {
          tc.inactive = true;
          tc.hasIssues = false;
          _log(`Équipe "${name}" marquée inactive (sprint "${tc.sprintName}" terminé il y a ${diffDays}j, seuil ${INACTIVE_THRESHOLD_DAYS}j)`);
        }
      });
    }
  }

  const _inactiveTeams = new Set(Object.entries(ctx.teamConfigs).filter(([, tc]) => tc.inactive).map(([n]) => n));
  if (_inactiveTeams.size) {
    const before = ctx.allIssues.length;
    for (let i = ctx.allIssues.length - 1; i >= 0; i--) {
      if (_inactiveTeams.has(ctx.allIssues[i]._boardTeam)) ctx.allIssues.splice(i, 1);
    }
    if (before !== ctx.allIssues.length) _log(`${before - ctx.allIssues.length} tickets d'équipes inactives retirés`);
  }
}

/**
 * E. Sprints fermés → velocity, buffer, tickets done
 * Mute ctx.teamConfigs[*].velocityHistory, ctx.sharedEpicMap
 * @param {string|null} spFieldId - L'ID du champ Story Points découvert
 * @param {Object} ctx - contexte partagé
 */
async function _jiraFetchVelocityHistory(spFieldId, ctx) {
  const _velFieldsArr = [
    'status', 'summary', 'issuetype', 'assignee', 'parent', 'labels',
    'customfield_10016', 'customfield_10028', 'customfield_10005',
    'customfield_10004', 'customfield_10115', 'customfield_10106',
    'customfield_10034', 'customfield_10193',
    ...(spFieldId && !['customfield_10016','customfield_10028','customfield_10005','customfield_10004','customfield_10115','customfield_10106','customfield_10034','customfield_10193'].includes(spFieldId) ? [spFieldId] : []),
  ];
  if (CONFIG.sync.enrichClosedSprints) _velFieldsArr.push('description', 'priority', 'components');
  const _velFields = _velFieldsArr.join(',');

  await Promise.all(Object.entries(ctx.teamConfigs).map(async ([teamName, tc]) => {
    if (!tc.boardId || !tc.hasIssues) return;
    try {
      const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${tc.boardId}/sprint?state=closed&maxResults=${CONFIG.sync.closedSprintsFetch}`);
      if (!sr.ok) return;
      const allClosed = (await sr.json()).values || [];
      const teamSprints = allClosed.filter(s => !/^PI\s*#?\d+/i.test(s.name));
      teamSprints.sort((a, b) => {
        const da = new Date(a.endDate || a.startDate || 0);
        const db = new Date(b.endDate || b.startDate || 0);
        return da - db;
      });
      const closed = teamSprints.slice(-CONFIG.sync.velocityHistoryCount);
      const projKey = tc.projectKey || '';

      const sprintData = await Promise.all(closed.map(async sprint => {
        try {
          const jql = projKey
            ? `sprint=${sprint.id} AND project="${projKey}"`
            : `sprint=${sprint.id}`;
          const ir  = await _jiraFetch(`${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${_velFields}`, { headers: { Accept: 'application/json' } });
          if (!ir.ok) {
            _warn(`Vélocité ${teamName} sprint ${sprint.name} : HTTP ${ir.status}`);
            return { sprint, issues: [] };
          }
          const issues = (await ir.json()).issues || [];
          return { sprint, issues };
        } catch (e) {
          _warn(`Vélocité ${teamName} sprint ${sprint.name} : ${e.message}`);
          return { sprint, issues: [] };
        }
      }));

      const issueLastSprint = new Map();
      sprintData.forEach((sd, idx) => {
        sd.issues.filter(i => isDone(_mapStatus(i.fields.status?.name))).forEach(i => issueLastSprint.set(i.key, idx));
      });
      const activeKeys = new Set(ctx.allIssues.filter(i => i._boardTeam === teamName).map(i => i.key));

      const _closedEpicMap = {};
      const _epicLikeTypes = new Set(['epic', 'feature', 'fonctionnalité']);
      sprintData.forEach(sd => sd.issues.forEach(i => {
        const t = (i.fields.issuetype?.name || '').toLowerCase();
        if (_epicLikeTypes.has(t)) _closedEpicMap[i.key] = { title: i.fields.summary || '' };
        const pk = _getEpicKey(i.fields);
        if (pk && !_closedEpicMap[pk] && i.fields.parent?.key === pk) {
          _closedEpicMap[pk] = { title: i.fields.parent?.fields?.summary || '' };
        }
      }));
      ctx.allIssues.forEach(i => {
        const t = (i.fields.issuetype?.name || '').toLowerCase();
        if (_epicLikeTypes.has(t)) _closedEpicMap[i.key] = { title: i.fields.summary || '' };
        const pk = _getEpicKey(i.fields);
        if (pk && !_closedEpicMap[pk] && i.fields.parent?.key === pk) {
          _closedEpicMap[pk] = { title: i.fields.parent?.fields?.summary || '' };
        }
      });
      Object.assign(ctx.sharedEpicMap, _closedEpicMap);

      tc.velocityHistory = sprintData.map((sd, idx) => {
        const doneIssues = sd.issues.filter(i => isDone(_mapStatus(i.fields.status?.name))).filter(i => {
          if (activeKeys.has(i.key)) {
            _log(`Vélocité ${teamName} ${sd.sprint.name} : ${i.key} exclu (glissé → sprint actif)`);
            return false;
          }
          if (issueLastSprint.get(i.key) !== idx) {
            _log(`Vélocité ${teamName} ${sd.sprint.name} : ${i.key} exclu (glissé → ${sprintData[issueLastSprint.get(i.key)]?.sprint.name})`);
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
        const sprintMembers = [...new Set(sd.issues.map(i => (i.fields.assignee?.displayName || '').trim()).filter(Boolean))];
        return { name: sd.sprint.name, velocity, tickets, bufferTickets, members: sprintMembers, startDate: sd.sprint.startDate || '', endDate: sd.sprint.endDate || '' };
      });
      _log(`Vélocité ${teamName} : ${tc.velocityHistory.map(s => `${s.name}=${s.velocity}`).join(', ')}`);
    } catch (e) {
      _warn(`Vélocité ${teamName} : ${e.message}`);
    }
  }));
}

/**
 * F. Tickets des sprints futurs par board
 * Mute ctx.allFutureIssues, ctx.futureSeenKeys
 * @param {Object} ctx - contexte partagé
 */
async function _jiraFetchFutureSprints(ctx) {
  await Promise.all(Object.entries(ctx.teamConfigs).map(async ([teamName, tc]) => {
    if (!tc.boardId || !tc.hasIssues) return;
    try {
      const sr = await _jiraFetch(`${JIRA_PROXY}/agile/1.0/board/${tc.boardId}/sprint?state=future&maxResults=${CONFIG.sync.maxFutureSprints}`);
      if (!sr.ok) return;
      const sb = await sr.json();
      const futureSprints = sb.values || [];
      if (!futureSprints.length) return;

      for (const fs of futureSprints) {
        const jql = `sprint=${fs.id} ORDER BY priority ASC`;
        const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxIssuesPerSprint}&fields=${ctx.fields}`;
        const ir  = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
        if (!ir.ok) continue;
        const issues = (await ir.json()).issues || [];
        issues.forEach(issue => {
          if (ctx.futureSeenKeys.has(issue.key)) return;
          ctx.futureSeenKeys.add(issue.key);
          issue._boardTeam = teamName;
          issue._isFuture  = true;
          ctx.allFutureIssues.push(issue);
        });
      }
      const count = ctx.allFutureIssues.filter(i => i._boardTeam === teamName).length;
      if (count) _log(`Sprints futurs "${teamName}" : ${count} tickets (${futureSprints.length} sprints)`);
    } catch (e) {
      _warn(`Sprints futurs ${teamName} : ${e.message}`);
    }
  }));
}

/**
 * G. JQL PI# → tickets PI avec pagination
 * Mute ctx.allFutureIssues, ctx.futureSeenKeys, ctx.allIssues
 * @param {Object} ctx - contexte partagé
 * @returns {{ currentPINum: number|null, piFuture: number, projFilter: string, piActiveKeys: Set }}
 */
async function _jiraFetchPITickets(ctx) {
  const _currentPIMatch = (CONFIG.sprint.label || '').match(/(\d+)\.\d+/);
  const _currentPINum = _currentPIMatch ? parseInt(_currentPIMatch[1]) : null;

  if (!_currentPINum) return { currentPINum: null, piFuture: 0, projFilter: '', piActiveKeys: new Set() };

  const piNames = [];
  const _piFuture = CONFIG.sync.piFutureCount || 2;
  for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI#${_currentPINum + i}"`);
  for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI #${_currentPINum + i}"`);
  for (let i = 0; i <= _piFuture; i++) piNames.push(`"PI${_currentPINum + i}"`);

  const projFilter = (CONFIG.jira.projects || []).length
    ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
    : '';
  const piJql = `sprint IN (${piNames.join(',')})${projFilter} ORDER BY priority ASC`;
  _log(`Recherche tickets PI : ${piJql}`);
  const _piActiveKeys = new Set(ctx.allIssues.map(i => i.key));

  try {
    const maxPi = CONFIG.sync.maxPIIssues || 500;
    const pageSize = 100;
    let allPiIssues = [];
    let piNextToken = null;
    for (let p = 0; allPiIssues.length < maxPi; p++) {
      let url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(piJql)}&maxResults=${pageSize}&fields=${ctx.fields}`;
      if (piNextToken) url += `&nextPageToken=${encodeURIComponent(piNextToken)}`;
      const ir = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
      if (!ir.ok) break;
      const body = await ir.json();
      const page = body.issues || [];
      allPiIssues = allPiIssues.concat(page);
      _log(`PI page ${p+1}: ${page.length} issues (fetched: ${allPiIssues.length})`);
      if (body.isLast !== false || !page.length) break;
      piNextToken = body.nextPageToken;
      if (!piNextToken) break;
    }
    if (allPiIssues.length) {
      const issues = allPiIssues;
      const _activeKeys = new Set(ctx.allIssues.map(i => i.key));
      let added = 0, enriched = 0;
      issues.forEach(issue => {
        const sprintRaw  = issue.fields[CONFIG.sync.sprintField];
        const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
        const piSprint   = _extractPISprint(sprintList);
        let   piName     = piSprint?.name || '';
        if (!piName && sprintRaw) {
          const rawStr = typeof sprintRaw === 'string' ? sprintRaw : JSON.stringify(sprintRaw);
          const piMatch = rawStr.match(/PI\s*#?\s*(\d+)/i);
          if (piMatch) piName = `PI#${piMatch[1]}`;
        }
        if (!piName) {
          const allFieldsStr = JSON.stringify(issue.fields || {});
          const piScan = allFieldsStr.match(/PI\s*#?\s*(\d+)/i);
          if (piScan) piName = `PI#${piScan[1]}`;
          if (!piName && _currentPINum) {
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

        if (ctx.futureSeenKeys.has(issue.key)) {
          const existing = ctx.allFutureIssues.find(i => i.key === issue.key);
          if (existing && !existing._piSprintName) {
            existing._piSprintName = piName;
            enriched++;
          }
          return;
        }
        if (_activeKeys.has(issue.key)) {
          const existing = ctx.allIssues.find(ai => ai.key === issue.key);
          if (existing) { existing._piSprintName = piName; enriched++; }
          const iType = (issue.fields?.issuetype?.name || '').toLowerCase();
          if (iType === 'feature' || iType === 'fonctionnalité') _log(`PI Feature in activeKeys: ${issue.key} type=${iType} piName=${piName} boardTeam=${existing?._boardTeam}`);
          if (iType === 'feature' || iType === 'fonctionnalité' || iType === 'epic') {
            const existingFuture = ctx.allFutureIssues.find(fi => fi.key === issue.key);
            if (existingFuture) {
              if (piName && !existingFuture._piSprintName) existingFuture._piSprintName = piName;
            } else {
              ctx.futureSeenKeys.add(issue.key);
              issue._boardTeam = existing?._boardTeam || '_PI';
              issue._piSprintName = piName;
              ctx.allFutureIssues.push(issue);
            }
          }
          return;
        }
        const epicKey = _getEpicKey(issue.fields);
        let epicTeam = null;
        if (epicKey) {
          const sameEpic = ctx.allIssues.find(ai => _getEpicKey(ai.fields) === epicKey && ai._boardTeam);
          if (sameEpic) {
            epicTeam = sameEpic._boardTeam;
          } else {
            const sameEpicFuture = ctx.allFutureIssues.find(fi => _getEpicKey(fi.fields) === epicKey && fi._boardTeam && fi._boardTeam !== '_PI');
            if (sameEpicFuture) epicTeam = sameEpicFuture._boardTeam;
          }
        }
        ctx.futureSeenKeys.add(issue.key);
        issue._boardTeam     = epicTeam || '_PI';
        issue._isFuture      = true;
        issue._piSprintName  = piName || `PI#${_currentPINum}`;
        issue._fromPiJql     = true;
        ctx.allFutureIssues.push(issue);
        added++;
      });
      const piDist = {};
      ctx.allFutureIssues.forEach(fi => { if (fi._piSprintName) piDist[fi._piSprintName] = (piDist[fi._piSprintName] || 0) + 1; });
      _log(`Tickets PI : ${issues.length} trouvés, ${added} nouveaux, ${enriched} enrichis - distribution:`, piDist);
    }
  } catch (e) {
    _warn(`Recherche tickets PI : ${e.message}`);
  }

  return { currentPINum: _currentPINum, piFuture: _piFuture, projFilter, piActiveKeys: _piActiveKeys };
}

/**
 * H. JQL Features PI avec resolution team enfants
 * Mute ctx.allFutureIssues, ctx.futureSeenKeys
 */
async function _jiraFetchPIFeatures(currentPINum, piFuture, projFilter, piActiveKeys, ctx) {
  for (let pi = 0; pi <= piFuture; pi++) {
    const piN = currentPINum + pi;
    const piSprintName = `PI#${piN}`;
    try {
      const featJql = `sprint IN ("PI#${piN}","PI #${piN}","PI${piN}")${projFilter} AND issuetype IN (Feature, Fonctionnalité) ORDER BY key ASC`;
      let featIssues = [];
      let featToken = null;
      for (let fp = 0; fp < 10; fp++) {
        let featUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(featJql)}&maxResults=100&fields=${ctx.fields}`;
        if (featToken) featUrl += `&nextPageToken=${encodeURIComponent(featToken)}`;
        const featRes = await _jiraFetch(featUrl, { headers: { Accept: 'application/json' } });
        if (!featRes.ok) break;
        const featBody = await featRes.json();
        featIssues = featIssues.concat(featBody.issues || []);
        if (featBody.isLast !== false) break;
        featToken = featBody.nextPageToken;
        if (!featToken) break;
      }
      if (!featIssues.length) continue;
      let featAdded = 0;
      featIssues.forEach(issue => {
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
        if (!ctx.futureSeenKeys.has(issue.key) && !piActiveKeys.has(issue.key)) {
          ctx.futureSeenKeys.add(issue.key);
          issue._boardTeam = team;
          issue._isFuture = true;
          issue._piSprintName = piSprintName;
          issue._fromPiJql = true;
          ctx.allFutureIssues.push(issue);
          featAdded++;
        } else {
          const existing = ctx.allFutureIssues.find(fi => fi.key === issue.key);
          if (existing) {
            if (!existing._piSprintName) existing._piSprintName = piSprintName;
            if ((!existing._boardTeam || existing._boardTeam === '_PI') && team !== '_PI') existing._boardTeam = team;
          }
        }
      });
      if (featIssues.length) _log(`Features ${piSprintName} : ${featIssues.length} trouvées, ${featAdded} ajoutées`);

      // Fetch enfants de TOUTES les features PI
      const allFeatKeys = featIssues.map(i => i.key);
      if (allFeatKeys.length) {
        _syncProgress(ctx.step, ctx.totalSteps, `Enfants Features PI#${piN} (${allFeatKeys.length})…`);
        let totalChildAdded = 0;
        const childPageSize = 100;
        for (let b = 0; b < allFeatKeys.length; b += 50) {
          const batch = allFeatKeys.slice(b, b + 50);
          try {
            const childJql = `parent IN (${batch.join(',')})${projFilter} ORDER BY key ASC`;
            let nextPageToken = null;
            for (let page = 0; page < 10; page++) {
              let childUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(childJql)}&maxResults=${childPageSize}&fields=${ctx.fields}`;
              if (nextPageToken) childUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
              const childRes = await _jiraFetch(childUrl, { headers: { Accept: 'application/json' } });
              if (!childRes.ok) break;
              const childBody = await childRes.json();
              const childIssues = childBody.issues || [];
              if (!childIssues.length) break;
              childIssues.forEach(ci => {
                if (ctx.futureSeenKeys.has(ci.key) || piActiveKeys.has(ci.key)) return;
                ctx.futureSeenKeys.add(ci.key);
                const parentKey = ci.fields?.parent?.key;
                const parentInFuture = parentKey ? ctx.allFutureIssues.find(fi => fi.key === parentKey) : null;
                let childTeam = '_PI';
                const childTeamField = ci.fields?.customfield_10001;
                if (childTeamField) {
                  const ctStr = typeof childTeamField === 'string' ? childTeamField : (childTeamField.name || childTeamField.value || '');
                  const ctMatch = ctStr.match(/[-–]\s*(.+)/);
                  childTeam = ctMatch ? ctMatch[1].trim() : ctStr.trim();
                }
                if (childTeam === '_PI') childTeam = parentInFuture?._boardTeam || '_PI';
                ci._boardTeam = childTeam;
                ci._isFuture = true;
                ci._piSprintName = piSprintName;
                ci._fromPiJql = true;
                ctx.allFutureIssues.push(ci);
                totalChildAdded++;
              });
              if (childBody.isLast !== false) break;
              nextPageToken = childBody.nextPageToken;
              if (!nextPageToken) break;
            }
          } catch (e2) {
            _warn(`Enfants Features PI#${piN} batch : ${e2.message}`);
          }
        }
        if (totalChildAdded) _log(`Enfants Features ${piSprintName} : ${totalChildAdded} ajoutés (${allFeatKeys.length} features)`);
      }
    } catch (e) {
      _warn(`Features PI#${piN} : ${e.message}`);
    }
  }
}

/**
 * I. Résoudre les epics/features stubs (titres manquants)
 * Mute ctx.allIssues, ctx.allFutureIssues
 */
async function _jiraResolveEpicTitles(ctx) {
  const hierarchyTypes = ['epic', 'feature', 'fonctionnalité'];
  const allPool = [].concat(ctx.allIssues, ctx.allFutureIssues);
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
    _syncProgress(++ctx.step, ctx.totalSteps, `Titres epics (${stubKeys.length})…`);
    try {
      const jql = `issuekey in (${stubKeys.join(',')})`;
      const url = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${CONFIG.sync.maxEpicsResolve}&fields=summary,status,issuetype,assignee`;
      const res = await _jiraFetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const body = await res.json();
        (body.issues || []).forEach(i => { ctx.allIssues.push(i); ctx.allFutureIssues.push(i); });
        _log(`${body.issues?.length || 0} epic(s)/feature(s) résolue(s)`);
      }
    } catch (e) {
      _warn('Résolution epics :', e.message);
    }
  }
}

/**
 * J. Features innovation (label Inno) + leurs tickets enfants
 * @returns {Array} Liste des features innovation
 */
async function _jiraFetchInnoFeatures(ctx) {
  const _innoFeatureList = [];
  const _innoProjFilter = (CONFIG.jira.projects || []).length
    ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
    : '';
  const _innoJql = `issuetype in (Feature, Fonctionnalité) AND labels in (Inno, inno, innovation, Innovation)${_innoProjFilter} ORDER BY priority ASC`;
  _log(`Innovation Features : ${_innoJql}`);
  try {
    const _innoUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_innoJql)}&maxResults=200&fields=${ctx.fields}`;
    const _innoRes = await _jiraFetch(_innoUrl, { headers: { Accept: 'application/json' } });
    if (_innoRes.ok) {
      const _innoIssues = (await _innoRes.json()).issues || [];
      const _innoKeys = _innoIssues.map(i => i.key);
      _log(`Innovation : ${_innoIssues.length} features trouvées (${_innoKeys.join(', ')})`);

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

      if (_innoKeys.length) {
        const _childJql = `parent in (${_innoKeys.join(',')})${_innoProjFilter} ORDER BY priority ASC`;
        _log(`Innovation enfants : ${_childJql}`);
        try {
          const _childUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_childJql)}&maxResults=500&fields=${ctx.fields}`;
          const _childRes = await _jiraFetch(_childUrl, { headers: { Accept: 'application/json' } });
          if (_childRes.ok) {
            const _childIssues = (await _childRes.json()).issues || [];
            const _activeKeys = new Set(ctx.allIssues.map(i => i.key));
            const _futureKeys = new Set(ctx.allFutureIssues.map(i => i.key));

            const _memberTeamMap = {};
            ctx.allIssues.forEach(i => {
              if (i._boardTeam && i.fields?.assignee?.displayName) {
                _memberTeamMap[i.fields.assignee.displayName] = i._boardTeam;
              }
            });

            let _childAdded = 0, _childEnriched = 0;
            _childIssues.forEach(i => {
              if (_activeKeys.has(i.key) || _futureKeys.has(i.key)) {
                _childEnriched++;
                return;
              }
              const assignee = i.fields?.assignee?.displayName;
              let team = (assignee && _memberTeamMap[assignee]) || null;
              if (!team) {
                const epicKey = _getEpicKey(i.fields);
                if (epicKey) {
                  const sameEpic = ctx.allIssues.find(ai => _getEpicKey(ai.fields) === epicKey && ai._boardTeam);
                  if (sameEpic) team = sameEpic._boardTeam;
                }
              }
              i._boardTeam = team || '';
              ctx.allIssues.push(i);
              _childAdded++;
            });
            _log(`Innovation enfants : ${_childIssues.length} trouvés, ${_childAdded} ajoutés, ${_childEnriched} déjà connus`);
          }
        } catch (e) {
          _warn('Innovation enfants :', e.message);
        }
      }
    } else {
      _warn(`Innovation Features : HTTP ${_innoRes.status}`);
    }
  } catch (e) {
    _warn('Innovation Features :', e.message);
  }
  return _innoFeatureList;
}

/**
 * K. Tickets amélioration continue (rétro, post-mortem, CoP)
 * @returns {Array} Liste des tickets amélioration
 */
async function _jiraFetchAmelTickets(ctx) {
  const _ameliorationList = [];
  const _amelProjFilter = (CONFIG.jira.projects || []).length
    ? ` AND project IN (${CONFIG.jira.projects.map(p => `"${p}"`).join(',')})`
    : '';
  const _amelJql = `(labels in (Rétro, ActionRetro, Amélioration, postmortem, retro, retro-tech, RetroFonc, Adapt, CoP-méthodo, cop-dev, Methodo) OR summary ~ Rétro OR summary ~ Retro OR summary ~ postmortem OR summary ~ "post-mortem" OR summary ~ CoP) AND (statusCategory != Done OR resolved >= -15d)${_amelProjFilter} ORDER BY labels DESC, status DESC, Rank ASC`;
  _log(`Amélioration continue : ${_amelJql}`);
  try {
    const _amelUrl = `${JIRA_PROXY}/api/3/search/jql?jql=${encodeURIComponent(_amelJql)}&maxResults=500&fields=${ctx.fields}`;
    const _amelRes = await _jiraFetch(_amelUrl, { headers: { Accept: 'application/json' } });
    if (_amelRes.ok) {
      const _amelIssues = (await _amelRes.json()).issues || [];
      _log(`Amélioration continue : ${_amelIssues.length} tickets trouvés`);
      _amelIssues.forEach(i => {
        const f = i.fields;
        const sprintRaw  = f[CONFIG.sync.sprintField];
        const sprintList = sprintRaw ? _parseSprintField(sprintRaw) : [];
        const piSprint   = _extractPISprint(sprintList);
        const assignee = f.assignee?.displayName || '';
        let team = '';
        if (assignee) {
          for (const ai of ctx.allIssues) {
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
      _warn(`Amélioration continue : HTTP ${_amelRes.status}`);
    }
  } catch (e) {
    _warn('Amélioration continue :', e.message);
  }
  return _ameliorationList;
}

/**
 * L. Groupes depuis Espaces JIRA (projectGroups)
 */
function _jiraBuildGroups(projectGroups, allIssues) {
  let gColorIdx = 0;
  return Object.entries(projectGroups)
    .filter(([, pg]) => pg.boards.some(b => {
      const teamName = _boardTeamName(b.name);
      return allIssues.some(i => i._boardTeam === teamName);
    }))
    .map(([pk, pg]) => ({
      id:    `G-${pk}`,
      name:  pg.name,
      color: _GROUP_COLORS[gColorIdx++ % _GROUP_COLORS.length],
      teams: pg.boards.map(b => _boardTeamName(b.name)),
    }));
}

/**
 * M+N+O. Transform + backlog + deduce teams (bloc final)
 * @returns {Object} Le cache final prêt à sauvegarder
 */
async function _jiraTransformAndSave(ctx, groups, innoFeatureList, ameliorationList, opts) {
  const project = (CONFIG.jira.projects || []).join(', ') || 'JIRA';
  const cache   = _transform(ctx.allIssues, project, CONFIG.sprint.current, ctx.teamConfigs);
  cache.groups       = groups;
  cache.team_configs = Object.fromEntries(
    Object.entries(ctx.teamConfigs).filter(([, tc]) => tc.hasIssues)
  );
  cache.inno_features        = innoFeatureList;
  cache.amelioration_tickets = ameliorationList;
  cache.board_status_map     = { ..._boardColumnMap };
  BOARD_COLUMNS = ctx.allBoardColumns;

  try {
    await fetch(`${DATA_PROXY}/board-columns.json`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(ctx.allBoardColumns, null, 2),
    });
    _log('Board columns sauvegardé → board-columns.json');
  } catch (e) {
    _warn('Sauvegarde board-columns.json échouée :', e.message);
  }

  // Enrichir les features depuis toutes les issues (sprint actif + fermés + backlog)
  {
    const _allFeatures = {};
    const _epicFeatureMap = {};
    (cache.features || []).forEach(f => { _allFeatures[f.id] = f; });
    (cache.epics || []).forEach(e => { if (e.feature) _epicFeatureMap[e.id] = e.feature; });

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
    ctx.allIssues.forEach(_scanIssue);
    ctx.allFutureIssues.forEach(_scanIssue);

    [].concat(ctx.allIssues, ctx.allFutureIssues).forEach(i => {
      const iType = (i.fields?.issuetype?.name || '').toLowerCase();
      const iLevel = i.fields?.issuetype?.hierarchyLevel;
      if (iType === 'feature' || iType === 'fonctionnalité' || (iLevel != null && iLevel >= 2)) {
        if (!_allFeatures[i.key]) {
          _allFeatures[i.key] = { id: i.key, title: i.fields?.summary || i.key, color: '#2563EB', status: _mapStatus(i.fields?.status?.name), _jiraStatus: i.fields?.status?.name || '' };
        }
        const piName = i._piSprintName || '';
        if (piName && !_allFeatures[i.key].piSprint) _allFeatures[i.key].piSprint = piName;
        if (i._boardTeam && i._boardTeam !== '_PI' && !_allFeatures[i.key].team) _allFeatures[i.key].team = i._boardTeam;
      }
    });

    cache.features = Object.values(_allFeatures);
    (cache.epics || []).forEach(e => {
      if (!e.feature && _epicFeatureMap[e.id]) e.feature = _epicFeatureMap[e.id];
    });

    if (cache.features.length > 1 || (cache.features.length === 1 && cache.features[0].id !== 'F-1')) {
      _log(`Features extraites : ${cache.features.map(f => `${f.id}="${f.title}"`).join(', ')}`);
    }
  }

  // Tickets futurs / backlog planifié
  if (opts.incremental) {
    cache.backlog_tickets = (typeof BACKLOG_TICKETS !== 'undefined' ? [...BACKLOG_TICKETS] : []);
    _log(`Sync incrémentale - backlog conservé (${cache.backlog_tickets.length})`);
  } else {
    const _seenActive = new Set(ctx.allIssues.map(i => i.key));
    const _uniqueFuture = ctx.allFutureIssues.filter(i => {
      if (!_seenActive.has(i.key)) return true;
      return !!i._fromPiJql;
    });
    const _blEpicMap = { ...ctx.sharedEpicMap };
    (cache.epics || []).forEach(e => { _blEpicMap[e.id] = { title: e.title || '' }; });
    const bufferEpics = Object.entries(_blEpicMap).filter(([, v]) => (v.title || '').toLowerCase().includes('buffer'));
    _log(`EpicMap backlog: ${Object.keys(_blEpicMap).length} entrées (${bufferEpics.length} buffer: ${bufferEpics.map(([k, v]) => `${k}="${v.title}"`).join(', ')})`);
    cache.backlog_tickets = _transformBacklog(_uniqueFuture, _blEpicMap);
    if (cache.backlog_tickets.length) _log(`${cache.backlog_tickets.length} tickets backlog/futurs`);
  }

  // Enrichir sprintName des backlog tickets done sans sprint
  {
    const _velSprintMap = {};
    Object.entries(ctx.teamConfigs).forEach(([tid, tc]) => {
      (tc.velocityHistory || []).forEach(vh => {
        [].concat(vh.tickets || [], vh.bufferTickets || []).forEach(t => {
          _velSprintMap[t.id] = vh.name;
        });
      });
    });
    let enriched = 0;
    (cache.backlog_tickets || []).forEach(bt => {
      if (bt.sprintName || !_velSprintMap[bt.id]) return;
      bt.sprintName = _velSprintMap[bt.id];
      enriched++;
    });
    if (enriched) _log(`${enriched} tickets backlog enrichis avec sprintName depuis vélocité`);
  }

  // Déduire la team et piSprint des epics/features depuis les tickets enfants
  {
    const _allTicketPool = [].concat(cache.tickets || [], cache.backlog_tickets || []);

    (cache.epics || []).forEach(e => {
      if (e.team && e.team !== '_PI' && e.team !== '') return;
      const child = _allTicketPool.find(t => t.epic === e.id && t.team && t.team !== '_PI' && t.team !== '');
      if (child) e.team = child.team;
    });

    (cache.features || []).forEach(f => {
      if (!f.team || f.team === '_PI' || f.team === '') {
        const childEpic = (cache.epics || []).find(e => e.feature === f.id && e.team && e.team !== '_PI' && e.team !== '');
        if (childEpic) { f.team = childEpic.team; }
        else {
          const childTicket = _allTicketPool.find(t => t.epic === f.id && t.team && t.team !== '_PI' && t.team !== '');
          if (childTicket) f.team = childTicket.team;
        }
      }
      if (!f.piSprint) {
        const asBl = (cache.backlog_tickets || []).find(t => t.id === f.id && t.piSprint);
        if (asBl) f.piSprint = asBl.piSprint;
      }
    });

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
    _log(`Enrichissement features : ${enrichedTeams} avec team, ${enrichedPi} avec piSprint`);
  }

  return cache;
}

/**
 * P. Lead/cycle time via changelog des tickets Done
 * Mute cache.tickets[*].leadTimeDays, cycleTimeDays, startedDate, resolvedDate
 */
async function _jiraFetchCycleTimes(cache) {
  const doneTickets = cache.tickets.filter(t => isDone(t.status));
  if (!doneTickets.length) return;
  _log(`Calcul lead/cycle time pour ${doneTickets.length} tickets terminés…`);
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
        if (firstInProg) t.startedDate  = firstInProg.toISOString().slice(0, 10);
        if (doneDate)    t.resolvedDate = doneDate.toISOString().slice(0, 10);
      } catch { /* skip */ }
    }));
  }
  const withCT = cache.tickets.filter(t => t.cycleTimeDays != null).length;
  _log(`Cycle time calculé pour ${withCT}/${doneTickets.length} tickets`);
}

// ============================================================
// Orchestrateur principal
// ============================================================

/**
 * Fetch tous les boards JIRA, récupère les sprints actifs de chaque board,
 * transforme les issues en taguant l'équipe depuis le nom du board,
 * construit les groupes depuis location.projectKey,
 * sauvegarde en cache et applique.
 * Appelé sur clic "Synchroniser".
 */
async function loadJiraData(opts = {}) {
  _jiraApiCalls = 0;

  // A+C. Discovery champs + fetch boards (en parallèle)
  const [spFieldId, boardsResult] = await Promise.all([
    _jiraDiscoverSPField(),
    _jiraFetchBoards(),
  ]);

  // B. Construire la string de champs API
  const fields = _jiraBuildFields(spFieldId);

  const { scrumBoards, projectGroups } = boardsResult;

  // Contexte partagé entre sous-fonctions
  const ctx = {
    fields,
    allIssues:       [],
    allFutureIssues: [],
    futureSeenKeys:  new Set(),
    sharedEpicMap:   {},
    teamConfigs:     {},
    firstSprint:     null,
    piBoardIds:      [],
    allBoardColumns: {},
    step:       1,
    totalSteps: 1 + scrumBoards.length * 2 + 6,
  };

  // D. Sprints actifs + issues + colonnes + détection inactive
  await _jiraFetchSprintsAndIssues(scrumBoards, ctx);

  // Branches conditionnelles (incremental saute E, F, G, H, J, K)
  _syncProgress(++ctx.step, ctx.totalSteps, 'Vélocité (sprints fermés)…');

  let innoFeatureList  = [];
  let ameliorationList = [];
  let piCtx = { currentPINum: null, piFuture: 0, projFilter: '', piActiveKeys: new Set() };

  if (opts.incremental) {
    _log('Sync incrémentale - vélocité et backlog ignorés');
  } else {
    // E. Velocity history (sprints fermés)
    await _jiraFetchVelocityHistory(spFieldId, ctx);

    // F. Backlog (sprints futurs)
    _syncProgress(++ctx.step, ctx.totalSteps, 'Backlog (sprints futurs)…');
    await _jiraFetchFutureSprints(ctx);

    // G. Tickets PI (JQL)
    _syncProgress(++ctx.step, ctx.totalSteps, 'Tickets PI (JQL)…');
    piCtx = await _jiraFetchPITickets(ctx);

    // H. Features PI
    if (piCtx.currentPINum) {
      _syncProgress(++ctx.step, ctx.totalSteps, 'Features PI…');
      await _jiraFetchPIFeatures(piCtx.currentPINum, piCtx.piFuture, piCtx.projFilter, piCtx.piActiveKeys, ctx);
    }

    // J. Innovation features
    innoFeatureList = await _jiraFetchInnoFeatures(ctx);

    // K. Amélioration continue
    ameliorationList = await _jiraFetchAmelTickets(ctx);
  }

  // I. Résoudre les titres des epics/features stubs
  await _jiraResolveEpicTitles(ctx);

  // L. Groupes depuis Espaces JIRA
  const groups = _jiraBuildGroups(projectGroups, ctx.allIssues);

  _syncProgress(ctx.totalSteps, ctx.totalSteps, 'Transformation & sauvegarde…');

  // M+N+O. Transform + backlog + deduce teams
  const cache = await _jiraTransformAndSave(ctx, groups, innoFeatureList, ameliorationList, opts);

  // P. Lead/cycle time
  await _jiraFetchCycleTimes(cache);

  // Q. Sauvegarder en cache + appliquer
  try {
    await fetch(`${DATA_PROXY}/${_cacheFile()}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cache),
    });
    _log(`Cache sauvegardé → ${_cacheFile()}`);
  } catch (e) {
    _warn('Sauvegarde cache échouée :', e.message);
  }

  _applyCache(cache);
}
