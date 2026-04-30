import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const actif = req.nextUrl.searchParams.get('actif') !== 'false'
  try {
    const { rows } = await pool.query(
      `SELECT
        e.id::text, e.nom, e.email, e.telephone,
        e.formule, e.duree_contractuelle_mois,
        e.date_debut, e.date_fin_prevue, e.actif,
        e.mode_paiement, e.montant_total, e.nb_echeances,
        e.semaines_freeze_consommees, e.freeze_actif,
        e.objectifs, e.points_total,
        e.lead_id::text, e.prof_dedie_id,
        e.created_at,
        COUNT(s.id)::int                                     AS nb_seances_realisees,
        COALESCE(BOOL_OR(s.alerte_decrochage), false)        AS has_alerte,
        ROUND(AVG(cre.satisfaction)::numeric, 1)             AS satisfaction_moyenne
      FROM eleves e
      LEFT JOIN seances s            ON s.eleve_id = e.id
      LEFT JOIN compte_rendu_eleve cre ON cre.seance_id = s.id
      WHERE e.actif = $1
      GROUP BY e.id
      ORDER BY e.created_at DESC`,
      [actif]
    )
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/eleves]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Calcule nb_echeances depuis mode_paiement
function nbEcheances(mode: string) {
  if (mode === 'cb_1x') return 1
  if (mode === 'cb_2x') return 2
  if (mode === 'cb_3x') return 3
  return 4 // cb_4x et paypal_4x
}

// Ajoute N mois à une date ISO
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, formule, date_debut, mode_paiement, objectifs } = body

    if (!lead_id || !formule || !date_debut || !mode_paiement) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Récupère les infos du lead
    const { rows: leadRows } = await pool.query(
      `SELECT nom, email, telephone FROM leads WHERE id = $1`,
      [lead_id]
    )
    if (leadRows.length === 0) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }
    const lead = leadRows[0]

    // Récupère duree_mois depuis la table formules
    const { rows: formuleRows } = await pool.query(
      `SELECT duree_mois FROM formules WHERE id = $1`, [formule]
    )
    const dureeMois = formuleRows.length > 0 ? formuleRows[0].duree_mois : 4
    const dateFinPrevue = addMonths(date_debut, dureeMois)
    const nb = nbEcheances(mode_paiement)
    const montantTotal = 597
    const montantEcheance = +(montantTotal / nb).toFixed(2)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Créer l'élève
      const { rows: eleveRows } = await client.query(
        `INSERT INTO eleves
           (nom, email, telephone, lead_id, formule, duree_contractuelle_mois,
            date_debut, date_fin_prevue, prof_dedie_id,
            mode_paiement, montant_total, nb_echeances, objectifs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'axel', $9, $10, $11, $12)
         RETURNING id::text`,
        [
          lead.nom, lead.email, lead.telephone, lead_id,
          formule, dureeMois, date_debut, dateFinPrevue,
          mode_paiement, montantTotal, nb,
          objectifs?.trim() || '',
        ]
      )
      const eleveId = eleveRows[0].id

      // 2. Créer l'inscription financière
      const { rows: inscRows } = await client.query(
        `INSERT INTO inscriptions_financieres
           (eleve_id, date_inscription, formule, mode_paiement, montant_contracte)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id::text`,
        [eleveId, date_debut, formule, mode_paiement, montantTotal]
      )
      const inscId = inscRows[0].id

      // 3. Créer les échéances
      for (let i = 0; i < nb; i++) {
        const datePrelevement = addMonths(date_debut, i)
        const encaisse = mode_paiement === 'paypal_4x' // PayPal verse tout dès le départ
        await client.query(
          `INSERT INTO echeances
             (inscription_id, eleve_id, date_prelevement, montant, encaisse, date_encaissement)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            inscId, eleveId, datePrelevement, montantEcheance,
            encaisse, encaisse ? date_debut : null,
          ]
        )
      }

      // 4. Archiver le lead + lier l'élève
      await client.query(
        `UPDATE leads
         SET eleve_id = $2, statut = 'eleve', archive = true,
             date_archivage = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [lead_id, eleveId]
      )

      await client.query('COMMIT')
      return NextResponse.json({ id: eleveId }, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[POST /api/eleves]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
