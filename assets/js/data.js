// ============================================================
// DATA - Déclarations des variables globales de données
//
// Ces variables sont remplies par l'une des sources suivantes :
//   • demo/*.js         - données de démonstration (chargé dans index.html)
//   • assets/js/jira.js - données réelles depuis JIRA via le proxy
//
// Les renders lisent toujours ces variables - la source est transparente.
// ============================================================

let FEATURES          = [];
let EPICS             = [];
let MEMBERS           = {};
let MEMBER_COLORS     = {};
let TICKETS           = [];
let SUPPORT_TICKETS   = [];
let BACKLOG_TICKETS   = []; // Tickets non planifiés / sprints futurs (vue Roadmap)
let BOARD_COLUMNS     = {}; // Config colonnes JIRA par équipe - { teamName: [{ name, internal, statuses }] }
