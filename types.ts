// ============================================================
// GUITARISATION™ — Modèle de données complet
// ============================================================

// ------------------------------------------------------------
// ENUMS & TYPES DE BASE
// ------------------------------------------------------------

export type LeadStatut =
  | 'non_qualifie'
  | 'qualifie'
  | 'reserve'
  | 'present'
  | 'eleve'
  | 'ancien_eleve'

export type LeadRaisonArchivage =
  | 'non_qualifie'   // questionnaire éliminatoire
  | 'sans_reponse'   // relances épuisées
  | 'abandon'        // a participé mais a choisi de ne pas continuer
  | 'budget'         // budget insuffisant ou inadapté

export type LeadSource = 'pub_meta' | 'organique'

export type ActionType = 'appel' | 'sms' | 'whatsapp' | 'cours_essai' | 'temoignage'

export type ModePaiement = 'cb_2x' | 'cb_3x' | 'cb_4x' | 'paypal_4x'

export type FormuleType =
  | 'programme_4_mois'
  | 'renouvellement_12_mois_avec_prof'
  | 'renouvellement_12_mois_sans_prof'

export type TrancheAge =
  | 'moins_de_30'
  | '30_45'
  | '45_60'
  | 'plus_de_60'

// ------------------------------------------------------------
// MODULE LEADS
// ------------------------------------------------------------

export interface ActionContact {
  id: string
  type: ActionType
  date: string           // ISO date
  note?: string          // note libre optionnelle
}

export interface ProchaineAction {
  type: ActionType
  date: string           // ISO date
  note?: string
}

export interface Lead {
  id: string
  createdAt: string      // date d'entrée (réception questionnaire)
  updatedAt: string

  // Identité
  nom: string
  email: string
  telephone?: string

  // Pipeline
  statut: LeadStatut
  source: LeadSource

  // Archivage (null si lead actif)
  archive: boolean
  raisonArchivage?: LeadRaisonArchivage
  dateArchivage?: string

  // Cours d'essai (rempli quand statut = 'reserve' ou 'present')
  coursEssaiDate?: string     // ISO datetime
  coursEssaiFait: boolean

  // Suivi contact
  journal: ActionContact[]
  prochaineAction?: ProchaineAction
  dernierContactDate?: string  // calculé depuis journal

  // Infos questionnaire (discrètes — panneau détail uniquement)
  trancheAge?: TrancheAge
  objectifs?: string           // texte libre issu du questionnaire
  problemes?: string           // texte libre issu du questionnaire

  // Lien vers fiche élève (rempli si statut = 'eleve' ou 'ancien_eleve')
  eleveId?: string

  // Détection doublons
  doublonEmailIds?: string[]   // IDs des fiches fusionnées
}

// ------------------------------------------------------------
// MODULE ÉLÈVES
// ------------------------------------------------------------

export interface CompteRenduEleve {
  // Volet élève (rempli par l'élève dans les 24h)
  satisfaction?: 1 | 2 | 3 | 4 | 5
  ressenti?: string
  participationAteliers?: boolean
  dateRemplissage?: string     // ISO datetime — null = non rempli (alerte décrochage)
}

export interface CompteRenduProf {
  // Volet prof (rempli par le prof)
  presence: boolean
  remarque?: string
  nbAteliersAssistes?: number
  nbCommentaires?: number
  nbVideosFeedback?: number
  videoDefi: boolean
  defiValide: boolean
  pointsJeux: number
}

export interface Seance {
  id: string
  eleveId: string
  date: string               // ISO date
  numeroSeance: number       // 1, 2, 3...

  voletEleve?: CompteRenduEleve   // null si pas encore rempli
  voletProf?: CompteRenduProf     // null si pas encore rempli

  // Alerte calculée
  alerteDecrochage: boolean  // true si voletEleve non rempli après 24h
}

export interface Freeze {
  dateDebut: string          // ISO date
  dateFin?: string           // null si freeze en cours
  semainesDuree?: number     // calculé
}

