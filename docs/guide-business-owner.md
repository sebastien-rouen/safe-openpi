# 💼 Guide Business Owner

> Accedez a l'essentiel : objectifs PI, avancement des features, risques et indicateurs de confiance.

---

## L'essentiel en 5 minutes

En tant que Business Owner, vous n'avez pas besoin de plonger dans les details techniques. Le dashboard vous offre les reponses a vos questions cles :

| Question | Ou trouver la reponse |
|----------|----------------------|
| Les objectifs PI sont-ils atteints ? | PI Planning > Objectifs |
| Les features avancent-elles ? | Releases > Gantt |
| Les equipes sont-elles confiantes ? | PI Planning > Fist of Five |
| Quels sont les risques ? | Roadmap > Risques |
| Quel est l'avancement global ? | Roadmap > KPIs en haut |

---

## Vos 3 ecrans essentiels

### 1. Les KPIs PI (Roadmap, touche `3`)

En haut de la vue Roadmap, une barre de KPIs vous donne la synthese :

- **Avancement PI** : pourcentage de completion (colore vert/ambre/gris)
- **Termine / Engage** : points termines sur la capacite totale
- **Velocite** : moyenne par sprint (toutes equipes)
- **Sprints restants** : combien il en reste dans le PI
- **Epics termines** : progression au niveau epic

**Repartition 80/20** : la barre visuelle compare la repartition ideale SAFe (80% features / 20% buffer) avec la repartition reelle. Si le buffer est trop eleve (>25%), la barre passe en rouge.

### 2. Les objectifs PI (PI Planning, touche `4`)

La section Objectifs montre :

- **Objectifs Committed** : les engagements fermes du PI, avec leur Business Value (BV)
- **Objectifs Stretch** : les objectifs aspirationels
- **Statut** de chaque objectif : en bonne voie, a risque, atteint
- **Progression** : barre d'avancement par objectif

Le **Fist of Five** en dessous montre le vote de confiance de chaque equipe :
- Score de 1 a 5
- Tendance en sparkline sur les sprints du PI
- Un score moyen faible (<3) est un signal d'alerte

### 3. La vue Releases

Le **Gantt par Feature** vous donne :

- Une barre de progression par feature, coloree selon l'avancement :
  - Vert : >80% termine
  - Ambre : 40-80%
  - Rouge : <40%
  - Hachures rouges : tickets bloques
- La **projection** estime le sprint de livraison base sur la velocite
- Les **points restants** par feature

---

## Suivre les risques

### Dans la sidebar (toujours visible)

La section "Risques & Qualite" montre :
- Tickets bloques et flagges
- Dependances inter-equipes non resolues
- Objectifs PI a risque

### Dans la Roadmap > Risques

Le **ROAM Board** classe les risques :

| Lettre | Statut | Signification |
|--------|--------|---------------|
| R | Resolved | Risque traite |
| O | Owned | Risque en cours de traitement |
| A | Accepted | Risque accepte (decision consciente) |
| M | Mitigated | Risque attenue par des mesures |

---

## Rapports pour vos comites

Vue **Rapports** (touche `5`) :

Les sections les plus pertinentes pour vous :

- **PI Planning** : resume des objectifs, ROAM, avancement global
- **Roadmap** : backlog priorise, estimation, planning
- **Sprint** : velocite et stories livrees (pour un suivi plus fin)

Chaque rapport est disponible en :
- **Slack** : copier-coller dans un canal
- **Confluence** : format wiki pour documentation

---

## Navigation rapide

| Touche | Action |
|--------|--------|
| `3` | Roadmap (KPIs, risques) |
| `4` | PI Planning (objectifs, confiance) |
| `5` | Rapports |

**Export PNG** : chaque vue peut etre exportee en image haute resolution via le bouton en haut a droite.

---

## Les vues cles pour vous

| Frequence | Vue | Ce que vous y cherchez |
|-----------|-----|----------------------|
| Bi-mensuel | Roadmap | KPIs, avancement global, risques |
| Par PI | PI Planning | Objectifs, confiance equipes |
| Mensuel | Releases | Progression features, projections |
| Ponctuel | Rapports | Exports pour vos comites |

---

## Evolutions a venir

- **Vue executive** : synthese en une page avec les indicateurs cles (objectifs, risques, velocite, moral)
- **Tendances multi-PI** : evolution des KPIs sur plusieurs PIs pour mesurer l'amelioration continue
- **Scoring automatique des objectifs** : calcul de la Business Value livree par PI
- **Alertes par email** : notification quand un objectif passe "a risque"
- **Comparatif equipes** : benchmarks de velocite et qualite entre equipes (normalise par taille)
