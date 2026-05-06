import pool from '@/lib/db'
import { isGoogleConnected } from '@/lib/google'
import ElevesClient from './ElevesClient'

export const dynamic = 'force-dynamic'

async function fetchTodayCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM eleves WHERE created_at::date = CURRENT_DATE`
  )
  return rows[0].count as number
}

async function fetchEleves(actif: boolean) {
  const { rows } = await pool.query(
    `SELECT
      e.id::text, e.nom, e.email, e.telephone,
      e.formule, COALESCE(f.label, e.formule) AS formule_label,
      e.duree_contractuelle_mois,
      COALESCE(e.nb_seances_prevues, e.duree_contractuelle_mois * 2)::int AS nb_seances_prevues,
      e.date_debut, e.date_fin_prevue, e.actif,
      e.mode_paiement, e.montant_total, e.nb_echeances,
      e.semaines_freeze_consommees, e.freeze_actif,
      e.objectifs, e.notes, e.points_total,
      e.lead_id::text, e.prof_dedie_id,
      e.created_at, e.photo_url,
      COUNT(s.id)::int                                     AS nb_seances_realisees,
      COALESCE(BOOL_OR(s.alerte_decrochage), false)        AS has_alerte,
      (
        SELECT cre2.satisfaction
        FROM seances s2
        JOIN compte_rendu_eleve cre2 ON cre2.seance_id = s2.id
        WHERE s2.eleve_id = e.id AND cre2.satisfaction IS NOT NULL
        ORDER BY s2.date DESC
        LIMIT 1
      )                                                    AS satisfaction_moyenne
    FROM eleves e
    LEFT JOIN formules f           ON f.id = e.formule
    LEFT JOIN seances s            ON s.eleve_id = e.id
    WHERE e.actif = $1
    GROUP BY e.id, f.label
    ORDER BY e.date_debut DESC`,
    [actif]
  )
  return rows
}

export default async function ElevesPage() {
  const [actifs, anciens, todayCount, googleConnected] = await Promise.all([
    fetchEleves(true),
    fetchEleves(false),
    fetchTodayCount(),
    isGoogleConnected(),
  ])
  return <ElevesClient initialActifs={actifs} initialAnciens={anciens} todayCount={todayCount} googleConnected={googleConnected} />
}
