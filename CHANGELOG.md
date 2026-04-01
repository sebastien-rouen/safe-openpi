# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.
Format base sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet adhere au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publie] - 2026-03-31

### Securite

- **Token JIRA retire du client** : `JIRA_TOKEN` n'est plus expose dans `window.ENV` / `env.js` — le proxy `server.js` gere l'auth. `generate-env.js` n'exporte plus que `JIRA_HAS_TOKEN: true` (`env.js`, `generate-env.js`, `config.js`, `navigation.js`, `settings.js`)
- **Dark mode : fonds pastels et couleurs en dur** : remplacement de 76+ couleurs hex en dur par des variables CSS semantiques (`--success-bg`, `--warning-bg`, `--danger-bg`, `--info-bg` + variantes `fg`) avec overrides dark mode (`base.css`, `pi.js`, `piprep.js`, `scrum.js`, `roadmap.js`, `reports.js`, `mood.js`, `sidebar.js`)
- **ptsBadge() invisible en dark mode** : migre vers classe CSS `.pts-badge` au lieu de `background:#1E293B` en dur (`utils.js`, `base.css`)
- **thresholdColor()** : nouvelle fonction utilitaire pour les ternaires tri-couleur vert/orange/rouge (`utils.js`)
- **Table statuts piprep.js factorisee** : 4 copies identiques remplacees par constantes `PP_STATUS_OPTS` / `PP_STATUS_OPTS_DEP`
- **Bonnes pratiques CSS ajoutees dans CLAUDE.md** : variables semantiques, anti-patterns hex en dur, classes disponibles

- **Protection XSS deployee** : `escapeHtml()` globale appliquee sur 57+ points d'injection innerHTML dans 12 fichiers (`modal.js`, `scrum.js`, `navigation.js`, `sidebar.js`, `sync.js`, `support.js`, `filter.js`, `roadmap.js`, `inno.js`, `amelioration.js`, `piprep.js`, `reports.js`). Couvre titres, assignees, equipes, labels, composants, auteurs, sprints, input recherche utilisateur
- **Protection SSRF proxy** : validation du path dans `server.js` — seuls `/api/` et `/agile/` sont autorises, traversal (`..`) bloque

### Performance

- **renderScrum() conditionnel** : n'est plus appele a chaque changement d'equipe/groupe si la vue active n'est pas Scrum (`filter.js`)
- **_refreshCurrentView()** : extraction d'une fonction commune pour le re-render conditionnel, eliminant 4 blocs dupliques (`filter.js`, `sync.js`)
- **Memoisation _piAllTickets()** : cache par cle `teams:piNum`, invalide apres sync ou changement d'equipe (`utils.js`)
- **Memoisation _piDetect()** : resultat cache entre les appels, invalide apres sync (`utils.js`)

### Nettoyage

- **Code mort retire** : `releases.js` retire du chargement dans `index.html` (fonction `renderReleases()` jamais appelee). `standup.js` n'etait deja pas charge
- **Doublon _initials() supprime** : fonction morte dans `jira.js`, doublon de `initials()` dans `utils.js`
- **Variable CSS --surface dedoublonnee** : declaration dupliquee dans `:root` supprimee (`base.css`)

### Tableau JIRA PI — ameliorations

- **Colonne Sprint** : affichage du sprint complet avec nom d'equipe (`pi.js`, `views.css`)
- **Colonne Equipe** : affichage discret de l'equipe par ticket (`pi.js`, `views.css`)
- **Bouton Hors sprint** : masque par defaut les tickets sans sprint (non comptabilises en velocite), toggle avec recalcul des totaux (`pi.js`, `views.css`)
- **Section Actions Retro** : tickets `ActionRetro` sans epic regroupes dans une section dediee avant "Sans epic" (`pi.js`, `views.css`)
- **Badge status nowrap** : "Clos sans suite" sur une seule ligne (`views.css`)

### Fiabilisation donnees sync

