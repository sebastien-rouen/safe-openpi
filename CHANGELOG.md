# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.
Format base sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet adhere au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publie] - 2026-03-26

### Rapports dynamiques PI/Sprint

- **Selecteur PI/Sprint** : les rapports s'adaptent au PI et sprint selectionnes via `_rptSprintData()`
- **Donnees historiques** : rapports de sprints passes bases sur `velocityHistory` (tickets, membres, dates)
- **Membres** : utilisation de `_rotTeamMembers()` (rotation support) au lieu de `MEMBERS[]` brut

### Web links dans les modales de tickets

- **Fetch on-demand** : `_fetchRemoteLinks(issueKey)` recupere les liens web JIRA a l'ouverture de la modale
- **Affichage** : favicon, titre cliquable, badge domaine — securise via `_esc()`

### Filtrage PI sur la roadmap

- **Fix velocite/buffer** : la carte "Etat des lieux du PI" affiche les donnees du PI selectionne (pas le sprint actif)
- **Fix `_piAllTickets`** : n'inclut les tickets du sprint actif que si le sprint appartient au PI selectionne
- **Barres histogramme** : affichage correct des sprints clos pour les PI non courants

### PI Planning : gestion PI futurs

- **Masquage sections historiques** : "Sprints precedents" et "Autres sprints du PI" masques pour les PI futurs (mood + fist of five)
- **Detection PI reel** : utilisation de `_ppDetectPI()` au lieu de `_piDetect().piNum` pour la comparaison
- **Sparklines filtrees** : fist of five filtre par PI selectionne
- **Chart vide** : masquage complet de la carte "Evolution Confiance PI" quand aucune donnee

### Navigation sidebar risques

- **Lien vers Roadmap** : clic sur les items risques/deps dans la sidebar redirige vers Roadmap > Risques
- **Fix repliement** : `preventDefault()` empeche le toggle du `<details>` au clic sur la fleche de navigation
- **Preservation etat** : l'etat ouvert/ferme du details est preserve lors des re-renders

### Nouvelles vues

- **Innovations** (`inno.js`) : board par Feature d'innovation, selecteur PI, sprint IP, KPIs
- **Amelioration Continue** (`amelioration.js`) : retro, post-mortem, CoP en 3 swimlanes kanban
- **Mood** (`mood.js`) : mood meter, ROTI, vote de confiance avec sparklines
- **Sidebar** (`sidebar.js`) : progress, buffer, objectifs PI, risques avec navigation
- **Absences** (`absences.js`) : import Excel, calcul jours, capacite

### Documentation

- **10 guides utilisateur** par persona : SM, PO, UX, PM, BO, SA, RTE, Support, Dev, OPS
- **README** reecrit : guides par profil, architecture simplifiee, evolutions prevues
- **CLAUDE.md** restructure : conventions, pieges courants, fonctions PI centralisees

---

## [1.0.0] - 2026-03-17

### Added
- Dashboard JIRA multi-equipes avec vues Scrum, Kanban, Roadmap, PI Planning, Prepa PI, Rapports, Support, Parametres
- Synchronisation JIRA Cloud via proxy local (sprint actif, backlog, velocity history, changelog)
- Mode demo avec donnees pre-remplies (40 tickets, 3 groupes, velocity history)
- Modal ticket avec metadonnees, description ADF (emoji, mentions, liens), sprint progress bar
- Graphiques Chart.js : burndown, burnup, velocity, donut types, CFD
- Vue Roadmap : velocite 80/20, chronologie sprints, simulation backlog, calendrier PI
- Vue Prepa PI : objectifs, ROAM, dependances, capacite individuelle, fist of five, calendrier PI
- Vue Rapports : export Slack/Confluence, apercu visuel, 7 sections, sondage humoristique
- Export PNG pleine page via html2canvas
- Sidebar redimensionnable, raccourcis clavier (1-8), recherche globale (Ctrl+K)
- Groupes d'equipes configurables
- Persistance pi-data.json multi-PI avec detection automatique
- Theme clair/sombre
