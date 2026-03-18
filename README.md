# 📊 JIRA Dashboard — les équipes en SAFe

Dashboard tout-en-un pour les équipes, conçu pour les projets SAFe.
Données en temps réel depuis JIRA Cloud via un proxy local Python.

---

## 🚀 Démarrage rapide

### 🎭 Mode démo (sans JIRA)
Ouvrir `index.html` dans un navigateur — les données démo se chargent automatiquement.

### ⚡ Mode live (données JIRA réelles)

**Prérequis :** Python 3.6+ installé.

1. Copier `.env.example` en `.env` et renseigner les variables :
   ```
   JIRA_URL=https://votre-instance.atlassian.net
   JIRA_USER=prenom.nom@email.com
   JIRA_TOKEN=votre-token-api-atlassian
   JIRA_PROJECT=PROJ
   ```
2. Générer `assets/js/env.js` (si Node.js disponible) :
   ```bash
   node scripts/generate-env.js
   ```
   Ou modifier `assets/js/env.js` directement en copiant `.env.example`.

3. Lancer le proxy local :
   ```bash
   python scripts/proxy.py
   ```

4. Ouvrir **http://localhost:3001** dans un navigateur.

5. Cliquer sur **Synchroniser** pour charger les données JIRA et créer le cache local.

---

## 🏗️ Architecture

```
JIRA-Dashboard/
├── index.html              # 🌐 Application principale (SPA vanilla)
├── demo/
│   └── demo-default.js     # 🎭 Données démo (startup tech, équipes, SAFe)
├── data/                   # 💾 Cache JSON (jira-sprint-*.json, piprep.json)
├── assets/
│   ├── css/
│   │   ├── base.css        # 🎨 Variables, layout, sidebar redimensionnable, modal, toast
│   │   ├── board.css       # 🃏 Boards scrum/kanban, cartes tickets
│   │   └── views.css       # 👁️ Toutes les vues : charts, PI, rapports, roadmap, piprep…
│   └── js/
│       ├── vendor/
│       │   ├── chart.umd.min.js     # 📈 Chart.js 4.4.0 (local)
│       │   └── html2canvas.min.js   # 🖼️ html2canvas 1.4.1 (local)
│       ├── config.js       # ⚙️ Configuration centralisée (équipes, sprint, sync, WIP…)
│       ├── data.js         # 📦 Déclarations des variables globales
│       ├── jira.js         # 🔄 Fetch JIRA → transformation → velocity history JQL → cache
│       ├── sync.js         # 🔁 Bouton "Synchroniser"
│       ├── charts.js       # 📊 Burndown · Burnup · Velocity · Donut · CFD Sprint
│       ├── roadmap.js      # 🗺️ Vue Roadmap : vélocité 80/20, chronologie, backlog
│       ├── piprep.js       # 📋 Préparation PI Planning : objectifs, ROAM, capacité, calendrier PI
│       ├── reports.js      # 📝 Rapports multi-sections : Sprint, Kanban, PI, Support, Roadmap, Prépa PI, Sondage
│       └── ...             # 🧩 Autres vues : scrum, kanban, pi, support, settings, navigation
└── scripts/
    ├── proxy.py            # 🔌 Proxy HTTP local (port 3001) — bypass CORS + cache
    └── generate-env.js     # 🔐 Génère assets/js/env.js depuis .env
```

### 🔄 Flux de données

```
Page load  → lit data/jira-sprint-{id}.json (cache)   → affiche données JIRA
           → si pas de cache : affiche données démo   → toast "Synchroniser"

Sync clic  → proxy.py → JIRA REST API
           → transforme → velocity history (JQL closedSprints)
           → sauvegarde data/jira-sprint-{id}.json
           → re-rend toutes les vues
```

---

## ✨ Fonctionnalités

### 🖥️ Vues disponibles (touches 1–8)

