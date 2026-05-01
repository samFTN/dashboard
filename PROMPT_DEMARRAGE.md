# Prompt de démarrage — Dashboard Guitarisation™

## Comment utiliser ce fichier

Lance Claude Code en **Plan Mode** (`claude --dangerously-skip-permissions`).
Colle le prompt ci-dessous au démarrage de chaque nouvelle session.
Claude Code lira le contexte et saura exactement où il en est.

---

## Prompt de démarrage (à coller dans Claude Code)

```
Lis attentivement CONTEXTE.md et types/index.ts avant de faire quoi que ce soit.

Tu construis le dashboard de gestion de Guitarisation™, une école de guitare en ligne française.
Stack : Next.js (App Router) + PostgreSQL sur Railway. 

Principes non négociables :
- Un seul outil d'hébergement : Railway (app + base de données + cron jobs)
- Interface sobre : vue liste épurée, panneau détail au clic (suis le DESIGN_SYSTEM.md)
- Calculs automatiques partout où c'est possible
- On construit module par module, MVP d'abord

Ordre de construction :
1. Setup Railway (PostgreSQL + déploiement Next.js)
2. Schéma SQL (basé sur types/index.ts)
3. Module Leads (vue liste + panneau détail + journal de contact)
4. Module Élèves (fiche élève + comptes rendus + Jeux Guitarisation™)
5. Module Finances (revenus + charges + EBITDA)
6. Vue globale KPIs
7. Automatisations cron (alertes + calculs nocturnes)

Aujourd'hui on commence par : [INDIQUE ICI L'ÉTAPE EN COURS]

Avant de coder quoi que ce soit, présente-moi ton plan en Plan Mode et attends ma validation.
```

---

## Prompts par étape

### Étape 1 — Setup Railway

```
Configure le projet Railway :
1. Crée le service PostgreSQL
2. Configure le déploiement Next.js depuis GitHub
3. Génère le fichier .env.example avec toutes les variables nécessaires
4. Vérifie que la connexion Next.js → PostgreSQL fonctionne avec une route /api/health

Présente le plan avant d'exécuter.
```

### Étape 2 — Schéma SQL

```
À partir de types/index.ts, génère le schéma SQL complet pour PostgreSQL :
- Tables : leads, actions_contact, eleves, seances, compte_rendu_eleve, compte_rendu_prof, 
  inscriptions_financieres, echeances, charges_outils, charges_meta, charges_prof, profs
- Toutes les contraintes (FK, NOT NULL, CHECK)
- Les index utiles pour les requêtes fréquentes
- Un fichier seed.sql avec des données fictives réalistes pour tester

Présente le schéma complet avant d'exécuter.
```

### Étape 3 — Module Leads

```
Construis le module Leads complet :
1. API routes CRUD : GET /api/leads, POST /api/leads, PATCH /api/leads/[id], 
   POST /api/leads/[id]/archiver, POST /api/leads/[id]/actions
2. Page /leads : vue liste avec colonnes (nom, statut, source, dernière action, prochaine action)
3. Filtres : par statut, par source, actifs / archivés
4. Panneau détail (slide-over au clic) : toutes les infos + journal de contact + ajout d'action
5. Détection de doublons à la création (email ou téléphone)
6. Bouton "Convertir en élève" sur les leads au statut "present"

Design : Tailwind CSS, accent #d4a017, font Inter, interface sobre.
Présente le plan avant d'exécuter.
```

### Étape 4 — Module Élèves

```
Construis le module Élèves complet :
1. API routes CRUD pour élèves et séances
2. Page /eleves : vue liste (nom, formule, avancement, satisfaction moyenne, points Jeux)
3. Fiche élève : objectifs en haut (toujours visibles), compteur séances, freeze, 
   historique comptes rendus
4. Formulaire compte rendu : volet prof (immédiat) + volet élève (24h après)
5. Alerte visuelle si volet élève non rempli après 24h
6. Total points Jeux Guitarisation™ par élève

Présente le plan avant d'exécuter.
```

### Étape 5 — Module Finances

```
Construis le module Finances :
1. API routes pour inscriptions, échéances, charges
2. Page /finances avec vue style Stripe :
   - Sélecteur de période (mois en cours, trimestre, année, personnalisé)
   - Revenus : contracté vs encaissé vs reste à encaisser
   - Charges : outils (ventilées) + prof (calculé) + Meta Ads (calculé)
   - EBITDA = encaissé - toutes charges
3. Tableau des échéances à venir
4. Saisie du budget Meta Ads journalier (modifiable)

Présente le plan avant d'exécuter.
```

### Étape 6 — KPIs globaux

```
Construis la page d'accueil /dashboard avec les KPIs globaux :
- Leads actifs par statut (mini pipeline visuel)
- Taux de conversion qualifié → élève
- Élèves actifs / churn du mois
- Revenu encaissé du mois vs objectif
- Coût par lead et coût par élève (Meta Ads)
- Alertes actives (comptes rendus manquants, leads sans action)
- Prochains cours d'essai planifiés

Présente le plan avant d'exécuter.
```

### Étape 7 — Automatisations cron

```
Mets en place les cron jobs Railway :
1. Toutes les heures : vérifie les séances de la veille dont le volet élève n'est pas rempli → 
   notification Pushover à Samuel
2. Tous les matins à 8h : vérifie les leads actifs sans action depuis 7 jours → 
   notification Pushover
3. Toutes les nuits à 2h : recalcule les KPIs mensuels et les charges (prof + Meta)
4. Le 1er de chaque mois : génère le récapitulatif financier du mois précédent

Chaque cron est un script Node.js autonome dans /cron/*.ts
Présente le plan avant d'exécuter.
```

---

## Règles pour Claude Code

1. Toujours lire CONTEXTE.md au début de chaque session
2. Toujours présenter le plan en Plan Mode avant d'exécuter
3. Construire un module entièrement fonctionnel avant de passer au suivant
4. Nommer les fichiers en cohérence avec l'App Router Next.js (`/app/leads/page.tsx`, etc.)
5. Toutes les variables d'environnement dans `.env.local` (jamais en dur dans le code)
6. Pas de librairies inutiles — rester simple
