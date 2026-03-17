# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.
Format base sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet adhere au [Semantic Versioning](https://semver.org/lang/fr/).

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
- Persistance piprep.json multi-PI avec detection automatique
- Theme clair/sombre
