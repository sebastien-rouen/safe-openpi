// ============================================================
// CONFIG - Paramètres centralisés de l'application
// Les valeurs de connexion JIRA sont lues depuis window.ENV
// (généré par scripts/generate-env.js à partir de .env).
// Pour les autres paramètres, modifier ce fichier directement.
// ============================================================

const E = window.ENV || {};

const CONFIG = {

  // --- Connexion JIRA ---
  jira: {
    url:      E.JIRA_URL     || 'https://votre-jira.atlassian.net',
    token:    E.JIRA_TOKEN   || '',
    projects: (E.JIRA_PROJECT || '').split(',').map(s => s.trim()).filter(Boolean),
    excludeTeams: (E.JIRA_EXCLUDE_TEAMS || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // --- Paramètres de synchronisation JIRA ---
  sync: {
    maxBoardsPerPage:     300,  // Boards récupérés par page (pagination de l'API boards)
    maxIssuesPerSprint:   500,  // Issues max par sprint actif
    closedSprintsFetch:   800,  // Sprints fermés à fetcher via board API (fallback)
    velocityHistoryCount:   5,  // Nb de sprints historiques à conserver (sélecteur + graphiques)
    piHistoryCount:         3,  // Nb de PIs passés pour le calcul empirique
    maxEpicsResolve:      200,  // Epics orphelines à résoudre en fin de sync
    velocityMaxIssues:   2000,  // Issues max à scanner pour l'historique de vélocité (JQL)
    maxFutureSprints:      10,  // Sprints futurs max par board
    maxPIIssues:          500,  // Issues max pour la requête JQL PI
    piFutureCount:          2,  // Nb de PIs futurs à chercher (ex: 2 → PI courant + PI+1 + PI+2)
    cycleTimeBatchSize:    10,  // Taille de batch pour le calcul lead/cycle time
    sprintField: 'customfield_10020', // Champ sprint JIRA Cloud (peut varier selon les instances)
  },

  // --- Sprint actuel (chargé dynamiquement depuis JIRA via jira.js) ---
  sprint: {
    current:        0,
    label:          'Sprint actif',
    startDate:      '',
    endDate:        '',
    durationDays:     14,
    velocityTarget:   80,
    sprintsPerPI:      5,  // Sprints par PI SAFe (4 feature + 1 IP) - pour le calcul
    presentielPerPI:   2,  // Sessions en présentiel par PI (ex: 1 PI Planning + 1 mid-PI Review)
    sprintStartDay:    5,  // Jour de début des itérations (0=dim, 1=lun, … 5=ven)
    pipDays:           2,  // Durée du PI Planning (jours ouvrés avant le début du PI)
    nextPlanning:     '',
    nextRetro:        '',
  },

  // --- Équipes (peuplées dynamiquement depuis JIRA - valeurs ci-dessous = fallback démo) ---
  teams: {
    A: { name: 'Équipe A', color: '#2563EB', velocity: 84 },
    B: { name: 'Équipe B', color: '#EC4899', velocity: 80 },
    C: { name: 'Équipe C', color: '#14B8A6', velocity: 76 },
    D: { name: 'Équipe D', color: '#F59E0B', velocity: 88 },
  },

  // --- Limites WIP Kanban ---
  wip: {
    backlog: 0,
    todo:    15,
    inprog:  8,
    review:  6,
    test:    4,
    done:    0,
  },

  // --- Notifications (affichage uniquement dans Paramètres) ---
  notifications: {
    slackReports: '#equipe-reports',
    slackAlerts:  '#alertes-jira',
    email:        'team-leads@example.com',
    frequency:    'Fin de sprint',
  },

  // --- Alertes sprint (jours avant/après) ---
  alerts: {
    demoDays:  1,  // J-N avant fin de sprint → "Préparation démo"
    moodDays:  2,  // J-N avant fin de sprint → "Mood meter (ROTI)"
    voteDays:  1,  // J+N après début de sprint → "Vote de confiance PI Objectives"
    scopeCreepThreshold:   2,    // Stories ajoutées mid-sprint pour déclencher l'alerte scope creep
    blockedRatioThreshold: 0.3,  // Ratio bloquants / en cours pour déclencher l'alerte
    velocityDropPct:       15,   // % de chute sur 3 sprints pour alerter
    depAlertDays:          5,    // Jours avant cible pour signaler dépendance non résolue
    backlogAgingSprints:   3,    // Sprints sans mouvement → ticket "vieillissant"
  },

  // --- Couleurs par type de ticket (doit rester cohérent avec base.css :root) ---
  typeColors: {
    feature:   '#B45309',
    epic:      '#2563EB',
    story:     '#059669',
    storytech: '#0891B2',
    bug:       '#DC2626',
    incident:  '#EA580C',
    support:   '#D97706',
    ops:       '#64748B',
    tache:     '#0369A1',
    dette:     '#DB2777',
  },

  // --- Référentiel statuts internes ---
  // countsInVelocity : le ticket est considéré "terminé" et compte dans la vélocité
  statuses: {
    backlog: { label: 'Backlog',   countsInVelocity: false },
    todo:    { label: 'À faire',   countsInVelocity: false },
    inprog:  { label: 'En cours',  countsInVelocity: false },
    review:  { label: 'En review', countsInVelocity: false },
    test:    { label: 'En test',   countsInVelocity: false },
    blocked: { label: 'Bloqué',    countsInVelocity: false },
    done:    { label: 'Terminé',   countsInVelocity: true  },
  },

};

// --- Groupes d'équipes ---
// Peuplé dynamiquement depuis JIRA (boards partageant le même "Espace" / projectKey).
// En mode démo, demo-default.js peut pré-remplir ce tableau.
let GROUPS = [];
