# Contexte — Dashboard Guitarisation™

## L'activité

**Guitarisation™** est une école de guitare en ligne française, exploitée sous la structure légale **SF PROD (EURL)**. Le fondateur est Samuel, guitariste et pédagogue.

L'activité principale repose sur :
- Des **programmes d'accompagnement** individuels (4 mois par défaut, extensible)
- Des **ateliers live hebdomadaires** sur Zoom (thématiques, avec replay)
- Un **suivi asynchrone** via programmes vidéo et messagerie
- Une **délégation pédagogique** : un prof dédié (Axel) assure les séances individuelles

Les leads proviennent quasi exclusivement de **publicité Meta** (Facebook/Instagram), ou de manière organique (posts/reels sans pub).

---

## Ce dashboard couvre UNIQUEMENT

L'activité **Guitarisation™ en ligne**. Sont exclus : les dépenses personnelles de Samuel, et tout ce qui concerne **Le Point d'Orgue** (école de musique physique, activité séparée).

---

## Module 1 — Leads (pipeline)

### Statuts actifs (pipeline principal)

| Statut | Déclencheur |
|--------|-------------|
| `nouveau` | Lead entré, questionnaire reçu, pas encore analysé |
| `qualifie` | Questionnaire validé, cours d'essai pas encore réservé |
| `reserve` | Cours d'essai planifié (date + heure stockées) |
| `present` | Est venu au cours d'essai, pas encore décidé |
| `eleve` | Inscrit au programme → fiche Élève créée |
| `ancien_eleve` | Programme terminé, non renouvelé |

### Archivage (sortie du pipeline)

Un lead peut être archivé à n'importe quelle étape avec une raison :

