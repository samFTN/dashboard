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
        e.objectifs, e.notes, e.points_total,
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
        ) AS freezes,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id',              ec.id::text,
            'date_prelevement',ec.date_prelevement,
            'montant',         ec.montant,
            'encaisse',        ec.encaisse,
            'date_encaissement',ec.date_encaissement
          ) ORDER BY ec.date_prelevement ASC), '[]'::json)
          FROM echeances ec WHERE ec.eleve_id = e.id
        ) AS echeances
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

const ALLOWED = [
  'nom', 'email', 'telephone',
  'formule', 'duree_contractuelle_mois', 'nb_seances_prevues', 'date_debut', 'date_fin_prevue', 'date_fin_reelle',
  'mode_paiement', 'montant_total', 'nb_echeances',
  'prof_dedie_id', 'objectifs', 'notes', 'actif',
] as const

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function nbEcheancesFromMode(mode: string): number {
  if (mode === 'cb_1x') return 1
  if (mode === 'cb_2x') return 2
  if (mode === 'cb_3x') return 3
  if (mode === 'cb_4x') return 4
  return 1 // paypal_4x
}

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

    const paymentChanged = ['montant_total', 'mode_paiement', 'nb_echeances'].some(f => f in body)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`UPDATE eleves SET ${sets.join(', ')} WHERE id = $1`, values)

      if (paymentChanged) {
        // Lire l'état actuel de l'élève après mise à jour
        const { rows: eleveRows } = await client.query(
          `SELECT montant_total, mode_paiement, nb_echeances, date_debut FROM eleves WHERE id = $1`, [id]
        )
        const eleve = eleveRows[0]
        const montant = parseFloat(eleve.montant_total)
        const mode = eleve.mode_paiement
        const nb = nbEcheancesFromMode(mode)
        const montantEcheance = +(montant / nb).toFixed(2)
        const dateDebut = eleve.date_debut instanceof Date
          ? eleve.date_debut.toISOString().slice(0, 10)
          : String(eleve.date_debut).slice(0, 10)
        const isPaypal = mode === 'paypal_4x'

        // Mettre à jour inscription_financieres
        await client.query(
          `UPDATE inscriptions_financieres
           SET montant_contracte = $1, mode_paiement = $2
           WHERE eleve_id = $3`,
          [montant, mode, id]
        )

        // Récupérer l'inscription
        const { rows: inscRows } = await client.query(
          `SELECT id::text FROM inscriptions_financieres WHERE eleve_id = $1`, [id]
        )
        if (inscRows.length > 0) {
          const inscId = inscRows[0].id

          // Supprimer uniquement les échéances non encaissées
          await client.query(
            `DELETE FROM echeances WHERE inscription_id = $1 AND encaisse = false`, [inscId]
          )

          // Compter les échéances déjà encaissées
          const { rows: paidRows } = await client.query(
            `SELECT COUNT(*)::int AS cnt FROM echeances WHERE inscription_id = $1 AND encaisse = true`, [inscId]
          )
          const nbPaid = paidRows[0].cnt

          // Recréer les échéances manquantes — la 1ère (i=0) toujours encaissée
          for (let i = nbPaid; i < nb; i++) {
            const datePrel = addMonths(dateDebut, i)
            const encaisseAuto = i === 0
            await client.query(
              `INSERT INTO echeances (inscription_id, eleve_id, date_prelevement, montant, encaisse, date_encaissement)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [inscId, id, datePrel, montantEcheance, encaisseAuto, encaisseAuto ? dateDebut : null]
            )
          }

          // Mettre à jour nb_echeances sur l'élève
          await client.query(`UPDATE eleves SET nb_echeances = $1 WHERE id = $2`, [nb, id])
        }
      }

      await client.query('COMMIT')
      return NextResponse.json({ ok: true })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[PATCH /api/eleves/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
