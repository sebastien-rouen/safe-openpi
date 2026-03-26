# 🚂 Guide Release Train Engineer

> Orchestrez le train SAFe : PI Planning, capacite, risques, dependances et coordination multi-equipes.

---

## Votre poste de commandement

En tant que RTE, vous etes le chef d'orchestre du train. Le dashboard vous donne la visibilite complete :

- **Etat du PI** : objectifs, avancement, velocite, buffer
- **Coordination** : dependances inter-equipes, risques, blocages
- **Capacite** : charge vs disponibilite, absences, projections
- **Confiance** : fist of five, mood meter, tendances
- **Communication** : rapports pre-formates pour tous les stakeholders

---

## Le cycle PI avec le dashboard

### Phase 1 : Preparation du PI Planning

**Vue Roadmap** (touche `3`) > onglet **Capacite** :

1. **Score de readiness** : indicateur global avec criteres ponderes
   - Cliquez sur chaque critere pour naviguer vers la section correspondante
   - Le score evolue en temps reel quand vous completez les sections

2. **Calendrier PI suivant** :
   - Detection auto de la date de debut (depuis JIRA ou saisie manuelle)
   - Jours ouvres par sprint, jours feries francais inclus
   - Presentiels configurables
   - Badge PIP (PI Planning) pour le jour J

3. **Capacite individuelle** :
   - Jours disponibles par membre et par sprint
   - Checkbox pour exclure un membre (absence, depart)
   - Facteur de focus configurable (x0.8)
   - Import des absences depuis Excel (Parametres > Absences)

4. **Matrice de charge** :
   - Charge vs capacite par sprint et par equipe
   - Alerte visuelle quand la charge depasse la capacite

### Phase 2 : Pendant le PI Planning

**Vue PI Planning** (touche `4`) :

- **Objectifs PI** : ajoutez les objectifs committed et stretch avec leur Business Value
- **ROAM Board** : categorisez les risques identifies pendant le PI Planning
- **Dependances** : saisissez les dependances inter-equipes avec leur livrable et statut
- **Fist of Five** : enregistrez le vote de confiance de chaque equipe

**Tout est persiste automatiquement** dans `data/pi-data.json` (debounce 300ms).

### Phase 3 : Execution du PI

**Vue Roadmap** (touche `3`) — votre ecran quotidien :

- **KPIs en haut** : avancement %, pts done, velocite, sprints restants, epics done
- **Histogramme de velocite PI** : barres par sprint du PI (passes, actuel, futurs)
- **Buffer** : consommation par categorie avec progression

**Sidebar** (toujours visible) :
- Progression feature + buffer
- Tickets bloques et flagges
- Section "Risques & Qualite" avec navigation directe

### Phase 4 : Inspect & Adapt

**Vue Rapports** (touche `5`) :

- Section **PI Planning** : bilan complet (objectifs, ROAM, dependances)
- Section **Mood / Velocite** : tendances d'humeur et velocite sur le PI
- Section **Prepa PI** : export du readiness et du calendrier

---

## Gestion multi-equipes

### Groupes

Configurez des groupes d'equipes dans **Parametres** (touche `8`) :

- Creez des groupes qui correspondent a vos trains ou clusters
- Selectionnez un groupe dans la sidebar pour agreger les donnees
- Toutes les metriques se combinent automatiquement

### Selecteur PI

En haut de la vue Roadmap et PI Planning :

- Basculez entre PIs pour consulter l'historique
- Pour un PI futur, les sections historiques (sprints precedents, mood) sont masquees
- Les donnees s'adaptent au PI selectionne

---

## Risques et dependances : votre vigilance

### Vue consolidee (sidebar)

La section "Risques & Qualite" affiche en permanence :
- ROAM items actifs (Owned, Accepted, Mitigated)
- Dependances inter-equipes (avec nombre de bloquees)
- Risques intra-equipe
- Tickets bloques et flagges
- Objectifs a risque

**Cliquez sur n'importe quel item** pour naviguer vers la section Risques de la Roadmap.

### ROAM Board (Roadmap > Risques)

| Cat | Icone | Action RTE |
|-----|-------|------------|
| R | Resolved | Archiver, communiquer la resolution |
| O | Owned | Assigner un owner, planifier la resolution |
| A | Accepted | Documenter la decision, informer les stakeholders |
| M | Mitigated | Verifier les mesures, suivre l'efficacite |

### Dependances inter-equipes

- Tableau avec equipe source > equipe cible, livrable, statut
- Heatmap quand beaucoup de dependances
- Ajout/modification directement depuis le dashboard

---

## Reporting : votre arsenal de communication

| Audience | Section rapport | Frequence |
|----------|----------------|-----------|
| Equipes | Sprint | Par sprint |
| Product Management | PI Planning | Par PI |
| Stakeholders | Roadmap | Bi-mensuel |
| Management | Mood / Velocite | Mensuel |
| Direction | Releases | Par PI |

**Format Slack** : copier-coller direct avec preview dark theme.
**Format Confluence** : wiki markup pour documentation perenne.

**Sondage** : 10 templates humoristiques rotatifs pour animer les canaux d'equipe.

---

## Support et rotation

Vue **Support** (touche `6`) :

- Rotation support en cours : qui est de garde par equipe et par semaine
- Tickets ouverts par priorite (critique, haute, moyenne, basse)
- Stats de resolution

Configuration dans **Parametres** > **Rotation Support** :
- Affectation hebdomadaire par equipe
- Gestion des membres supplementaires et caches
- Mode semaine (debut vendredi ou dimanche)

---

## Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Roadmap | KPIs, avancement, risques |
| Quotidien | Sidebar | Bloques, dependances, risques |
| Par sprint | Scrum | Sprint health par equipe |
| Par sprint | Rapports | Communication stakeholders |
| Par PI | PI Planning | Objectifs, capacite, confiance |
| Par PI | Releases | Projection livraisons |
| Continu | Support | Incidents en cours |
| Pre-PI | Roadmap > Capacite | Readiness, calendrier, capacite |

---

## Raccourcis utiles

| Touche | Action |
|--------|--------|
| `3` | Roadmap (ecran principal RTE) |
| `4` | PI Planning |
| `5` | Rapports |
| `6` | Support |
| `1` | Scrum (par equipe) |
| `Ctrl+K` | Recherche globale |

---

## Evolutions a venir

- **Board de coordination** : vue synthetique des dependances critiques avec timeline et alertes
- **Previsions Monte Carlo** : projection probabiliste des objectifs PI
- **Rapport PI automatise** : bilan complet genere en un clic (objectifs, velocite, risques, mood)
- **Alertes proactives** : notification quand une dependance passe "bloquee" ou un objectif "a risque"
- **Historique multi-PI** : tendances de velocite, mood et completion sur 3+ PIs
- **Synchronisation Slack** : envoi automatique des rapports dans les canaux configures
- **Matrice WSJF** : scoring Weighted Shortest Job First pour aider a la priorisation
