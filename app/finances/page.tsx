import pool from '@/lib/db'
import FinancesClient from './FinancesClient'

export const dynamic = 'force-dynamic'

const SEED_OUTILS = [
  { id: 'podia',      nom: 'podia',      montant_annuel: 376 },
  { id: 'mailerlite', nom: 'mailerlite', montant_annuel: 298 },
  { id: 'calendly',   nom: 'calendly',   montant_annuel: 120 },
  { id: 'make',       nom: 'make',       montant_annuel: 120 },
  { id: 'zoom',       nom: 'zoom',       montant_annuel: 179 },
  { id: 'manychat',   nom: 'manychat',   montant_annuel: 168 },
]

const LABELS: Record<string, string> = {
  podia: 'Podia', mailerlite: 'MailerLite', calendly: 'Calendly',
  make: 'Make', zoom: 'Zoom', manychat: 'ManyChat',
}

function periodeMonthCurrent() {
  const now = new Date()
  const debut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const fin = now.toISOString().slice(0, 10)
  return { debut, fin }
}

async function fetchInitial() {
  const { debut, fin } = periodeMonthCurrent()
  const moisCourant = debut.slice(0, 7)

  // Seed outils
  for (const tool of SEED_OUTILS) {
    await pool.query(
      `INSERT INTO charges_outils (id, nom, montant_annuel) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [tool.id, tool.nom, tool.montant_annuel]
    )
  }

  // Charge Meta mois courant — auto-créer si absente
  const today = new Date()
  const nbJoursMois = today.getDate()
  await pool.query(
    `INSERT INTO charges_meta_ads (mois, budget_journalier, nb_jours)
     VALUES ($1, 20, $2) ON CONFLICT (mois) DO NOTHING`,
    [moisCourant, nbJoursMois]
  )

  const [kpis, outils, meta, inscriptions, echeances, alertes, eleves] = await Promise.all([
    // KPIs mois courant
    pool.query(
      `SELECT
        COALESCE((SELECT SUM(montant_contracte) FROM inscriptions_financieres
          WHERE date_inscription BETWEEN $1 AND $2), 0)::numeric AS revenus_contractes,
        COALESCE((SELECT SUM(e.montant) FROM echeances e
          WHERE e.encaisse = true AND e.date_encaissement BETWEEN $1 AND $2), 0)::numeric AS revenus_encaisses,
        COALESCE((SELECT SUM(e.montant) FROM echeances e WHERE e.encaisse = false), 0)::numeric AS reste_a_encaisser,
        COALESCE((SELECT SUM(montant_annuel) FROM charges_outils), 0) / 12 AS charges_outils_mensuel,
        (SELECT COUNT(*)::int FROM seances WHERE date BETWEEN $1 AND $2) AS nb_seances_prof,
        COALESCE((SELECT COALESCE(montant_realise, budget_journalier * nb_jours)
          FROM charges_meta_ads WHERE mois = $3), 0)::numeric AS charges_meta`,
      [debut, fin, moisCourant]
    ),
    // Outils
    pool.query(
      `SELECT id, nom, montant_annuel, ROUND(montant_annuel/12,2) AS montant_mensuel, date_renouvellement
       FROM charges_outils ORDER BY montant_annuel DESC`
    ),
    // Meta mois courant
    pool.query(
      `SELECT id::text, mois, budget_journalier, nb_jours, montant_realise FROM charges_meta_ads WHERE mois = $1`,
      [moisCourant]
    ),
    // Inscriptions avec échéances
    pool.query(
      `SELECT i.id::text, i.eleve_id::text, i.date_inscription, i.formule,
              i.mode_paiement, i.montant_contracte,
              e.nom AS eleve_nom, e.email AS eleve_email,
              COALESCE(json_agg(
                json_build_object(
                  'id', ec.id::text, 'date_prelevement', ec.date_prelevement,
                  'montant', ec.montant, 'encaisse', ec.encaisse,
                  'date_encaissement', ec.date_encaissement
                ) ORDER BY ec.date_prelevement ASC
              ) FILTER (WHERE ec.id IS NOT NULL), '[]'::json) AS echeances,
              COALESCE(SUM(CASE WHEN ec.encaisse THEN ec.montant ELSE 0 END),0) AS montant_encaisse,
              COALESCE(SUM(CASE WHEN NOT ec.encaisse THEN ec.montant ELSE 0 END),0) AS reste_a_encaisser
       FROM inscriptions_financieres i
       JOIN eleves e ON e.id = i.eleve_id
       LEFT JOIN echeances ec ON ec.inscription_id = i.id
       GROUP BY i.id, e.nom, e.email
       ORDER BY i.date_inscription DESC`
    ),
    // Échéances à venir (non encaissées, triées par date)
    pool.query(
      `SELECT ec.id::text, ec.eleve_id::text, ec.date_prelevement, ec.montant,
              ec.encaisse, ec.date_encaissement, e.nom AS eleve_nom
       FROM echeances ec
       JOIN eleves e ON e.id = ec.eleve_id
       ORDER BY ec.date_prelevement ASC`
    ),
    // Alertes paiements non assignés
    pool.query(
      `SELECT id::text, created_at, stripe_email, stripe_nom, montant, statut, meta
       FROM alertes_paiement WHERE statut = 'non_assigne' ORDER BY created_at DESC`
    ),
    // Liste élèves pour dropdown résolution alertes
    pool.query(
      `SELECT id::text, nom, email FROM eleves WHERE actif = true ORDER BY nom ASC`
    ),
  ])

  const row = kpis.rows[0]
  const charges_outils = parseFloat(row.charges_outils_mensuel)
  const charges_prof = (row.nb_seances_prof ?? 0) * 22.5
  const charges_meta = parseFloat(row.charges_meta)
  const charges_total = charges_outils + charges_prof + charges_meta
  const revenus_encaisses = parseFloat(row.revenus_encaisses)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCount = echeances.rows.filter(
    (r: { encaisse: boolean; date_encaissement: string | null }) =>
      r.encaisse && r.date_encaissement === todayStr
  ).length

  return {
    kpis: {
      revenus_contractes: parseFloat(row.revenus_contractes),
      revenus_encaisses,
      reste_a_encaisser: parseFloat(row.reste_a_encaisser),
      charges_outils,
      charges_prof,
      charges_meta,
      charges_total,
      ebitda: revenus_encaisses - charges_total,
      nb_seances_prof: row.nb_seances_prof ?? 0,
    },
    outils: outils.rows.map(r => ({ ...r, label: LABELS[r.nom] ?? r.nom })),
    meta: meta.rows[0] ?? { mois: moisCourant, budget_journalier: 20, nb_jours: nbJoursMois, montant_realise: null },
    inscriptions: inscriptions.rows,
    echeances: echeances.rows,
    alertes: alertes.rows,
    eleves: eleves.rows,
    periode: { debut, fin },
    todayCount,
  }
}

export default async function FinancesPage() {
  const data = await fetchInitial()
  return <FinancesClient {...data} todayCount={data.todayCount} />
}
