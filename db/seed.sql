-- ============================================================
-- GUITARISATION™ — Données de test réalistes
-- ============================================================
-- ATTENTION : à ne lancer qu'une fois sur une base vide (ou après TRUNCATE)

-- Nettoyage dans l'ordre inverse des FK
TRUNCATE
  kpis_mensuels,
  charges_meta_ads,
  charges_outils,
  echeances,
  inscriptions_financieres,
  compte_rendu_prof,
  compte_rendu_eleve,
  seances,
  freezes,
  eleves,
  actions_contact,
  leads,
  profs
CASCADE;

-- ------------------------------------------------------------
-- PROFS
-- ------------------------------------------------------------
INSERT INTO profs (id, nom, email, tarif_par_seance) VALUES
  ('axel', 'Axel Martin', 'axel@guitarisation.fr', 22.50);

-- ------------------------------------------------------------
-- LEADS (5 leads à différents stades)
-- ------------------------------------------------------------
-- Lead 1 : Nouveau (vient d'arriver)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   tranche_age, objectifs, problemes,
                   prochaine_action_type, prochaine_action_date)
VALUES (
  '11111111-0000-0000-0000-000000000001',
  NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
  'Marie Dupont', 'marie.dupont@gmail.com', '0612345678',
  'nouveau', 'pub_meta',
  '30_45',
  'Apprendre à jouer des chansons pop pour accompagner ma fille',
  'Je n''ai jamais touché une guitare, je ne sais pas par où commencer',
  'appel', NOW() + INTERVAL '1 day'
);

-- Lead 2 : Qualifié (questionnaire validé)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   tranche_age, objectifs, problemes,
                   prochaine_action_type, prochaine_action_date)
VALUES (
  '11111111-0000-0000-0000-000000000002',
  NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day',
  'Jean-Pierre Moreau', 'jp.moreau@hotmail.fr', '0698765432',
  'qualifie', 'organique',
  '45_60',
  'Jouer des solos blues, rattraper un projet de jeunesse abandonné',
  'J''ai appris seul pendant 2 ans mais je plafonne, mauvaises habitudes de posture',
  'cours_essai', NOW() + INTERVAL '3 days'
);

-- Lead 3 : Réservé (cours d'essai planifié)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   cours_essai_date, cours_essai_fait,
                   tranche_age, objectifs, problemes)
VALUES (
  '11111111-0000-0000-0000-000000000003',
  NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days',
  'Sophie Leblanc', 'sophie.leblanc@orange.fr', '0756781234',
  'reserve', 'pub_meta',
  NOW() + INTERVAL '2 days', FALSE,
  '30_45',
  'Guitare acoustique, folk, chansons françaises',
  'Reprend après 10 ans d''arrêt, doigts rouillés'
);

-- Lead 4 : Archivé (sans réponse)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   archive, raison_archivage, date_archivage,
                   tranche_age, objectifs)
VALUES (
  '11111111-0000-0000-0000-000000000004',
  NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days',
  'Thomas Petit', 'thomas.petit@gmail.com', NULL,
  'qualifie', 'pub_meta',
  TRUE, 'sans_reponse', NOW() - INTERVAL '10 days',
  'moins_de_30',
  'Guitare électrique, metal, shred'
);

-- Lead 5 : Archivé (non qualifié)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   archive, raison_archivage, date_archivage)
VALUES (
  '11111111-0000-0000-0000-000000000005',
  NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days',
  'Laura Chevalier', 'l.chevalier@yahoo.fr', '0645231890',
  'nouveau', 'pub_meta',
  TRUE, 'non_qualifie', NOW() - INTERVAL '15 days'
);