- **Team enfants features** : lecture `customfield_10001` sur chaque enfant au lieu d'heriter du parent — corrige GDC-13678 affiche Dezir au lieu de Cameleon (`jira.js`)
- **Sprint backlog enrichi** : tickets done sans sprint enrichis depuis la velocite history — corrige GDEM-3146 sans sprint affiche (`jira.js`)
- **Suppression fallbackEpic** : tickets sans parent ne sont plus assignes au premier epic du board (`jira.js`)
- **Dedup buffer** : tickets backlog buffer non re-ajoutes depuis velocityHistory (`pi.js`)
- **Progress bar PI** : utilise `_piAllTickets()` au lieu de tous les tickets actifs — chiffres coherents (`pi.js`)
- **Terme "tix"** : remplace par "tickets" a l'affichage (`pi.js`, `roadmap.js`)

### Rotation support

- **Cadenas verrouillage** : bouton lock/unlock par equipe, persistance, protection shuffle avec flash orange (`settings.js`, `views.css`)
- **Mode Mer->Mar** : 3e option de semaine support mercredi-mardi (`settings.js`)

### Pagination JIRA Cloud v3

- **Migration nextPageToken** : l'API v3 `search/jql` ignore `startAt` — migration de toutes les paginations (PI JQL, features, enfants) vers `nextPageToken` + `isLast` (`jira.js`)
- **Fix enfants features** : les enfants au-dela de la page 1 (ex: GDEM-1332, GDEM-1355 enfants de GDEM-1711) sont maintenant correctement recuperes (`jira.js`)
- **Features PI#30** : pagination des features PI (avant: plafond a 100 par `maxResults`) — PI#30 passe de 100 a 124 features (`jira.js`)
- **Labels de progression** : ajout de messages utilisateur pendant la sync (Velocite, Backlog, Tickets PI, Features PI, Enfants) (`jira.js`)

### Standardisation selecteurs PI

- **`_piListAll()`** : fonction centralisee dans `utils.js` collectant tous les PI depuis 5 sources (sprint, velocite, backlog, piprep, config)
- **`_piSelectOptions()`** : generateur HTML d'options `<select>` avec suffixe (actuel/futur) — utilise par PI Planning, Rapports, Innovation (`utils.js`)
- **PI#30 visible** : les selecteurs PI affichent desormais tous les PI synchronises, y compris les futurs (`piprep.js`, `reports.js`, `inno.js`)

### Fiabilisation detection PI

- **Suppression matching par titre** : la detection d'appartenance a un PI ne se base plus sur le titre des tickets/features/epics — uniquement sur les champs structures `piSprint`, `sprintName`, `allSprints`, labels `Cadrage_PIXX` (`utils.js`, `pi.js`)
- **Story points features** : affichage des points de la feature elle-meme quand sans enfants + inclusion dans le total (`pi.js`)
- **Filtrage `_PI`** : exclusion des teams `_PI` de la liste des equipes PI Planning (`pi.js`)

### Fichiers modifies

- `assets/js/jira.js` (~80 lignes) — pagination nextPageToken, labels progression, nettoyage debug
- `assets/js/utils.js` (~60 lignes) — `_piListAll`, `_piSelectOptions`, suppression title matching
- `assets/js/pi.js` (~30 lignes) — story points features, suppression title matching, nettoyage debug
- `assets/js/piprep.js` (~15 lignes) — selecteur PI centralise
- `assets/js/reports.js` (~5 lignes) — selecteur PI centralise
- `assets/js/inno.js` (~5 lignes) — selecteur PI centralise

---

### Synchronisation Features PI

