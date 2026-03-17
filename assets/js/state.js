// ============================================================
// STATE — Variables d'état globales de l'application
// ============================================================

let currentView       = 'scrum';
let currentTeam       = 'all';
let currentGroup      = null;
let reportTeam        = null; // initialisé sur la première équipe réelle dans renderReportTabs()
let reportFormat      = 'slack';
let reportSection     = 'sprint'; // sprint | kanban | pi | support | roadmap | piprep
let supportFilter     = 'all';
let chartsInitialized = false;
