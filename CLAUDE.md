# JIRA Dashboard - Guide Claude

## Structure du projet

```
JIRA-Dashboard/
├── index.html              # Shell HTML - markup statique + chargement des assets
├── demo/
│   ├── demo-default.js     # Scénario démo par défaut (startup tech, équipes SAFe)
│   └── demo-*.js           # Autres scénarios démo - changer le <script src> dans index.html
├── data/                   # Cache JSON (jira-sprint-*.json, piprep.json)
├── assets/
│   ├── css/
│   │   ├── base.css        # Variables CSS :root, reset, sidebar (resizable), topbar, boutons, badges, modal, toast
│   │   ├── board.css       # Boards scrum/kanban, cartes tickets, sidebar groupes
│   │   └── views.css       # Sprint bar, charts, PI, rapports, support, paramètres, roadmap, piprep, releases, sondage
│   └── js/
│       ├── vendor/
│       │   ├── chart.umd.min.js     # Chart.js 4.4.0 (local, pas CDN)
│       │   └── html2canvas.min.js   # html2canvas 1.4.1 (local, pas CDN)
│       ├── config.js       # ⚙️ CONFIG centralisé (JIRA, équipes, sprint, WIP, notifs, typeColors, sync) + GROUPS
│       ├── data.js         # Déclarations vides (let FEATURES, EPICS, TICKETS…) - remplies par demo/ ou jira.js
│       ├── jira.js         # loadJiraData() - fetch JIRA via proxy, transforme, peuple les globals
│       ├── state.js        # Variables d'état globales (currentView, currentTeam, currentGroup, reportSection…)
│       ├── utils.js        # Helpers partagés : typeName, priorityIcon, statusLabel, showToast, initials, ptsBadge, epicTag
│       ├── filter.js       # Filtrage équipes/groupes : getActiveTeams, getTickets, selectTeam, selectGroup…
│       ├── sync.js         # doSync() → appelle loadJiraData() ; _setBtnLoading, _setBtnReady, _updateLastSync
│       ├── modal.js        # openModal, closeModal, closeModalDirect, modalNavigate
│       ├── export.js       # exportPNG() - capture pleine page via html2canvas (scale 2x)
│       ├── charts.js       # initCharts() - burndown, burnup, velocity (6 sprints), donut type, CFD scrum
│       ├── scrum.js        # renderScrum, renderBoard, ticketCard, _showScrumStatDetail, _renderScrumRisks
│       ├── kanban.js       # renderKanban() - colonnes WIP, CFD chart, cycle time
│       ├── pi.js           # renderPI() - grille SAFe, objectifs, capacity chart
│       ├── reports.js      # renderReport - 8 sections (Sprint, Kanban, PI, Support, Roadmap, Prépa PI, Mood/Vélocité, Sondage) · Slack/Confluence · aperçu visuel
│       ├── support.js      # renderSupport, renderSupportList, filterSupport
│       ├── settings.js     # renderSettings, toggleGroupTeam, addGroup
│       ├── roadmap.js      # renderRoadmap() - vélocité 80/20, chronologie, simulation sprints, calendrier PI, backlog
│       ├── piprep.js       # renderPIPrep() - objectifs, ROAM, dépendances, capacité individuelle, calendrier PI, fist of five
│       ├── releases.js     # renderReleases() - Gantt features, burnup par feature, projection
│       └── navigation.js   # showView(), raccourcis clavier (1-0 / Échap / Ctrl+K), sidebar resize, recherche globale, init
```

## Ordre de chargement JS (important - pas de modules ES)

Les `<script src>` dans `index.html` doivent respecter cet ordre strict :

`config` → `data` → `demo/*` → `state` → `utils` → `filter` → **`jira`** → `sync` → `modal` → `export` → `charts` → `scrum` → `kanban` → `pi` → `reports` → `support` → `settings` → **`roadmap`** → **`piprep`** → `releases` → `navigation`

Le fichier `demo/*.js` (actif) est chargé juste après `data.js` pour pré-remplir les globals avec des données démo.
Si JIRA est configuré (`CONFIG.jira.url` et `CONFIG.jira.token`), `navigation.js` appelle automatiquement `loadJiraData()` au démarrage et écrase les données démo.

