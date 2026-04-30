import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { rows } = await pool.query(
      `SELECT
        e.id::text, e.nom, e.email, e.telephone,
        e.formule, e.duree_contractuelle_mois,
        e.date_debut, e.date_fin_prevue, e.date_fin_reelle, e.actif,
        e.mode_paiement, e.montant_total, e.nb_echeances,
        e.semaines_freeze_consommees, e.freeze_actif,
        e.objectifs, e.points_total,
        e.lead_id::text, e.prof_dedie_id,
        e.created_at, e.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             s.id::text,
              'date',           s.date,
              'numero_seance',  s.numero_seance,
              'alerte_decrochage', s.alerte_decrochage,
              'volet_prof', CASE WHEN crp.seance_id IS NOT NULL THEN
                json_build_object(
                  'presence',             crp.presence,
                  'remarque',             crp.remarque,
                  'nb_ateliers_assistes', crp.nb_ateliers_assistes,
                  'nb_commentaires',      crp.nb_commentaires,
                  'nb_videos_feedback',   crp.nb_videos_feedback,
                  'video_defi',           crp.video_defi,
                  'defi_valide',          crp.defi_valide,
                  'points_jeux',          crp.points_jeux
                ) ELSE NULL END,
              'volet_eleve', CASE WHEN cre.seance_id IS NOT NULL THEN
                json_build_object(
                  'satisfaction',          cre.satisfaction,
                  'ressenti',              cre.ressenti,
                  'participation_ateliers',cre.participation_ateliers,
                  'date_remplissage',      cre.date_remplissage
                ) ELSE NULL END
            ) ORDER BY s.date DESC
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS seances,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id',             f.id::text,
            'date_debut',     f.date_debut,
            'date_fin',       f.date_fin,
            'semaines_duree', f.semaines_duree
          ) ORDER BY f.date_debut), '[]'::json)
          FROM freezes f WHERE f.eleve_id = e.id
        ) AS freezes
      FROM eleves e
      LEFT JOIN seances s             ON s.eleve_id = e.id
      LEFT JOIN compte_rendu_prof crp ON crp.seance_id = s.id
      LEFT JOIN compte_rendu_eleve cre ON cre.seance_id = s.id
      WHERE e.id = $1
      GROUP BY e.id`,
      [id]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[GET /api/eleves/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const ALLOWED = ['nom', 'objectifs', 'actif', 'date_fin_reelle', 'prof_dedie_id'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const values: unknown[] = [id]
    const sets: string[] = []

    for (const field of ALLOWED) {
      if (field in body) {
        values.push(body[field])
        sets.push(`${field} = $${values.length}`)
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Aucun champ' }, { status: 400 })
    sets.push('updated_at = NOW()')

    await pool.query(`UPDATE eleves SET ${sets.join(', ')} WHERE id = $1`, values)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/eleves/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
