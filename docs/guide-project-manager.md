# 📐 Guide Project Manager

> Pilotez le projet avec une vue d'ensemble : planning, capacite, releases, risques et reporting.

---

## Votre tableau de bord strategique

En tant que PM, le dashboard vous donne une vision consolidee sur plusieurs equipes et PIs :

- **Ou en est la livraison ?** Releases, features, projections
- **Les equipes sont-elles en capacite ?** Charge vs capacite, absences, velocite
- **Quels sont les risques ?** ROAM, dependances, bloques
- **Comment communiquer ?** Rapports multi-format prets a envoyer

---

## Vos ecrans strategiques

### 1. Roadmap : la vue d'ensemble (touche `3`)

C'est votre ecran principal. La Roadmap se decoupe en onglets navigables :

| Onglet | Contenu |
|--------|---------|
| Vision & Avancement | Velocite agregee, KPIs PI (avancement %, pts done, sprints restants, epics) |
| Planification | Chronologie des sprints (passes, actuel, futurs simules), simulation backlog |
| Capacite | Matrice charge vs capacite par equipe, capacite individuelle avec absences |
| Risques | ROAM Board, dependances inter/intra-equipes, objectifs a risque |
| Metriques | Charts reusables (burnup, velocite, distribution) |
| Backlog | Table complete des tickets non planifies |

**Les KPIs en haut** donnent en un coup d'oeil :
- % avancement du PI
- Points termines / engages
- Velocite moyenne (toutes equipes)
- Sprints restants
- Epics termines

### 2. Releases : suivi des livrables

La vue Releases offre :

- **Gantt horizontal** par Feature : barre coloree selon l'avancement (vert > 80%, ambre 40-80%, rouge < 40%)
- **Projection** : estimation du sprint de completion basee sur la velocite roulante
- **KPIs header** : completion %, points done, velocite moyenne, sprints restants, features actives

**Usage type** : en comite de pilotage, affichez cette vue pour montrer l'avancement des features et les projections.

### 3. PI Planning : gouvernance PI (touche `4`)

- **Objectifs PI** : committed vs stretch, business value, statut
- **Buffer 20%** : consommation par categorie (dette, outillage, innovation, automatisation)
- **Fist of Five** : vote de confiance des equipes avec tendance en sparkline
- **Mood Meter** : suivi du moral des equipes

### 4. Support : incidents et tickets (touche `6`)

- Rotation support en cours (qui est de garde cette semaine)
- Tickets ouverts par priorite
- Stats : critiques, urgents, resolus

---

## Gestion multi-equipes

### Groupes d'equipes

Le dashboard supporte les **groupes** : un ensemble d'equipes regroupees.

- Selectionnez un groupe dans la sidebar pour agreger les donnees
- Les metriques (velocite, progression, burndown) se combinent automatiquement
- Utile pour piloter un train SAFe ou un ensemble de squads

### Filtre par equipe

- Cliquez sur une equipe dans la sidebar pour isoler ses donnees
- Toutes les vues se mettent a jour instantanement
- La vue Rapports a son propre selecteur d'equipe (independant)

---

## Reporting : communiquer efficacement

Vue **Rapports** (touche `5`) - 8 sections disponibles :

| Section | Audience cible | Contenu |
|---------|---------------|---------|
| Sprint | Equipe, stakeholders | Velocite, stories livrees, bugs, bloquants |
| PI Planning | Direction, sponsors | Objectifs, ROAM, avancement |
| Roadmap | Comite de pilotage | Planning, backlog, projections |
| Support | Clients, management | Tickets par priorite, resolution |
| Mood / Velocite | RH, management | Tendances equipe |
| Sondage | Equipe | Message ludique pre-formate |

**Workflow de reporting** :
1. Selectionnez la section et l'equipe/groupe
2. Le rapport se genere automatiquement
3. Choisissez le format : **Slack** (copier-coller) ou **Confluence** (wiki)
4. L'apercu visuel vous montre le rendu avant envoi

---

## Gestion des risques

### ROAM Board

Accessible depuis la Roadmap > onglet Risques :

| Categorie | Signification | Action |
|-----------|--------------|--------|
| **R**esolved | Risque resolu | Aucune |
| **O**wned | Risque pris en charge | Suivre la resolution |
| **A**ccepted | Risque accepte | Documenter la decision |
| **M**itigated | Risque attenue | Verifier les mesures |

### Dependances

Deux types visualises :
- **Inter-equipes** : entre deux equipes differentes (avec statut : todo, en cours, bloque, done)
- **Intra-equipe** : risques internes a une equipe

### Sidebar : alertes permanentes

La section "Risques & Qualite" dans la sidebar montre en permanence :
- Nombre de tickets bloques et flagges
- Dependances inter/intra-equipes
- Objectifs a risque

Cliquez sur un item pour naviguer directement vers la section Risques de la Roadmap.

---

## Capacite et absences

### Matrice de charge (Roadmap > Capacite)

- Vue sprint par sprint : charge planifiee vs capacite disponible
- Alerte visuelle quand la charge depasse la capacite
- Basee sur les jours reels (pas la velocite abstraite)

### Absences (Parametres > Absences)

- Import par copier-coller depuis Excel (format tabulaire)
- Calcul automatique de la capacite reduite
- Prise en compte dans la matrice de charge et les projections

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Roadmap | KPIs, avancement, risques |
| Hebdomadaire | Rapports | Communication stakeholders |
| Par sprint | Scrum | Sprint health |
| Par PI | PI Planning | Objectifs, capacite, mood |
| Mensuel | Releases | Projections, Gantt |
| Continu | Support | Incidents en cours |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `3` | Roadmap (vue principale PM) |
| `4` | PI Planning |
| `5` | Rapports |
| `6` | Support |
| `Ctrl+K` | Recherche globale |

---

## Evolutions a venir

- **Dashboard executif** : vue synthetique avec les metriques cles en une page
- **Rapport PI automatise** : generation complete du bilan PI en un clic
- **Previsions Monte Carlo** : projection probabiliste des dates de livraison
- **Export PowerPoint** : diapositives pre-formatees pour les comites de pilotage
- **Suivi budgetaire** : correlation points/jours/cout pour le suivi financier
