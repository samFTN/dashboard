import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// GET — liste toutes les alertes non résolues
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT
        a.id::text, a.created_at, a.stripe_email, a.stripe_nom,
        a.montant, a.stripe_payment_id, a.statut, a.meta,
        a.eleve_id::text, a.echeance_id::text
       FROM alertes_paiement a
       WHERE a.statut = 'non_assigne'
       ORDER BY a.created_at DESC`
    )
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/finances/alertes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH — assigner ou ignorer une alerte
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { action, eleve_id } = await req.json()

    if (action === 'ignorer') {
      await pool.query(
        `UPDATE alertes_paiement SET statut = 'ignore' WHERE id = $1`,
        [id]
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'assigner' && eleve_id) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Récupère l'alerte
        const { rows: alerteRows } = await client.query(
          `SELECT stripe_email, montant, stripe_payment_id FROM alertes_paiement WHERE id = $1`,
          [id]
        )
        if (alerteRows.length === 0) throw new Error('Alerte introuvable')
        const alerte = alerteRows[0]

        // Trouve la plus ancienne échéance non-encaissée de l'élève avec le bon montant
        const { rows: echeanceRows } = await client.query(
          `SELECT id FROM echeances
           WHERE eleve_id = $1 AND encaisse = false
             AND ABS(montant - $2) < 0.02
           ORDER BY date_prelevement ASC
           LIMIT 1`,
          [eleve_id, alerte.montant]
        )

        if (echeanceRows.length === 0) throw new Error('Aucune échéance correspondante trouvée')
        const echeanceId = echeanceRows[0].id

        // Marque l'échéance encaissée
        const today = new Date().toISOString().slice(0, 10)
        await client.query(
          `UPDATE echeances SET encaisse = true, date_encaissement = $2 WHERE id = $1`,
          [echeanceId, today]
        )

        // Sauvegarde l'email Stripe sur l'élève pour les prochains matchings
        await client.query(
          `UPDATE eleves SET email_paiement = $2 WHERE id = $1 AND email_paiement IS NULL`,
          [eleve_id, alerte.stripe_email]
        )

        // Résout l'alerte
        await client.query(
          `UPDATE alertes_paiement
           SET statut = 'assigne', eleve_id = $2, echeance_id = $3
           WHERE id = $1`,
          [id, eleve_id, echeanceId]
        )

        await client.query('COMMIT')
        return NextResponse.json({ ok: true, echeance_id: echeanceId })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/finances/alertes/[id]]', err)
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