| Raison | Cas |
|--------|-----|
| `non_qualifie` | Questionnaire éliminatoire (critères non remplis) |
| `sans_reponse` | Relances épuisées, pas de retour |
| `abandon` | A participé (cours d'essai ou plus) mais a choisi de ne pas continuer |

### Données de la fiche lead

**Visibles en vue liste :**
- Nom complet
- Email
- Téléphone
- Date d'entrée (date de réception du questionnaire)
- Statut actuel
- Source (`pub_meta` | `organique`)
- Date de dernière action
- Prochaine action (type + date)
- Date/heure cours d'essai (si statut `reserve` ou `present`)

**Visibles uniquement dans le panneau détail (clic sur la fiche) :**
- Tranche d'âge (issue du questionnaire)
- Objectif(s) déclaré(s) (issue du questionnaire)
- Problème(s) / blocage(s) déclaré(s) (issue du questionnaire)

### Journal de contact (par lead)

Chaque interaction est loggée avec :
- Type d'action : `appel` | `sms` | `cours_essai`
- Date
- Note libre optionnelle

### Règles métier

- **Détection de doublons** à la saisie par email ou téléphone → fusion en une seule fiche avec historique consolidé
- Quand un lead passe au statut `eleve`, sa fiche lead est **archivée** et une **fiche Élève distincte** est créée, avec lien entre les deux
- Les leads archivés sont visibles dans un onglet "Archivés" séparé, pas dans la vue principale

---

## Module 2 — Élèves (suivi pédagogique)

### Formules disponibles

| Formule | Durée | Prix | Paiement |
|---------|-------|------|----------|
| Programme standard | 4 mois (ajustable) | 597 € | CB 2x, 3x, 4x / Paypal 4x |
| Renouvellement long avec prof dédié | 12 mois | à définir | — |
| Renouvellement long sans prof dédié | 12 mois | à définir | — |

**Règle Paypal 4x :** Paypal verse la totalité à Samuel immédiatement → revenu contracté = revenu encaissé = 597 € dès l'inscription.

**Règle CB en plusieurs fois :** Prélèvements automatiques mensuels → revenu contracté = 597 € dès l'inscription, revenu encaissé = mensualités reçues à date.

### Freeze d'accompagnement

Un élève peut mettre son accompagnement en pause, dans la limite de **4 semaines cumulées** sur la durée du programme. La date de fin de programme est repoussée d'autant.

### Données de la fiche élève

- Nom, email, téléphone (repris de la fiche lead)
- Lien vers la fiche lead d'origine
- Formule souscrite + durée
- Date de début / date de fin prévue
- Mode de paiement
- Freeze actif (oui/non) + semaines de freeze consommées
- Objectifs (saisis lors du cours d'essai, visibles en permanence en haut de la fiche)
- Prof dédié assigné (Axel par défaut)

### Comptes rendus de séance

Un compte rendu est créé après chaque séance individuelle (toutes les 2 semaines). Il contient deux volets distincts :

**Volet élève** (rempli par l'élève dans les 24h après la séance) :
- Satisfaction (note 1-5)
- Ressenti libre
- Participation aux éléments de l'école (ateliers, vidéos feedback, défi)

**Volet prof** (rempli par le prof) :
- Présence (oui/non)
- Remarque libre
- Nombre d'ateliers suivis
- Nombre de commentaires laissés
- Vidéos pour feedback (nombre)
- Vidéo pour défi (oui/non)
- Défi validé (oui/non)
- Points Jeux Guitarisation™ attribués

**Signal d'alerte :** Un élève qui ne remplit pas son volet dans les 24h est signalé (risque de décrochage).

### Jeux Guitarisation™

Système de gamification actif et important. Chaque séance génère des points. Le dashboard affiche le total de points par élève.

---

## Module 3 — Finances

### Revenus (Guitarisation™ uniquement)

- Revenu contracté : total du programme signé, enregistré à la date d'inscription
- Revenu encaissé : mensualités effectivement reçues sur le compte bancaire

### Charges (Guitarisation™ uniquement)

**Abonnements outils (mensuels ou annuels) :**

| Outil | Fréquence | Montant indicatif |
|-------|-----------|-------------------|
| Podia | Annuel | ~376 €/an |
| MailerLite | Annuel | ~298 €/an |
| Calendly | Annuel | ~120 €/an |
| Make | Mensuel | ~10 €/mois |
| Zoom | Annuel | ~179 €/an |
| ManyChat | Mensuel | ~14 €/mois |

**Charges variables :**

| Charge | Calcul |
|--------|--------|
| Délégation prof (Axel) | Nombre de séances × 22,50 € (calculé automatiquement depuis les comptes rendus) |
| Meta Ads | Budget journalier × nombre de jours (budget journalier modifiable — actuellement 20 €/jour, 1 seule campagne) |

### EBITDA

```
EBITDA = Revenu encaissé − Charges outils − Charge prof − Charge Meta Ads
```

Vues souhaitées (style Stripe) : mensuelle, trimestrielle, depuis le début de l'année, personnalisée.

---

## Stack technique

- **Frontend / Backend :** Next.js (App Router)
- **Hébergement + Base de données + Automatisations :** Railway (PostgreSQL intégré + serveur Node.js pour les cron jobs)
- **Style :** Tailwind CSS, cohérent avec `designsystem.md` existant (accent `--accent #d4a017`, font Inter)
- **Auth :** Usage solo (Samuel uniquement), session simple suffisante

### Pourquoi Railway uniquement

Objectif : minimiser le nombre d'outils pour minimiser la complexité et les points de bug. Railway héberge tout en un seul endroit : l'app Next.js, la base PostgreSQL, et les scripts d'automatisation cron. Pas de Vercel, pas de Supabase, pas de Make.

### Automatisations prévues (tournent sur Railway 24h/24)

- Alerte si un élève n'a pas rempli son compte rendu dans les 24h après une séance
- Alerte si un lead actif n'a eu aucune action depuis X jours
- Calcul nocturne des KPIs mensuels
- Calcul automatique de la charge prof (séances × 22,50 €)
- Calcul automatique de la charge Meta Ads (budget/jour × jours du mois)

---

## Contraintes et principes

1. Interface sobre : vue liste épurée, panneau détail au clic pour les infos secondaires
2. Séparation nette leads / élèves : deux modules distincts, lien entre fiches
3. Calculs automatiques partout où c'est possible (charge prof, charge Meta, EBITDA)
4. Alertes : élève qui ne remplit pas son compte rendu, lead sans action depuis X jours
5. Pas de complexité inutile : on construit module par module, MVP d'abord
6. Un seul outil d'hébergement (Railway) pour tout faire tourner