-- ------------------------------------------------------------
-- ACTIONS CONTACT (journal des leads 1 et 2)
-- ------------------------------------------------------------
INSERT INTO actions_contact (lead_id, type, date, note) VALUES
  ('11111111-0000-0000-0000-000000000001', 'sms',   NOW() - INTERVAL '2 days',
   'SMS de bienvenue envoyé, lien vers le questionnaire'),
  ('11111111-0000-0000-0000-000000000002', 'appel', NOW() - INTERVAL '4 days',
   'Appel de qualification — très motivé, disponibilité le mardi soir'),
  ('11111111-0000-0000-0000-000000000002', 'sms',   NOW() - INTERVAL '1 day',
   'Rappel cours d''essai, confirmation mercredi 18h');

-- ------------------------------------------------------------
-- ÉLÈVES (2 élèves actifs issus de leads convertis)
-- Lead correspondants : on crée d'abord les élèves, puis on met à jour les leads
-- ------------------------------------------------------------

-- Élève 1 : Clara Fontaine — programme 4 mois, CB 3x, démarré il y a 2 mois
-- Lead origine (simulé inline, pas de lead existant pour cet élève)
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   cours_essai_fait, tranche_age, objectifs)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  NOW() - INTERVAL '70 days', NOW() - INTERVAL '60 days',
  'Clara Fontaine', 'clara.fontaine@gmail.com', '0677889900',
  'eleve', 'pub_meta',
  TRUE,
  '30_45',
  'Jouer des chansons pop et composer ses propres morceaux'
);

INSERT INTO eleves (id, created_at, updated_at,
                    nom, email, telephone, lead_id,
                    formule, duree_contractuelle_mois, date_debut, date_fin_prevue,
                    prof_dedie_id, mode_paiement, montant_total, nb_echeances,
                    objectifs, points_total, actif)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  NOW() - INTERVAL '60 days', NOW(),
  'Clara Fontaine', 'clara.fontaine@gmail.com', '0677889900',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'programme_4_mois', 4,
  (NOW() - INTERVAL '60 days')::DATE,
  (NOW() + INTERVAL '60 days')::DATE,
  'axel', 'cb_3x', 597.00, 3,
  'Jouer des chansons pop et composer ses propres morceaux',
  185, TRUE
);

UPDATE leads SET eleve_id = 'bbbbbbbb-0000-0000-0000-000000000001'
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Élève 2 : Marc Rousseau — programme 4 mois, PayPal 4x, démarré il y a 3 semaines
INSERT INTO leads (id, created_at, updated_at, nom, email, telephone, statut, source,
                   cours_essai_fait, tranche_age, objectifs)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  NOW() - INTERVAL '30 days', NOW() - INTERVAL '21 days',
  'Marc Rousseau', 'marc.rousseau@sfr.fr', '0623456789',
  'eleve', 'organique',
  TRUE,
  '45_60',
  'Jouer des standards jazz, apprendre la théorie musicale'
);

INSERT INTO eleves (id, created_at, updated_at,
                    nom, email, telephone, lead_id,
                    formule, duree_contractuelle_mois, date_debut, date_fin_prevue,
                    prof_dedie_id, mode_paiement, montant_total, nb_echeances,
                    objectifs, points_total, actif)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000002',
  NOW() - INTERVAL '21 days', NOW(),
  'Marc Rousseau', 'marc.rousseau@sfr.fr', '0623456789',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'programme_4_mois', 4,
  (NOW() - INTERVAL '21 days')::DATE,
  (NOW() + INTERVAL '99 days')::DATE,
  'axel', 'paypal_4x', 597.00, 4,
  'Jouer des standards jazz, apprendre la théorie musicale',
  60, TRUE
);