- **Fetch dédié Features par PI** : requête JQL spécifique `issuetype IN (Feature) AND sprint IN ("PI#XX")` par PI individuel, car le champ sprint est `null` pour les Features dans l'API JIRA Cloud (`jira.js`)
- **Pagination JQL PI** : pagination automatique par pages de 100 pour récupérer tous les tickets PI (plus de limite à 100) — paramétrable via `maxPIIssues` dans les Paramètres (`jira.js`)
- **Champ Team JIRA** : ajout de `customfield_10001` dans les champs JQL — résolution automatique de l'équipe depuis le champ Team managé JIRA Cloud (`jira.js`)
- **Team effective** : résolution de la team depuis `FEATURES[]`/`EPICS[]` quand le ticket backlog a `team: "_PI"` — dans `_piAllTickets` (`utils.js`) et `_piRenderJiraSection` (`pi.js`)
- **Story points features** : affichage des story points de la feature elle-même quand elle n'a pas de tickets enfants (`pi.js`)
- **Filtrage `_PI`** : exclusion des teams `_PI` de la liste des équipes affichées dans PI Planning (`pi.js`)
- **Nettoyage debug** : suppression des console.log de debug pour l'investigation JIRA (`jira.js`)
- **Paramètres sync** : ajout de `maxPIIssues` et `piFutureCount` dans la page Paramètres, avec persistance localStorage et toast de confirmation (`settings.js`)
- **Sauvegarde paramètres** : `_stgSave()` persiste les modifications dans `localStorage` avec feedback visuel toast (`settings.js`)

### Onglet JIRA → Miro (PI Planning)

- **Nouvel onglet "JIRA"** dans PI Planning : tableau hierarchique Feature > Epic > US avec les tickets du PI selectionne (`pi.js`, `views.css`, `index.html`, `navigation.js`)
- **Regroupement** : tickets tries par feature, puis epic, puis type/points — lignes feature (fond gris) et epic (fond bleu) avec compteurs
- **Copier TSV** : bouton pour copier en tab-separated (collable dans Excel, Google Sheets, Miro table)
- **Copier Miro** : bouton pour copier au format texte structure `[TYPE] CLE — Resume (pts)` indente par feature/epic
- **Clic ticket** : ouvre la modale de detail
- **Colonnes** : Type (badge couleur), Cle, Resume, Etat (badge statut), Story Points
- **PI futur** : affiche un empty state si aucun ticket

### Correction tickets dupliques sur le board Scrum

- **Bug critique** : un ticket apparaissait dans plusieurs colonnes quand le board JIRA avait plusieurs colonnes mappees vers le meme statut interne (ex: "Specification Fonc", "Specification Tech", "En cours de dev" → tous mappes `inprog`). Le filtre `t.status === col.key` matchait toutes les colonnes (`scrum.js`)
- **Fix** : `getBoardColumns()` retourne maintenant les statuts JIRA bruts par colonne (`jiraStatuses[]`), et `_ticketInCol()` utilise `t._jiraStatus` pour matcher precisement un ticket a sa colonne JIRA d'origine (`utils.js`, `scrum.js`)
- **Largeur colonnes** : le calcul `gridCols` prend en compte toutes les swimlanes (main + taches + support) pour eviter les decalages de largeur entre headers et swimlanes
- **Colonnes vides swimlane** : motif hachures diagonales discret, opacity reduite a .35 (`board.css`)

### Coherence inter-vues

- **Sections collapsibles unifiees** : PI et Roadmap partagent desormais le meme pattern — fleche par rotation CSS (`transform: rotate(-90deg)`) au lieu de swap texte ▼/▶, meme transition `.15s`, animation `sectionOpen` (fade-in + slide) a l'ouverture, meme hover `var(--bg)` (`views.css`, `pi.js`, `roadmap.js`)
- **Highlight scroll-to Roadmap** : ajout de la classe `.rm-highlight` reutilisant l'animation `pi-highlight-fade` deja presente sur PI (`views.css`)
- **Active state unifie** : tous les boutons actionnables (filter-btn, sprint-sel-btn, fmt-btn, sqf-btn, report-section-btn) partagent le meme hover teinte primaire `rgba(2,132,199,.06)` + `border-color/color: var(--primary)` et transition `.15s` (`views.css`, `base.css`)

