# 🎨 Guide UX Designer

> Suivez l'avancement de vos stories UX, identifiez les goulots et gardez le lien entre design et delivery.

---

## Pourquoi ce dashboard vous concerne

En tant qu'UX Designer integre dans une equipe SAFe, vous avez besoin de :

- **Voir ou en sont vos stories** dans le sprint en cours
- **Identifier les blocages** qui pourraient impacter les livrables UX
- **Comprendre le flux** de travail pour mieux synchroniser design et developpement
- **Suivre les innovations** et POCs en cours
- **Preparer vos interventions** aux rituels (planning, review, retro)

---

## Les vues qui vous seront utiles

### 1. Vue Scrum - suivre vos tickets (touche `1`)

Le board sprint vous montre tous les tickets de l'equipe en colonnes :

- **A faire** > **En cours** > **Review** > **Termine**
- Chaque carte affiche : type, assignation, points, priorite, epic parent
- **Mode Liste** : triez par assignation pour retrouver rapidement vos tickets

**Pour filtrer vos tickets** : utilisez la recherche globale (`Ctrl+K`) et tapez votre nom.

**Modale ticket** : cliquez sur n'importe quel ticket pour voir :
- Description complete (texte, liens, mentions)
- Web links JIRA associes (maquettes Figma, specs, documents)
- Sprint actuel et progression
- Historique des changements

### 2. Vue Kanban - comprendre le flux (touche `2`)

La vue Kanban est particulierement utile pour vous :

| Metrique | Ce que ca vous dit |
|----------|-------------------|
| WIP limits | Combien de tickets sont "en vol" par colonne - trop = bottleneck |
| Cycle time | Temps moyen entre "En cours" et "Done" - utile pour estimer vos livrables |
| CFD | Flux cumule - si "Review" gonfle, les devs attendent des retours |

**Cas d'usage** : si le cycle time augmente, c'est peut-etre le moment de proposer des stories UX plus petites et mieux decoupees.

### 3. Vue Innovations (touche `7`)

Si vous contribuez a des initiatives d'innovation :

- Chaque **Feature d'innovation** a son mini-board
- Les tickets enfants montrent leur avancement
- Le **sélecteur PI** filtre par increment
- La **banniere Sprint IP** signale quand c'est le sprint innovation (x.5)

Utile pour suivre vos POCs, prototypes et explorations design.

---

## Liens web dans les modales

Les **modales de ticket** affichent automatiquement les **liens web** associes dans JIRA :

- Liens vers vos maquettes Figma ou Sketch
- Liens vers des specs fonctionnelles
- Liens vers des documents de recherche utilisateur

Les liens apparaissent en bas de la modale avec le favicon du site, le titre cliquable et le domaine.

**Astuce** : dans JIRA, utilisez la fonctionnalite "Ajouter un lien web" pour rattacher vos maquettes aux tickets.

---

## Comprendre les indicateurs de sante

### Dans la sidebar (toujours visible)

- **Bloques** : tickets avec un impediment - souvent un signal que le design ou les specs manquent
- **Flagges** : tickets marques comme problematiques dans JIRA
- **Progression** : pourcentage feature + buffer

### Dans les charts

- **Burndown** : si la courbe reelle est au-dessus de l'ideale, l'equipe prend du retard
- **Distribution par type** : donut montrant la repartition story/bug/tache - un ratio de bugs eleve peut signaler des problemes de qualite en amont

---

## Preparer les rituels

### Sprint Planning

Consultez la vue **Roadmap** (touche `3`) :
- La **simulation backlog** montre les tickets a venir et leur repartition dans les prochains sprints
- Identifiez vos stories UX dans le backlog pour anticiper

### Sprint Review

- Vue **Rapports** > section **Sprint** : liste des stories terminees avec points et type
- Repérez les stories UX livrees pour preparer votre part de la demo

### PI Planning

- Vue **PI Planning** (touche `4`) > onglet **Objectifs**
- Verifiez que les objectifs incluent des composantes UX
- La matrice **Capacite** vous aide a comprendre la charge equipe et a positionner vos stories

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Scrum | Suivi de vos tickets |
| Regulier | Kanban | Comprendre le flux |
| Par sprint | Rapports | Preparation review |
| Par PI | Innovations | POCs et explorations |
| Ponctuel | Roadmap | Backlog a venir |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `1` | Vue Scrum (votre board) |
| `2` | Vue Kanban (flux) |
| `7` | Innovations |
| `Ctrl+K` | Recherche rapide |
| `Fleches` | Naviguer entre tickets dans la modale |

---

## Evolutions a venir

- **Filtre par label** : filtrer le board par labels (ex: "UX", "design-review") pour isoler vos tickets
- **Tags visuels custom** : identification visuelle des stories UX sur le board
- **Intégration Figma** : apercu des maquettes directement dans la modale ticket
- **Metrics UX** : cycle time specifique aux stories de type UX pour mesurer le throughput design