UPDATE leads SET eleve_id = 'bbbbbbbb-0000-0000-0000-000000000002'
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- ------------------------------------------------------------
-- SÉANCES — Clara (5 séances réalisées)
-- ------------------------------------------------------------
INSERT INTO seances (id, eleve_id, date, numero_seance, alerte_decrochage) VALUES
  ('cccccccc-0000-0000-0001-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', (NOW() - INTERVAL '56 days')::DATE, 1, FALSE),
  ('cccccccc-0000-0000-0001-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', (NOW() - INTERVAL '42 days')::DATE, 2, FALSE),
  ('cccccccc-0000-0000-0001-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', (NOW() - INTERVAL '28 days')::DATE, 3, FALSE),
  ('cccccccc-0000-0000-0001-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', (NOW() - INTERVAL '14 days')::DATE, 4, FALSE),
  ('cccccccc-0000-0000-0001-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', (NOW() - INTERVAL '2 days')::DATE,  5, TRUE); -- alerte : pas encore rempli

-- Comptes rendus prof — Clara (4 premières séances)
INSERT INTO compte_rendu_prof (seance_id, presence, remarque, nb_ateliers_assistes, nb_commentaires, nb_videos_feedback, video_defi, defi_valide, points_jeux) VALUES
  ('cccccccc-0000-0000-0001-000000000001', TRUE, 'Bonne prise en main, motivation excellente', 1, 2, 1, FALSE, FALSE, 30),
  ('cccccccc-0000-0000-0001-000000000002', TRUE, 'Accord de Mi mineur maîtrisé, transition Do difficile', 2, 3, 1, TRUE, TRUE, 45),
  ('cccccccc-0000-0000-0001-000000000003', TRUE, 'Grattage en 8/8 acquis, introduit fingerpicking', 2, 1, 2, TRUE, FALSE, 40),
  ('cccccccc-0000-0000-0001-000000000004', TRUE, 'Excellent progrès, première chanson complète jouée !', 3, 4, 2, TRUE, TRUE, 70),
  ('cccccccc-0000-0000-0001-000000000005', TRUE, 'Séance productive, nouveaux accords barrés introduits', 0, 0, 0, FALSE, FALSE, 0);

-- Comptes rendus élève — Clara (4 premières séances, la 5e non remplie)
INSERT INTO compte_rendu_eleve (seance_id, satisfaction, ressenti, participation_ateliers, date_remplissage) VALUES
  ('cccccccc-0000-0000-0001-000000000001', 5, 'Super première séance, j''adore !', TRUE,  (NOW() - INTERVAL '55 days')),
  ('cccccccc-0000-0000-0001-000000000002', 4, 'Un peu dur avec les transitions mais ça vient', TRUE,  (NOW() - INTERVAL '41 days')),
  ('cccccccc-0000-0000-0001-000000000003', 5, 'Le fingerpicking c''est magique', FALSE, (NOW() - INTERVAL '27 days')),
  ('cccccccc-0000-0000-0001-000000000004', 5, 'J''ai joué ma première chanson en entier devant ma famille !', TRUE,  (NOW() - INTERVAL '13 days'));
-- Séance 5 : volet élève non rempli (alerte décrochage)

-- Séances — Marc (2 séances réalisées)
INSERT INTO seances (id, eleve_id, date, numero_seance, alerte_decrochage) VALUES
  ('cccccccc-0000-0000-0002-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', (NOW() - INTERVAL '14 days')::DATE, 1, FALSE),
  ('cccccccc-0000-0000-0002-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', (NOW() - INTERVAL '0 days')::DATE,  2, FALSE);

INSERT INTO compte_rendu_prof (seance_id, presence, remarque, nb_ateliers_assistes, nb_commentaires, nb_videos_feedback, video_defi, defi_valide, points_jeux) VALUES
  ('cccccccc-0000-0000-0002-000000000001', TRUE, 'Bon niveau de base, bonnes oreilles', 0, 1, 1, FALSE, FALSE, 35),
  ('cccccccc-0000-0000-0002-000000000002', TRUE, 'Introduction aux accords de jazz (ii-V-I)', 1, 2, 1, TRUE, TRUE, 25);

