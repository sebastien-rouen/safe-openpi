// ============================================================
// STATE - Variables d'état globales de l'application
// ============================================================

let currentView       = 'scrum';
let currentTeam       = 'all';
let currentGroup      = null;
let reportTeam        = null; // synchronisé avec la sidebar via _rptSyncTeam()
let reportFormat      = 'slack';
let reportSection     = 'sprint'; // sprint | kanban | pi | support | roadmap | piprep
let reportPI          = null;     // PI sélectionné (ex: '28'), null = PI courant
let reportSprint      = null;     // Itération sélectionnée (ex: '28.3'), null = sprint courant
let supportFilter     = 'all';
let chartsInitialized = false;
