import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const TARIF = 22.5

export async function GET(req: NextRequest) {
  const debut = req.nextUrl.searchParams.get('debut')
  const fin = req.nextUrl.searchParams.get('fin')

  if (!debut || !fin) {
    return NextResponse.json({ error: 'Paramètres debut et fin requis' }, { status: 400 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(s.id)::int AS nb_seances
       FROM seances s
       WHERE s.date BETWEEN $1 AND $2`,
      [debut, fin]
    )

    const nb_seances = rows[0].nb_seances ?? 0
    const montant_total = nb_seances * TARIF

    return NextResponse.json({
      nb_seances,
      tarif_par_seance: TARIF,
      montant_total,
    })
  } catch (err) {
    console.error('[GET /api/finances/charges/prof]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