### Ameliorations navigation, sidebar, tabs et coherence UX

- **Team buttons hover** : feedback visuel au survol (opacity + fond) avant le clic (`base.css`)
- **Group buttons actif** : fond visible sur le groupe selectionne + badge compteur d'equipes (`board.css`, `filter.js`)
- **Nav item actif renforce** : fond plus marque (opacity .2), font-weight 600, icones en surbrillance via filter brightness/saturate (`base.css`)
- **Sprint link** : indicateur visuel permanent fleche ↗ via `::after`, plus visible au hover (`base.css`)
- **Blocked badge pulse** : animation de pulsation rouge (3 cycles) a l'apparition pour attirer l'attention (`base.css`)
- **Tabs pills → vrais tabs** : migration du style pills (border-radius 20px) vers des tabs classiques avec underline active, border-bottom 2px, coins arrondis en haut — support dark mode (`views.css`)
- **PI tabs sticky** : suppression du double border-bottom entre header PI et tabs (`views.css`)
- **Tabs overflow scroll** : scrollbar masquee, scroll horizontal natif sur les tabs qui debordent (`views.css`)
- **Buffer popin fleche** : fleche CSS triangulaire pointant vers la carte source (`base.css`)
- **Details toggle smooth** : animation d'ouverture fade-in + slide-down sur les panneaux `<details>` sidebar (`base.css`)
- **Report section hover** : fond teinte primaire au survol des boutons de section rapport (`views.css`)

### Section Animation PIP (PI Planning)

- **Nouvelle section "Animation PIP"** dans la vue PI Planning : checklist interactive pour structurer l'animation du PI Planning par equipe (`index.html`, `pi.js`, `piprep.js`, `views.css`)
- **Template global** : 5 items par defaut (objectifs, capacite, tour des equipes, organisation post-planif, vote de confiance)
- **Templates par equipe** : template specifique pour l'equipe OPS (Fuego) avec role emissaire, rotation support, tour des equipes, organisation, bonus
- **Persistance** : items sauvegardes par PI et par equipe dans `pi-data.json` via `_ppSet('pip', ...)`
- **Interactions** : cocher/decocher, editer le texte inline (contenteditable), ajouter/supprimer des items, reinitialiser depuis le template
- **Info-bulle** : bouton info sur les items avec detail (ex: role emissaire) affiche un toast
- **Indicateur progression** : compteur done/total par equipe avec couleur adaptive, message "tous couverts" quand 100%

## [Non publie] - 2026-03-28

### Ameliorations UI/UX et accessibilite

- **Tokens CSS** : ajout `--radius-sm` (6px), `--radius-lg` (12px), `--shadow-lg` — harmonisation des border-radius et ombres dans tout le projet (`base.css`, `board.css`)
- **Focus ring visible** : `:focus-visible` global avec outline primaire — suppression des `outline: none` sur search-input, sqf-select, sqf-text
- **prefers-reduced-motion** : desactivation des animations et transitions pour les utilisateurs qui le preferent (`base.css`)
- **Classes boutons** : ajout `.btn-sm` / `.btn-md` pour standardiser les paddings de boutons
- **Navigation semantique** : `div.nav-item` migre vers `button.nav-item` avec `aria-label`, `title` (raccourcis 1-9), `aria-hidden` sur les emojis (`index.html`)
- **Modal dialog natif** : migration de `<div>` vers `<dialog>` avec `showModal()`/`close()`, `aria-labelledby`, `aria-label` sur les boutons (`index.html`, `modal.js`, `navigation.js`, `pi.js`, `piprep.js`, `roadmap.js`, `scrum.js`)
- **Search box responsive** : largeur en `min(560px, 90vw)` au lieu de fixe 560px
- **Grilles responsive** : breakpoint 600px pour forcer 1 colonne sur charts/stats (`base.css`)
- **Sidebar collapsible mobile** : sidebar en overlay sous 768px avec bouton hamburger, backdrop et transition (`base.css`, `index.html`, `navigation.js`)
- **Accessibilite emojis** : `aria-hidden="true"` sur les icones emoji decoratives, `role="search"` sur le search overlay, `aria-label` sur le checkbox sync

