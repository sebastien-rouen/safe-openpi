# 🏗️ Guide Solution Architect

> Suivez les dependances techniques, la dette, les innovations et la sante du backlog pour garder la coherence architecturale.

---

## Ce que le dashboard vous apporte

En tant que SA, vous avez une vision transverse. Le dashboard vous aide a :

- **Detecter les dependances inter-equipes** avant qu'elles ne deviennent des blocages
- **Suivre la dette technique** et son budget dans le buffer 20%
- **Piloter les initiatives d'innovation** (POCs, spikes, explorations)
- **Evaluer la sante du backlog** : tickets orphelins, non estimes, abandonnes
- **Comprendre le flux** entre equipes via les features cross-equipes

---

## Vos ecrans cles

### 1. Dependances et risques (Roadmap > onglet Risques)

C'est votre section principale. Elle contient :

**Dependances inter-equipes** :
- Tableau avec equipe source, equipe cible, livrable, statut
- Heatmap des dependances (quand il y en a beaucoup)
- Statuts : todo, en cours, bloque, done

**Risques intra-equipe** :
- Risques techniques internes identifies par les equipes

**ROAM Board** :
- Vue consolidee de tous les risques techniques et organisationnels
- Categorisation Resolved/Owned/Accepted/Mitigated

**Depuis la sidebar** : la section "Risques & Qualite" montre en permanence le nombre de dependances et risques. Cliquez pour naviguer directement vers cette section.

### 2. Features cross-equipes (Roadmap > Vision)

La section **Features cross-equipes** montre les features partagees entre plusieurs equipes :

- Progression par equipe (barre de completion)
- Drill-down en popin pour voir les tickets par equipe
- Identification des goulots : si une equipe est a 80% et l'autre a 20%, il y a un risque

### 3. Budget technique : la regle 80/20

La vue Roadmap affiche la repartition du buffer 20% :

| Categorie | Budget | Usage |
|-----------|--------|-------|
| Dette technique | 6% | Refactoring urgent, fixes architecturaux |
| Outillage CI/CD | 5% | Pipelines, monitoring, infra |
| Innovation | 5% | POCs, explorations techniques |
| Automatisation | 4% | Tests auto, scripts N2/N3 |

La barre 80/20 compare l'ideal et le reel. Si le buffer > 25%, c'est un signal : trop de dette ou trop d'urgences.

### 4. Sante du backlog (Roadmap > Backlog)

4 KPIs cliquables vous alertent :

| KPI | Signal architectural |
|-----|---------------------|
| Sans epic | Tickets sans rattachement = perte de tracabilite |
| Sans points | Tickets non estimes = risque de sous-estimation |
| Sans priorite | Backlog non priorise = decisions manquantes |
| Inactifs | Tickets abandonnes = dette silencieuse |

### 5. Innovations (touche `7`)

La vue Innovations suit vos POCs et spikes :

- **Sélecteur PI** pour filtrer par increment
- **Board par initiative** : chaque Feature d'innovation a son mini-board
- **Sprint IP** : banniere quand c'est le sprint innovation (x.5)
- **KPIs** : avancement, points termines, tickets en cours

---

## Vue Kanban pour le flux technique (touche `2`)

La vue Kanban vous aide a comprendre les goulots :

- **WIP limits** : si une colonne est en rouge, il y a surcharge
- **Cycle time** : temps moyen pour traverser le pipeline de dev
- **Lead time** : temps total de creation a completion
- **Breakdown par type** : ratio story/bug/tache par equipe

Un cycle time qui augmente peut signaler un probleme architectural (complexite croissante, couplage).

---

## Amelioration continue

La vue **Amelioration Continue** suit les actions issues des retrospectives :

- **Swimlane Retro** : actions d'amelioration
- **Swimlane Post-Mortem** : corrections suite a incidents
- **Swimlane CoP Methodo** : sujets de Community of Practice

Les actions techniques (refactoring, outillage, automatisation) apparaissent ici.

---

## Utiliser la recherche transverse

`Ctrl+K` ouvre la recherche globale :

- Recherchez par **ID de ticket** (PROJ-123)
- Recherchez par **nom d'epic** pour trouver tous les tickets associes
- Recherchez par **membre** pour voir la charge d'un expert technique

Dans la **modale ticket**, consultez :
- La description complete
- Les **web links JIRA** (documents d'architecture, ADR, schemas)
- L'epic parent et le rattachement a une feature

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Regulier | Roadmap > Risques | Dependances, ROAM |
| Regulier | Roadmap > Vision | Features cross-equipes, 80/20 |
| Hebdomadaire | Roadmap > Backlog | Sante du backlog |
| Par PI | Innovations | POCs, spikes |
| Ponctuel | Kanban | Flux, goulots |
| Continu | Amelioration | Actions techniques |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `3` | Roadmap (dependances, backlog, 80/20) |
| `2` | Kanban (flux) |
| `7` | Innovations |
| `Ctrl+K` | Recherche transverse |

---

## Evolutions a venir

- **Graphe de dependances interactif** : visualisation en reseau des dependances entre equipes et features
- **Metriques DORA** : deployment frequency, lead time, change failure rate, MTTR
- **Suivi de la dette technique** : evolution du ratio dette/features sur plusieurs PIs
- **Architecture Decision Records** : liens directs vers les ADR depuis les tickets et epics
- **Impact analysis** : quand un ticket est modifie, visualiser les tickets et equipes impactes
