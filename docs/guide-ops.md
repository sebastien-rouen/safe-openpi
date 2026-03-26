# 🔧 Guide OPS / DevOps

> Suivez les incidents, la dette technique, le buffer ops et la sante operationnelle du projet.

---

## 🎯 Ce que le dashboard vous apporte

En tant qu'OPS ou DevOps, votre focus est sur la stabilite et l'amelioration continue :

- **Suivre les incidents** et tickets de support en cours
- **Mesurer le buffer technique** : dette, outillage, automatisation
- **Detecter les tickets bloques** qui pourraient signaler des problemes infra
- **Participer au PI Planning** avec une vue sur la capacite et les risques techniques
- **Suivre les actions post-mortem** dans l'amelioration continue

---

## 🖥️ Vos ecrans principaux

### 1. 🛟 Support et incidents (touche `6`)

La vue Support est votre point d'entree quotidien :

- **Rotation** : qui est de garde cette semaine
- **Tickets critiques** : compteur en rouge, tickets en haut de la liste
- **Filtres par priorite** : isolez les critiques et les urgents
- **Description complete** : texte du ticket visible sans aller dans JIRA

**Astuce** : les tickets de type `incident` et `ops` ont leurs propres badges colores (orange et gris).

### 2. 🗺️ Le buffer 20% (Roadmap, touche `3`)

La vue Roadmap vous montre comment le budget technique est reparti :

| Categorie | % du buffer | Ce que ca couvre |
|-----------|-------------|-----------------|
| Dette technique | 6% | Refactoring, fixes urgents, nettoyage |
| Outillage CI/CD | 5% | Pipelines, monitoring, observabilite |
| Innovation | 5% | POCs, explorations, prototypage |
| Automatisation N2/N3 | 4% | Tests auto, scripts, runbooks |

La **barre 80/20** compare l'ideal et le reel :
- Si le buffer reel > 25% : alerte rouge (trop de dette ou d'urgences)
- Si le buffer reel < 15% : alerte ambre (pas assez d'investissement technique)

### 3. 📋 Vue Scrum - tickets techniques (touche `1`)

- Les tickets de type **OPS** sont identifies par un badge gris
- Les tickets **dette technique** ont un badge rose
- Le mode **Liste** permet de trier par type pour isoler vos tickets
- Les tickets **buffer** ont un fond vert pastel

### 4. 🔄 Amelioration continue

La vue Amelioration Continue est particulierement pertinente pour l'OPS :

| Swimlane | Usage OPS |
|----------|-----------|
| **Post-Mortem** | Actions correctives suite a incidents |
| **Retro** | Ameliorations infra/outillage issues des retros |
| **CoP Methodo** | Sujets DevOps, bonnes pratiques |

- Board Kanban avec statut (a faire, en cours, bloque, termine)
- KPIs : tickets, progression, taux de completion

---

## ⚡ Vue Kanban pour le flux ops (touche `2`)

La vue Kanban vous aide a surveiller le flux de travail :

- **WIP limits** : si la colonne "En cours" est en rouge, il y a surcharge
- **Cycle time** : temps moyen de resolution - un indicateur cle pour l'OPS
- **Lead time** : temps total de prise en charge a resolution
- **Breakdown par type** : ratio incidents/bugs/stories par equipe

---

## 🚨 Gestion des blocages

### Sidebar (toujours visible)

La section "Risques & Qualite" montre en permanence :

- **Tickets bloques** : nombre et story points impactes
- **Tickets flagges** : impediments actifs
- **Dependances bloquees** : dependances inter-equipes en statut bloque

Survolez un compteur pour voir la liste des tickets.

### Board Scrum

Les tickets bloques sont visuellement marques :
- **Fond rouge** avec bordure rouge
- **Badge "Bloque"**
- Les tickets **flagges** (impediments JIRA) ont un fond pastel rouge

---

## 📊 Rapports

Vue **Rapports** (touche `5`) :

| Section | Usage OPS |
|---------|-----------|
| Support | Tickets par priorite, ouverts vs resolus |
| Sprint | Ratio bugs/incidents, velocity |
| Mood / Velocite | Tendances de l'equipe |

Formats disponibles : **Slack** (copier-coller) et **Confluence** (wiki).

---

## 🔐 PI Planning pour les OPS

Lors du PI Planning, la vue **PI Planning** (touche `4`) vous permet de :

- **Objectifs techniques** : verifiez que les objectifs d'outillage et de dette sont inclus
- **ROAM** : les risques techniques y sont categories (infra, securite, performance)
- **Capacite** : verifiez que la capacite OPS est correctement estimee
- **Buffer** : assurez-vous que le 20% couvre bien vos besoins

---

## 📋 Les vues cles pour vous

| Priorite | Vue | Usage |
|----------|-----|-------|
| Quotidien | Support | Incidents, tickets critiques |
| Quotidien | Scrum | Tickets OPS/dette du sprint |
| Regulier | Roadmap | Buffer 20%, dette technique |
| Par sprint | Kanban | Flux, cycle time |
| Par sprint | Amelioration | Post-mortems, actions |
| Par PI | PI Planning | Objectifs techniques, risques |

---

## ⌨️ Raccourcis utiles

| Touche | Action |
|--------|--------|
| `6` | Support (ecran principal) |
| `1` | Scrum |
| `2` | Kanban |
| `3` | Roadmap (buffer) |
| `Ctrl+K` | Recherche ticket |

---

## 🔮 Evolutions a venir

- **Metriques DORA** : deployment frequency, lead time, change failure rate, MTTR
- **SLA dashboard** : suivi temps de resolution par priorite avec alertes
- **Incident timeline** : chronologie visuelle des incidents avec correlation
- **Runbook links** : acces direct aux runbooks depuis les tickets incidents
- **Health checks** : indicateurs de sante infra integres au dashboard
- **Alerting** : notifications push quand un incident critique est ouvert
