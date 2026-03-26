# JIRA Dashboard - Guide Claude

## Structure du projet

```
JIRA-Dashboard/
├── index.html              # SPA — shell HTML + chargement des scripts (ordre strict)
├── docs/                   # Guides utilisateur par persona (SM, PO, UX, PM, BO, SA, RTE, Support, Dev, OPS)
├── demo/
│   └── demo-default.js     # Données démo (startup tech, équipes SAFe)
├── data/                   # Cache JSON (non versionné) — pi-data, jira-data, supports, mood, absences
├── scripts/
│   ├── proxy.py            # Proxy HTTP local (port 3001) — CORS bypass + serveur fichiers
│   └── generate-env.js     # Génère assets/js/env.js depuis .env
└── assets/
    ├── css/
    │   ├── base.css        # Variables :root, reset, sidebar, topbar, modal, toast, badges
    │   ├── board.css       # Boards scrum/kanban, cartes tickets
    │   └── views.css       # Vues spécifiques : charts, PI, rapports, roadmap, piprep, releases, sondage
    └── js/
        ├── vendor/         # Chart.js 4.4.0 + html2canvas 1.4.1 (local, pas CDN)
        ├── config.js       # CONFIG centralisé (JIRA, équipes, sprint, WIP, sync, alerts, typeColors) + GROUPS
        ├── data.js         # Déclarations globales vides (FEATURES, EPICS, TICKETS…)
        ├── state.js        # État applicatif (currentView, currentTeam, reportPI, reportSprint…)
        ├── utils.js        # Helpers partagés + fonctions PI centralisées (_piDetect, _piAllTickets, _piVelocityStats, _piBufferStats, _renderFistChart…)
        ├── filter.js       # Filtrage : getActiveTeams(), getTickets(), selectTeam(), selectGroup()
        ├── jira.js         # loadJiraData() — fetch JIRA via proxy, transformation, cache + _fetchRemoteLinks()
        ├── sync.js         # doSync() → loadJiraData()
        ├── modal.js        # openModal/closeModal + web links JIRA (_loadWebLinks)
        ├── export.js       # exportPNG() via html2canvas
        ├── charts.js       # Burndown, burnup, velocity, donut, CFD sprint
        ├── mood.js         # Mood/ROTI + vote confiance — panels, sparklines, persistance
        ├── sidebar.js      # Sidebar : progress, buffer, objectifs PI, risques (nav → roadmap)
        ├── scrum.js        # renderScrum — board 3 modes, alertes, activité du jour
        ├── kanban.js       # renderKanban — colonnes WIP, CFD, cycle time
        ├── pi.js           # renderPI — objectifs, buffer, vélocité, ROAM, mood, fist of five
        ├── reports.js      # renderReport — 8 sections, sélecteur PI/Sprint, _rptSprintData(), Slack/Confluence
        ├── support.js      # renderSupport — rotation, tickets par priorité
        ├── settings.js     # renderSettings — groupes, rotation support, absences, config JIRA
        ├── absences.js     # Import absences Excel, calcul jours, capacité
        ├── roadmap.js      # renderRoadmap — vélocité 80/20, chronologie, backlog, sections collapsibles avec onglets
        ├── piprep.js       # Bibliothèque _pp*() consommée par roadmap — ROAM, deps, objectifs, capacité, fist, calendrier PI
        ├── inno.js         # renderInno — Features d'innovation, board par initiative, sprint IP
        ├── amelioration.js # renderAmelioration — retro, post-mortem, CoP (3 swimlanes kanban)
        ├── releases.js     # renderReleases — Gantt features, projection, KPIs
        └── navigation.js   # showView(), raccourcis 1-0/Échap/Ctrl+K, sidebar resize, recherche, init
```

## Ordre de chargement JS (important — pas de modules ES)

