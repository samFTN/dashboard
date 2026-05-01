import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT
        i.id::text,
        i.eleve_id::text,
        i.date_inscription,
        i.formule,
        i.mode_paiement,
        i.montant_contracte,
        e.nom AS eleve_nom,
        e.email AS eleve_email,
        COALESCE(
          json_agg(
            json_build_object(
              'id',               ec.id::text,
              'date_prelevement', ec.date_prelevement,
              'montant',          ec.montant,
              'encaisse',         ec.encaisse,
              'date_encaissement',ec.date_encaissement
            ) ORDER BY ec.date_prelevement ASC
          ) FILTER (WHERE ec.id IS NOT NULL),
          '[]'::json
        ) AS echeances,
        COALESCE(SUM(CASE WHEN ec.encaisse THEN ec.montant ELSE 0 END), 0) AS montant_encaisse,
        COALESCE(SUM(CASE WHEN NOT ec.encaisse THEN ec.montant ELSE 0 END), 0) AS reste_a_encaisser
      FROM inscriptions_financieres i
      JOIN eleves e ON e.id = i.eleve_id
      LEFT JOIN echeances ec ON ec.inscription_id = i.id
      GROUP BY i.id, e.nom, e.email
      ORDER BY i.date_inscription DESC`
    )
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/finances/inscriptions]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
