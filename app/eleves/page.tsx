import pool from '@/lib/db'
import ElevesClient from './ElevesClient'

export const dynamic = 'force-dynamic'

async function fetchEleves(actif: boolean) {
  const { rows } = await pool.query(
    `SELECT
      e.id::text, e.nom, e.email, e.telephone,
      e.formule, COALESCE(f.label, e.formule) AS formule_label,
      e.duree_contractuelle_mois,
      e.date_debut, e.date_fin_prevue, e.actif,
      e.mode_paiement, e.montant_total, e.nb_echeances,
      e.semaines_freeze_consommees, e.freeze_actif,
      e.objectifs, e.notes, e.points_total,
      e.lead_id::text, e.prof_dedie_id,
      e.created_at,
      COUNT(s.id)::int                                     AS nb_seances_realisees,
      COALESCE(BOOL_OR(s.alerte_decrochage), false)        AS has_alerte,
      ROUND(AVG(cre.satisfaction)::numeric, 1)             AS satisfaction_moyenne
    FROM eleves e
    LEFT JOIN formules f           ON f.id = e.formule
    LEFT JOIN seances s            ON s.eleve_id = e.id
    LEFT JOIN compte_rendu_eleve cre ON cre.seance_id = s.id
    WHERE e.actif = $1
    GROUP BY e.id, f.label
    ORDER BY e.date_debut DESC`,
    [actif]
  )
  return rows
}

export default async function ElevesPage() {
  const [actifs, anciens] = await Promise.all([
    fetchEleves(true),
    fetchEleves(false),
  ])
  return <ElevesClient initialActifs={actifs} initialAnciens={anciens} />
}
