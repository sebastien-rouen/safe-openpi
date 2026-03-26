# 🛟 Guide Support / Incident Manager

> Gerez la rotation, suivez les tickets de support et gardez le controle sur les priorites.

---

## 🎯 Ce que le dashboard vous apporte

En tant que responsable support ou membre de la rotation, vous avez besoin de :

- **Savoir qui est de garde** cette semaine
- **Suivre les tickets ouverts** par priorite
- **Identifier les urgences** (critiques, bloques)
- **Communiquer** l'etat du support aux parties prenantes

---

## 🖥️ Votre ecran principal : vue Support (touche `6`)

### Barre de rotation

En haut de la vue, la **barre de rotation support** affiche :

- L'equipe concernee
- La semaine en cours (label + dates)
- Les **membres de garde** avec leurs avatars
- Les indicateurs d'absence (point colore)
- Lien vers la configuration de la rotation

### Statistiques

4 cartes de stats immediates :

| Carte | Description |
|-------|-------------|
| Tickets ouverts | Nombre total de tickets non resolus |
| Critiques | Tickets de priorite critique |
| Urgents | Tickets de priorite haute |
| Resolus | Tickets termines |

### Liste des tickets

Les tickets sont affiches avec :

- **Priorite** : emoji + couleur (critique = rouge, haute = orange, moyenne = jaune, basse = gris)
- **Statut** : colore selon l'avancement
- **Titre et description** complete
- **Assignation** et date
- **Badge equipe**

**Filtres disponibles** : Tous, Ouverts, Termines, par priorite (Critique, Haute, Moyenne, Basse).

---

## ⚙️ Configurer la rotation (Parametres, touche `8`)

Dans **Parametres** > **Rotation Support** :

- **Affectation hebdomadaire** : assignez les membres de garde par equipe et par semaine
- **Membres supplementaires** : ajoutez des personnes au roster
- **Membres caches** : masquez les personnes absentes ou non disponibles
- **Mode semaine** : choisissez le debut de semaine (vendredi ou dimanche)
- **Calendrier** : vue d'ensemble de la rotation avec overlay des absences

Les modifications sont persistees dans `data/supports.json`.

---

## 📊 Rapports support

Vue **Rapports** (touche `5`) > section **Support** :

Le rapport genere inclut :
- Nombre de tickets par priorite
- Tickets ouverts vs resolus
- Distribution par equipe

Disponible en format **Slack** (copier-coller) et **Confluence** (wiki).

---

## 🔍 Recherche de tickets

`Ctrl+K` : recherchez un ticket par son ID (ex: PROJ-123) ou par mot-cle dans le titre.

Dans la **modale ticket**, vous trouvez :
- Description complete
- Web links JIRA (documentation, procedures)
- Historique des changements
- Sprint et progression

---

## 📋 Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Support | Tickets, priorites, rotation |
| Hebdomadaire | Parametres | Ajuster la rotation |
| Par sprint | Rapports | Communication support |

---

## ⌨️ Raccourcis utiles

| Touche | Action |
|--------|--------|
| `6` | Vue Support |
| `8` | Parametres (rotation) |
| `5` | Rapports |
| `Ctrl+K` | Recherche ticket |

---

## 🔮 Evolutions a venir

- **SLA tracking** : suivi du temps de resolution par priorite avec alertes
- **Tableau de bord on-call** : metriques de charge par semaine de rotation
- **Escalation automatique** : alertes quand un ticket critique depasse un delai
- **Historique de rotation** : qui a ete de garde quand, avec statistiques de charge