| Touche | Vue | Description |
|--------|-----|-------------|
| `1` | **🏃 Scrum** | Board sprint (3 vues : colonnes/swimlanes/liste triable) · alertes sprint · activité du jour (changelog JIRA) · burndown/burnup · velocity · donut · CFD · stat cards cliquables |
| `2` | **📋 Kanban** | Colonnes WIP limits · CFD kanban · cycle time |
| `3` | **🗺️ Roadmap** | Vélocité moyenne · règle 80/20 · chronologie · simulation backlog en sprints |
| `4` | **📐 Prépa PI** | Calendrier PI · objectifs · ROAM · dépendances · capacité individuelle · fist of five · readiness cliquable |
| `5` | **🎯 PI Planning** | Grille SAFe · objectifs PI · capacité vs charge par équipe |
| `6` | **📝 Rapports** | Multi-sections (Sprint, Kanban, PI, Support, Roadmap, Prépa PI, Sondage) · Slack & Confluence · aperçu visuel |
| `7` | **🛟 Support** | Tickets support/incidents · description complète · filtre priorité |
| `8` | **⚙️ Paramètres** | Gestion groupes d'équipes · configuration JIRA |

### 📈 Graphiques Métriques Sprint (vue Scrum)

Tous les tooltips utilisent un style sombre unifié avec footer coloré contextuel.

| Graphique | Description |
|-----------|-------------|
| 📉 Burndown | Courbe idéale vs réelle + tickets restants (axe Y secondaire, ambre pointillé) — footer ⚠️/✅ avec delta pts |
| 📈 Burnup | Scope fixe + done cumulé — footer avec % avancement |
| ⚡ Vélocité | Toujours 6 colonnes (5 historiques + actuel) — footer taux réalisation |
| 🍩 Distribution | Répartition par type de ticket — tooltip count + % |
| 📊 CFD Sprint | Stacked area simulé par statut · J0 → aujourd'hui |

**🔍 Comparaison historique :** sélecteur de sprint au-dessus des charts (sprints fermés réels depuis JIRA).

### 🗺️ Vue Roadmap — règle 80/20

- **📊 Vélocité de référence** — moyenne des sprints historiques, min/max, mini-histogramme
- **🛡️ Buffer 20%** — 4 catégories (dette technique, outillage, innovation, automatisation)
- **📅 Chronologie** — défilement horizontal : sprints passés → actuel → futurs simulés
- **🧮 Simulation** — bin-packing greedy du backlog dans des sprints à 80% de la vélocité
- **📋 Table backlog** — tous les tickets non planifiés avec points, type, epic

### 📐 Vue Prépa PI Planning

Outil complet de préparation PI Planning (persisté dans `data/piprep.json`) :

- **🎯 Score de readiness** — indicateur global avec critères pondérés, lignes cliquables qui scrollent vers la section concernée
- **📅 Calendrier PI suivant** — détection auto de la date de début (depuis JIRA ou saisie manuelle), jours ouvrés par sprint, jours fériés français, présentiels configurables, badge PIP (PI Planning)
- **🏁 Objectifs PI** — ajout/suppression, type committed/stretch, business value décroissante par défaut (10, 9, 8…)
- **⚖️ Charge par équipe** — matrice charge vs capacité par sprint, basée sur les jours individuels
- **👥 Capacité individuelle** — jours disponibles par membre et par sprint, avec :
  - ☑️ Checkbox pour exclure un membre du calcul (absence, départ…)
  - ⏩ Auto-avance après 2 chiffres, sélection au focus
  - 🎚️ Facteur de focus configurable (×0.8)
  - 🔄 Rafraîchissement temps réel des totaux et de la matrice de charge
- **🚦 ROAM Board** — risques catégorisés (Resolved/Owned/Accepted/Mitigated)
- **🔗 Dépendances inter-équipes** — source → cible avec livrables
- **✋ Fist of Five** — vote de confiance par équipe
- **💾 Export JSON** — téléchargement du fichier de préparation complet

