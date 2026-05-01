-- ============================================================
-- GUITARISATION™ — Schéma PostgreSQL
-- ============================================================
-- Idempotent : peut être rejoué sans erreur (CREATE TABLE IF NOT EXISTS)

-- ------------------------------------------------------------
-- PROFS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profs (
  id              TEXT PRIMARY KEY,
  nom             TEXT        NOT NULL,
  email           TEXT,
  tarif_par_seance NUMERIC(8,2) NOT NULL DEFAULT 22.50
);

-- ------------------------------------------------------------
-- LEADS
-- La FK vers eleves est ajoutée APRÈS la création de la table eleves
-- pour éviter la dépendance circulaire.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identité
  nom              TEXT NOT NULL,
  email            TEXT NOT NULL,
  telephone        TEXT,

  -- Pipeline
  statut           TEXT NOT NULL DEFAULT 'nouveau'
                   CHECK (statut IN ('nouveau','qualifie','reserve','present','eleve','ancien_eleve')),
  source           TEXT NOT NULL
                   CHECK (source IN ('pub_meta','organique')),

  -- Archivage
  archive          BOOLEAN NOT NULL DEFAULT FALSE,
  raison_archivage TEXT     CHECK (raison_archivage IN ('non_qualifie','sans_reponse','abandon')),
  date_archivage   TIMESTAMPTZ,

  -- Cours d'essai
  cours_essai_date  TIMESTAMPTZ,
  cours_essai_fait  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Prochaine action (dénormalisé pour perf liste)
  prochaine_action_type TEXT CHECK (prochaine_action_type IN ('appel','sms','cours_essai')),
  prochaine_action_date TIMESTAMPTZ,
  prochaine_action_note TEXT,

  -- Questionnaire (panneau détail uniquement)
  tranche_age      TEXT CHECK (tranche_age IN ('moins_de_30','30_45','45_60','plus_de_60')),
  objectifs        TEXT,
  problemes        TEXT,
  questionnaire    JSONB,

  -- Lien élève (FK ajoutée plus bas)
  eleve_id         UUID,

  -- Doublons fusionnés
  doublon_email_ids UUID[] NOT NULL DEFAULT '{}'
);

-- ------------------------------------------------------------
-- ACTIONS CONTACT (journal par lead)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actions_contact (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id  UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type     TEXT NOT NULL CHECK (type IN ('appel','sms','cours_essai')),
  date     TIMESTAMPTZ NOT NULL,
  note     TEXT
);

-- ------------------------------------------------------------
-- ÉLÈVES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eleves (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identité
  nom                      TEXT NOT NULL,
  email                    TEXT NOT NULL,
  telephone                TEXT,
  lead_id                  UUID NOT NULL REFERENCES leads(id),

  -- Programme
  formule                  TEXT NOT NULL
                           CHECK (formule IN ('programme_4_mois','renouvellement_12_mois_avec_prof','renouvellement_12_mois_sans_prof')),
  duree_contractuelle_mois INTEGER NOT NULL DEFAULT 4,
  date_debut               DATE NOT NULL,
  date_fin_prevue          DATE NOT NULL,
  prof_dedie_id            TEXT NOT NULL REFERENCES profs(id),

  -- Paiement
  mode_paiement            TEXT NOT NULL,
  montant_total            NUMERIC(8,2) NOT NULL DEFAULT 597,
  nb_echeances             INTEGER NOT NULL,

  -- Freeze
  semaines_freeze_consommees INTEGER NOT NULL DEFAULT 0 CHECK (semaines_freeze_consommees <= 4),
  freeze_actif             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Pédagogie
  objectifs                TEXT NOT NULL DEFAULT '',
  points_total             INTEGER NOT NULL DEFAULT 0,

  -- Statut
  actif                    BOOLEAN NOT NULL DEFAULT TRUE,
  date_fin_reelle          DATE,

  -- Paiement Stripe (email utilisé sur Podia/Stripe, peut différer de email)
  email_paiement           TEXT
);

-- FK circulaire leads → eleves (ajoutée après création de eleves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_eleve_id_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_eleve_id_fkey
      FOREIGN KEY (eleve_id) REFERENCES eleves(id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- FREEZES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS freezes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id    UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date_debut  DATE NOT NULL,
  date_fin    DATE,
  semaines_duree INTEGER -- calculé par l'app ou cron
);

-- ------------------------------------------------------------
-- SÉANCES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id         UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  numero_seance    INTEGER NOT NULL,
  alerte_decrochage BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------
-- COMPTE RENDU ÉLÈVE (1-1 avec seances)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compte_rendu_eleve (
  seance_id            UUID PRIMARY KEY REFERENCES seances(id) ON DELETE CASCADE,
  satisfaction         INTEGER CHECK (satisfaction BETWEEN 1 AND 5),
  ressenti             TEXT,
  participation_ateliers BOOLEAN,
  date_remplissage     TIMESTAMPTZ -- NULL = non encore rempli → alerte décrochage
);

-- ------------------------------------------------------------
-- COMPTE RENDU PROF (1-1 avec seances)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compte_rendu_prof (
  seance_id            UUID PRIMARY KEY REFERENCES seances(id) ON DELETE CASCADE,
  presence             BOOLEAN NOT NULL,
  remarque             TEXT,
  nb_ateliers_assistes INTEGER NOT NULL DEFAULT 0,
  nb_commentaires      INTEGER NOT NULL DEFAULT 0,
  nb_videos_feedback   INTEGER NOT NULL DEFAULT 0,
  video_defi           BOOLEAN NOT NULL DEFAULT FALSE,
  defi_valide          BOOLEAN NOT NULL DEFAULT FALSE,
  points_jeux          INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- INSCRIPTIONS FINANCIÈRES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscriptions_financieres (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id         UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date_inscription DATE NOT NULL,
  formule          TEXT NOT NULL,
  mode_paiement    TEXT NOT NULL,
  montant_contracte NUMERIC(8,2) NOT NULL
  -- montant_encaisse et reste_a_encaisser sont calculés depuis echeances
);

-- ------------------------------------------------------------
-- ÉCHÉANCES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS echeances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id    UUID NOT NULL REFERENCES inscriptions_financieres(id) ON DELETE CASCADE,
  eleve_id          UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date_prelevement  DATE NOT NULL,
  montant           NUMERIC(8,2) NOT NULL,
  encaisse          BOOLEAN NOT NULL DEFAULT FALSE,
  date_encaissement DATE
);

-- ------------------------------------------------------------
-- CHARGES OUTILS (6 lignes fixes, une par outil)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges_outils (
  id                  TEXT PRIMARY KEY,
  nom                 TEXT NOT NULL UNIQUE
                      CHECK (nom IN ('podia','mailerlite','calendly','make','zoom','manychat')),
  montant_annuel      NUMERIC(8,2) NOT NULL,
  -- montant_mensuel = montant_annuel / 12 (calculé à la volée)
  date_renouvellement DATE
);

-- ------------------------------------------------------------
-- CHARGES META ADS (une ligne par mois)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges_meta_ads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mois             TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
  budget_journalier NUMERIC(8,2) NOT NULL DEFAULT 20,
  nb_jours         INTEGER NOT NULL,
  montant_realise  NUMERIC(8,2) -- NULL = utiliser budget_journalier × nb_jours
);

