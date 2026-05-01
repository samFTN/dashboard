import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const mois = req.nextUrl.searchParams.get('mois') ?? new Date().toISOString().slice(0, 7)

  try {
    let { rows } = await pool.query(
      `SELECT id::text, mois, budget_journalier, nb_jours, montant_realise,
              ROUND(
                COALESCE(montant_realise, budget_journalier * nb_jours), 2
              ) AS montant_total
       FROM charges_meta_ads WHERE mois = $1`,
      [mois]
    )

    // Créer automatiquement la ligne si elle n'existe pas encore
    if (rows.length === 0) {
      const [year, month] = mois.split('-').map(Number)
      const today = new Date()
      const nbJours = (today.getFullYear() === year && today.getMonth() + 1 === month)
        ? today.getDate()
        : new Date(year, month, 0).getDate() // tous les jours si mois passé

      const { rows: inserted } = await pool.query(
        `INSERT INTO charges_meta_ads (mois, budget_journalier, nb_jours)
         VALUES ($1, 20, $2)
         ON CONFLICT (mois) DO UPDATE SET mois = EXCLUDED.mois
         RETURNING id::text, mois, budget_journalier, nb_jours, montant_realise,
                   ROUND(budget_journalier * nb_jours, 2) AS montant_total`,
        [mois, nbJours]
      )
      rows = inserted
    }

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[GET /api/finances/charges/meta]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mois, budget_journalier, nb_jours, montant_realise } = await req.json()
    if (!mois) return NextResponse.json({ error: 'mois requis' }, { status: 400 })

    const { rows } = await pool.query(
      `INSERT INTO charges_meta_ads (mois, budget_journalier, nb_jours, montant_realise)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (mois) DO UPDATE SET
         budget_journalier = EXCLUDED.budget_journalier,
         nb_jours          = COALESCE(EXCLUDED.nb_jours, charges_meta_ads.nb_jours),
         montant_realise   = EXCLUDED.montant_realise
       RETURNING id::text, mois, budget_journalier, nb_jours, montant_realise,
                 ROUND(COALESCE(montant_realise, budget_journalier * nb_jours), 2) AS montant_total`,
      [mois, budget_journalier ?? 20, nb_jours ?? null, montant_realise ?? null]
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[POST /api/finances/charges/meta]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