INSERT INTO compte_rendu_eleve (seance_id, satisfaction, ressenti, participation_ateliers, date_remplissage) VALUES
  ('cccccccc-0000-0000-0002-000000000001', 4, 'Très intéressant, beaucoup de choses à assimiler', TRUE, (NOW() - INTERVAL '13 days')),
  ('cccccccc-0000-0000-0002-000000000002', 5, 'Le ii-V-I c''est la clé du jazz, enfin je comprends !', TRUE, NOW() - INTERVAL '1 hour');

-- ------------------------------------------------------------
-- INSCRIPTIONS FINANCIÈRES
-- ------------------------------------------------------------
INSERT INTO inscriptions_financieres (id, eleve_id, date_inscription, formule, mode_paiement, montant_contracte) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   (NOW() - INTERVAL '60 days')::DATE, 'programme_4_mois', 'cb_3x', 597.00),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   (NOW() - INTERVAL '21 days')::DATE, 'programme_4_mois', 'paypal_4x', 597.00);

-- Échéances Clara (CB 3x — 199 €/mois, 2 encaissées, 1 à venir)
INSERT INTO echeances (inscription_id, eleve_id, date_prelevement, montant, encaisse, date_encaissement) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   (NOW() - INTERVAL '60 days')::DATE, 199.00, TRUE, (NOW() - INTERVAL '60 days')::DATE),
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   (NOW() - INTERVAL '30 days')::DATE, 199.00, TRUE, (NOW() - INTERVAL '30 days')::DATE),
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   (NOW() + INTERVAL '30 days')::DATE, 199.00, FALSE, NULL);

-- Échéances Marc (PayPal 4x — totalité versée immédiatement)
INSERT INTO echeances (inscription_id, eleve_id, date_prelevement, montant, encaisse, date_encaissement) VALUES
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   (NOW() - INTERVAL '21 days')::DATE, 597.00, TRUE, (NOW() - INTERVAL '21 days')::DATE);

-- ------------------------------------------------------------
-- CHARGES OUTILS (6 lignes fixes)
-- ------------------------------------------------------------
INSERT INTO charges_outils (id, nom, montant_annuel, date_renouvellement) VALUES
  ('podia',      'podia',      376.00, '2026-09-01'),
  ('mailerlite', 'mailerlite', 298.00, '2026-06-15'),
  ('calendly',   'calendly',   120.00, '2026-11-01'),
  ('make',       'make',       120.00, NULL),          -- mensuel × 12
  ('zoom',       'zoom',       179.00, '2026-08-20'),
  ('manychat',   'manychat',   168.00, NULL)            -- mensuel × 12
ON CONFLICT (nom) DO UPDATE SET
  montant_annuel      = EXCLUDED.montant_annuel,
  date_renouvellement = EXCLUDED.date_renouvellement;

-- ------------------------------------------------------------
-- CHARGES META ADS (mois en cours)
-- ------------------------------------------------------------
INSERT INTO charges_meta_ads (mois, budget_journalier, nb_jours) VALUES
  (TO_CHAR(NOW(), 'YYYY-MM'), 20.00, EXTRACT(DAY FROM NOW())::INTEGER)
ON CONFLICT (mois) DO NOTHING;

-- ------------------------------------------------------------
-- KPIs MENSUELS (mois en cours, valeurs calculées manuellement pour le seed)
-- ------------------------------------------------------------
INSERT INTO kpis_mensuels (
  mois,
  nouveaux_leads, leads_qualifies, cours_essais_realises, conversions,
  taux_conversion_qualifie_eleve,
  eleves_actifs, nouveaux_eleves, churn,
  revenus_contractes, revenus_encaisses,
  charges_outils, charges_prof, charges_meta, charges_total, ebitda,
  cout_par_lead, cout_par_eleve
) VALUES (
  TO_CHAR(NOW(), 'YYYY-MM'),
  3, 2, 1, 1,
  50.00,
  2, 1, 0,
  597.00, 597.00,
  97.08, 67.50, 600.00, 764.58, -167.58,
  200.00, 600.00
)
ON CONFLICT (mois) DO NOTHING;