Toutes les fonctions et variables sont globales (pas d'`import/export`).

## Stack technique

- **Vanilla JS** - pas de framework, pas de bundler, pas de transpilation
- **Chart.js 4.4.0** (local `assets/js/vendor/`) - burndown, burnup, velocity, donut, CFD (scrum + kanban), capacité PI
- **html2canvas 1.4.1** (local `assets/js/vendor/`) - export PNG
- **CSS custom properties** - palette complète dans `base.css :root`
- **Persistance** - `data/piprep.json` via POST/GET serveur (debounced 300ms), `localStorage` pour préférences UI et rituels sprint

## Configuration centralisée

Tout ce qui doit être adapté au projet se trouve dans **`assets/js/config.js`** :

| Clé | Contenu |
|-----|---------|
| `CONFIG.jira` | URL, projet, token, board ID |
| `CONFIG.sync` | Paramètres API : maxBoardsPerPage, maxIssuesPerSprint, velocityHistoryCount, velocityMaxIssues, sprintField… |
| `CONFIG.sprint` | Sprint courant, dates, vélocité cible, planning |
| `CONFIG.teams` | Définition des équipes (nom, couleur, vélocité, velocityHistory[]) |
| `CONFIG.wip` | Limites WIP par colonne Kanban |
| `CONFIG.notifications` | Canaux Slack, email |
| `CONFIG.typeColors` | Couleur par type de ticket |
| `CONFIG.alerts` | Seuils alertes sprint : `demoDays`, `moodDays`, `voteDays` |
| `GROUPS` (let) | Groupes d'équipes - modifiable en runtime |

Les couleurs CSS dans `base.css :root` doivent rester cohérentes avec `CONFIG.typeColors`.

## Modèle de données

```
Feature (FEATURES)
  └─ Epic (EPICS)       - feature, team, color
       └─ Ticket (TICKETS) - type, epic, team, assignee, points, status, priority, sprint

Groupe (GROUPS in config.js) - id, name, color, teams[]
Ticket support (SUPPORT_TICKETS) - id, title, priority, status, assignee, date, description
```

**Types de tickets :** `story | storytech | bug | incident | support | ops | tache | dette`
**Statuts :** `todo | inprog | review | done | blocked | test | backlog`
**Priorités :** `critical | high | medium | low`

**Propriétés enrichies des tickets :**
- `flagged` (bool) - détecté depuis `fields.flagged` contenant "Impediment" (`_isFlagged()` dans jira.js)
- `buffer` (bool) - détecté par étiquette contenant "buffer" OU epic parent avec titre contenant "buffer" (`_isBuffer()` dans jira.js)
- `labels` (string[]) - étiquettes JIRA normalisées en minuscules
- `_jiraStatus` (string) - statut JIRA brut, re-mappé à chaque chargement du cache via `_mapStatus()`
- `updatedAt` (string|null) - timestamp ISO `fields.updated` de JIRA
- `todayChanges` (array) - entrées du changelog JIRA du jour, extraites via `_extractTodayChanges()` : `{ time, author, field, from, to }`
- `description` (string) - texte extrait du champ description JIRA (ADF → texte brut via `_extractDescription()`)
- `piSprint` (string) - nom du sprint PI associé (ex: `"PI#29"`, `"PI#30"`), extrait depuis `customfield_10020` via `_extractPISprint()` ou enrichi par la requête JQL PI (section 3.8 de jira.js). Utilisé par la roadmap visuelle pour positionner les epics dans les colonnes PI futures.
- `startedDate` / `resolvedDate` (string|null) - dates ISO du premier passage In Progress / Done, stockées lors du calcul cycle time

**Sprint goal :** stocké dans `CONFIG.sprint.goal` et `teamConfigs[X].sprintGoal`, sauvegardé/restauré depuis le cache (`sprint_goal`). Affiché dans la sprint-bar uniquement si présent dans JIRA (pas de fallback démo).

**Tickets backlog :** `sprint: 0` (ou falsy) + `status: 'backlog'` - utilisés par la vue Roadmap pour la simulation de planification. Récupérés via l'API board-specific `GET /board/{id}/sprint?state=future` puis issues par sprint ID (team correcte garantie).

**Velocity history :** `CONFIG.teams[X].velocityHistory = [{name, velocity}, ...]` - chargé dynamiquement depuis JIRA ou défini dans `demo/*.js`. Utilisé par charts.js (velocity chart, sprint selector) et roadmap.js (chronologie, référence vélocité).

## Ajouter une vue

1. Ajouter `<div class="view" id="view-nomvue">` dans `index.html`
2. Ajouter un `.nav-item` dans la sidebar HTML
3. Ajouter le titre dans le map `titles` de `navigation.js`
4. Ajouter `if (view === 'nomvue') renderNomVue();` dans `showView()`
5. Créer `assets/js/nomvue.js` avec la fonction `renderNomVue()`
6. Ajouter `<script src="assets/js/nomvue.js">` **avant** `navigation.js` dans `index.html`
7. Ajouter le refresh dans `selectTeam()` et `selectGroup()` dans `filter.js`

## Vues disponibles (raccourcis 1–0)

| Touche | Vue | Description |
|--------|-----|-------------|
| `1` | Scrum | Board sprint (3 vues : colonnes/swimlanes/liste triable) · alertes sprint · activité du jour (changelog JIRA) · burndown/burnup/velocity/CFD |
| `2` | Kanban | Colonnes WIP + CFD kanban + cycle time |
| `3` | Roadmap | Vélocité 80/20, chronologie, simulation backlog, santé backlog (KPI cliquables), features cross-équipes |
| `4` | Prépa PI | Calendrier PI, objectifs, ROAM, dépendances, heatmap, capacité individuelle, fist of five, multi-PI |
| `5` | PI Planning | Grille SAFe · objectifs avec alertes risque · capacité vs charge · alertes dépendances |
| `6` | Releases | Gantt features, burnup par feature, projection dates |
| `7` | Rapports | Multi-sections (Sprint, Kanban, PI, Support, Roadmap, Prépa PI, Mood/Vélocité, Sondage) · Slack/Confluence |
| `8` | Support | Tickets support/incidents |
| `9` | Paramètres | Groupes d'équipes, configuration |
| `Échap` | - | Fermer le modal / recherche |
| `Ctrl+K` | - | Recherche globale (tickets, epics, membres) |
| `←` `→` | - | Navigation entre tickets dans le modal |

## Chargement des données JIRA (live)

Le bouton "Synchroniser" et l'initialisation auto appellent `loadJiraData()` (dans `jira.js`).

**Prérequis :** proxy local démarré : `python scripts/proxy.py`

**Flux :**
1. `GET /api/3/field` → découverte auto du champ Story Points (`customfield_XXXXX`)
2. `GET /agile/1.0/board?maxResults=100` → pagination de tous les boards, filtrage par `location.projectKey`
3. Par board : `GET /agile/1.0/board/{id}/sprint?state=active` → sprint actif (name, dates, goal)
4. Par sprint : `GET /api/3/search/jql?jql=sprint={id}&expand=changelog` → issues du sprint + historique des modifications
5. Transformation : epics → `EPICS`, issues → `TICKETS`, incidents/support → `SUPPORT_TICKETS`
6. `FEATURES`, `MEMBERS`, `MEMBER_COLORS` construits synthétiquement depuis les assignees
7. Backlog futur : `GET /agile/1.0/board/{id}/sprint?state=future` → sprints futurs par board, puis issues par sprint ID (team correcte)
8. PI futurs : JQL `sprint IN ("PI#XX","PI#XX+1","PI#XX+2")` → tickets planifiés dans les sprints PI (indépendant des boards et de l'état du sprint - couvre `future`, `active`, `closed`). Enrichit les tickets existants avec `_piSprintName` ou ajoute de nouveaux tickets à `BACKLOG_TICKETS` avec `piSprint: "PI#29"`. Détection d'équipe par correspondance d'epic avec les tickets déjà connus.
9. Velocity history : JQL `sprint in closedSprints() AND project="X"` → groupé par `customfield_10020` (ou `CONFIG.sync.sprintField`)

**Détection équipe :** nom du board (préfixes "Sprint ", "Équipe ", "Team " supprimés). Ex: "Sprint Fuego" → team "Fuego".

**Mapping statuts dynamique :** à la sync, `GET /agile/1.0/board/{id}/configuration` récupère les colonnes de chaque board et leurs statuts associés. Le mapping `statusName → internalStatus` (todo/inprog/review/test/done/blocked) est construit dynamiquement et prend priorité sur le mapping statique `_STATUS_MAP`. Stocké dans le cache (`board_columns` = config brute par équipe, `board_status_map` = mapping aplati). Restauré avant le re-mapping des tickets au chargement du cache.

**Story points :** découverte auto via `/api/3/field`, sinon fallback sur `customfield_10016`, `10028`, `10005`.

**Détection flag :** `fields.flagged` contenant "Impediment" → `ticket.flagged = true`, statut forcé à `blocked`.

**Détection buffer :** étiquettes contenant "buffer" OU epic parent avec titre contenant "buffer" → `ticket.buffer = true`.

**Changelog JIRA :** `expand=changelog` sur la requête JQL principale → `_extractTodayChanges(issue)` filtre les entrées du jour → stocké dans `ticket.todayChanges[]`. Utilisé par l'activité du jour (scrum.js) pour afficher les vrais changements avec auteur et heure réels.

## Vue Scrum - fonctionnalités avancées

### Board views (scrum.js)
3 modes de visualisation dans le tableau sprint, toggle via `_boardViewMode` (persisté localStorage) :
- **Colonnes** (`columns`) - grille 4 colonnes (todo/inprog/review/done) avec swimlane Tâches (filtré par labels `onboarding`/`actionretro`)
- **Swimlanes** (`deadlines`) - couloirs groupés par date d'échéance/target end
- **Liste** (`list`) - tableau compact triable (colonnes : clé, titre, type, statut, assigné, points, priorité, échéance). Tri persisté dans localStorage.

### Alertes sprint (scrum.js)
Messages contextuels dans la sprint-bar selon la date courante vs dates du sprint :
- 🎬 Préparation démo : J-N avant fin de sprint (`CONFIG.alerts.demoDays`)
- 😊 Mood meter (ROTI) : J-N avant fin de sprint (`CONFIG.alerts.moodDays`)
- 🗳️ Vote de confiance : J+N après début de sprint (`CONFIG.alerts.voteDays`)
Rituels cochés persistés dans localStorage (`team_rituals`).

### Activité du jour (scrum.js)
Feed des modifications JIRA du jour, basé sur le **changelog réel** (pas des snapshots) :
- Source : `ticket.todayChanges[]` extrait depuis `expand=changelog` dans la requête JQL
- Affiche : heure réelle, auteur réel, champ modifié (statut, assigné, points, description, sprint, étiquettes, liens, rang, priorité…)
- Filtré par équipe/groupe actif via `getTickets()`
- Section pliable, header bleu pastel, compteur et résumé

### Burndown chart (charts.js)
Double axe Y : story points (axe gauche) + nombre de tickets (axe droit, couleur ambre `#F59E0B`, trait pointillé).

## Mode démo

Sans JIRA configuré, le dashboard affiche les données de `demo/demo-default.js`.

Le fichier démo contient :
- 40 tickets sprint actif + 25 tickets backlog (`sprint: 0, status: 'backlog'`)
- Velocity history pour chaque équipe (5 sprints)
- Groupes (G-1 Testo, G-2 Platino, G-3 Corevo)

**Changer de scénario démo :**
1. Créer `demo/mon-scenario.js` (copier `demo-default.js`, modifier les données)
2. Dans `index.html`, remplacer `<script src="demo/demo-default.js">` par `<script src="demo/mon-scenario.js">`

**Ordre de priorité des données :**
- JIRA live (via proxy) → écrase les données démo au chargement
- `demo/*.js` → données initiales affichées avant/si JIRA indisponible

## Vue Roadmap - règle 80/20

La vue Roadmap (`roadmap.js`) affiche :

1. **Carte vélocité** - moyenne sur l'historique, mini-histogramme, barre 80/20 visuelle
2. **Carte buffer 20%** - breakdown des 4 catégories (dette, outillage, innovation, automatisation)
3. **Chronologie des sprints** - défilement horizontal : passés (velocityHistory) → actuel → futurs simulés
4. **Simulation sprints** - bin-packing greedy du backlog trié par priorité dans des sprints de `cap80` pts
5. **Santé du backlog** - score global + 4 KPI cliquables (sans epic, sans points, sans priorité, inactifs) ouvrant un détail en popin
6. **Features cross-équipes** - visualisation des features partagées entre plusieurs équipes, avec progression par équipe et drill-down en popin
7. **Table backlog** - tous les tickets non planifiés avec points, type, epic, priorité

**Sources de données :** `getTickets()` (respecte filtre équipe/groupe), `CONFIG.teams[t].velocityHistory`, `EPICS`.

## Vue Prépa PI Planning

La vue Prépa PI (`piprep.js`) est un outil de planification PI complet, persisté dans `data/piprep.json` :

- **Score de readiness** - indicateur global avec critères pondérés, lignes cliquables → scroll vers la section concernée
- **Calendrier PI suivant** - détection auto date début (JIRA ou manuelle), jours fériés français (algorithme Pâques), présentiels, badge PIP
- **Objectifs PI** - committed/stretch, BV décroissante, filtrage par équipe
- **Matrice de charge** - charge vs capacité par sprint, calculée depuis les jours individuels (pas la vélocité)
- **Capacité individuelle** - jours/membre/sprint, checkbox pour exclure un membre, auto-advance, facteur focus 0.8
- **ROAM Board** - catégories R/O/A/M
- **Dépendances inter-équipes** - équipes issues des tickets réels (pas des clés config)
- **Fist of Five** - vote de confiance par équipe

**Persistance :** `_ppCache` en mémoire → debounced `POST /data/piprep.json` (300ms). Chargement async via `_ppLoad()`.

## Vue Rapports - multi-sections

La vue Rapports (`reports.js`) génère des rapports en format Slack et Confluence pour 8 domaines :

- `sprint`, `kanban`, `pi`, `support`, `roadmap`, `piprep`, `mood`, `sondage`
- **Aperçu visuel Slack** - layout 2 colonnes (message brut + preview dark theme) pour toutes les sections
- **Sondage** - 10 templates humoristiques rotatifs (`sprintNum % 10`), date d'envoi auto (2j ouvrés avant fin sprint), mapping emoji Slack → Unicode via `_SLACK_EMOJI`
- **Équipes** - `reportTeam` indépendant de `currentTeam`, synchronisé au clic sidebar

## Sidebar redimensionnable

Le handle `#sidebar-resizer` (entre `</aside>` et `<div id="main">`) permet de redimensionner la sidebar par drag. La largeur est persistée dans `localStorage` clé `sidebarW`. Logique dans `navigation.js` (IIFE en fin de fichier).

## Graphiques Métriques Sprint (charts.js)

- **Burndown** - idéal vs réel + courbe tickets restants (axe Y secondaire, ambre pointillé), tooltip avec delta (avance/retard en pts)
- **Vélocité** - toujours 6 colonnes (5 sprints historiques + actuel), nulls pour slots manquants
- **Donut types** - filtré par équipe active, tooltip avec count + %
- **Burnup** - scope fixe + courbe done, tooltip avec % avancement
- **CFD Sprint** - stacked area simulé (J0→aujourd'hui), 6 statuts de bas en haut
- **Sélecteur sprint** - comparaison avec sprints historiques (au-dessus des charts)

Tous les tooltips utilisent le style partagé `_TOOLTIP` (fond sombre `rgba(15,23,42,.94)`).

## Groupes d'équipes

Les groupes permettent de filtrer et agréger plusieurs équipes.
Définis dans `config.js` en tant que `let GROUPS = [...]` (mutable en runtime via les Paramètres).
Accédés dans : `filter.js`, `reports.js`, `settings.js`, `navigation.js`, `roadmap.js`.
