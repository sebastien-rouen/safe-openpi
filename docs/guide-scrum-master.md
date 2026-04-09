# 🏃 Guide Scrum Master

> Votre cockpit quotidien pour piloter les sprints, detecter les signaux faibles et animer les rituels d'equipe.

---

## Votre journee type avec le dashboard

### Le matin : etat des lieux en 2 minutes

1. **Ouvrir la vue Scrum** (touche `1`)
   - La **barre sprint** en haut vous donne immediatement : nom du sprint, jours restants, velocite en cours, objectif sprint (si defini dans JIRA).
   - Les **alertes contextuelles** apparaissent automatiquement selon la date :
     - Preparation demo en approche
     - Mood meter / ROTI a lancer
     - Vote de confiance a planifier

2. **Consulter l'activite du jour**
   - La section depliable "Activite du jour" montre les **vrais changements JIRA** : qui a modifie quoi, a quelle heure, avec les valeurs avant/apres.
   - Utile pour preparer le daily : "Alice a passe PROJ-123 en Done hier a 17h", "Bob a ete assigne a PROJ-456".

3. **Sidebar gauche** : le resume en un coup d'oeil
   - Barre de progression feature + buffer
   - Compteurs par statut (a faire, en cours, review, test, bloque, flagge)
   - Survol d'un compteur = popin avec la liste des tickets concernes

### Pendant le sprint : suivre la sante

| Indicateur | Ou le trouver | Quoi surveiller |
|------------|---------------|-----------------|
| Burndown | Charts sous le board | Ecart entre courbe ideale et reelle |
| Burnup | Charts | Le scope augmente-t-il en cours de sprint ? |
| Velocity | Charts (6 sprints) | Tendance a la baisse = signal d'alerte |
| CFD | Charts | Accumulation dans une colonne = goulot |
| Throughput | Flow Metrics | Tickets termines par jour, tendance 3j |
| Cycle Time | Flow Metrics | Scatter plot : points rouges = tickets > P85 |
| WIP Age | Flow Metrics | Tickets en cours > P85 du cycle time = risque |
| Bloques | Sidebar + board | Fond rouge, badge "Bloque" |
| Flagges | Sidebar + board | Fond pastel rouge, badge "Flagge" |

### Les 3 modes de board

Utilisez le toggle en haut du board pour basculer :

- **Colonnes** : vue classique todo/inprog/review/done, avec une swimlane dediee aux taches (onboarding, retro)
- **Swimlanes par deadline** : ideal pour visualiser les echances
- **Liste triable** : tableau compact pour trier par points, priorite, assignation - pratique en revue de sprint

---

## Rituels : le dashboard comme support

### Daily standup

- Affichez la vue **Scrum en mode Colonnes**
- L'**activite du jour** remplace le "qu'avez-vous fait hier ?" - les faits sont la
- Cliquez sur les **stat cards** (bloque, en cours) pour afficher les tickets groupes par type

### Sprint Review / Demo

- Vue **Rapports** (touche `5`) > section **Sprint**
- Generez le rapport en format Slack : copier-coller direct dans votre canal
- Ou format Confluence pour documenter
- Le rapport inclut : velocite, stories terminees/reportees, bugs, incidents, bloquants

### Retrospective

- Vue **Amelioration Continue** : suivez les actions retro dans un board dedie (3 swimlanes : Retro, Post-Mortem, CoP)
- Vue **Rapports** > section **Mood / Velocite** : tendances d'humeur et de velocite sur plusieurs sprints

### Sondage d'equipe

- Vue **Rapports** > section **Sondage**
- 10 templates humoristiques qui tournent automatiquement (humeur cinema, meteo, cuisine...)
- Date d'envoi calculee : 2 jours ouvres avant la fin du sprint
- Copiez le message Slack genere et envoyez-le

---

## Mood Meter et Vote de confiance

### Mood Meter (ROTI)

Accessible depuis la vue **PI Planning** (touche `4`) :

- Echelle de 1 a 5 par equipe et par sprint
- Historique visible en sparkline
- Notes contextuelles pour garder une trace
- Les donnees sont persistees et consultables d'un PI a l'autre

### Vote de confiance (Fist of Five)

- Votez la confiance de chaque equipe sur les objectifs du PI
- L'evolution est tracee en sparkline sur tous les sprints du PI
- Pour un PI futur, les sections historiques sont masquees automatiquement

---

## Gestion des risques et impediments

La **sidebar** affiche en permanence la section "Risques & Qualite" :

- Tickets bloques et flagges avec le nombre de story points impactes
- Dependances inter-equipes et risques intra-equipe
- Objectifs PI a risque

**Cliquez sur n'importe quel item** pour etre redirige vers la section Risques de la Roadmap, ou vous retrouvez le ROAM Board complet.

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Scrum | Board, activite, charts |
| Quotidien | Sidebar | Progression, bloques, risques |
| Hebdomadaire | Rapports | Sprint report Slack/Confluence |
| Par sprint | Mood | ROTI + vote confiance |
| Par PI | PI Planning | Objectifs, capacite, ROAM |
| Continu | Amelioration | Suivi actions retro |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `1` | Vue Scrum |
| `4` | PI Planning (Mood, Fist of Five) |
| `5` | Rapports |
| `Ctrl+K` | Recherche globale |
| `Echap` | Fermer modale/recherche |
| `Fleches` | Naviguer entre tickets dans la modale |

---

## Evolutions a venir

- **Alertes Slack automatiques** : notification directe quand un ticket est bloque depuis plus de X jours
- **Dashboard retrospective** : metriques croisees mood / velocite / scope creep pour alimenter les retros
- **Sprint planning assistant** : suggestion de capacite basee sur les absences et l'historique
- **Comparaison inter-sprints** : superposition de burndowns pour identifier des patterns recurrants