### Roadmap reactive au selecteur PI

- **Roadmap Visuelle** : utilise le PI selectionne (`_piDetect().piNum`) au lieu de detecter depuis les sprint labels — affiche les epics et colonnes du PI choisi (`roadmap.js`)
- **Chronologie des sprints** : filtre l'historique velocity par PI selectionne, affiche tous les sprints passes pour un PI non-courant, masque sprint actuel et futurs simules pour un PI passe — titre enrichi avec le label PI
- **Simulation PI** : titre dynamique "PI XX" au lieu de "PI Suivant" quand un PI futur est selectionne (`roadmap.js`)
- **Metriques** : titre de section enrichi avec le label PI selectionne (ex: "Metriques · PI 29")
- **Colonnes PI visuelles** : labels "Passe" / "En cours" / "Futur" relatifs au PI actif reel (`_ppDetectPI`), pas au PI selectionne
- **Barre 80/20** : clic sur la partie "Features" ou "Buffer" de la barre reelle ouvre la liste des tickets correspondants (`roadmap.js`)

## [Non publie] - 2026-03-27

### Extraction Features JIRA reelles

- **Features depuis la hierarchie JIRA** : extraction des Features (parent des epics) depuis les issues du sprint actif, sprints fermes et backlog
- **Mapping epic→feature** : chaque epic pointe vers sa feature parente (plus de feature factice "F-1")
- **MIRO enrichi** : affichage des vraies features (ex: GCOM-3664) avec stats, puis US regroupees par feature
- **Fallback demo** : si aucune feature detectee, conserve le comportement par defaut

### Detection tickets PI futurs

- **Feature parente PI** : les tickets backlog dont la feature parente mentionne le PI dans son titre (ex: "[Buffer] FUEGO - PI29") sont inclus dans le PI correspondant
- **Titre ticket PI** : les tickets dont le titre mentionne le PI (ex: "Sujets OPS - PI29") sont aussi detectes
- **Filtre backlog strict** : regex stricte `PI#29` au lieu de `includes("29")` pour eviter les faux positifs
- **Pas de fallback PI futur** : un PI futur sans tickets affiche un message explicatif au lieu de charger les tickets du sprint actif

### Selecteur PI/Sprint ameliore

- **Auto-selection sprint actif** : plus d'option "Sprint actif" generique, le sprint courant est pre-selectionne avec badge "(actif)"
- **Selection intelligente** : au changement de PI, auto-selection du sprint actif si present, sinon premier sprint
- **PI futurs** : liste deroulante inclut les PI futurs (depuis backlog + PI N+1 auto-genere) avec badge "(futur)"
- **Masquage sprint pour PI futur/MIRO** : selecteur sprint masque quand PI futur ou format MIRO (export PI complet)
- **Nouveau style** : selecteurs PI/Sprint dans un conteneur distinct avec fond, chevron custom, couleur primaire pour le PI

### Export MIRO post-its

- **Nouveau format MIRO** : onglet "MIRO" dans le sélecteur de format des rapports
- **Reactive aux selecteurs** : PI, equipe et groupe sont pris en compte pour le contenu MIRO
- **Post-its par sprint** : tickets regroupés par itération, séparés Features / Stories par feature parente
- **Fallback sprint actif** : si aucun ticket PI trouve (demo), inclusion des tickets du sprint actif
- **Format copier-coller** : clé JIRA + lien, titre, story points, tag [Buffer] — prêt pour import MIRO

### Rapports Slack sans blockquote

- **Suppression `> `** : les listes à puces ne sont plus préfixées par `> ` (citation Slack) pour un affichage plus clair
- **Tous les rapports** : sprint, kanban, PI, support, roadmap, prépa PI, mood — nettoyage global

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
