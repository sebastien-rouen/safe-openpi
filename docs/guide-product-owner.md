# 🎯 Guide Product Owner

> Gardez la maitrise de votre backlog, suivez la valeur livree et pilotez vos objectifs PI avec des donnees factuelles.

---

## Ce que le dashboard vous apporte

En tant que PO, vous jonglez entre vision produit, priorisation et suivi de livraison. Le dashboard centralise tout cela :

- **Ou en est le sprint ?** Vue Scrum avec progression en temps reel
- **Mon backlog est-il sain ?** Indicateurs de sante dans la Roadmap
- **Les objectifs PI sont-ils en bonne voie ?** Suivi dans PI Planning
- **Quelle velocite pour estimer ?** Historique de velocite sur 6+ sprints
- **Les features avancent-elles ?** Gantt de releases avec projection

---

## Vos ecrans au quotidien

### 1. Suivi sprint : vue Scrum (touche `1`)

- **Barre de progression** en haut de la sidebar : feature % + buffer %
- **Mode Liste** : tableau triable par points, priorite, type - ideal pour la priorisation
- **Burnup chart** : scope fixe + courbe done = visualisation claire de l'avancement
- **Velocity chart** : 6 sprints pour detecter les tendances

**Astuce** : cliquez sur un compteur de statut dans la sidebar pour voir tous les tickets dans cet etat.

### 2. Sante du backlog : vue Roadmap (touche `3`)

La section **Sante du backlog** vous donne 4 KPIs cliquables :

| KPI | Ce que ca mesure | Action PO |
|-----|-----------------|-----------|
| Sans epic | Tickets orphelins sans rattachement | Rattacher a un epic ou supprimer |
| Sans points | Tickets non estimes | Planifier un refinement |
| Sans priorite | Tickets non priorises | Prioriser selon la valeur metier |
| Inactifs | Tickets sans mise a jour recente | Decider : garder ou archiver |

Chaque KPI est cliquable et affiche la liste des tickets concernes.

### 3. Objectifs PI : vue PI Planning (touche `4`)

- **Objectifs Committed vs Stretch** : chaque objectif a sa Business Value
- **Progression** : barre d'avancement par objectif
- **Capacite vs Charge** : matrice par equipe et par sprint
- **Buffer** : consommation du buffer 20% par categorie

### 4. Suivi des releases : vue Releases

- **Gantt par Feature** : barre de progression coloree (vert/ambre/rouge selon l'avancement)
- **Projection** : estimation du sprint de livraison basee sur la velocite moyenne
- **Points restants** par feature et nombre de sprints necessaires

---

## Piloter les objectifs PI

### Creer et suivre les objectifs

Dans la vue **Roadmap** > section **Risques** > sous-section **Objectifs PI** :

- Ajoutez des objectifs **Committed** (engagements fermes) et **Stretch** (aspirationels)
- La Business Value est ordonnee par defaut de facon decroissante (10, 9, 8...)
- Le statut de chaque objectif est visible : en bonne voie, a risque, atteint

### Surveiller la capacite

La section **Capacite** dans la Roadmap montre :

- Charge vs capacite par sprint et par equipe
- Capacite individuelle (jours/membre/sprint) avec prise en compte des absences
- Facteur de focus configurable (x0.8 par defaut)

---

## Rapports pour vos parties prenantes

Vue **Rapports** (touche `5`) :

| Section | Pour qui | Contenu |
|---------|----------|---------|
| Sprint | Stakeholders | Velocite, stories livrees, bugs, bloquants |
| PI Planning | Direction | Objectifs, avancement, risques |
| Roadmap | Sponsors | Backlog, estimation, planning |
| Releases | Clients | Progression par feature, projection |

Chaque rapport est disponible en **format Slack** (copier-coller) et **Confluence** (wiki markup).

**Apercu visuel** : le format Slack est affiche cote a cote avec une preview dark theme pour verifier le rendu avant envoi.

---

## Comprendre la regle 80/20

La vue Roadmap affiche la repartition ideale SAFe vs la repartition reelle :

- **80% Features** : stories, fonctionnalites, valeur metier
- **20% Buffer** : dette technique (6%), outillage CI/CD (5%), innovation (5%), automatisation (4%)

La barre visuelle compare l'ideal et le reel. Si le buffer depasse 25%, il passe en rouge.

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Scrum | Sprint progress, burnup |
| Hebdomadaire | Roadmap | Sante backlog, 80/20 |
| Par sprint | Rapports | Sprint report |
| Par PI | PI Planning | Objectifs, capacite |
| Mensuel | Releases | Projection livraisons |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `1` | Vue Scrum |
| `3` | Roadmap & backlog |
| `4` | PI Planning |
| `5` | Rapports |
| `Ctrl+K` | Recherche ticket/epic/membre |

---

## Evolutions a venir

- **Burnup par epic** : suivre l'avancement d'un epic specifique a travers les sprints
- **Alertes backlog** : notification quand la sante du backlog passe sous un seuil
- **Lead time par type** : temps moyen de bout en bout par type de ticket (story vs bug)
- **Valeur livree par PI** : tableau de bord cumulant la Business Value des objectifs atteints
- **Dependency mapping visuel** : graphe interactif des dependances entre features
