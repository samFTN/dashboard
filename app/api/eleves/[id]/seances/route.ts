import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { date } = await req.json()
    if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

    // Calcule le prochain numéro de séance
    const { rows: countRows } = await pool.query(
      `SELECT COALESCE(MAX(numero_seance), 0) + 1 AS next_num FROM seances WHERE eleve_id = $1`,
      [id]
    )
    const nextNum = countRows[0].next_num

    const { rows } = await pool.query(
      `INSERT INTO seances (eleve_id, date, numero_seance, alerte_decrochage)
       VALUES ($1, $2, $3, false)
       RETURNING id::text, eleve_id::text, date, numero_seance, alerte_decrochage`,
      [id, date, nextNum]
    )

    return NextResponse.json({ ...rows[0], volet_prof: null, volet_eleve: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/eleves/[id]/seances]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
