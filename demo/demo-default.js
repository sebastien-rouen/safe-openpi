// ============================================================
// DÉMO — Scénario par défaut : startup tech, 4 équipes, SAFe
//
// Pour utiliser ce scénario, charger ce fichier dans index.html
// après data.js :
//   <script src="demo/demo-default.js"></script>
//
// Pour créer un autre scénario : copier ce fichier, modifier les
// données, puis changer le <script src> dans index.html.
// ============================================================

FEATURES = [
  { id: 'F-1', title: 'Refonte Interface Utilisateur', color: '#B45309' },
  { id: 'F-2', title: 'Optimisation des Performances',  color: '#2563EB' },
  { id: 'F-3', title: 'Sécurité & Conformité RGPD',    color: '#059669' },
];

EPICS = [
  { id: 'E-1', title: 'Nouveau Design System', feature: 'F-1', team: 'A', color: '#2563EB' },
  { id: 'E-2', title: 'Migration React 18',    feature: 'F-1', team: 'B', color: '#EC4899' },
  { id: 'E-3', title: 'Refactoring API REST',  feature: 'F-2', team: 'A', color: '#0891B2' },
  { id: 'E-4', title: 'Cache Redis & CDN',     feature: 'F-2', team: 'C', color: '#14B8A6' },
  { id: 'E-5', title: 'SSO & OAuth 2.0',       feature: 'F-3', team: 'B', color: '#F59E0B' },
  { id: 'E-6', title: 'Audit Sécurité',        feature: 'F-3', team: 'D', color: '#EF4444' },
  { id: 'E-7', title: 'CI/CD Pipeline',        feature: 'F-2', team: 'D', color: '#06B6D4' },
  { id: 'E-8', title: 'Dashboard Analytics',   feature: 'F-1', team: 'C', color: '#10B981' },
];

MEMBERS = {
  A: ['Martin Leclerc','Sophie Renaud','Adrien Blanc','Pauline Caron'],
  B: ['Nicolas Dupont','Louise Morel','Karim Tazi','Fanny Serre'],
  C: ['Yann Barbier','Claire Martin','Hugo Robert','Olivia Petit'],
  D: ['Thomas Lambert','Victoire Roux','Julien Dufour','Baptiste Klein'],
};

MEMBER_COLORS = {
  'Martin Leclerc': '#2563EB', 'Sophie Renaud': '#EC4899', 'Adrien Blanc': '#14B8A6', 'Pauline Caron': '#F59E0B',
  'Nicolas Dupont': '#06B6D4', 'Louise Morel': '#10B981', 'Karim Tazi': '#0891B2', 'Fanny Serre': '#F43F5E',
  'Yann Barbier': '#F97316', 'Claire Martin': '#84CC16', 'Hugo Robert': '#0284C7', 'Olivia Petit': '#0369A1',
  'Thomas Lambert': '#EF4444', 'Victoire Roux': '#3B82F6', 'Julien Dufour': '#22C55E', 'Baptiste Klein': '#EAB308',
};

