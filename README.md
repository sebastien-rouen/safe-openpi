# 📊 JIRA Dashboard SAFe

Dashboard tout-en-un pour les equipes SAFe. Donnees en temps reel depuis JIRA Cloud, visualisation des sprints, PI Planning, roadmap, risques et reporting — le tout sans framework, en vanilla JS.

---

## 🚀 Demarrage rapide

### 🎭 Mode demo (sans JIRA)

Ouvrir `index.html` dans un navigateur. Les donnees de demonstration se chargent automatiquement (40 tickets, 3 groupes d'equipes, velocity history).

### ⚡ Mode live (donnees JIRA)

**Prerequis :** Python 3.6+

1. Copier `.env.example` en `.env` et renseigner :
   ```
   JIRA_URL=https://votre-instance.atlassian.net
   JIRA_USER=prenom.nom@email.com
   JIRA_TOKEN=votre-token-api-atlassian
   JIRA_PROJECT=PROJ
   ```

2. Generer la config JS :
   ```bash
   node scripts/generate-env.js    # ou editer assets/js/env.js manuellement
   ```

3. Lancer le proxy et ouvrir le dashboard :
   ```bash
   python scripts/proxy.py         # http://localhost:3001
   ```

4. Cliquer **Synchroniser** pour charger les donnees JIRA.

---

## 📖 Guides par profil

Chaque guide est autonome et adapte a votre role. Il explique quelles vues utiliser, comment interpreter les donnees et quelles evolutions sont prevues.

| Profil | Guide | Focus principal |
|--------|-------|-----------------|
| 🏃 Scrum Master | [guide-scrum-master.md](docs/guide-scrum-master.md) | Sprints, rituels, mood, impediments |
| 🎯 Product Owner | [guide-product-owner.md](docs/guide-product-owner.md) | Backlog, objectifs PI, releases, valeur |
| 🎨 UX Designer | [guide-ux-designer.md](docs/guide-ux-designer.md) | Tickets UX, flux kanban, liens maquettes |
| 📐 Project Manager | [guide-project-manager.md](docs/guide-project-manager.md) | Planning, capacite, risques, reporting |
| 💼 Business Owner | [guide-business-owner.md](docs/guide-business-owner.md) | KPIs PI, objectifs, confiance, releases |
| 🏗️ Solution Architect | [guide-solution-architect.md](docs/guide-solution-architect.md) | Dependances, dette, innovations, backlog |
| 🚂 RTE | [guide-rte.md](docs/guide-rte.md) | PI Planning, ROAM, capacite, coordination |
| 🛟 Support | [guide-support.md](docs/guide-support.md) | Rotation, tickets, priorites, incidents |
| 💻 Developpeur | [guide-developpeur.md](docs/guide-developpeur.md) | Board sprint, tickets, activite, charts |
| 🔧 OPS / DevOps | [guide-ops.md](docs/guide-ops.md) | Incidents, buffer technique, post-mortems |

---

## 🖥️ Les vues

| Touche | Vue | Description |
|--------|-----|-------------|
| `1` | 🏃 Scrum | Board sprint (colonnes / swimlanes / liste triable), alertes sprint, activite du jour, burndown, burnup, velocity, CFD, flow metrics (throughput, cycle time scatter, WIP age) |
| `2` | 📋 Kanban | Colonnes WIP, CFD, cycle time, lead time |
| `3` | 🗺️ Roadmap | Velocite 80/20, chronologie, simulation backlog, sante backlog, features cross-equipes, PI prep (ROAM, dependances, objectifs, capacite, fist of five) |
| `4` | 🗓️ PI Planning | Objectifs PI, buffer, velocite, mood meter, fist of five, metriques |
| `5` | 📊 Rapports | 8 sections (Sprint, Kanban, PI, Support, Roadmap, Prepa PI, Mood/Velocite, Sondage) en format Slack et Confluence |
| `6` | 🛟 Support | Rotation support, tickets par priorite, stats |
| `7` | 💡 Innovations | Features d'innovation, board par initiative, sprint IP |
| `8` | 🔄 Amelioration | Retro, post-mortem, CoP — board kanban |
| `9` | 📅 Releases | Gantt par feature, projection de livraison |
| `0` | ⚙️ Parametres | Groupes, rotation support, absences, configuration |

**Navigation** : `Ctrl+K` recherche globale, `Echap` fermer, `← →` naviguer dans les modales.

---

## 🏗️ Architecture

```
JIRA-Dashboard/
├── index.html                 # SPA — shell HTML + chargement des scripts
├── docs/                      # 📖 Guides utilisateur par profil
├── demo/
│   └── demo-default.js        # Donnees de demonstration
├── data/                      # Cache JSON (non versionne)
├── scripts/
│   ├── proxy.py               # Proxy HTTP local (port 3001)
│   └── generate-env.js        # Generation de env.js depuis .env
└── assets/
    ├── css/
    │   ├── base.css            # Variables, layout, sidebar, modal, toast
    │   ├── board.css           # Boards scrum/kanban, cartes tickets
    │   └── views.css           # Toutes les vues specifiques
    └── js/
        ├── vendor/             # Chart.js 4.4.0 + html2canvas 1.4.1 (local)
        ├── config.js           # Configuration centralisee
        ├── data.js             # Declarations des variables globales
        ├── state.js            # Etat applicatif (vue, equipe, groupe, filtres)
        ├── utils.js            # Helpers partages (PI stats, charts, formatage)
        ├── filter.js           # Filtrage equipes/groupes
        ├── jira.js             # Fetch JIRA, transformation, cache
        ├── sync.js             # Synchronisation manuelle
        ├── modal.js            # Modale ticket detaillee
        ├── charts.js           # Burndown, burnup, velocity, donut, CFD, flow metrics (throughput, cycle time scatter, WIP age)
        ├── sidebar.js          # Panels : progression, buffer, objectifs, risques
        ├── scrum.js            # Vue Scrum (board, alertes, activite)
        ├── kanban.js           # Vue Kanban (WIP, cycle time)
        ├── pi.js               # Vue PI Planning
        ├── roadmap.js          # Vue Roadmap (velocite, chronologie, backlog)
        ├── piprep.js           # Preparation PI (ROAM, deps, objectifs, capacite, fist)
        ├── reports.js          # Rapports multi-sections
        ├── support.js          # Vue Support
        ├── settings.js         # Parametres, rotation, absences
        ├── mood.js             # Mood meter, ROTI, vote de confiance
        ├── absences.js         # Import absences Excel
        ├── inno.js             # Vue Innovations
        ├── amelioration.js     # Vue Amelioration continue
        ├── releases.js         # Vue Releases (Gantt, projections)
        ├── standup.js          # Standup assistant
        ├── export.js           # Export PNG via html2canvas
        └── navigation.js       # Routing, raccourcis, recherche, sidebar resize
```

### Principes techniques

- **Vanilla JS** — pas de framework, pas de bundler, pas de transpilation
- **Globals** — toutes les fonctions et variables sont globales (pas d'import/export)
- **Ordre de chargement** strict dans `index.html` (config → data → demo → state → utils → ... → navigation)
- **Persistance** — `data/*.json` via le proxy (POST/GET), `localStorage` pour les preferences UI
- **Librairies locales** — Chart.js et html2canvas servies depuis `vendor/` (pas de CDN)

### Flux de donnees

```
Chargement page → lit data/jira-data.json (cache)    → affiche les donnees
                → si pas de cache : donnees demo      → toast "Synchroniser"

Synchronisation → proxy.py → JIRA REST API
                → transformation + velocity history (JQL closedSprints)
                → sauvegarde data/jira-data.json
                → re-rendu de toutes les vues
```

Le proxy (`scripts/proxy.py`) sert de passerelle CORS vers JIRA Cloud et de serveur de fichiers statiques.

---

## ⚙️ Configuration

Tout dans `assets/js/config.js` :

| Section | Contenu |
|---------|---------|
| `CONFIG.jira` | URL, projet, board ID (via `env.js`) |
| `CONFIG.sync` | Parametres API : `maxIssuesPerSprint`, `velocityHistoryCount`, `sprintField` |
| `CONFIG.sprint` | Sprint courant : label, dates, velocite cible, `sprintsPerPI` |
| `CONFIG.teams` | Equipes : nom, couleur, velocite, `velocityHistory[]` |
| `CONFIG.wip` | Limites WIP par colonne Kanban |
| `CONFIG.alerts` | Seuils alertes : `demoDays`, `moodDays`, `voteDays` |
| `GROUPS` | Groupes d'equipes (modifiable en runtime via Parametres) |

---

## 🔌 Proxy local

| Route | Description |
|-------|-------------|
| `GET /jira/*` | Proxy vers JIRA Cloud (Basic auth) |
| `GET /data/*.json` | Lecture du cache |
| `POST /data/*.json` | Ecriture du cache |
| `GET /*` | Fichiers statiques (HTML/CSS/JS) |

---

## 📦 Dependances

| Librairie | Version | Usage |
|-----------|---------|-------|
| Chart.js | 4.4.0 | Graphiques (burndown, velocity, donut, CFD...) |
| html2canvas | 1.4.1 | Export PNG des vues |
| Python | 3.6+ | Proxy local (stdlib uniquement) |

Les librairies JS sont embarquees dans `assets/js/vendor/` pour eviter les blocages de Tracking Prevention.

---

## 🗺️ Evolutions prevues

### Court terme
- Filtres avances dans le board (par label, assignation, epic)
- SLA tracking pour les tickets support
- Sprint forecast Monte Carlo (cone de prediction sur le burndown)
- Scope creep tracker (evolution du scope en overlay burnup)

### Moyen terme
- Dashboard executif : synthese en une page
- Metriques DORA (deployment frequency, lead time, change failure rate, MTTR)
- Dependency heatmap inter-equipes (matrice N x N)
- Capacity vs charge en temps reel

### Long terme
- Graphe de dependances interactif entre equipes et features
- Synchronisation Slack bidirectionnelle (notifications push)
- Export PowerPoint pour les comites de pilotage
- Personal dashboard par developpeur

---

## 🤝 Maintenance

### Ajouter une vue

1. Ajouter `<div class="view" id="view-nomvue">` dans `index.html`
2. Ajouter un `.nav-item` dans la sidebar HTML
3. Ajouter le titre dans `titles` de `navigation.js`
4. Ajouter `if (view === 'nomvue') renderNomVue();` dans `showView()`
5. Creer `assets/js/nomvue.js` avec `renderNomVue()`
6. Ajouter le `<script>` **avant** `navigation.js` dans `index.html`
7. Ajouter le refresh dans `selectTeam()` et `selectGroup()` dans `filter.js`

### Convention de nommage

- Fonctions globales : `renderVue()`, `_helperInterne()`
- Fonctions piprep : prefixe `_pp` (ex: `_ppRefreshROAM()`)
- Fonctions rapports : prefixe `_rpt` (ex: `_rptSprintData()`)
- IDs HTML de section : `rm-sec-xxx` (roadmap), `pp-xxx` (piprep)

### Cache et persistance

| Fichier | Contenu | Gere par |
|---------|---------|----------|
| `data/jira-data.json` | Tickets, epics, velocity history, membres | `jira.js` (sync) |
| `data/pi-data.json` | Objectifs, ROAM, dependances, capacite, fist | `piprep.js` |
| `data/supports.json` | Rotation support | `settings.js` |
| `data/team-mood.json` | Votes mood/ROTI | `mood.js` |
| `data/absences.json` | Absences importees | `absences.js` |
| `localStorage` | Preferences UI, board view, tri, sidebar width | Divers |