### 📝 Vue Rapports — multi-sections

Rapports disponibles pour chaque domaine, en format **Slack** et **Confluence** :

| Section | Contenu |
|---------|---------|
| 🏃 Sprint | Vélocité, stories terminées/reportées, bugs, incidents, bloquants |
| 📋 Kanban | Colonnes avec WIP, tickets par statut |
| 🎯 PI Planning | Résumé, epics, bloquants |
| 🛟 Support | Tickets par priorité, ouverts/résolus |
| 🗺️ Roadmap | Backlog priorisé, estimation sprints |
| 📐 Prépa PI | Objectifs, ROAM, dépendances, capacité, fist of five |
| **🗳️ Sondage** | Message Slack humoristique (10 thèmes rotatifs par sprint) |

**✨ Fonctionnalités :**
- **👀 Aperçu visuel Slack** — rendu côte à côte (message brut à copier + preview Slack dark theme) pour toutes les sections
- **👥 Sélection d'équipe** — synchronisée avec la sidebar, indépendante dans la page rapports
- **🎲 Sondage** — 10 templates humoristiques (humeur, film, énergie, cuisine, musique, jeu vidéo, météo, GIF, course, avion), date d'envoi calculée (2 jours ouvrés avant fin de sprint)

### 🏃 Vue Scrum — Board sprint

3 modes de visualisation (toggle persisté) :
- **📊 Colonnes** — grille 4 colonnes (todo/inprog/review/done) avec swimlane Tâches (onboarding/retro)
- **🏊 Swimlanes** — couloirs groupés par date d'échéance
- **📋 Liste** — tableau compact avec colonnes triables (clé, titre, type, statut, assigné, points, priorité, échéance)

### ⏰ Alertes sprint

Messages contextuels dans la barre sprint selon la date courante :
- 🎬 Préparation démo (J-N avant fin de sprint)
- 😊 Mood meter / ROTI (J-N avant fin de sprint)
- 🗳️ Vote de confiance (J+N après début de sprint)

Seuils configurables dans **Paramètres > Alertes Sprint**.

### 📰 Activité du jour

Feed des modifications JIRA du jour, basé sur le **changelog réel** (`expand=changelog`) :
- 🕐 Heure et auteur réels de chaque modification
- 📝 Tous les champs : statut, assigné, points, description, sprint, étiquettes, liens, rang, priorité…
- 🔍 Filtré par équipe/groupe actif
- 📂 Section pliable avec compteur et résumé

### 🏷️ Indicateurs visuels sur les tickets

- **🚩 Flaggé** — fond pastel rouge, badge "Flaggé" — détecté depuis le champ JIRA `flagged` = "Impediment"
- **🔴 Bloqué** — fond rouge, bordure rouge — statut forcé à `blocked` pour les tickets flaggés
- **🛡️ Buffer** — fond pastel vert, badge "Buffer" — détecté par étiquette "buffer" ou epic parent avec titre "buffer"
- **🎯 Sprint goal** — affiché dans la barre sprint (uniquement si défini dans JIRA)
- **🔢 Story points uniformes** — badge `ptsBadge()` toujours visible, "– pts" si absent
- **🔗 Epic cliquable** — titre tronqué, hover affiche clé + titre complet, clic ouvre l'epic dans JIRA, icône lien externe SVG

### 🧰 Autres fonctionnalités