TICKETS = [
  // Team A — Epic E-1
  { id:'PROJ-101', title:'Créer le système de tokens de design',   type:'story',     epic:'E-1', team:'A', assignee:'Martin Leclerc', points:8,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-102', title:'Composants boutons & formulaires',        type:'story',     epic:'E-1', team:'A', assignee:'Sophie Renaud', points:5,  status:'done',    priority:'medium', sprint:12 },
  { id:'PROJ-103', title:'Migration Storybook v7',                  type:'storytech', epic:'E-1', team:'A', assignee:'Adrien Blanc', points:13, status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-104', title:"Refonte page d'accueil dashboard",       type:'story',     epic:'E-1', team:'A', assignee:'Pauline Caron', points:8,  status:'review',  priority:'high',   sprint:12 },
  // Team A — Epic E-3
  { id:'PROJ-105', title:'Audit et documentation API existante',    type:'storytech', epic:'E-3', team:'A', assignee:'Martin Leclerc', points:5,  status:'done',    priority:'medium', sprint:12 },
  { id:'PROJ-106', title:'Refactoring endpoints /users',            type:'storytech', epic:'E-3', team:'A', assignee:'Sophie Renaud', points:8,  status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-107', title:'Correction bug timeout sur /reports',     type:'bug',       epic:'E-3', team:'A', assignee:'Adrien Blanc', points:3,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-108', title:'Mise à jour Swagger documentation',       type:'tache',     epic:'E-3', team:'A', assignee:'Pauline Caron', points:2,  status:'todo',    priority:'low',    sprint:12 },
  // Team B — Epic E-2
  { id:'PROJ-201', title:'Upgrade dépendances React 18',            type:'storytech', epic:'E-2', team:'B', assignee:'Nicolas Dupont', points:8,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-202', title:'Migration vers Concurrent Mode',          type:'storytech', epic:'E-2', team:'B', assignee:'Louise Morel', points:13, status:'review',  priority:'high',   sprint:12 },
  { id:'PROJ-203', title:'Tests de régression composants',          type:'storytech', epic:'E-2', team:'B', assignee:'Karim Tazi', points:8,  status:'inprog',  priority:'medium', sprint:12 },
  { id:'PROJ-204', title:'Optimisation re-renders inutiles',        type:'dette',     epic:'E-2', team:'B', assignee:'Fanny Serre', points:5,  status:'done',    priority:'medium', sprint:12 },
  // Team B — Epic E-5
  { id:'PROJ-205', title:'Intégration Keycloak SSO',                type:'story',     epic:'E-5', team:'B', assignee:'Nicolas Dupont', points:13, status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-206', title:'Implémentation OAuth 2.0 flow',           type:'story',     epic:'E-5', team:'B', assignee:'Louise Morel', points:8,  status:'todo',    priority:'high',   sprint:12 },
  { id:'PROJ-207', title:'Incident connexion SSO production',       type:'incident',  epic:'E-5', team:'B', assignee:'Karim Tazi', points:3,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-208', title:'Documentation sécurité auth',             type:'tache',     epic:'E-5', team:'B', assignee:'Fanny Serre', points:2,  status:'todo',    priority:'low',    sprint:12 },
  // Team C — Epic E-4
  { id:'PROJ-301', title:'Setup Redis cluster production',          type:'ops',       epic:'E-4', team:'C', assignee:'Yann Barbier', points:8,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-302', title:'Stratégie de cache API responses',        type:'storytech', epic:'E-4', team:'C', assignee:'Claire Martin', points:13, status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-303', title:'Configuration CloudFront CDN',            type:'ops',       epic:'E-4', team:'C', assignee:'Hugo Robert', points:8,  status:'review',  priority:'medium', sprint:12 },
  { id:'PROJ-304', title:'Benchmarks performances cache',           type:'storytech', epic:'E-4', team:'C', assignee:'Olivia Petit', points:5,  status:'done',    priority:'medium', sprint:12 },
  // Team C — Epic E-8
  { id:'PROJ-305', title:'Dashboard métriques temps réel',          type:'story',     epic:'E-8', team:'C', assignee:'Yann Barbier', points:13, status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-306', title:'Graphiques Chart.js KPIs',                type:'story',     epic:'E-8', team:'C', assignee:'Claire Martin', points:8,  status:'todo',    priority:'medium', sprint:12 },
  { id:'PROJ-307', title:'Export PDF rapports',                     type:'story',     epic:'E-8', team:'C', assignee:'Hugo Robert', points:5,  status:'todo',    priority:'low',    sprint:12 },
  // Team D — Epic E-6
  { id:'PROJ-401', title:'Audit OWASP Top 10',                      type:'storytech', epic:'E-6', team:'D', assignee:'Thomas Lambert', points:13, status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-402', title:'Correction vulnérabilités XSS',           type:'bug',       epic:'E-6', team:'D', assignee:'Victoire Roux', points:8,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-403', title:'Mise en conformité RGPD données',         type:'story',     epic:'E-6', team:'D', assignee:'Julien Dufour', points:13, status:'review',  priority:'high',   sprint:12 },
  { id:'PROJ-404', title:'Chiffrement données sensibles',           type:'storytech', epic:'E-6', team:'D', assignee:'Baptiste Klein', points:8,  status:'inprog',  priority:'high',   sprint:12 },
  // Team D — Epic E-7
  { id:'PROJ-405', title:'Pipeline CI GitHub Actions',              type:'ops',       epic:'E-7', team:'D', assignee:'Thomas Lambert', points:8,  status:'done',    priority:'high',   sprint:12 },
  { id:'PROJ-406', title:'Déploiement Kubernetes EKS',              type:'ops',       epic:'E-7', team:'D', assignee:'Victoire Roux', points:13, status:'inprog',  priority:'high',   sprint:12 },
  { id:'PROJ-407', title:'Monitoring Datadog alertes',              type:'ops',       epic:'E-7', team:'D', assignee:'Julien Dufour', points:5,  status:'todo',    priority:'medium', sprint:12 },
  { id:'PROJ-408', title:'Incident pipeline bloqué prod',           type:'incident',  epic:'E-7', team:'D', assignee:'Baptiste Klein', points:2,  status:'blocked', priority:'high',   sprint:12 },

  // ===== BACKLOG — tickets non planifiés (sprint 0 = pas encore affecté) =====
  // Team A — E-1 Design System
  { id:'PROJ-501', title:'Composants navigation & breadcrumbs',      type:'story',     epic:'E-1', team:'A', assignee:'Martin Leclerc', points:8,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-502', title:'Dark mode support Design System',           type:'story',     epic:'E-1', team:'A', assignee:'Sophie Renaud', points:13, status:'backlog', priority:'medium',   sprint:0 },
  { id:'PROJ-503', title:'Accessibilité WCAG 2.1 AA components',     type:'story',     epic:'E-1', team:'A', assignee:'Adrien Blanc', points:13, status:'backlog', priority:'high',     sprint:0 },
  // Team A — E-3 API
  { id:'PROJ-504', title:'Refactoring endpoints /products & /orders', type:'storytech', epic:'E-3', team:'A', assignee:'Pauline Caron', points:8,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-505', title:'Couverture tests unitaires 80%',            type:'storytech', epic:'E-3', team:'A', assignee:'Martin Leclerc', points:5,  status:'backlog', priority:'medium',   sprint:0 },
  { id:'PROJ-506', title:'Documentation API OpenAPI 3.0',             type:'tache',     epic:'E-3', team:'A', assignee:'Sophie Renaud', points:3,  status:'backlog', priority:'low',      sprint:0 },
  { id:'PROJ-507', title:'Dette : suppression code mort backend',     type:'dette',     epic:'E-3', team:'A', assignee:'Adrien Blanc', points:5,  status:'backlog', priority:'medium',   sprint:0 },
  // Team B — E-2 React
  { id:'PROJ-508', title:'Server-side rendering Next.js migration',   type:'story',     epic:'E-2', team:'B', assignee:'Nicolas Dupont', points:21, status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-509', title:'Lazy loading composants lourds',            type:'storytech', epic:'E-2', team:'B', assignee:'Louise Morel', points:8,  status:'backlog', priority:'medium',   sprint:0 },
  { id:'PROJ-510', title:'Performance mobile Lighthouse 90+',         type:'story',     epic:'E-2', team:'B', assignee:'Karim Tazi', points:8,  status:'backlog', priority:'medium',   sprint:0 },
  // Team B — E-5 Auth
  { id:'PROJ-511', title:'Gestion rôles & permissions RBAC',         type:'story',     epic:'E-5', team:'B', assignee:'Fanny Serre', points:13, status:'backlog', priority:'critical',  sprint:0 },
  { id:'PROJ-512', title:'Refresh token automatique OAuth',           type:'story',     epic:'E-5', team:'B', assignee:'Nicolas Dupont', points:8,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-513', title:'Audit trail connexions utilisateurs',        type:'storytech', epic:'E-5', team:'B', assignee:'Louise Morel', points:5,  status:'backlog', priority:'medium',   sprint:0 },
  // Team C — E-4 Cache
  { id:'PROJ-514', title:'Auto-invalidation cache produits',          type:'storytech', epic:'E-4', team:'C', assignee:'Yann Barbier', points:8,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-515', title:'Prefetch pages critiques CloudFront',       type:'ops',       epic:'E-4', team:'C', assignee:'Claire Martin', points:5,  status:'backlog', priority:'medium',   sprint:0 },
  // Team C — E-8 Dashboard
  { id:'PROJ-516', title:'Filtres avancés & sauvegarde dashboard',    type:'story',     epic:'E-8', team:'C', assignee:'Hugo Robert', points:13, status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-517', title:'Graphiques prédictifs IA sur KPIs',         type:'story',     epic:'E-8', team:'C', assignee:'Olivia Petit', points:21, status:'backlog', priority:'medium',   sprint:0 },
  { id:'PROJ-518', title:'Export Excel & CSV rapports',               type:'story',     epic:'E-8', team:'C', assignee:'Yann Barbier', points:8,  status:'backlog', priority:'low',      sprint:0 },
  // Team D — E-6 Sécurité
  { id:'PROJ-519', title:'Tests de pénétration automatisés',          type:'storytech', epic:'E-6', team:'D', assignee:'Thomas Lambert', points:13, status:'backlog', priority:'critical',  sprint:0 },
  { id:'PROJ-520', title:'Correction vulnérabilités CSRF identifiées', type:'bug',      epic:'E-6', team:'D', assignee:'Victoire Roux', points:5,  status:'backlog', priority:'critical',  sprint:0 },
  { id:'PROJ-521', title:'DRP — Plan de reprise activité',            type:'storytech', epic:'E-6', team:'D', assignee:'Julien Dufour', points:13, status:'backlog', priority:'high',     sprint:0 },
  // Team D — E-7 CI/CD
  { id:'PROJ-522', title:'Auto-scaling Kubernetes HPA',               type:'ops',       epic:'E-7', team:'D', assignee:'Baptiste Klein', points:8,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-523', title:'Backup automatique PostgreSQL chiffré',      type:'ops',       epic:'E-7', team:'D', assignee:'Thomas Lambert', points:5,  status:'backlog', priority:'high',     sprint:0 },
  { id:'PROJ-524', title:'Mise à jour dépendances sécurité Q1',       type:'ops',       epic:'E-7', team:'D', assignee:'Victoire Roux', points:3,  status:'backlog', priority:'medium',   sprint:0 },
  { id:'PROJ-525', title:'Monitoring SLOs & alertes Datadog avancées', type:'ops',      epic:'E-7', team:'D', assignee:'Julien Dufour', points:8,  status:'backlog', priority:'high',     sprint:0 },
];

// --- Sprint démo ---
CONFIG.sprint.current        = 12;
CONFIG.sprint.label          = 'Sprint 12';
CONFIG.sprint.startDate      = '06 Jan 2025';
CONFIG.sprint.endDate        = '19 Jan 2025';
CONFIG.sprint.durationDays   = 14;
CONFIG.sprint.velocityTarget = 84;

// --- Historique de vélocité par équipe (5 sprints fermés : S7 → S11) ---
CONFIG.teams.A.velocityHistory = [
  { name: 'Sprint 7',  velocity: 47 },
  { name: 'Sprint 8',  velocity: 52 },
  { name: 'Sprint 9',  velocity: 49 },
  { name: 'Sprint 10', velocity: 54 },
  { name: 'Sprint 11', velocity: 50 },
];
CONFIG.teams.B.velocityHistory = [
  { name: 'Sprint 7',  velocity: 55 },
  { name: 'Sprint 8',  velocity: 60 },
  { name: 'Sprint 9',  velocity: 57 },
  { name: 'Sprint 10', velocity: 63 },
  { name: 'Sprint 11', velocity: 58 },
];
CONFIG.teams.C.velocityHistory = [
  { name: 'Sprint 7',  velocity: 56 },
  { name: 'Sprint 8',  velocity: 58 },
  { name: 'Sprint 9',  velocity: 62 },
  { name: 'Sprint 10', velocity: 59 },
  { name: 'Sprint 11', velocity: 55 },
];
CONFIG.teams.D.velocityHistory = [
  { name: 'Sprint 7',  velocity: 65 },
  { name: 'Sprint 8',  velocity: 68 },
  { name: 'Sprint 9',  velocity: 72 },
  { name: 'Sprint 10', velocity: 66 },
  { name: 'Sprint 11', velocity: 69 },
];

// --- Groupes démo (simulés comme si 3 Espaces JIRA) ---
GROUPS = [
  { id: 'G-1', name: 'Testo',   color: '#0284C7', teams: ['A','B','C'] },
  { id: 'G-2', name: 'Platino', color: '#059669', teams: ['B','D']     },
  { id: 'G-3', name: 'Corevo',  color: '#EA580C', teams: ['C','D']     },
];

SUPPORT_TICKETS = [
  {
    id: 'SUP-001',
    title: 'Impossible de se connecter après mise à jour SSO',
    priority: 'critical', status: 'inprog', assignee: 'Karim Tazi', team: 'B', date: '2025-01-14',
    description: `🔴 PROBLÈME CRITIQUE — Impact production

**Contexte :**
Suite à la mise à jour du module SSO (version 2.4.1 → 2.5.0) déployée ce matin à 08h30,
plusieurs utilisateurs signalent l'impossibilité de se connecter à l'application.

**Utilisateurs affectés :**
- Département Finance : ~45 utilisateurs
- Département RH : ~23 utilisateurs
- Direction générale : 5 utilisateurs

**Comportement observé :**
1. L'utilisateur saisit ses identifiants Keycloak
2. Redirection vers l'application
3. Écran blanc avec erreur "Token validation failed - invalid_grant"
4. Déconnexion automatique après 3 secondes

**Actions en cours :**
- ✅ Rollback initié sur le service keycloak-adapter
- ⏳ Investigation en cours avec l'équipe Infra`,
  },
  {
    id: 'SUP-002',
    title: "Performance dégradée sur l'interface de reporting",
    priority: 'high', status: 'open', assignee: 'Martin Leclerc', team: 'A', date: '2025-01-12',
    description: `🟠 PROBLÈME HAUTE PRIORITÉ

**Métriques observées :**
| Page | Avant | Après | Dégradation |
|------|-------|-------|-------------|
| Dashboard principal | 1.2s | 8.7s | +625% |
| Rapport mensuel     | 3.1s | 24.3s | +684% |

**Hypothèses :**
1. Requête N+1 suite au refactoring API
2. Index manquant sur la table reports_aggregated
3. Cache Redis non invalidé correctement`,
  },
  {
    id: 'SUP-003',
    title: "Données manquantes dans l'export RGPD",
    priority: 'high', status: 'open', assignee: 'Julien Dufour', team: 'D', date: '2025-01-10',
    description: `🟠 CONFORMITÉ RGPD — Action requise sous 72h

Demande d'exercice des droits (DSAR) reçue le 08/01/2025.
Délai légal de réponse : 1 mois (art. 12 RGPD).

**Données manquantes dans l'export :**
- Historique des connexions (table user_auth_log)
- Préférences notifications (table user_preferences)
- Données de profil étendues (table user_profile_extended)`,
  },
  {
    id: 'SUP-004',
    title: "Erreurs 500 intermittentes sur l'API /orders",
    priority: 'medium', status: 'open', assignee: 'Nicolas Dupont', team: 'B', date: '2025-01-08',
    description: `🟡 PROBLÈME INTERMITTENT

**Fréquence :** ~2-3% des requêtes (~150 erreurs/jour)

**Root cause probable :**
Pool de connexions PostgreSQL sous-dimensionné (20 connexions max).

**Solution proposée :**
1. Court terme : Augmenter pool size à 50
2. Long terme : Implémenter connection pooling avec PgBouncer`,
  },
  {
    id: 'SUP-005',
    title: 'Demande ajout colonne rapport mensuel direction',
    priority: 'low', status: 'done', assignee: 'Claire Martin', team: 'C', date: '2025-01-06',
    description: `🟢 DEMANDE D'ÉVOLUTION — Résolue ✅

Ajouter au rapport mensuel PDF une colonne "Évolution M-1" en % pour :
CA, Nombre de commandes, Panier moyen, Taux de conversion.

- ✅ Déployé en production le 11/01/2025
- ✅ Validé par la Direction Générale`,
  },
];