-- ------------------------------------------------------------
-- ALERTES PAIEMENT (paiements Stripe non reconnus automatiquement)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertes_paiement (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_email      TEXT NOT NULL,
  stripe_nom        TEXT,
  montant           NUMERIC(8,2) NOT NULL,
  stripe_payment_id TEXT NOT NULL UNIQUE,
  statut            TEXT NOT NULL DEFAULT 'non_assigne'
                    CHECK (statut IN ('non_assigne','assigne','ignore')),
  eleve_id          UUID REFERENCES eleves(id),
  echeance_id       UUID REFERENCES echeances(id),
  meta              JSONB
);

-- ------------------------------------------------------------
-- KPIs MENSUELS (précalculés par le cron nocturne)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpis_mensuels (
  mois                         TEXT PRIMARY KEY, -- 'YYYY-MM'
  nouveaux_leads               INTEGER     NOT NULL DEFAULT 0,
  leads_qualifies              INTEGER     NOT NULL DEFAULT 0,
  cours_essais_realises        INTEGER     NOT NULL DEFAULT 0,
  conversions                  INTEGER     NOT NULL DEFAULT 0,
  taux_conversion_qualifie_eleve NUMERIC(5,2) NOT NULL DEFAULT 0,
  eleves_actifs                INTEGER     NOT NULL DEFAULT 0,
  nouveaux_eleves              INTEGER     NOT NULL DEFAULT 0,
  churn                        INTEGER     NOT NULL DEFAULT 0,
  revenus_contractes           NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenus_encaisses            NUMERIC(10,2) NOT NULL DEFAULT 0,
  charges_outils               NUMERIC(10,2) NOT NULL DEFAULT 0,
  charges_prof                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  charges_meta                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  charges_total                NUMERIC(10,2) NOT NULL DEFAULT 0,
  ebitda                       NUMERIC(10,2) NOT NULL DEFAULT 0,
  cout_par_lead                NUMERIC(10,2),
  cout_par_eleve               NUMERIC(10,2),
  computed_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEX (requêtes fréquentes)
-- ============================================================

-- Leads : filtres liste principale
CREATE INDEX IF NOT EXISTS idx_leads_statut     ON leads(statut);
CREATE INDEX IF NOT EXISTS idx_leads_archive    ON leads(archive);
CREATE INDEX IF NOT EXISTS idx_leads_source     ON leads(source);
-- Leads : détection doublons
CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_telephone  ON leads(telephone);
-- Leads : tri par date
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Actions contact : par lead
CREATE INDEX IF NOT EXISTS idx_actions_lead_id ON actions_contact(lead_id);
CREATE INDEX IF NOT EXISTS idx_actions_date    ON actions_contact(date DESC);

-- Élèves : filtres
CREATE INDEX IF NOT EXISTS idx_eleves_actif       ON eleves(actif);
CREATE INDEX IF NOT EXISTS idx_eleves_prof        ON eleves(prof_dedie_id);
CREATE INDEX IF NOT EXISTS idx_eleves_lead_id     ON eleves(lead_id);

-- Séances : par élève + date
CREATE INDEX IF NOT EXISTS idx_seances_eleve_id ON seances(eleve_id);
CREATE INDEX IF NOT EXISTS idx_seances_date     ON seances(date DESC);

-- Alerte décrochage
CREATE INDEX IF NOT EXISTS idx_seances_alerte ON seances(alerte_decrochage) WHERE alerte_decrochage = TRUE;

-- Échéances : encaissement + date
CREATE INDEX IF NOT EXISTS idx_echeances_eleve_id        ON echeances(eleve_id);
CREATE INDEX IF NOT EXISTS idx_echeances_date_prelevement ON echeances(date_prelevement);
CREATE INDEX IF NOT EXISTS idx_echeances_encaisse        ON echeances(encaisse);

-- Alertes paiement
CREATE INDEX IF NOT EXISTS idx_alertes_paiement_statut ON alertes_paiement(statut);
CREATE INDEX IF NOT EXISTS idx_alertes_paiement_stripe_payment_id ON alertes_paiement(stripe_payment_id);