`config` → `data` → `demo/*` → `state` → `utils` → `filter` → `jira` → `sync` → `modal` → `export` → `charts` → `mood` → `sidebar` → `scrum` → `kanban` → `pi` → `reports` → `support` → `settings` → `absences` → `roadmap` → `piprep` → `inno` → `amelioration` → `releases` → `navigation`

Toutes les fonctions et variables sont **globales** (pas d'import/export).

## Conventions de nommage

| Préfixe | Fichier | Exemple |
|---------|---------|---------|
| `_pp` | piprep.js | `_ppRefreshROAM()`, `_ppDepList()`, `_ppObjList()`, `_ppFistSection()` |
| `_rpt` | reports.js | `_rptSprintData()`, `_rptSprintCtx()`, `_rptCollectPISprints()` |
| `_rm` | roadmap.js | `_rmScrollTo()`, `_rmSection()`, `_rmToggleSection()` |
| `_pi` | utils.js | `_piDetect()`, `_piAllTickets()`, `_piVelocityStats()`, `_piBufferStats()` |
| `_rot` | settings.js | `_rotTeamMembers()` |
| `render*` | vues | `renderScrum()`, `renderRoadmap()`, `renderPI()` |

### IDs HTML importants

| Pattern | Usage | Exemple |
|---------|-------|---------|
| `view-xxx` | Conteneur de vue | `view-scrum`, `view-roadmap` |
| `rm-sec-xxx` | Section roadmap collapsible | `rm-sec-risques`, `rm-sec-vision` |
| `pp-xxx` | Section piprep | `pp-roam`, `pp-deps`, `pp-objectives`, `pp-fist` |
| `sb-xxx-wrap` | Conteneur sidebar | `sb-risks-wrap`, `sb-buffer-wrap` |

## Modèle de données

```
Feature (FEATURES)
  └─ Epic (EPICS)       - feature, team, color
       └─ Ticket (TICKETS) - type, epic, team, assignee, points, status, priority, sprint

Groupe (GROUPS)         - id, name, color, teams[]
Support (SUPPORT_TICKETS) - id, title, priority, status, assignee, date, description
Innovation (INNO_FEATURES) - id, title, status, labels, assignee, points, piSprint
Backlog (BACKLOG_TICKETS) - tickets non planifiés ou PI futurs
```

**Types :** `story | storytech | bug | incident | support | ops | tache | dette`
**Statuts :** `todo | inprog | review | done | blocked | test | backlog`
**Priorités :** `critical | high | medium | low`

### Propriétés enrichies des tickets

| Propriété | Type | Source |
|-----------|------|--------|
| `flagged` | bool | `fields.flagged` contenant "Impediment" → statut forcé `blocked` |
| `buffer` | bool | Label "buffer" OU epic parent titre "buffer" |
| `labels` | string[] | Étiquettes JIRA normalisées en minuscules |
| `_jiraStatus` | string | Statut JIRA brut, re-mappé via `_mapStatus()` |
| `updatedAt` | string | ISO timestamp `fields.updated` |
| `todayChanges` | array | Changelog JIRA du jour : `{ time, author, field, from, to }` |
| `description` | string | ADF → texte brut via `_extractDescription()` |
| `piSprint` | string | Sprint PI associé (ex: "PI#29") |
| `startedDate` / `resolvedDate` | string | Dates ISO In Progress / Done |
| `allSprints` | string[] | Tous les sprints associés au ticket |
| `sprintName` | string | Nom du sprint actif du ticket |

### Velocity history (enrichie)

`CONFIG.teams[X].velocityHistory` = `[{ name, velocity, tickets, bufferTickets, members, startDate, endDate }, ...]`

Chargé depuis JIRA (JQL closedSprints) ou défini dans `demo/*.js`. Utilisé par :
- `charts.js` (velocity chart, sélecteur sprint)
- `roadmap.js` (chronologie, histogramme PI)
- `reports.js` (`_rptSprintData()` pour les rapports de sprints passés)
- `utils.js` (`_piVelocityStats()`, `_piAllTickets()`)

## Fonctions centralisées PI (utils.js)

Ces fonctions sont utilisées partout — les modifier avec soin :

| Fonction | Rôle | Attention |
|----------|------|-----------|
| `_piDetect()` | Retourne `{ piNum, isCurrent, sprintsPerPI }` — le PI **sélectionné** (pas le PI actif) | `piNum` vient de `_ppCurrentPI()` ou du label sprint |
| `_ppDetectPI()` | Retourne le PI **réellement actif** (depuis les noms de sprint JIRA) | Utiliser pour savoir si un PI est futur |
| `_piAllTickets(teams, piNum)` | Collecte tous les tickets d'un PI (actif + backlog + fermés) | N'inclut le sprint actif que si `piNum` correspond au PI courant |
| `_piVelocityStats(teams, piNum)` | Stats vélocité agrégées par PI | Filtre `velocityHistory` par regex `piNum.\d+` |
| `_piBufferStats(teams, piNum)` | Stats buffer par PI | Appelle `_piAllTickets()` puis filtre `t.buffer` |

**Piège fréquent** : `_piDetect().piNum` retourne le PI sélectionné (ex: "29" si l'utilisateur a choisi PI 29). Pour savoir si c'est le PI courant, utiliser `_piDetect().isCurrent`. Pour le PI réellement actif, utiliser `_ppDetectPI()`.

## Système de rapports (reports.js)

### Sélecteur PI/Sprint

- `reportPI` / `reportSprint` (state.js) — PI et itération sélectionnés
- `reportSprint` stocke le numéro d'itération (ex: `"28.4"`), pas le nom complet
- `_rptSprintCtx(team)` résout l'itération → nom de sprint spécifique à l'équipe
- `_rptSprintData(team)` retourne `{ tickets, members, startDate, endDate, velTarget, isHistorical, historicalVelocity }`
- Pour les membres : utilise `_rotTeamMembers(team)` (rotation support) au lieu de `MEMBERS[team]` brut

### Sections

8 sections : `sprint`, `kanban`, `pi`, `support`, `roadmap`, `piprep`, `mood`, `sondage`
Chaque section a : format Slack (raw + preview dark) + format Confluence.

## Roadmap : architecture des sections

La vue Roadmap utilise un système d'onglets collapsibles (`_rmTabs`) :

| Tab ID | Contenu |
|--------|---------|
| `vision` | Carte vélocité PI + buffer 80/20 + KPIs + fist of five summary |
| `planification` | Chronologie, simulation backlog |
| `capacite` | Readiness, calendrier PI, capacité individuelle, matrice charge |
| `risques` | ROAM Board + dépendances inter/intra + objectifs à risque |
| `metriques` | Charts réutilisables |
| `backlog` | Santé backlog + features cross-équipes + table backlog |

Navigation : `_rmScrollTo(tabId)` ouvre la section et scroll avec offset pour les sticky tabs.

## Piprep (piprep.js)

Bibliothèque de rendu, pas une vue autonome. Sections rendues par `_pp*Section()`, consommées par `roadmap.js`.

**Refresh ciblé** : `_ppRefreshROAM()`, `_ppRefreshDeps()`, `_ppRefreshObj()`, `_ppRefreshFist()` remplacent le `outerHTML` de la section par son ID (`pp-roam`, `pp-deps`, `pp-objectives`, `pp-fist`).

**Persistance** : `_ppCache` en mémoire → debounced `POST /data/pi-data.json` (300ms).

**Détection PI futur** : utiliser `_ppDetectPI()` (PI actif réel), pas `_piDetect().piNum` (PI sélectionné). Comparaison numérique `parseInt(piNum) > parseInt(realPiNum)`.

## Sidebar (sidebar.js)

Sections : progress, buffer, objectifs PI, risques & qualité, stats sprint.

**Risques** : items avec `nav: 'risques'` naviguent vers Roadmap > Risques au clic (`showView('roadmap')` + `_rmScrollTo('risques')`). L'état ouvert/fermé du `<details>` est préservé lors des re-renders.

**Re-render** : `showView()` appelle `_renderSidebarRisks()` etc. à chaque changement de vue. Toujours préserver l'état `open` du `<details>` avant de remplacer `innerHTML`.

## Chargement des données JIRA

`loadJiraData()` (jira.js) — séquence :

1. `GET /api/3/field` → découverte auto champ Story Points
2. `GET /agile/1.0/board` → boards filtrés par `location.projectKey`
3. Par board : sprint actif → issues + changelog (`expand=changelog`)
4. Transformation : EPICS, TICKETS, SUPPORT_TICKETS, FEATURES, MEMBERS
5. Backlog : sprints futurs par board
6. PI futurs : JQL `sprint IN ("PI#XX"...)` → enrichissement tickets
7. Innovation : JQL Features avec label Inno → `INNO_FEATURES`
8. Velocity history : JQL `sprint in closedSprints()` → `velocityHistory[]`

**Détection équipe** : nom du board sans préfixes ("Sprint ", "Équipe ", "Team ").
**Mapping statuts** : dynamique via `board/{id}/configuration` + fallback `_STATUS_MAP`.
**Remote links** : `_fetchRemoteLinks(issueKey)` — fetch on-demand pour la modale (pas en bulk).

## Cache et persistance

| Fichier | Contenu | Géré par |
|---------|---------|----------|
| `data/jira-data.json` | Tickets, epics, velocity, membres, board columns | jira.js |
| `data/pi-data.json` | Objectifs, ROAM, deps, capacité, fist, calendrier | piprep.js |
| `data/supports.json` | Rotation support | settings.js |
| `data/team-mood.json` | Votes mood/ROTI | mood.js |
| `data/absences.json` | Absences importées | absences.js |
| `localStorage` | Préfs UI, board view, tri, sidebar width, rituels | Divers |

## Ajouter une vue

1. `<div class="view" id="view-xxx">` dans `index.html`
2. `.nav-item` dans la sidebar HTML
3. Titre dans `titles` de `navigation.js`
4. `if (view === 'xxx') renderXxx();` dans `showView()`
5. Créer `assets/js/xxx.js` avec `renderXxx()`
6. `<script>` **avant** `navigation.js` dans `index.html`
7. Refresh dans `selectTeam()` et `selectGroup()` de `filter.js`

## CHANGELOG.md

**Toujours mettre à jour `CHANGELOG.md`** lors de modifications conséquentes (nouvelles features, fixes importants, refactors). Le changelog est un historique lisible des évolutions — il sert aux utilisateurs et à la maintenance future.

Format : section `[Non publié]` en haut, puis blocs `###` par feature/fix avec description et fichiers modifiés. Voir le skill `/git changelog` pour le format complet.

## Pièges courants

1. **PI sélectionné vs PI actif** : `_piDetect().piNum` = sélectionné, `_ppDetectPI()` = actif réel
2. **`_piAllTickets` et sprint actif** : n'inclut les tickets du sprint actif que si le sprint appartient au PI demandé (regex `piNum.\d+` sur le label sprint)
3. **`reportSprint`** : stocke l'itération (`"28.4"`), pas le nom complet. Utiliser `_rptSprintCtx(team).label` pour afficher
4. **Refresh sidebar** : `showView()` re-rend la sidebar entière. Toujours préserver l'état `open` des `<details>` avant `innerHTML`
5. **`_rotTeamMembers(team)`** vs `MEMBERS[team]` : le premier combine JIRA + manuels + absences - hidden. Toujours préférer `_rotTeamMembers`
6. **Fist of five / sparklines** : filtrer par PI avec le paramètre `piNum`. Sans filtre, les données de tous les PIs se mélangent
7. **Sections piprep** : refresh partiel via `outerHTML` (pas `innerHTML`). L'ID (`pp-roam`, etc.) doit être sur le div racine de la section
