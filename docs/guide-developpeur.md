# 💻 Guide Developpeur

> Votre board sprint au quotidien : tickets, progression, activite et metriques pour rester focus.

---

## 🎯 Ce que le dashboard vous apporte

En tant que dev, le dashboard est votre outil de travail quotidien :

- **Voir vos tickets** et leur statut en un coup d'oeil
- **Comprendre la progression** du sprint sans aller dans JIRA
- **Identifier les blocages** qui impactent l'equipe
- **Consulter le detail** d'un ticket rapidement (description, liens, historique)
- **Contribuer aux rituels** : daily, review, retro, PI Planning

---

## 🖥️ Votre ecran principal : vue Scrum (touche `1`)

### Le board sprint

3 modes de visualisation :

| Mode | Usage | Quand l'utiliser |
|------|-------|-----------------|
| **Colonnes** | Grille todo/inprog/review/done | Vue classique du daily |
| **Swimlanes** | Groupement par date d'echeance | Pour voir les deadlines |
| **Liste** | Tableau triable | Pour filtrer et trier vos tickets |

Le mode est persiste : vous retrouvez votre preference a chaque ouverture.

### Les cartes tickets

Chaque carte affiche :
- **Type** : badge colore (Story, Bug, Tache, etc.)
- **Priorite** : icone (critique, haute, moyenne, basse)
- **Assignation** : avatar avec initiales
- **Story points** : badge toujours visible
- **Epic** : tag cliquable (ouvre l'epic dans JIRA)
- **Indicateurs** : fond rouge si bloque, fond pastel rouge si flagge, fond pastel vert si buffer

### Modale ticket (cliquez sur une carte)

La modale detaillee montre :
- **Description complete** : texte, listes, liens, mentions
- **Web links** : liens associes dans JIRA (documentation, maquettes, specs)
- **Sprint** : barre de progression du sprint actuel
- **Metadonnees** : type, priorite, assignation, epic, labels, dates
- **Navigation** : fleches ← → pour passer au ticket suivant/precedent

### Activite du jour

La section depliable "Activite du jour" montre les **vrais changements JIRA** du jour :
- Qui a modifie quoi, a quelle heure
- Champs modifies : statut, assignation, points, description, sprint, labels...
- Valeurs avant et apres

---

## 📊 Les charts qui vous parlent

| Chart | Ce que ca vous dit |
|-------|--------------------|
| **Burndown** | Etes-vous en avance ou en retard sur le sprint ? |
| **Burnup** | Le scope a-t-il change en cours de sprint ? |
| **Velocity** | Tendance sur 6 sprints - stabilite ou fluctuation ? |
| **CFD** | Accumulation dans une colonne = goulot d'etranglement |
| **Distribution** | Ratio stories/bugs/taches - trop de bugs = probleme qualite |

**Comparaison historique** : le selecteur de sprint au-dessus des charts permet de comparer avec les sprints precedents.

---

## 🔍 Recherche et navigation rapide

- **`Ctrl+K`** : recherche globale par ID de ticket, titre, nom de membre ou epic
- **Fleches ← →** : navigation entre tickets dans la modale
- **`Echap`** : fermer la modale ou la recherche

### Filtrer vos tickets

En mode **Liste**, triez par :
- Assignation : retrouvez vos tickets
- Points : priorisez par effort
- Priorite : focus sur l'urgent
- Type : isolez les bugs des stories

---

## 🛡️ Buffer et support

### Buffer

Les tickets buffer sont identifies par un fond **pastel vert** et un badge "Buffer". Ils correspondent au 20% de capacite reserve pour la dette technique, l'outillage et l'innovation.

### Rotation support

Si vous etes dans la rotation :
- Vue **Support** (touche `6`) : vos tickets de support
- La **barre de rotation** en haut montre qui est de garde
- Configuration dans **Parametres** > **Rotation Support**

---

## 🔄 Amelioration continue

La vue **Amelioration Continue** suit les actions des retros :

- **Retro** : les actions d'amelioration issues des retrospectives
- **Post-Mortem** : les corrections suite a incidents
- **CoP** : les sujets de communaute de pratique

---

## 💡 Innovation

Si vous participez a des initiatives d'innovation :

- Vue **Innovations** (touche `7`) : board par initiative
- Le **Sprint IP** (x.5) est signale par une banniere
- Vos tickets d'innovation sont visibles dans le mini-board de la Feature parent

---

## 📋 Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Scrum | Board, tickets, activite |
| Quotidien | Sidebar | Progression, bloques |
| Par sprint | Charts | Burndown, velocity |
| Ponctuel | Support | Si vous etes de garde |
| Ponctuel | Innovations | Sprint IP, POCs |

---

## ⌨️ Raccourcis utiles

| Touche | Action |
|--------|--------|
| `1` | Vue Scrum |
| `2` | Vue Kanban |
| `6` | Support |
| `7` | Innovations |
| `Ctrl+K` | Recherche rapide |
| `Echap` | Fermer modale |
| `← →` | Naviguer dans la modale |

---

## 🔮 Evolutions a venir

- **Filtres avances** : par label, par assignation, par epic dans le board
- **Notifications in-app** : alerte quand un de vos tickets est bloque ou reassigne
- **Code review tracker** : suivi des PRs associees aux tickets
- **Personal dashboard** : vue personnalisee avec vos tickets, votre charge et vos deadlines
- **Raccourcis JIRA** : passage de statut directement depuis le dashboard