export interface Eleve {
  id: string
  createdAt: string
  updatedAt: string

  // Identité (repris de la fiche lead)
  nom: string
  email: string
  telephone?: string
  leadId: string             // lien vers la fiche lead d'origine

  // Programme
  formule: FormuleType
  dureeContractuelleMois: number   // 4 par défaut, ajustable
  dateDebut: string                // ISO date
  dateFinPrevue: string            // ISO date (recalculée si freeze)
  profDedieId: string              // 'axel' par défaut

  // Paiement
  modePaiement: ModePaiement
  montantTotal: number             // 597 par défaut
  nbEcheances: number              // 2, 3 ou 4

  // Freeze
  freezes: Freeze[]
  semainesFreezeConsommees: number // calculé, max 4
  freezeActif: boolean

  // Suivi pédagogique
  objectifs: string                // saisis lors du cours d'essai, toujours visibles
  seances: Seance[]
  nbSeancesRealisees: number       // calculé
  nbSeancesTotales: number         // calculé selon formule

  // Jeux Guitarisation™
  pointsTotal: number              // somme de tous les pointsJeux des séances

  // Statut
  actif: boolean
  dateFinReelle?: string           // rempli quand programme terminé
}

// ------------------------------------------------------------
// MODULE FINANCES
// ------------------------------------------------------------

export interface Echeance {
  id: string
  eleveId: string
  datePrelevement: string    // ISO date
  montant: number
  encaisse: boolean
  dateEncaissement?: string  // ISO date
}

export interface InscriptionFinanciere {
  id: string
  eleveId: string
  dateInscription: string
  formule: FormuleType
  modePaiement: ModePaiement

  // Revenus
  montantContracte: number   // toujours = montantTotal (597 ou autre)
  montantEncaisse: number    // calculé depuis echeances.encaisse = true
  resteAEncaisser: number    // calculé = contracté - encaissé

  echeances: Echeance[]
}

export interface ChargeOutil {
  id: string
  nom: 'podia' | 'mailerlite' | 'calendly' | 'make' | 'zoom' | 'manychat'
  montantAnnuel: number
  montantMensuel: number     // calculé = annuel / 12
  dateRenouvellement?: string
}

export interface ChargeMetaAds {
  id: string
  mois: string               // format 'YYYY-MM'
  budgetJournalier: number   // en € (actuellement 20€/jour)
  nbJours: number            // jours de campagne dans le mois
  montantTotal: number       // calculé = budgetJournalier × nbJours
  montantRealise?: number    // réel si différent du calculé
}

export interface ChargeProf {
  mois: string               // format 'YYYY-MM'
  nbSeances: number          // calculé depuis les séances du mois
  tarifParSeance: number     // 22.50 €
  montantTotal: number       // calculé = nbSeances × tarifParSeance
}

// ------------------------------------------------------------
// KPIs & AGRÉGATS (pour la vue globale et les graphiques)
// ------------------------------------------------------------

export interface KpisMensuel {
  mois: string               // format 'YYYY-MM'

  // Leads
  nouveauxLeads: number
  leadsQualifies: number
  coursEssaisRealises: number
  conversions: number        // leads → élèves
  tauxConversionQualifieEleve: number   // %

  // Élèves
  elevesActifs: number
  nouveauxEleves: number
  churn: number              // élèves terminés dans le mois

  // Finances
  revenusContractes: number
  revenusEncaisses: number
  chargesOutils: number      // somme abonnements du mois
  chargesProf: number
  chargesMeta: number
  chargesTotal: number
  ebitda: number             // encaissé - toutes charges

  // Pub Meta
  coutParLead: number        // chargesMeta / nouveauxLeads
  coutParEleve: number       // chargesMeta / nouveauxEleves
}

// ------------------------------------------------------------
// PROF DÉDIÉ
// ------------------------------------------------------------

export interface Prof {
  id: string
  nom: string
  email?: string
  tarifParSeance: number     // 22.50 par défaut
  elevesAssignes: string[]   // liste d'eleveIds
}