- **🔍 Recherche globale** (Ctrl+K) — tickets, epics, membres
- **🖼️ Export PNG** — capture pleine page de la vue active (html2canvas, scale 2x)
- **🔘 Boutons contextuels** — chaque vue a ses propres actions dans la topbar (Export PNG, Rapport)
- **↔️ Sidebar redimensionnable** — 160–420px, largeur persistée, stats dynamiques (progress bar, statuts, buffer, flags)
- **👆 Stat cards cliquables** — clic sur les stats Scrum ouvre une modale détaillée avec les tickets groupés par type
- **🌳 Hiérarchie pliable** — features pliées par défaut, epics terminés triés en bas, features entièrement terminées grisées
- **👤 Avatars initiales** — affichage des initiales dans les boards scrum/kanban, modal et support
- **🔗 Navigation par hash** — état de la vue sérialisé dans l'URL (#vue/équipe/format…)
- **⏳ Indicateur de fraîcheur** — bannière si les données ont plus de 2h
- **📦 Librairies locales** — Chart.js et html2canvas servis depuis `assets/js/vendor/` (pas de CDN)

### 🔌 Données réelles depuis JIRA

- **🔎 Découverte auto** : champ Story Points détecté via `/api/3/field` (indépendant du `customfield_XXXXX`)
- **⚡ Velocity history** : récupérée via JQL `sprint in closedSprints() AND project="X"` (filtrée par projet, sprints PI exclus)
- **👥 Équipes** : dérivées du nom des boards JIRA (préfixes "Sprint ", "Équipe ", "Team " supprimés)
- **📁 Groupes** : construits depuis les Espaces JIRA (`location.projectKey`)
- **👤 Avatars** : initiales depuis les `displayName` JIRA
- **📋 Tickets backlog** : récupérés par board via API future sprints (team correcte garantie), affichés dans la Roadmap
- **🎯 Sprint goal** : extrait de l'API sprint et sauvegardé dans le cache
- **🚩 Flags / Buffer** : détection automatique depuis les champs JIRA

---

## ⚙️ Configuration

Tout dans **`assets/js/config.js`** :

| Section | Contenu |
|---------|---------|
| `CONFIG.jira` | 🔗 URL, projet, board ID (lu depuis `env.js`) |
| `CONFIG.sync` | 🔄 Paramètres API : `maxIssuesPerSprint`, `velocityHistoryCount` (défaut 5), `velocityMaxIssues`, `sprintField`… |
| `CONFIG.alerts` | ⏰ Seuils alertes sprint : `demoDays` (démo), `moodDays` (ROTI), `voteDays` (vote confiance) |
| `CONFIG.sprint` | 🏃 Label, dates, vélocité cible |
| `CONFIG.teams` | 👥 Équipes : nom, couleur, vélocité, `velocityHistory[]` |
| `CONFIG.wip` | 🚦 Limites WIP par colonne Kanban |
| `GROUPS` | 📁 Groupes d'équipes (ex: Testo = A+B+C) |

---

## 🔌 Proxy local (`scripts/proxy.py`)

| Route | Description |
|-------|-------------|
| `GET  /jira/*` | 🔗 Proxy vers JIRA Cloud (Basic auth) |
| `GET  /data/*.json` | 💾 Serve les fichiers cache |
| `POST /data/*.json` | 📥 Sauvegarde un fichier cache |
| `GET  /*` | 📄 Fichiers statiques (HTML/CSS/JS) |

---

## 📦 Dépendances

- **📈 Chart.js 4.4.0** — graphiques (servi localement depuis `assets/js/vendor/`)
- **🖼️ html2canvas 1.4.1** — export PNG (servi localement depuis `assets/js/vendor/`)
- **🐍 Python 3.6+** — proxy local (stdlib uniquement, aucune dépendance à installer)

> 📦 Les librairies sont embarquées localement pour éviter les blocages de Tracking Prevention des navigateurs.

---

## 🎨 Palette de couleurs

| Type | Couleur |
|------|---------|
| 🟢 Story | Vert `#059669` |
| 🔵 Story Tech | Cyan `#0891B2` |
| 🔴 Bug | Rouge `#DC2626` |
| 🟠 Incident | Orange `#EA580C` |
| 🟡 Support | Jaune `#D97706` |
| ⚪ OPS | Gris `#64748B` |
| 🔷 Tâche | Bleu foncé `#0369A1` |
| 🩷 Dette | Rose `#DB2777` |
